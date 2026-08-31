/* Sophrosyne — 引擎冒烟测试 v5（阶段 A + B） */
require("./_env.js");

const E = globalThis.Sophrosyne.Engine;
let state = E.init();
// 开发模式：让临朝即时可功成，便于冒烟测试走完「开始→功成」流程（计时规则由 timing.test 覆盖）
state.settings.devMode = true;

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("  ok -", msg);
}
function yesterdayStr() {
  const d = new Date(Date.now() - 86400000);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function main() {
  console.log("[1] 初始化（年龄/寿命）");
  assert(state.reign.age === 18, "初始 18 岁");
  assert(state.reign.lifeSpan >= 30, "寿命已计算（" + state.reign.lifeSpan + "）");

  console.log("[2] 临朝 + 功成");
  E.startFocus(state, "audience", "main", "背英语单词200个");
  let r = E.completeFocus(state);
  assert(r.number === 1, "主要政务 #1");
  assert(state.reign.todayTasks.length === 1, "今日事务 +1");
  assert(state.reign.attributes.intellect === 51, "智力 +1");

  console.log("[3] 岁末结算（事务已清，当日年龄不变）");
  await E.settleYear(state, false);
  assert(state.reign.todayTasks.length === 0, "事务已清");
  assert(state.reign.age === 18, "结算当日年龄不变（仍 18 岁）");

  console.log("[3b] 跨日（年龄 +1，一天 = 一年）");
  state.meta.lastTickDate = yesterdayStr();
  E.tick(state);
  assert(state.reign.age === 19, "过了一天，君主年长一岁");
  assert(state.reign.metrics.treasury > 800000, "国库累计岁入");

  console.log("[4] 预约 → 威望");
  const p0 = state.reign.attributes.prestige;
  E.scheduleAppointment(state, "audience");
  E.fulfillAppointment(state);
  assert(state.reign.attributes.prestige === p0 + 1, "履约威望 +1");
  E.completeFocus(state);
  const p1 = state.reign.attributes.prestige;
  E.scheduleAppointment(state, "read");
  E.missAppointment(state);
  assert(state.reign.attributes.prestige === p1 - 1, "失信威望 -1");

  console.log("[5] 制度树：升级 / 强化 / 复活");
  const pol = E.addPolicy(state, { name: "子时后不碰手机", group: "作息" });
  assert(pol.ok, "颁行制度");
  const pid = pol.policy.id;
  let p = state.policies.find(x => x.id === pid);
  p.solidity = 100; p.survivalDays = 20;
  assert(E.upgradePolicy(state, pid).ok, "升级");
  p = state.policies.find(x => x.id === pid);
  assert(p.level === 1 && p.revive === 1 && p.solidityCap === 150, "升到 1 级、复活 1 次、上限 150");
  assert(E.strengthenPolicy(state, pid).ok, "强化");
  const c1 = E.collapsePolicy(state, pid);
  assert(c1.revived === true, "复活免删（降级）");
  const c2 = E.collapsePolicy(state, pid);
  assert(c2.collapsed === true, "复活耗尽后诏废");

  console.log("[6] 突发事件逐项裁决");
  state.meta.lastPolicyAddDate = null;
  const p2 = E.addPolicy(state, { name: "晨起不碰手机", group: "作息" });
  const pid2 = p2.policy.id;
  E.adjudicateEvent(state, { text: "偶感风寒", decisions: [{ policyId: pid2, decision: "precedent" }] });
  const pp2 = state.policies.find(x => x.id === pid2);
  assert(pp2.status === "active", "立为成例：制度保持在线");
  assert(pp2.rule && pp2.rule.exceptions.length === 1, "成例写入制度例外");
  E.adjudicateEvent(state, { text: "出差数日", decisions: [{ policyId: pid2, decision: "collapse" }] });
  assert(state.policies.find(x => x.id === pid2).status === "fallen", "判失守：制度诏废");

  console.log("[7] 阶段目标（政务总数 / 国力指标，可多选）");
  const g = E.addGoal(state, { name: "考研上岸", flavor: "击退游牧" });
  const totalBefore = state.chains.main.records.length + state.chains.reserve.records.length;
  E.addSubGoal(state, g.goal.id, { name: "勤政安民", criteria: [
    { type: "focus-total", count: totalBefore + 1 },
    { type: "metric", key: "support", target: 0 },
  ] });
  assert(g.goal.subGoals[0].done === false, "多标准未全达成前不完成");
  E.startFocus(state, "audience", "main", "背单词");
  E.completeFocus(state);
  assert(g.goal.subGoals[0].done === true, "政务总数达标 → 阶段目标达成");
  assert(state.reign.attributes.prestige >= p1 + 1, "阶段目标 +威望");

  console.log("[8] 子嗣");
  const heir = E.createHeir(state, state.reign.attributes);
  assert(state.heirs.length >= 1 && heir.age === 0, "子嗣出生（有年龄）");
  assert(heir.attributes.intellect >= 0 && heir.attributes.prestige >= 0, "子嗣属性继承+扰动");
  state.meta.lastTrainDate = null;
  assert(E.trainHeir(state, heir.id).ok, "培养子嗣");

  console.log("[9] 驾崩（子嗣即位，规则谥号）");
  const res = await E.abdicate(state, "禅位", { mode: "rule", heirId: heir.id });
  assert(state.dynasty.lineage.length === 1, "太庙载入");
  assert(state.dynasty.lineage[0].score.reason, "谥号依据");
  assert(state.dynasty.lineage[0].veritableRecords.length > 0, "实录归档");
  assert(state.reign.age === Math.max(6, heir.age), "子嗣即位，年龄继承");

  console.log("[10] 驾崩（LLM 未配置回退规则）");
  const res2 = await E.abdicate(state, "禅位", { mode: "llm" });
  assert(res2.score && res2.score.posthumous, "LLM 失败回退规则评定");

  console.log("\nSMOKE OK — 所有断言通过");
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
