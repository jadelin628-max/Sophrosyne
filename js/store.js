/* Sophrosyne — 数据层（localStorage schema + 持久化）v4 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Store = (function () {
  const KEY = "sophrosyne.v4";

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function newChain(kind) {
    return { kind: kind, records: [], precedents: [] };
  }

  function defaultState() {
    const Metrics = window.Sophrosyne.Metrics;
    const initM = Metrics ? Metrics.initialMetrics() : {};
    return {
      version: 4,
      settings: { lifeSpanDays: 60, focusMinutes: 60, llm: { baseUrl: "", apiKey: "", model: "" } },
      dynasty: { name: "未定", lineage: [] },
      reign: {
        eraName: "建元",
        startDate: todayStr(),
        age: 18,                     // 君主年龄
        lifeSpan: null,              // 寿命（登基时按四因子公式计算）
        eventMode: null,             // 突发事件状态：null 或 { active, since }
        metrics: initM,              // 20 项存量国力
        baseline: initM,             // 登基快照（供增减结算）
        attributes: { health: 50, energy: 50, talent: 50, intellect: 50, composure: 50, charm: 50, prestige: 50 },
        bonuses: null,               // 制度反哺缓存
        eventPrecedents: [],         // 突发事件成例
        todayTasks: [],              // 今日政务/事务（岁末结算）
      },
      heirs: [],                     // 子嗣 [{id,name,gender,age,attributes,birthDate}]
      goals: [],
      chains: {
        main: newChain("main"),      // 主要政务
        reserve: newChain("reserve"),// 次要政务
        appointment: { active: null, history: [] }, // 预约（无守信指数）
      },
      policies: [],                  // 制度树（固化度 + 分组）
      activeFocus: null,
      activeAppointment: null,
      log: [],                       // 起居注（本任）
      meta: { lastTickDate: todayStr(), advancedToday: false, lastPolicyAddDate: null },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return deepMerge(defaultState(), s);
    } catch (e) {
      console.warn("load failed, using default", e);
      return defaultState();
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error("save failed", e); }
  }

  function reset() {
    const s = defaultState();
    save(s);
    return s;
  }

  function deepMerge(def, src) {
    if (Array.isArray(def) || Array.isArray(src)) return src;
    if (typeof def === "object" && def !== null && typeof src === "object" && src !== null) {
      const out = {};
      for (const k of Object.keys(def)) {
        if (k in src) out[k] = deepMerge(def[k], src[k]);
        else out[k] = def[k];
      }
      for (const k of Object.keys(src)) {
        if (!(k in out)) out[k] = src[k];
      }
      return out;
    }
    return src === undefined ? def : src;
  }

  return { KEY, load, save, reset, todayStr, defaultState, newChain };
})();
