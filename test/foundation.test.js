/* Sophrosyne — 地基单元测试（指标模型 + 场景模板） */
global.window = globalThis;
require("../js/metrics.js");
require("../js/scenes.js");

const M = globalThis.Sophrosyne.Metrics;
const Scenes = globalThis.Sophrosyne.Scenes;

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("  ok -", msg);
}

console.log("[1] 指标模型");
assert(M.STORED_KEYS.length === 20, "20 项存量指标");
const m = M.initialMetrics();
assert(m.population === 3000000, "人口 300 万口");
assert(m.treasury === 800000, "国库 80 万两");

console.log("[2] 派生指标");
const d = M.computeDerived(m);
assert(d.revenue > 0, "岁入为正（" + Math.round(d.revenue) + " 两/年）");
assert(d.living >= 0 && d.living <= 100, "生活水平 0-100");
assert(d.cultureScore === 5100, "文治总分 = 秀才 + 举人×5 + 进士×20");

console.log("[3] 自然增长");
M.applyNaturalGrowth(m);
assert(m.population > 3000000, "人口自然增长");

console.log("[4] 多指标增减（可增可减）");
const treBefore = m.treasury, supBefore = m.support, corBefore = m.corruption;
M.applyEffects(m, { treasury: 1000, support: 5, corruption: -2 });
assert(m.treasury === treBefore + 1000, "国库 +1000");
assert(Math.abs(m.support - (supBefore + 5)) < 1e-9, "民心 +5");
assert(Math.abs(m.corruption - (corBefore - 2)) < 1e-9, "腐败 -2");
M.applyEffects(m, { treasury: -5000 });
assert(m.treasury === treBefore + 1000 - 5000, "国库可被消耗");

console.log("[5] 快照与增减");
const base = M.snapshot(m);
M.applyEffects(m, { population: 100000 });
const deltas = M.deltas(base, m);
assert(deltas.population === 100000, "人口增减 +10 万");

console.log("[6] 场景模板");
assert(Scenes.all().length === 24, "24 个场景");
const s = Scenes.get("audience");
assert(s && s.domain === "前朝", "御门听政 · 前朝");
assert(s.appointment === "沐浴更衣·备朝", "预约前置绑定");
assert(s.defaultEffects.prestige === 2, "默认增减（皇威 +2）");
assert(Scenes.byDomain("内廷").length >= 10, "内廷事务 ≥10 个");

console.log("\nFOUNDATION OK — 所有断言通过");
