/* Sophrosyne — 双语起居录替换 + 国策风味名/评述 + 摘要压缩（0.6.0） */
global.window = globalThis;
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js"); require("../js/scenes.js"); require("../js/migrate.js"); require("../js/store.js");
require("../js/score.js"); require("../js/engine.js");
const E = globalThis.Sophrosyne.Engine, Store = globalThis.Sophrosyne.Store;
let failed = 0;
function assert(c,m){ if(c){console.log("  ok -",m);} else {console.error("  FAIL -",m); failed++;} }
function freshState(){ return E.tick(Store.reset()); }

(async function () {

console.log("[1] 结算后双语起居录替换待结算占位 + 摘要生成");
{
  const s = freshState();
  E.startFocus(s, "audience", "main", "背单词");
  s.activeFocus.endsAt = Date.now() - 1000;
  E.completeFocus(s);
  assert(s.log.some(e => e.pending), "功成后有待结算占位");
  const r = await E.proposeSettlement(s, false);
  assert(r.draft.entries[0].classical && r.draft.entries[0].modern, "本地常例草案含古体/白话");
  E.applySettlementDraft(s, r.draft);
  assert(!s.log.some(e => e.pending), "待结算占位被移除");
  assert(s.log[0].classical && s.log[0].modern, "起居录为双语条目");
  assert(s.reign.todayTasks.length === 0, "今日事务清空");
  assert(typeof s.reign.digest === "string" && s.reign.digest.length > 0, "生成摘要 digest");
}

console.log("[2] 国策风味名与评述回填");
{
  const s = freshState();
  const g = E.addGoal(s, { name: "考研上岸", flavor: "" }).goal;
  assert(g.title === "", "未填风味时 title 为空");
  E.applySettlementDraft(s, { entries: [], goalTitles: [{ goalId: g.id, title: "勤学兴教" }], goalVerdicts: [{ goalId: g.id, verdict: "推进有成" }] });
  assert(g.title === "勤学兴教" && g.verdict === "推进有成", "国策风味名与评述写入");
}

console.log("[3] compressRecords 长度上限");
{
  const s = freshState();
  const entries = [];
  for (let i = 0; i < 40; i++) entries.push({ classical: "帝御乾清宫，决狱数十，政通人和，第" + i + "条。" });
  const out = E.compressRecords(entries, 8, 120);
  assert(out.length <= 120, "摘要截断到上限内");
}

console.log("[4] 典章制度风味化名回填");
{
  const s = freshState();
  const p = E.addPolicy(s, { name: "子时后不碰手机", group: "作息" }).policy;
  assert(p.title === "", "新建制度 title 为空");
  E.applySettlementDraft(s, { entries: [], policyTitles: [{ policyId: p.id, title: "宵禁锁钥" }] });
  assert(p.title === "宵禁锁钥", "制度风味化名写入");
}

if (failed) { console.error("SETTLE-V2 FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("SETTLE-V2 OK — 双语起居录/国策风味化/摘要压缩通过");

})();
