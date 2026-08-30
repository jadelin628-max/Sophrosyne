/* Sophrosyne — 国力指标模型（存量 + 派生 + 自然增长率 + 岁入累计 + 多指标增减）
 * 指标分为「存量（直接存储）」与「派生（由公式实时计算）」。
 * 数值均为可调默认值；具体政务/制度的增减在结算时由大模型决定（无 LLM 时用场景默认增减兜底）。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Metrics = (function () {
  // —— 存量指标定义：key -> { name, unit, initial, min, max(null=∞), growth(年自然增长率) } ——
  const DEFS = {
    territory:  { name: "疆域", unit: "县",   initial: 13,       min: 0, max: null,  growth: 0.001 },
    population: { name: "人口", unit: "口",   initial: 3000000,  min: 0, max: null,  growth: 0.0015 },
    farmland:   { name: "耕地", unit: "亩",   initial: 1000000,  min: 0, max: null,  growth: 0.002 },
    workshop:   { name: "工坊", unit: "座",   initial: 2000,     min: 0, max: null,  growth: 0.003 },
    merchant:   { name: "商户", unit: "户",   initial: 3000,     min: 0, max: null,  growth: 0.003 },
    treasury:   { name: "国库", unit: "两",   initial: 800000,   min: 0, max: null,  growth: 0 },       // 由岁入累计 + 政务驱动
    grain:      { name: "粮储", unit: "石",   initial: 600000,   min: 0, max: null,  growth: 0.001 },
    army:       { name: "军队", unit: "人",   initial: 80000,    min: 0, max: null,  growth: 0.001 },
    training:   { name: "训练率", unit: "%",  initial: 40,       min: 0, max: 100,   growth: -0.005 },
    equipment:  { name: "装备率", unit: "%",  initial: 35,       min: 0, max: 100,   growth: -0.005 },
    support:    { name: "民心", unit: "",     initial: 50,       min: 0, max: 100,   growth: -0.002 },
    order:      { name: "治安", unit: "",     initial: 60,       min: 0, max: 100,   growth: -0.005 },
    corruption: { name: "腐败", unit: "",     initial: 30,       min: 0, max: 100,   growth: 0.003 },
    prestige:   { name: "皇威", unit: "",     initial: 50,       min: 0, max: null,  growth: 0.001 },
    xiuCai:     { name: "秀才", unit: "人",   initial: 2000,     min: 0, max: null,  growth: 0.003 },
    juRen:      { name: "举人", unit: "人",   initial: 300,      min: 0, max: null,  growth: 0.002 },
    jinShi:     { name: "进士", unit: "人",   initial: 80,       min: 0, max: null,  growth: 0.001 },
    tech:       { name: "科技", unit: "",     initial: 10,       min: 0, max: null,  growth: 0.005 },
    infra:      { name: "基建", unit: "",     initial: 30,       min: 0, max: null,  growth: 0.001 },
    diplomacy:  { name: "外交", unit: "",     initial: 40,       min: 0, max: 100,   growth: -0.003 },
  };
  const STORED_KEYS = Object.keys(DEFS);

  function clamp(v, lo, hi) {
    if (lo != null && v < lo) return lo;
    if (hi != null && v > hi) return hi;
    return v;
  }

  function initialMetrics() {
    const m = {};
    for (const k of STORED_KEYS) m[k] = DEFS[k].initial;
    return m;
  }

  // —— 派生指标（由存量实时计算）——
  function computeDerived(m) {
    const revenue = (m.merchant * 0.6 + m.workshop * 1.5 + m.farmland * 0.03 + m.population * 0.005) * (1 - m.corruption / 250);
    const living = clamp(0.4 * m.support + 0.3 * m.order + 0.3 * Math.min(100, m.tech + m.infra * 0.5), 0, 100);
    const unemployment = clamp(30 - m.workshop / 200 - m.farmland / 100000, 0, 100);
    const cultureScore = m.xiuCai + m.juRen * 5 + m.jinShi * 20;
    return { revenue, living, unemployment, cultureScore };
  }

  // —— 自然增长（每年，小量；可调）——
  function applyNaturalGrowth(m) {
    for (const k of STORED_KEYS) {
      const g = DEFS[k].growth;
      if (g) m[k] = clamp(m[k] * (1 + g), DEFS[k].min, DEFS[k].max);
    }
    return m;
  }

  // —— 多指标增减（effects: { key: delta }，可增可减）——
  // LLM 可能返回字符串/异常数值：一律 Number 强转，非有限数归零；
  // 并限制单次增减幅值（LLM 路径无天然量级约束，防一次跑偏输出把指标拉爆）。
  const EFFECT_CAP_BOUNDED = 15;   // 0-100 指标单次增减上限
  const EFFECT_CAP_REL = 0.05;     // 无上限指标：±(现值 × 5% + 100)
  const EFFECT_CAP_ABS = 100;

  function sanitizeDelta(k, cur, raw) {
    let v = Number(raw);
    if (!isFinite(v)) return 0;
    const def = DEFS[k];
    const cap = (def.max != null) ? EFFECT_CAP_BOUNDED : Math.abs(cur) * EFFECT_CAP_REL + EFFECT_CAP_ABS;
    return clamp(v, -cap, cap);
  }

  function applyEffects(m, effects) {
    if (!effects) return m;
    for (const k of Object.keys(effects)) {
      if (!(k in DEFS)) continue;
      const cur = Number(m[k]) || 0;
      m[k] = clamp(cur + sanitizeDelta(k, cur, effects[k]), DEFS[k].min, DEFS[k].max);
    }
    return m;
  }

  // —— 快照与增减（用于谥号按登基以来增减结算）——
  function snapshot(m) {
    const s = {};
    for (const k of STORED_KEYS) s[k] = m[k];
    return s;
  }
  function deltas(baseline, current) {
    const d = {};
    for (const k of STORED_KEYS) d[k] = (current[k] || 0) - (baseline[k] || 0);
    return d;
  }

  return { DEFS, STORED_KEYS, initialMetrics, computeDerived, applyNaturalGrowth, applyEffects, snapshot, deltas, clamp };
})();
