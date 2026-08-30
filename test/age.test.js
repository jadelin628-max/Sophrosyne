/* Sophrosyne — 年龄/在位回归测试：同一天刷新（reload + tick）不得重复加龄 */
global.window = globalThis;
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js"); require("../js/scenes.js"); require("../js/store.js");
require("../js/score.js"); require("../js/engine.js");
const E = globalThis.Sophrosyne.Engine, Store = globalThis.Sophrosyne.Store;
function assert(c,m){ if(!c){console.error("FAIL:",m);process.exit(1);} console.log("  ok -",m); }

let s = E.init();
const baseAge = s.reign.age, baseReign = E.reignYears(s);
// 同日多次刷新
for (let i=0;i<3;i++){ const r=E.init(); assert(r.reign.age===baseAge && E.reignYears(r)===baseReign, "第"+(i+1)+"次同日刷新，年龄/在位不变"); }
// 跨日一次，只长一岁（且刷新不再长）
const old = "2000-01-01";
s.meta.lastTickDate = old; Store.save(s);
s = E.tick(s);
assert(s.reign.age === baseAge+1, "跨日长一岁");
Store.save(s);
let again = E.tick(Store.load());
assert(again.reign.age === baseAge+1, "跨日结算后再加载/刷新，年龄不再重复增长");
console.log("AGE OK — 年龄/在位稳定");
