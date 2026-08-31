/* Sophrosyne — 领域状态迁移（旧档归一化 + 深合并骨架）
 * 独立模块：把「旧 schema → 当前 schema」的规则从持久化层剥离，便于单独测试。
 * 当前 schema：v7（0.6.0）；可迁移 v6（0.5.0）、v5（0.4.1）与更早的 v4 存档。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Migrate = (function () {
  // 制度「可执行规则」骨架（旧制度迁移时补默认值，保留原名称/分组等信息）
  function defaultRule() {
    return { trigger: "", minAction: "", evidence: "", exceptions: [], recovery: "" };
  }

  // 归一化并迁移旧档到当前 schema：为进行中的临朝/预约补 status、为旧制度补规则骨架
  function migrate(s) {
    const now = Date.now();
    const af = s.activeFocus;
    if (af && !af.status) af.status = (af.endsAt && now >= af.endsAt) ? "awaiting-confirmation" : "running";
    const ap = s.activeAppointment || (s.chains && s.chains.appointment && s.chains.appointment.active);
    if (ap && !ap.status) ap.status = (ap.dueAt && now >= ap.dueAt) ? "overdue" : "pending";
    // v5 → v6：旧制度从「名称+分组」扩展为可执行规则，补默认规则骨架
    if (Array.isArray(s.policies)) {
      for (const p of s.policies) {
        if (!p || typeof p !== "object") continue;
        if (!p.rule || typeof p.rule !== "object") p.rule = defaultRule();
        else {
          const r = defaultRule();
          for (const k of Object.keys(r)) if (p.rule[k] === undefined) p.rule[k] = r[k];
        }
      }
    }
    // v6 → v7：金口玉言链（chains.oath）与目标风味化字段缺省补齐（缺失即回默认，运行时按 g.title||g.name 兜底）
    if (s.chains && typeof s.chains === "object" && !s.chains.oath) {
      s.chains.oath = { kind: "oath", records: [], precedents: [] };
    }
    if (Array.isArray(s.goals)) {
      for (const g of s.goals) {
        if (!g || typeof g !== "object") continue;
        if (g.title === undefined) g.title = "";
        if (g.verdict === undefined) g.verdict = "";
        for (const sg of (g.subGoals || [])) if (sg && sg.verdict === undefined) sg.verdict = "";
      }
    }
    s.version = 7;
    return s;
  }

  // 以默认档为骨架合并外来数据：补齐缺失字段、丢弃类型不符的部分
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

  return { migrate, deepMerge, defaultRule };
})();
