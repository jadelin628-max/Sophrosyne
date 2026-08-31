/* Sophrosyne — 金口玉言（预约链）回归测试（0.6.0） */
global.window = globalThis;
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js"); require("../js/scenes.js"); require("../js/migrate.js"); require("../js/store.js");
require("../js/score.js"); require("../js/engine.js");
const E = globalThis.Sophrosyne.Engine, Store = globalThis.Sophrosyne.Store;
let failed = 0;
function assert(c,m){ if(c){console.log("  ok -",m);} else {console.error("  FAIL -",m); failed++;} }
function freshState(){ return E.tick(Store.reset()); }

console.log("[1] 预约 → 金口玉言 +1；履约保留");
{
  const s = freshState();
  assert(E.countOath(s) === 0, "初始金口玉言为 0");
  E.scheduleAppointment(s, "audience");
  assert(E.countOath(s) === 1, "预约后 +1");
  assert(s.chains.oath.records[0].status === "pending", "承诺入链（待履约）");
  E.fulfillAppointment(s);
  assert(E.countOath(s) === 1, "履约后计数保留");
  assert(s.chains.oath.records[0].status === "kept", "履约后标记为已履约");
}

console.log("[2] 失信 → 整链清零");
{
  const s = freshState();
  E.scheduleAppointment(s, "audience");
  E.scheduleAppointment(s, "read");   // 已有预约会被拒，此处应不新增
  assert(E.countOath(s) === 1, "已有预约时拒绝新预约，不 +1");
  E.missAppointment(s);
  assert(E.countOath(s) === 0 && s.chains.oath.records.length === 0, "失信后金口玉言整链清零");
}

if (failed) { console.error("OATH FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("OATH OK — 金口玉言预约链通过");
