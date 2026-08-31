/* Sophrosyne — 史官结算（提案—确认）+ LLM 草案严格校验 回归测试（0.5.0） */
global.window = globalThis;
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js"); require("../js/scenes.js"); require("../js/migrate.js"); require("../js/store.js");
require("../js/score.js"); require("../js/engine.js"); require("../js/llm.js");
const E = globalThis.Sophrosyne.Engine, Store = globalThis.Sophrosyne.Store;
const LLM = globalThis.Sophrosyne.LLM;
let failed = 0;
function assert(c,m){ if(c){console.log("  ok -",m);} else {console.error("  FAIL -",m); failed++;} }
function freshState(){ return E.tick(Store.reset()); }

(async function () {

console.log("[1] sanitizeDraft 严格校验（合法键/数值封顶/长度/条目上限）");
{
  const longTitle = "帝".repeat(100), longNote = "史".repeat(250);
  const entries = [
    { title: longTitle, note: longNote, effects: { order: 100, treasury: 999999, bogus: 5, corruption: "xx" } },
    { title: "工部营缮", note: "一句", effects: { infra: 12 } },
    { title: "", note: "", effects: {} },
    { title: "负向", effects: { order: -999 } },
  ];
  for (let i = 0; i < 30; i++) entries.push({ title: "条目" + i, effects: { tech: 1 } });
  const d = LLM.sanitizeDraft({ entries });
  assert(d && Array.isArray(d.entries), "返回含 entries 的草案");
  assert(d.entries[0].title.length === 80, "标题截断到 80 字");
  assert(d.entries[0].note.length === 200, "评语截断到 200 字");
  assert(d.entries[0].effects.order === 15, "0-100 指标 +100 封顶为 +15");
  assert(d.entries[0].effects.treasury === 100000, "无上限指标 999999 封顶为 100000");
  assert(!("bogus" in d.entries[0].effects) && !("corruption" in d.entries[0].effects), "非法键/非数值被丢弃");
  assert(d.entries[2].effects.order === -15, "0-100 指标负向封顶为 -15");
  assert(d.entries.length <= 24, "条目数封顶为 24");
  assert(LLM.sanitizeDraft(null) === null && LLM.sanitizeDraft({ entries: "x" }) === null, "非法结构返回 null");
}

console.log("[2] proposeSettlement 无 LLM → 本地确定性草案");
{
  const s = freshState();
  s.reign.todayTasks = [{ sceneId: "audience", realTask: "背单词", chain: "main", ts: Date.now() }];
  const r = await E.proposeSettlement(s, false);
  assert(r && r.source === "fallback", "来源标记为 fallback");
  assert(r.draft.entries.length === 1, "每项今日事务一条草案");
  assert(r.draft.entries[0].title.indexOf("御门听政") >= 0, "草案标题引用场景政务");
}

console.log("[3] applySettlementDraft 确认后入账（封顶 + 清空今日事务）");
{
  const s = freshState();
  s.reign.todayTasks = [{ sceneId: "audience", realTask: "", chain: "main", ts: Date.now() }];
  const before = s.reign.metrics.order;
  const r = E.applySettlementDraft(s, { title: "", note: "", entries: [{ title: "测试政务", note: "史官评语", effects: { order: 999, bogus: 1 } }] });
  assert(r && r.applied === 1, "应用 1 条草案");
  assert(s.reign.todayTasks.length === 0, "确认后清空今日事务");
  assert(Math.abs(s.reign.metrics.order - (before + 15)) <= 1, "入账按 0-100 指标 ±15 封顶");
  assert(s.log.length >= 1 && s.log[0].text.indexOf("史官评语") >= 0, "写入起居注含标题与评语");
}

if (failed) { console.error("SETTLE FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("SETTLE OK — 提案—确认结算与草案校验通过");

})();
