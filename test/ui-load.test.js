/* Sophrosyne — UI / 事件模块拆分加载冒烟（Node 下验证模块可加载、接口完整）
 * 只验证「拆分为独立模块后各脚本在无浏览器 DOM 时也能 require 成功」与接口挂载，
 * 不模拟完整 DOM 交互；交互正确性由浏览器手动回归 + events.js 的 api 门面约束保证。
 */
global.window = globalThis;
global.location = { search: "" };
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js");
require("../js/scenes.js");
require("../js/migrate.js");
require("../js/store.js");
require("../js/score.js");
require("../js/engine.js");
require("../js/llm.js");
require("../js/events.js");
require("../js/ui.js");

let failed = 0;
function assert(c, m) { if (c) { console.log("  ok -", m); } else { console.error("  FAIL -", m); failed++; } }

assert(typeof globalThis.Sophrosyne.Events === "object", "Events 模块已挂载");
assert(typeof globalThis.Sophrosyne.Events.bind === "function", "Events.bind 为函数");
assert(typeof globalThis.Sophrosyne.UI === "object", "UI 模块已挂载");
assert(typeof globalThis.Sophrosyne.UI.init === "function", "UI.init 为函数");
assert(typeof globalThis.Sophrosyne.UI.toast === "function", "UI.toast 为函数");

if (failed) { console.error("UI-LOAD FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("UI-LOAD OK — UI/事件模块拆分后加载与接口完整");
