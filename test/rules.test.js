/* Sophrosyne — 规则测试：谥号结算（score）· 廷议（verdict）· 存档净化（store.revive）· 数值消毒（applyEffects）· LLM JSON 提取
 * 运行：node test/rules.test.js
 */
require("./_env.js");
const Sophrosyne = globalThis.Sophrosyne;
const Engine = Sophrosyne.Engine, Store = Sophrosyne.Store, Score = Sophrosyne.Score,
      Metrics = Sophrosyne.Metrics, LLM = Sophrosyne.LLM;

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ok - " + msg); }
  else { console.error("  FAIL - " + msg); failed++; }
}

function freshState() {
  return Engine.tick(Store.reset());
}

// —— 谥号结算（短寿档位边界）——
console.log("[1] 谥号：在位 < 20 年档位");
assert(Score.posthumousName({ total: 70, gov: 70, sys: 50, attr: 50, years: 5 }) === "怀", "total≥60 → 怀");
assert(Score.posthumousName({ total: 40, gov: 40, sys: 50, attr: 50, years: 5 }) === "思", "40≤total<60 → 思");
assert(Score.posthumousName({ total: 20, gov: 20, sys: 50, attr: 50, years: 5 }) === "哀", "20≤total<40 → 哀");
assert(Score.posthumousName({ total: 10, gov: 10, sys: 50, attr: 50, years: 5 }) === "悼", "total<20 → 悼");

console.log("[2] 谥号：在位 ≥ 20 年档位");
assert(Score.posthumousName({ total: 15, gov: 15, sys: 10, attr: 20, years: 25 }) === "荒", "total<25 且属性低 → 荒");
assert(Score.posthumousName({ total: 15, gov: 15, sys: 10, attr: 40, years: 25 }) === "幽", "total<25 且 attr≥30 → 幽");
assert(Score.posthumousName({ total: 30, gov: 30, sys: 30, attr: 50, years: 25 }) === "惠", "25≤total<45 → 惠");
assert(Score.posthumousName({ total: 60, gov: 50, sys: 70, attr: 60, years: 25 }) === "文", "sys 最高 → 文");
assert(Score.posthumousName({ total: 60, gov: 70, sys: 50, attr: 60, years: 25 }) === "武", "gov 最高 → 武");
assert(Score.posthumousName({ total: 60, gov: 60, sys: 60, attr: 70, years: 25 }) === "仁", "attr 最高 → 仁");

console.log("[3] 庙号");
assert(Score.templeName({ isFirst: true, total: 10, gov: 10, sys: 10 }) === "太祖", "首任 → 太祖");
assert(Score.templeName({ isFirst: false, total: 15, gov: 15, sys: 10 }) === null, "total<25 → 不入太庙");
assert(Score.templeName({ isFirst: false, total: 60, gov: 50, sys: 85 }) === "世宗", "sys≥80 → 世宗");
assert(Score.templeName({ isFirst: false, total: 60, gov: 85, sys: 50 }) === "太宗", "gov≥80 → 太宗");

console.log("[4] 政绩分：baseline 与 metrics 独立（别名 bug 回归锚）");
{
  const baseline = Metrics.initialMetrics();
  const metrics = Metrics.initialMetrics();
  metrics.population = baseline.population * 1.5;  // 人口 +50%
  metrics.treasury = baseline.treasury + 100000;   // 国库 +10 万
  metrics.prestige = baseline.prestige * 2;        // 皇威 +100%
  const common = { chainLen: 0, policies: [], attributes: {}, years: 10, isFirst: true };
  const s = Score.scoreReign({ baseline, metrics, ...common });
  assert(s.gov >= 38, "多项真实增减应使政绩分明显高于别名退化值（实际 " + s.gov + "）");
  const aliased = Score.scoreReign({ baseline: metrics, metrics, ...common });
  assert(aliased.gov === 35, "baseline 与 metrics 同对象时政绩分退化为 35（复现旧 bug 特征）");
}

// —— 廷议（verdict）——
console.log("[5] 廷议：废黜与成例");
{
  const state = freshState();
  state.chains.main.records.push({ number: 1 }, { number: 2 });
  Engine.verdict(state, "main", "precedent", "回复消息不算违规");
  assert(state.chains.main.precedents.length === 1, "下诏成例入册");
  assert(state.chains.main.records.length === 2, "成例不清纪录");
  Engine.verdict(state, "main", "collapse", null);
  assert(state.chains.main.records.length === 0, "废黜清零纪录");
  assert(state.activeFocus === null, "废黜同时终止临朝");
}
console.log("[6] 廷议：主要链崩 → 次要链继位");
{
  const state = freshState();
  state.chains.main.records.push({ number: 1 });
  state.chains.reserve.records.push({ number: 1 }, { number: 2 });
  Engine.verdict(state, "main", "collapse", null);
  assert(state.chains.main.records.length === 2, "次要政务继位承续旧勋");
  assert(state.chains.reserve.records.length === 0, "次要链清空");
}

// —— 存档净化（store.revive）——
console.log("[7] store.revive：坏输入拒绝、缺字段补齐");
{
  assert(Store.revive(null) === null, "null 拒绝");
  assert(Store.revive("junk") === null, "字符串拒绝");
  assert(Store.revive({ reign: 1 }) === null, "缺 chains/policies 拒绝");
  const r = Store.revive({ reign: { metrics: { population: 100 } }, chains: {}, policies: [] });
  assert(r && r.reign && r.reign.metrics.population === 100, "合法数据放行且保留自定义值");
  assert(Array.isArray(r.log) && r.log.length === 0, "缺失字段以默认档补齐");
}
console.log("[8] store.deepMerge：null 数组不炸");
{
  const r = Store.revive({ reign: { metrics: {} }, chains: {}, policies: [], log: null });
  assert(Array.isArray(r.log), "旧档 log:null 被替换为数组，unshift 不会 TypeError");
}

// —— 数值消毒（applyEffects）——
console.log("[9] applyEffects：LLM 异常数值消毒");
{
  const m = Metrics.initialMetrics();
  Metrics.applyEffects(m, { treasury: "1000" });           // 字符串数字
  assert(m.treasury === m.population * 0 + 800000 + 1000 || typeof m.treasury === "number", "字符串数字强转为数值（无拼接）");
  const m2 = Metrics.initialMetrics();
  Metrics.applyEffects(m2, { treasury: 1e9 });             // 天文数字 → 按现值 5%+100 封顶
  assert(m2.treasury <= 800000 * 1.06 + 200, "无上限指标单次增幅被封顶（实际 " + m2.treasury + "）");
  const m3 = Metrics.initialMetrics();
  Metrics.applyEffects(m3, { support: "abc", order: NaN }); // 非有限数
  assert(m3.support === 50 && m3.order === 60, "NaN/非法字符串归零不变");
  const m4 = Metrics.initialMetrics();
  Metrics.applyEffects(m4, { support: 500 });               // 0-100 指标单次限幅
  assert(m4.support === 65, "0-100 指标单次至多 +15（50→65）");
}

// —— LLM JSON 提取 ——
console.log("[10] extractJson");
{
  const good = LLM.extractJson('前言```json\n{"entries":[]}\n```后记');
  assert(good && Array.isArray(good.entries), "容忍围栏与首尾杂文");
  assert(LLM.extractJson("没有任何大括号") === null, "无 JSON → null");
  const repaired = LLM.extractJson('{"a":1');
  assert(repaired && repaired.a === 1, "截断 JSON 自动补齐括号可解析");
}

if (failed) { console.error("RULES FAIL — " + failed + " 项断言未过"); process.exit(1); }
console.log("RULES OK — 所有断言通过");
