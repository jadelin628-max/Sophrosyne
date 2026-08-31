/* 测试环境桩：window / localStorage + js 模块加载（Node 下各测试共用） */
global.window = globalThis;
const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

require("../js/metrics.js");
require("../js/scenes.js");
require("../js/migrate.js");
require("../js/store.js");
require("../js/score.js");
require("../js/engine.js");
require("../js/llm.js");
