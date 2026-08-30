/* Sophrosyne — 谥号 / 庙号结算（按登基以来各指标增减，删除归一化指数）
 * 政绩 = 各项指标「登基→驾崩」增减的加权平均（腐败反向）；制度成色 = 固化度；属性 = 七属性均值。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Score = (function () {
  const Metrics = window.Sophrosyne.Metrics;
  const Scenes = window.Sophrosyne.Scenes;
  const ATTR_KEYS = Scenes.ATTR_KEYS;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50; }

  const WEIGHTS = {
    population: 1, treasury: 1, grain: 1, army: 1, territory: 0.5, farmland: 0.5,
    workshop: 1, merchant: 1, tech: 2, infra: 1, xiuCai: 0.5, juRen: 0.5, jinShi: 1,
    prestige: 2, support: 1, order: 1, diplomacy: 1, training: 0.5, equipment: 0.5,
  };

  function govScore(snap) {
    const base = snap.baseline || {};
    const cur = snap.metrics || {};
    let sum = 0, wsum = 0;
    for (const k of Metrics.STORED_KEYS) {
      const w = WEIGHTS[k] || 1;
      const b = base[k] || 0, c = cur[k] || 0;
      let rel;
      if (k === "corruption") rel = (b - c) / 50;                       // 腐败越低越好
      else if (Metrics.DEFS[k].max === 100) rel = (c - b) / 50;          // 0-100，越高越好
      else rel = b > 0 ? (c - b) / b : 0;                                // 无上限，看相对增减
      sum += w * rel;
      wsum += w;
    }
    const avgRel = wsum ? sum / wsum : 0;
    const growthScore = clamp(50 + avgRel * 60, 0, 100);
    const diligence = clamp((snap.chainLen || 0) * 5, 0, 100);
    return clamp(growthScore * 0.7 + diligence * 0.3, 0, 100);
  }

  function sysScore(snap) {
    const policies = snap.policies || [];
    const cornerstone = policies.filter(p => p.status === "active" && p.solidity >= 60).length;
    const inst = clamp(cornerstone * 25, 0, 100);
    const totalCollapses = policies.reduce((s, p) => s + (p.collapseCount || 0), 0);
    const stability = clamp(100 - totalCollapses * 10, 0, 100);
    return clamp(inst * 0.6 + stability * 0.4, 0, 100);
  }

  function scoreReign(snap) {
    const years = snap.years || 1;
    const isFirst = !!snap.isFirst;
    const goals = snap.goals || [];
    const goalDone = goals.filter(g => g.status === "done").length;
    const goalFailed = goals.filter(g => g.status === "failed").length;
    const hasGoals = goalDone + goalFailed > 0;

    const gov = clamp(govScore(snap) + (snap.subGoalDone || 0) * 3, 0, 100);
    const goalScore = hasGoals ? clamp((goalDone / (goalDone + goalFailed)) * 100, 0, 100) : 0;
    const sys = sysScore(snap);
    const vals = ATTR_KEYS.map(k => snap.attributes[k] != null ? snap.attributes[k] : 50);
    const attr = clamp(avg(vals), 0, 100);

    const total = clamp(
      hasGoals ? gov * 0.35 + goalScore * 0.30 + sys * 0.20 + attr * 0.15
               : gov * 0.65 + sys * 0.20 + attr * 0.15,
      0, 100
    );

    const posthumous = posthumousName({ total, gov, sys, attr, years });
    const temple = templeName({ isFirst, total, gov, sys });

    const out = {
      total: Math.round(total), gov: Math.round(gov), sys: Math.round(sys), attr: Math.round(attr),
      goal: Math.round(goalScore), years, posthumous, temple, hasGoals, goalDone, goalFailed,
    };
    out.reason = buildReason(out);
    return out;
  }

  function posthumousName(s) {
    if (s.years < 20) {
      if (s.total >= 60) return "怀";
      if (s.total >= 40) return "思";
      if (s.total >= 20) return "哀";
      return "悼";
    }
    if (s.total < 25) return s.attr < 30 ? "荒" : "幽";
    if (s.total < 45) return "惠";
    const top = Math.max(s.gov, s.sys, s.attr);
    if (s.sys === top) return "文";
    if (s.gov === top) return "武";
    return "仁";
  }

  function templeName(s) {
    if (s.isFirst) return "太祖";
    if (s.total < 25) return null;
    if (s.sys >= 80) return "世宗";
    if (s.gov >= 80) return "太宗";
    if (s.total >= 55) return "仁宗";
    if (s.total >= 30) return "神宗";
    return "思宗";
  }

  function buildReason(s) {
    const parts = ["在位 " + s.years + " 年", "政绩 " + s.gov];
    if (s.hasGoals) parts.push("武功（大目标 " + s.goalDone + " 成 " + s.goalFailed + " 败）");
    parts.push("制度成色 " + s.sys + "，个人属性 " + s.attr);
    return parts.join("，") + "。故谥「" + s.posthumous + "」" +
      (s.temple ? "，庙号「" + s.temple + "」。" : "，不入奉先殿。");
  }

  return { scoreReign, posthumousName, templeName, govScore, sysScore, ATTR_KEYS };
})();
