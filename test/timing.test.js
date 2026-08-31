/* Sophrosyne — 计时/预约状态机 + 存档迁移 回归测试（0.4.1） */
global.window = globalThis;
const mem = {};
global.localStorage = { getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} };
require("../js/metrics.js"); require("../js/scenes.js"); require("../js/migrate.js"); require("../js/store.js");
require("../js/score.js"); require("../js/engine.js");
const E = globalThis.Sophrosyne.Engine, Store = globalThis.Sophrosyne.Store;
let failed = 0;
function assert(c,m){ if(c){console.log("  ok -",m);} else {console.error("  FAIL -",m); failed++;} }
function freshState(){ return E.tick(Store.reset()); }

console.log("[1] 临朝到时 → 待确认，不自动记功、不阻塞");
{
  const s = freshState();
  E.startFocus(s, "audience", "main", "背单词");
  s.activeFocus.endsAt = Date.now() - 1000;
  assert(E.advanceTimers(s) === true, "到时触发状态转换");
  assert(s.activeFocus.status === "awaiting-confirmation", "转为待确认结束");
  assert(s.chains.main.records.length === 0 && s.reign.todayTasks.length === 0, "未自动记功/入今日事务");
  const r = E.completeFocus(s);
  assert(r && r.number === 1 && s.activeFocus === null, "待确认后手动功成入账");
}

console.log("[2] 未到时也可手动功成/失守");
{
  const s = freshState();
  E.startFocus(s, "read", "main", "读书");
  assert(E.completeFocus(s).number === 1, "未到时手动功成");
  const s2 = freshState();
  E.startFocus(s2, "read", "main", "");
  assert(E.abandonFocus(s2).target === "main", "未到时手动失守→廷议");
}

console.log("[3] 预约不可覆盖");
{
  const s = freshState();
  E.scheduleAppointment(s, "audience");
  const r2 = E.scheduleAppointment(s, "read");
  assert(r2 && r2.blocked === true, "已有预约时拒绝新预约");
}

console.log("[4] 预约逾期不可履约，只能确认失信");
{
  const s = freshState();
  E.scheduleAppointment(s, "audience");
  s.activeAppointment.dueAt = Date.now() - 1000;
  assert(E.advanceTimers(s) === true, "到期触发逾期");
  assert(s.activeAppointment.status === "overdue", "转为已逾期");
  const r = E.fulfillAppointment(s);
  assert(r && r.blocked === true, "逾期不可履约");
  const m = E.missAppointment(s);
  assert(m && m.missed === true, "确认失信入账（威望-1）");
}

console.log("[5] 旧 v5 档迁移（补 status、补制度规则骨架、写回 v6、保留数据）");
{
  const legacy = E.init();
  legacy.version = 5;
  legacy.dynasty.name = "大夏";          // 校验自定义字段保留
  legacy.policies = [{ id:"p1", name:"子时后不碰手机", group:"作息", status:"active", solidity:20, solidityCap:100, survivalDays:3, collapseCount:0, level:0, revive:0, strengthened:false, createdAt:"2024-01-01", parentId:null }];
  legacy.activeFocus = { sceneId:"audience", name:"御门听政", gov:"御门听政、面奏章疏", chain:"main", realTask:"", startedAt:Date.now(), endsAt: Date.now()-1000, minutes:60 };
  legacy.activeAppointment = { sceneId:"read", name:"研读经典", appointment:"沐浴焚香", scheduledAt:Date.now(), dueAt: Date.now()+60000 };
  mem["sophrosyne.v5"] = JSON.stringify(legacy);
  delete mem["sophrosyne.v6"]; delete mem["sophrosyne.v6.bak"];
  const s = Store.load();
  assert(s.activeFocus.status === "awaiting-confirmation", "旧进行中临朝迁移为待确认");
  assert(s.activeAppointment.status === "pending", "旧预约迁移为待履约");
  assert(s.dynasty.name === "大夏", "自定义字段保留");
  assert(s.version === 6, "迁移后版本号为 6");
  const pol = s.policies.find(p => p.id === "p1");
  assert(pol && pol.rule && Array.isArray(pol.rule.exceptions), "旧制度补默认规则骨架");
  assert(pol.name === "子时后不碰手机" && pol.group === "作息", "旧制度名称/分组保留");
  assert("sophrosyne.v6" in mem, "迁移后写回 v6 档");
}

console.log("[5b] 旧 v4 档直接迁到 v6");
{
  const legacy = E.init();
  legacy.version = 4;
  legacy.dynasty.name = "大夏";
  mem["sophrosyne.v4"] = JSON.stringify(legacy);
  delete mem["sophrosyne.v6"]; delete mem["sophrosyne.v6.bak"]; delete mem["sophrosyne.v5"];
  const s = Store.load();
  assert(s.version === 6 && s.dynasty.name === "大夏", "v4 档自动迁移并写回 v6");
}

if (failed) { console.error("TIMING FAIL — "+failed+" 项未过"); process.exit(1); }
console.log("TIMING OK — 计时/预约状态机与迁移通过");
