/* Sophrosyne — 数据层（localStorage schema + 持久化）v7 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Store = (function () {
  const KEY = "sophrosyne.v7";
  const BACKUP_KEY = "sophrosyne.v7.bak";
  // 旧档依次尝试：v6（0.5.0）、v5（0.4.1）、v4（更早）；命中即迁移并写回 v7
  const LEGACY_KEYS = ["sophrosyne.v6", "sophrosyne.v5", "sophrosyne.v4"];
  const Migrate = window.Sophrosyne.Migrate;   // 状态迁移独立模块（需先于 store.js 加载）
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
      version: 7,
      settings: { focusMinutes: 60, llm: { baseUrl: "", apiKey: "", model: "", maxTokens: 1024 }, prompts: {}, devMode: false },
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
        digest: "",                  // 上轮结算后的起居录压缩摘要（供下次 LLM 提示词）
      },
      heirs: [],                     // 子嗣 [{id,name,gender,age,attributes,birthDate}]
      goals: [],
      chains: {
        main: newChain("main"),      // 主要政务
        reserve: newChain("reserve"),// 次要政务
        oath: newChain("oath"),      // 金口玉言（预约链）
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

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 读取失败视为无档 */ }
    if (raw) {
      const s = tryParse(raw);
      if (s) return Migrate.migrate(Migrate.deepMerge(defaultState(), s));
      console.warn("主存档损坏，尝试旧档与备份……");
    }
    // 旧档 v5/v4 迁移（依次尝试，命中即写回 v6）
    for (const LK of LEGACY_KEYS) {
      try {
        const legacy = localStorage.getItem(LK);
        if (legacy) {
          const s = tryParse(legacy);
          if (s) {
            const merged = Migrate.migrate(Migrate.deepMerge(defaultState(), s));
            save(merged);
            warn("检测到旧存档，已自动迁移到新版。");
            return merged;
          }
        }
      } catch (e) { /* 无此旧档 */ }
    }
    try {
      const bak = localStorage.getItem(BACKUP_KEY);
      const s = bak && tryParse(bak);
      if (s) { warn("存档损坏，已从备份恢复（可能回退片刻）。"); return Migrate.migrate(Migrate.deepMerge(defaultState(), s)); }
    } catch (e) { /* 无备份 */ }
    return defaultState();
  }

  function save(state) {
    state.version = 7;
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
    return Migrate.deepMerge(defaultState(), raw);
  }

  return { KEY, BACKUP_KEY, LEGACY_KEYS, load, save, reset, revive, todayStr, defaultState, newChain };
})();
