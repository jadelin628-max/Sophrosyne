/* Sophrosyne — 数据层（localStorage schema + 持久化）v4 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Store = (function () {
  const KEY = "sophrosyne.v5";
  const LEGACY_KEY = "sophrosyne.v4";
  const BACKUP_KEY = "sophrosyne.v5.bak";
  let lastMirrored = null;

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  // 用户可见的警告（UI 尚未加载时静默降级为 console）
  function warn(msg) {
    const UI = window.Sophrosyne && window.Sophrosyne.UI;
    if (UI && typeof UI.toast === "function") UI.toast(msg);
    else console.warn(msg);
  }

  function newChain(kind) {
    return { kind: kind, records: [], precedents: [] };
  }

  function defaultState() {
    const Metrics = window.Sophrosyne.Metrics;
    const initM = Metrics ? Metrics.initialMetrics() : {};
    return {
      version: 5,
      settings: { focusMinutes: 60, llm: { baseUrl: "", apiKey: "", model: "" } },
      dynasty: { name: "未定", lineage: [] },
      reign: {
        eraName: "建元",
        startDate: todayStr(),
        age: 18,                     // 君主年龄
        startAge: 18,                // 登基时年龄（在位年数 = age - startAge + 1，与年龄同源）
        lifeSpan: null,              // 寿命（登基时按四因子公式计算）
        eventMode: null,             // 突发事件状态：null 或 { active, since }
        metrics: initM,              // 20 项存量国力
        baseline: Metrics ? Metrics.initialMetrics() : {}, // 登基快照（供增减结算），须与 metrics 各自独立
        attributes: { health: 50, energy: 50, talent: 50, intellect: 50, composure: 50, charm: 50, prestige: 50 },
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

  function tryParse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // 归一化并迁移旧档到当前 schema：为进行中的临朝/预约补 status，缺失字段用默认补齐
  function migrate(s) {
    const now = Date.now();
    const af = s.activeFocus;
    if (af && !af.status) af.status = (af.endsAt && now >= af.endsAt) ? "awaiting-confirmation" : "running";
    const ap = s.activeAppointment || (s.chains && s.chains.appointment && s.chains.appointment.active);
    if (ap && !ap.status) ap.status = (ap.dueAt && now >= ap.dueAt) ? "overdue" : "pending";
    s.version = 5;
    return s;
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 读取失败视为无档 */ }
    if (raw) {
      const s = tryParse(raw);
      if (s) return migrate(deepMerge(defaultState(), s));
      console.warn("主存档损坏，尝试旧档与备份……");
    }
    // 旧档 v4 迁移
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const s = tryParse(legacy);
        if (s) {
          const merged = migrate(deepMerge(defaultState(), s));
          save(merged);
          warn("检测到旧存档，已自动迁移到新版。");
          return merged;
        }
      }
    } catch (e) { /* 无旧档 */ }
    try {
      const bak = localStorage.getItem(BACKUP_KEY);
      const s = bak && tryParse(bak);
      if (s) { warn("存档损坏，已从备份恢复（可能回退片刻）。"); return migrate(deepMerge(defaultState(), s)); }
    } catch (e) { /* 无备份 */ }
    return defaultState();
  }

  function save(state) {
    state.version = 5;
    let json;
    try { json = JSON.stringify(state); }
    catch (e) { console.error("存档序列化失败", e); warn("存档失败：数据异常。"); return false; }
    try { localStorage.setItem(KEY, json); }
    catch (e) {
      console.error("save failed", e);
      warn("存档空间不足，本次修改可能未保存。");
      return false;
    }
    if (json !== lastMirrored) {
      try { localStorage.setItem(BACKUP_KEY, json); lastMirrored = json; }
      catch (e2) { /* 备份写失败不影响主档 */ }
    }
    return true;
  }

  function reset() {
    const s = defaultState();
    save(s);
    return s;
  }

  // 导入净化：以默认档为骨架合并外来数据，补齐缺失字段、丢弃结构不符的部分
  function revive(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.reign !== "object" || typeof raw.chains !== "object" || !Array.isArray(raw.policies)) return null;
    if (raw.reign && (typeof raw.reign.metrics !== "object" || !raw.reign.metrics)) return null;
    return deepMerge(defaultState(), raw);
  }

  function deepMerge(def, src) {
    if (src === null || src === undefined) return def;      // 旧档 null（如 log:null）回落默认，避免运行期 TypeError
    if (def === null || def === undefined) return src;      // 默认档为 null 而存档有对象（如 activeFocus 进行中），用存档
    if (Array.isArray(src)) return src;                     // 数组整取已存数据
    if (Array.isArray(def)) return def;                     // 模板为数组而来源非数组：类型不符，用默认
    if (typeof def === "object" && typeof src === "object") {
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
    return src;
  }

  return { KEY, BACKUP_KEY, LEGACY_KEY, load, save, reset, revive, todayStr, defaultState, newChain };
})();
