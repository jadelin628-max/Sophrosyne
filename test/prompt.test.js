/* Sophrosyne — LLM 提示词 / 限额 / 草案校验（0.6.0） */
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

console.log("[1] 默认提示词四类齐全且 prompt() 覆盖/回退");
{
  assert(LLM.DEFAULT_PROMPTS && typeof LLM.DEFAULT_PROMPTS.system === "string", "默认 system 提示词存在");
  assert(LLM.DEFAULT_PROMPTS.settle && LLM.DEFAULT_PROMPTS.posthumous && LLM.DEFAULT_PROMPTS.accession, "默认 settle/posthumous/accession 提示词存在");
  const s = freshState();
  for (const k of ["system", "settle", "posthumous", "accession"]) {
    assert(LLM.prompt(s, k) === LLM.DEFAULT_PROMPTS[k], k + " 未覆盖时回退默认");
  }
  s.settings.prompts = { system: "自定义人设", settle: "自定义结算", posthumous: "自定义议定先帝", accession: "自定义即位" };
  for (const k of ["system", "settle", "posthumous", "accession"]) {
    assert(LLM.prompt(s, k) === s.settings.prompts[k], k + " 覆盖生效");
  }
  s.settings.prompts.settle = "  ";
  assert(LLM.prompt(s, "settle") === LLM.DEFAULT_PROMPTS.settle, "空白覆盖回退默认");
}

console.log("[2] truncate 截断");
{
  assert(LLM.truncate("1234567890", 4) === "1234", "超长截断");
  assert(LLM.truncate("abc", 10) === "abc", "不超长不变");
}

console.log("[3] sanitizeDraft 校验新增字段（双语/国策/评述）");
{
  const d = LLM.sanitizeDraft({
    entries: [
      { title: "帝御乾清宫", effects: { order: 999 }, classical: "古体", modern: "白话", note: "评" },
      { title: "第二条", effects: { bogus: 5 } },
    ],
    goalTitles: [{ goalId: "g1", title: "勤学兴教" }, { goalId: "", title: "x" }],
    goalVerdicts: [{ goalId: "g1", verdict: "推进有成" }],
    subGoalVerdicts: [{ subGoalId: "sg1", verdict: "达成" }],
    policyTitles: [{ policyId: "p1", title: "宵禁锁钥" }, { policyId: "", title: "x" }],
  });
  assert(d && d.entries.length === 2, "条目数正确");
  assert(d.entries[0].classical === "古体" && d.entries[0].modern === "白话", "双语字段保留");
  assert(d.entries[0].effects.order === 15, "效果值封顶");
  assert(d.goalTitles.length === 1 && d.goalTitles[0].goalId === "g1" && d.goalTitles[0].title === "勤学兴教", "国策风味名校验");
  assert(d.goalVerdicts.length === 1 && d.goalVerdicts[0].verdict === "推进有成", "国策评述校验");
  assert(d.subGoalVerdicts.length === 1 && d.subGoalVerdicts[0].subGoalId === "sg1", "阶段目标评述校验");
  assert(d.policyTitles.length === 1 && d.policyTitles[0].policyId === "p1" && d.policyTitles[0].title === "宵禁锁钥", "典章制度风味名校验");
}

console.log("[4] max_tokens 默认与配置读取");
{
  const s = freshState();
  assert(s.settings.llm.maxTokens === 4096, "默认 maxTokens 为 4096");
  s.settings.llm.maxTokens = 99999;
  assert(LLM.config(s).maxTokens === 99999, "settings.llm.maxTokens 读取（chat 内部 clamp 到 512–16384）");
}

console.log("[5] extractJson 容错（代码围栏 / 截断修复）");
{
  const full = '{"entries":[{"title":"x","effects":{"order":2}}]}';
  assert(LLM.extractJson("```json\n" + full + "\n```").entries.length === 1, "剥离 markdown 代码围栏");
  const truncated = '{"entries":[{"title":"x","effects":{"order":2}';
  const r = LLM.extractJson(truncated);
  assert(r && r.entries && r.entries[0].effects.order === 2, "截断 JSON 补齐括号后可解析");
  assert(LLM.extractJson("这不是 JSON") === null, "无 JSON 返回 null");
}

if (failed) { console.error("PROMPT FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("PROMPT OK — 提示词/限额/草案校验通过");
