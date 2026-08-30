/* Sophrosyne — 引擎 v5（阶段 A + B：年龄寿命 · 子嗣 · 国策升级 · 突发事件状态机 · 阶段目标 · 谥号双轨） */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Engine = (function () {
  const Store = Sophrosyne.Store;
  const Scenes = Sophrosyne.Scenes;
  const Metrics = Sophrosyne.Metrics;

  const ERA_NAMES = ["建元", "永初", "太和", "景初", "天授", "开元", "大业", "贞观", "乾元", "广明", "天圣", "庆历"];
  const APPOINTMENT_MIN = 15;
  const SOLIDITY_PER_DAY = 5;
  const MALE_NAMES = ["承乾", "承志", "守礼", "守仁", "怀瑾", "明远", "景行", "怀安"];
  const FEMALE_NAMES = ["静姝", "婉仪", "明慧", "淑宁", "灵犀", "清和", "安然", "知微"];

  function todayStr() { return Store.todayStr(); }
  function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function log(state, text) {
    state.log.unshift({ date: todayStr(), time: new Date().toTimeString().slice(0, 5), year: reignYears(state), text });
    if (state.log.length > 500) state.log.length = 500;
  }

  function reignYears(state) {
    // 在位年数与年龄同源（按打开应用的跨日计）：长期不打开时年数不再按自然日虚涨。
    // 旧存档无 startAge 字段时退回自然日算法，避免误算。
    if (state.reign.startAge != null) return state.reign.age - state.reign.startAge + 1;
    return daysBetween(state.reign.startDate, todayStr()) + 1;
  }
  function computeLifeSpan(attrs, prevLifeSpan) {
    const r = Math.random() * 15;
    return Math.max(30, Math.round(60 + (attrs.health || 50) * 0.20 + (attrs.composure || 50) * 0.10 + ((prevLifeSpan || 80) - 80) * 0.15 + r));
  }
  function ensureLifeSpan(state) {
    if (state.reign.lifeSpan == null) {
      state.reign.lifeSpan = computeLifeSpan(state.reign.attributes, 80);
      Store.save(state);
    }
  }
  function shouldAbdicate(state) { return state.reign.age >= state.reign.lifeSpan; }

  function efficiency(state, primaryAttr) {
    const a = state.reign.attributes;
    const prestige = a.prestige != null ? a.prestige : 50;
    const primary = a[primaryAttr] != null ? a[primaryAttr] : 50;
    return 1 + 0.006 * (prestige - 50) + 0.002 * (primary - 50);
  }
  function scaleEffects(eff, factor) {
    const out = {};
    for (const k of Object.keys(eff || {})) out[k] = Math.round((eff[k] || 0) * factor);
    return out;
  }
  function describeEffects(eff) {
    if (!eff) return "";
    return Object.keys(eff).map(k => (Metrics.DEFS[k] ? Metrics.DEFS[k].name : k) + (eff[k] >= 0 ? "+" : "") + eff[k]).join("，");
  }
  function chainLabel(k) { return k === "reserve" ? "次要政务" : "主要政务"; }

  function tick(state) {
    const now = todayStr();
    if (state.meta.lastTickDate !== now) {
      state.meta.advancedToday = false;
      if (state.reign.todayTasks.length) { fallbackSettle(state); state.reign.todayTasks = []; }
      yearlyAdvance(state);
      state.meta.lastTickDate = now;
      // yearlyAdvance 内已保存，但那时 lastTickDate 还是旧值；这里再保存一次，确保下次刷新/加载读到"今日已结算"，避免重复加龄。
      Store.save(state);
    }
    return state;
  }
  function init() {
    const state = Store.load();
    ensureLifeSpan(state);
    if (state.reign.startAge == null) { state.reign.startAge = state.reign.age; Store.save(state); }
    tick(state);
    return state;
  }

  function fallbackSettle(state) {
    let loveCount = 0;
    for (const t of state.reign.todayTasks) {
      const sc = Scenes.get(t.sceneId);
      if (!sc) continue;
      if (sc.id === "love") loveCount++;
      const eff = scaleEffects(sc.defaultEffects, efficiency(state, sc.primary));
      Metrics.applyEffects(state.reign.metrics, eff);
      log(state, "「" + sc.gov + "」" + (t.realTask ? "——" + t.realTask : "") + "。（" + describeEffects(eff) + "）");
    }
    checkHeirBirth(state, loveCount);
  }
  function applySettlement(state, entries) {
    let loveCount = 0;
    for (const t of state.reign.todayTasks) if (t.sceneId === "love") loveCount++;
    // 与兜底路径一致：结算同样受威望加成（LLM 结算无主属性，仅取威望项）
    const factor = efficiency(state, null);
    for (const e of entries) {
      if (e.effects) Metrics.applyEffects(state.reign.metrics, scaleEffects(e.effects, factor));
      log(state, (e.title || "政务") + (e.note ? "：" + e.note : ""));
    }
    checkHeirBirth(state, loveCount);
  }

  function yearlyAdvance(state) {
    if (state.meta.advancedToday) return;
    Metrics.applyNaturalGrowth(state.reign.metrics);
    const d = Metrics.computeDerived(state.reign.metrics);
    state.reign.metrics.treasury += d.revenue;
    state.reign.age += 1;
    for (const h of state.heirs) h.age += 1;

    const inEvent = !!(state.reign.eventMode && state.reign.eventMode.active);
    for (const p of state.policies) {
      if (p.status !== "active") continue;
      if (!inEvent) { p.survivalDays += 1; p.solidity = Math.min(p.solidityCap || 100, p.solidity + SOLIDITY_PER_DAY); }
      if (p.solidity >= 60) state.reign.metrics.support = clamp(state.reign.metrics.support + 0.2, 0, 100);
      if (p.strengthened) {
        state.reign.metrics.support = clamp(state.reign.metrics.support + 0.3 * (p.level || 0), 0, 100);
        state.reign.metrics.order = clamp(state.reign.metrics.order + 0.2 * (p.level || 0), 0, 100);
      }
    }
    evaluateSubGoals(state);
    if (shouldAbdicate(state)) log(state, "圣寿已至「" + state.reign.lifeSpan + "」，当择日禅位 / 驾崩。");
    state.meta.advancedToday = true;
    Store.save(state);
  }

  async function settleYear(state, useLLM) {
    let llmFailed = null;
    if (state.reign.todayTasks.length) {
      const tasks = state.reign.todayTasks.slice();
      let entries = null;
      if (useLLM) {
        try { entries = await Sophrosyne.LLM.settle(state, tasks); }
        catch (e) { llmFailed = e; entries = null; }
      }
      // await 期间跨日 tick 可能已用兜底数值结算并清空任务，复查以免同一批事务双重入账
      if (state.reign.todayTasks.length) {
        if (entries && entries.length) applySettlement(state, entries);
        else {
          fallbackSettle(state);
          if (useLLM) log(state, "史官结算未成（" + (llmFailed ? llmFailed.message : "无产出") + "），以常例入账。");
        }
        state.reign.todayTasks = [];
      }
    }
    // 年龄/自然增长等“一年一度”的处理只在跨现实日时由 tick() 触发，
    // 避免“岁末结算”按钮与跨日结算叠加导致一天长两岁。
    Store.save(state);
    return { settled: true, llmFailed: llmFailed ? llmFailed.message : null };
  }

  function startFocus(state, sceneId, chainKey, realTask) {
    if (state.activeFocus) return { blocked: true, reason: "已有临朝进行中，请先功成或失守。" };
    const sc = Scenes.get(sceneId);
    if (!sc) return null;
    const minutes = state.settings.focusMinutes || 60;
    const af = {
      sceneId, name: sc.name, gov: sc.gov, appointment: sc.appointment,
      attrs: sc.attrs, primary: sc.primary,
      chain: chainKey || "main", realTask: realTask || "",
      startedAt: Date.now(), endsAt: Date.now() + minutes * 60000, minutes
    };
    state.activeFocus = af;
    log(state, "临朝：「" + sc.gov + "」" + (realTask ? "——" + realTask : "") + "（" + chainLabel(chainKey) + "）。");
    Store.save(state);
    return af;
  }
  function completeFocus(state) {
    const af = state.activeFocus;
    if (!af) return null;
    const chain = state.chains[af.chain];
    const number = chain.records.length + 1;
    for (const a of (af.attrs || [])) {
      if (a in state.reign.attributes) state.reign.attributes[a] = Math.min(100, state.reign.attributes[a] + 1);
    }
    chain.records.push({ number, name: af.name, gov: af.gov, realTask: af.realTask, date: todayStr(), ts: Date.now() });
    state.reign.todayTasks.push({ sceneId: af.sceneId, realTask: af.realTask, chain: af.chain, ts: Date.now() });
    state.activeFocus = null;
    log(state, "功成：" + chainLabel(af.chain) + " #" + number + "「" + af.gov + "」" + (af.realTask ? "——" + af.realTask : "") + "（待岁末结算）");
    evaluateSubGoals(state);
    Store.save(state);
    return { number, chain: af.chain };
  }
  function abandonFocus(state) {
    if (!state.activeFocus) return null;
    return { target: state.activeFocus.chain, source: "focus" };
  }
  function verdict(state, target, decision, precedentText) {
    if (target === "main" || target === "reserve") {
      const chain = state.chains[target];
      if (decision === "collapse") {
        chain.records = [];
        if (target === "main") {
          const res = state.chains.reserve;
          if (res.records.length) { state.chains.main.records = res.records; state.chains.reserve.records = []; log(state, "主要政务崩坏！次要政务继位，承续旧勋。"); }
          else log(state, "主要政务崩坏，勤政纪录清零。");
        } else log(state, "次要政务废黜，纪录清零。");
      } else {
        chain.precedents.push(precedentText || "(未书明)");
        log(state, "下诏成例：" + (precedentText || "(未书明)") + "，此后再不视为违规。");
      }
      state.activeFocus = null;
    }
    Store.save(state);
    return state;
  }

  function scheduleAppointment(state, sceneId) {
    const sc = Scenes.get(sceneId);
    if (!sc) return null;
    const ap = { sceneId, name: sc.name, appointment: sc.appointment, scheduledAt: Date.now(), dueAt: Date.now() + APPOINTMENT_MIN * 60000 };
    state.activeAppointment = ap;
    state.chains.appointment.active = ap;
    log(state, "预约（" + sc.appointment + "）：「" + sc.name + "」，一刻钟内须临朝。");
    Store.save(state);
    return ap;
  }
  function appointmentDue(state) {
    const ap = state.activeAppointment || state.chains.appointment.active;
    return ap && Date.now() >= ap.dueAt;
  }
  function fulfillAppointment(state) {
    const ap = state.activeAppointment || state.chains.appointment.active;
    if (!ap) return null;
    if (state.activeFocus) return { blocked: true, reason: "已有临朝进行中，预约暂不能履约。" };
    state.reign.attributes.prestige = Math.min(100, state.reign.attributes.prestige + 1);
    state.chains.appointment.history.push({ sceneId: ap.sceneId, fulfilled: true, date: todayStr() });
    state.activeAppointment = null; state.chains.appointment.active = null;
    log(state, "守信履约，威望 +1（现 " + state.reign.attributes.prestige + "）。");
    Store.save(state);
    return startFocus(state, ap.sceneId, "main", "");
  }
  function missAppointment(state) {
    const ap = state.activeAppointment || state.chains.appointment.active;
    if (!ap) return null;
    state.reign.attributes.prestige = Math.max(0, state.reign.attributes.prestige - 1);
    state.chains.appointment.history.push({ sceneId: ap.sceneId, fulfilled: false, date: todayStr() });
    state.activeAppointment = null; state.chains.appointment.active = null;
    log(state, "失信失约，威望 -1（现 " + state.reign.attributes.prestige + "）。");
    Store.save(state);
    return { missed: true };
  }

  function checkHeirBirth(state, loveBoost) {
    const a = state.reign.attributes;
    const chance = 0.08 + (loveBoost ? 0.20 : 0) + (state.reign.age < 40 ? 0.05 : 0) + (a.health > 60 ? 0.03 : 0);
    if (Math.random() < chance) {
      const h = createHeir(state, a);
      log(state, "喜得" + (h.gender === "male" ? "皇子" : "公主") + "「" + h.name + "」。");
      Store.save(state);
    }
  }
  function createHeir(state, parentAttrs) {
    const attrs = {};
    for (const k of Scenes.ATTR_KEYS) attrs[k] = clamp(20 + Math.round((parentAttrs[k] || 50) * 0.5 + Math.random() * 30), 0, 100);
    const gender = Math.random() < 0.5 ? "male" : "female";
    const names = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
    const h = { id: uid(), name: names[Math.floor(Math.random() * names.length)], gender, age: 0, attributes: attrs, birthDate: todayStr() };
    state.heirs.push(h);
    return h;
  }
  function trainHeir(state, heirId) {
    if (state.meta.lastTrainDate === todayStr()) return { ok: false, reason: "今日已培养过子嗣。" };
    const h = state.heirs.find(x => x.id === heirId);
    if (!h) return { ok: false, reason: "子嗣不存在。" };
    for (const k of ["intellect", "composure", "charm"]) h.attributes[k] = Math.min(100, h.attributes[k] + 1);
    state.meta.lastTrainDate = todayStr();
    log(state, "上书房培养：" + (h.gender === "male" ? "皇子" : "公主") + "「" + h.name + "」进学。");
    Store.save(state);
    return { ok: true };
  }

  function policyAddAllowed(state) { return state.meta.lastPolicyAddDate !== todayStr(); }
  function eventActive(state) { return !!(state.reign.eventMode && state.reign.eventMode.active); }
  function addPolicy(state, data) {
    if (!policyAddAllowed(state)) return { ok: false, reason: "今日已颁行过制度，明日再议。" };
    if (eventActive(state)) return { ok: false, reason: "突发事件期间禁止修改制度树。" };
    const p = {
      id: uid(), name: data.name, group: data.group || "", flavor: data.flavor || "",
      parentId: data.parentId || null, status: "active",
      solidity: 0, solidityCap: 100, survivalDays: 0, collapseCount: 0,
      level: 0, revive: 0, strengthened: false, createdAt: todayStr()
    };
    state.policies.push(p);
    state.meta.lastPolicyAddDate = todayStr();
    log(state, "颁行制度：「" + p.name + "」" + (p.group ? "（" + p.group + "）" : "") + "。");
    Store.save(state);
    return { ok: true, policy: p };
  }
  function collapsePolicy(state, id) {
    if (eventActive(state)) return { collapsed: false, reason: "突发事件期间禁止修改制度树。" };
    const p = state.policies.find(x => x.id === id);
    if (!p) return { collapsed: false };
    if (p.level > 0 && p.revive > 0) {
      p.revive -= 1; p.level -= 1;
      p.solidityCap = Math.max(100, p.solidityCap - 50);
      p.solidity = Math.floor(p.solidity / 2);
      log(state, "「" + p.name + "」赖升级之资复活，降级免删（余 " + p.revive + " 次）。");
      Store.save(state);
      return { collapsed: false, revived: true };
    }
    function fall(x) {
      x.status = "fallen";
      x.solidity = Math.floor(x.solidity / 2);
      x.collapseCount += 1;
      state.policies.filter(c => c.parentId === x.id).forEach(fall);
    }
    fall(p);
    log(state, "诏废：「" + p.name + "」失守，其从属制度一并废止（固化度减半）。");
    Store.save(state);
    return { collapsed: true };
  }
  function rescuePolicy(state, id, newParentId) {
    if (eventActive(state)) return;
    const p = state.policies.find(x => x.id === id);
    if (!p) return;
    p.status = "active";
    p.parentId = newParentId || null;
    log(state, "迁都改隶：「" + p.name + "」得救。");
    Store.save(state);
  }
  function upgradePolicy(state, id) {
    if (eventActive(state)) return { ok: false, reason: "突发事件期间禁止修改制度树。" };
    const p = state.policies.find(x => x.id === id);
    if (!p || p.status !== "active") return { ok: false, reason: "制度不在行。" };
    if (p.solidity < (p.solidityCap || 100)) return { ok: false, reason: "固化度未满。" };
    if (p.survivalDays < 20) return { ok: false, reason: "坚持不足 20 天，尚不可升级。" };
    p.level += 1; p.revive += 1;
    p.solidityCap = (p.solidityCap || 100) + 50;
    p.solidity = 0;
    log(state, "「" + p.name + "」升级至 " + p.level + " 级，获 1 次复活，固化上限增至 " + p.solidityCap + "。");
    Store.save(state);
    return { ok: true };
  }
  function strengthenPolicy(state, id) {
    if (eventActive(state)) return { ok: false, reason: "突发事件期间禁止修改制度树。" };
    const p = state.policies.find(x => x.id === id);
    if (!p || p.status !== "active") return { ok: false, reason: "制度不在行。" };
    if (p.level < 1) return { ok: false, reason: "需先升级方可强化。" };
    p.strengthened = true;
    log(state, "「" + p.name + "」强化：规约更严，影响更著，然更难维持。");
    Store.save(state);
    return { ok: true };
  }

  function enterEventMode(state, text) {
    state.reign.eventMode = { active: true, since: todayStr(), text: text || "" };
    log(state, "报备突发事件（" + (text || "未书明") + "），进入非常时期：制度树冻结，不计坚持天数。");
    Store.save(state);
    return state;
  }
  function exitEventMode(state, compliant) {
    const text = state.reign.eventMode && state.reign.eventMode.text;
    state.reign.eventMode = null;
    if (compliant) {
      log(state, "非常时期结束（合规），一切恢复如常。");
    } else {
      for (const p of state.policies) {
        if (p.level > 0) {
          p.level -= 1; p.revive = Math.max(0, p.revive - 1);
          p.solidityCap = Math.max(100, p.solidityCap - 50);
          p.solidity = Math.floor(p.solidity / 2);
          p.status = "active";
        } else if (p.status !== "fallen") {
          p.status = "fallen"; p.solidity = Math.floor(p.solidity / 2); p.collapseCount += 1;
        }
        // 已废制度不再重复减半/累加崩坏次数
      }
      log(state, "非常时期结束（判违规），制度树重置；已升级者降级保全。");
    }
    Store.save(state);
    return state;
  }

  function addGoal(state, { name, flavor }) {
    const g = { id: uid(), name, flavor: flavor || "", status: "active", createdAt: todayStr(), resolvedAt: null, subGoals: [] };
    state.goals.push(g);
    log(state, "定国策大志（敌人）：「" + name + "」" + (flavor ? "（" + flavor + "）" : "") + "。");
    Store.save(state);
    return { ok: true, goal: g };
  }
  function addSubGoal(state, goalId, { name, flavor, criteria }) {
    const g = state.goals.find(x => x.id === goalId);
    if (!g) return { ok: false, reason: "大目标不存在。" };
    if (!criteria || !criteria.length) return { ok: false, reason: "至少选择一条评判标准。" };
    const sg = { id: uid(), name, flavor: flavor || "", criteria, progress: 0, done: false };
    g.subGoals.push(sg);
    log(state, "分解阶段目标：「" + name + "」（" + criteria.map(c => describeCriterion(state, c)).join("、") + "）。");
    Store.save(state);
    evaluateSubGoals(state);
    return { ok: true, subGoal: sg };
  }
  // 动态评估阶段目标：每条标准全部达成即完成（政务总数 / 国力指标 / 制度坚持天数）
  function criterionMet(state, c) {
    if (!c) return false;
    if (c.type === "focus-total") {
      return (state.chains.main.records.length + state.chains.reserve.records.length) >= (c.count || 0);
    }
    if (c.type === "metric") {
      const v = state.reign.metrics[c.key];
      return v != null && v >= (c.target || 0);
    }
    if (c.type === "policy-days") {
      const p = state.policies.find(x => x.id === c.policyId);
      return !!(p && p.status === "active" && (p.survivalDays || 0) >= (c.days || 0));
    }
    return false;
  }
  function describeCriterion(state, c) {
    if (c.type === "focus-total") return "政务总数×" + c.count;
    if (c.type === "metric") return (Metrics.DEFS[c.key] ? Metrics.DEFS[c.key].name : c.key) + "≥" + c.target;
    if (c.type === "policy-days") { const p = state.policies.find(x => x.id === c.policyId); return "制度「" + (p ? p.name : "?") + "」坚持" + c.days + "天"; }
    return "?";
  }
  function evaluateSubGoals(state) {
    let changed = false;
    for (const g of state.goals) {
      if (g.status !== "active") continue;
      for (const sg of g.subGoals) {
        if (sg.done) continue;
        const met = (sg.criteria || []).length && (sg.criteria || []).every(c => criterionMet(state, c));
        if (met) {
          sg.done = true;
          state.reign.attributes.prestige = Math.min(100, state.reign.attributes.prestige + 2);
          log(state, "阶段目标达成：「" + sg.name + "」，威望 +2。");
          changed = true;
        }
      }
    }
    if (changed) Store.save(state);
    return changed;
  }
  function resolveGoal(state, id, status) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    g.status = status === "done" ? "done" : "failed";
    g.resolvedAt = todayStr();
    log(state, (g.status === "done" ? "大捷：击退敌人——" : "兵败：未竟全功——") + "「" + g.name + "」。");
    Store.save(state);
  }
  function countSubGoalsDone(goals) {
    return goals.reduce((s, g) => s + (g.subGoals || []).filter(sg => sg.done).length, 0);
  }

  async function abdicate(state, reason, opts) {
    opts = opts || {};
    // 禅位前未结算的事务不作数，但须载入实录而非无声丢弃
    if (state.reign.todayTasks.length) {
      log(state, "禅位时有 " + state.reign.todayTasks.length + " 件已记事务未及岁末结算，弃置。");
      state.reign.todayTasks = [];
    }
    const y = reignYears(state);
    const isFirst = state.dynasty.lineage.length === 0;
    const goalsThisReign = state.goals.filter(g => g.status !== "active" && g.resolvedAt && g.resolvedAt >= state.reign.startDate);
    const subGoalDone = countSubGoalsDone(goalsThisReign);

    const score = Sophrosyne.Score.scoreReign({
      baseline: state.reign.baseline, metrics: state.reign.metrics,
      chainLen: state.chains.main.records.length, policies: state.policies,
      attributes: state.reign.attributes, goals: goalsThisReign, subGoalDone,
      years: y, isFirst,
    });
    let llmEulogy = "";
    if (opts.mode === "llm") {
      try {
        const lr = await Sophrosyne.LLM.posthumous(state, goalsThisReign, subGoalDone);
        if (lr && lr.posthumous) score.posthumous = lr.posthumous;
        if (lr && lr.temple) score.temple = lr.temple;
        llmEulogy = (lr && lr.eulogy) || "";
      } catch (e) { /* 保持规则评定 */ }
    }

    log(state, (reason || "驾崩") + "。在位 " + y + " 年，享年 " + state.reign.age + " 岁。" + score.reason + (llmEulogy ? " 史官曰：" + llmEulogy : ""));
    const veritable = state.log.slice();
    state.dynasty.lineage.push({
      eraName: state.reign.eraName, years: y, age: state.reign.age,
      metrics: Object.assign({}, state.reign.metrics), chainLen: state.chains.main.records.length,
      goals: goalsThisReign.map(g => ({ name: g.name, status: g.status })), subGoalDone,
      date: todayStr(), reason: reason || "驾崩",
      posthumous: score.posthumous, temple: score.temple, score, eulogy: llmEulogy,
      veritableRecords: veritable,
    });

    const prevLifeSpan = state.reign.lifeSpan || 80;
    let newAge = 18, newAttrs = { health: 50, energy: 50, talent: 50, intellect: 50, composure: 50, charm: 50, prestige: 50 };
    let heirName = null;
    if (opts.heirId) {
      const h = state.heirs.find(x => x.id === opts.heirId);
      if (h) { newAge = Math.max(6, h.age); newAttrs = Object.assign({}, h.attributes); heirName = h.name; }
    }
    let accession = "新君「" + (heirName || "宗室") + "」即位";
    if (opts.mode === "llm") {
      try { accession = await Sophrosyne.LLM.accession(state, heirName, newAge); }
      catch (e) { /* 用默认 */ }
    }

    const next = ERA_NAMES[state.dynasty.lineage.length % ERA_NAMES.length];
    state.reign.eraName = next;
    state.reign.startDate = todayStr();
    state.reign.age = newAge;
    state.reign.startAge = newAge;
    state.reign.lifeSpan = computeLifeSpan(newAttrs, prevLifeSpan);
    state.reign.attributes = newAttrs;
    state.reign.metrics = Metrics.initialMetrics();
    state.reign.baseline = Metrics.initialMetrics();
    state.reign.eventMode = null;
    state.reign.todayTasks = [];
    state.chains.main = Store.newChain("main");
    state.chains.reserve = Store.newChain("reserve");
    state.chains.appointment = { active: null, history: [] };
    state.activeFocus = null;
    state.activeAppointment = null;
    state.log = [];
    state.meta.lastTickDate = todayStr();
    state.meta.advancedToday = false;
    state.meta.lastTrainDate = null;      // 新君即位，当日培养/颁行限制不继承
    state.meta.lastPolicyAddDate = null;
    if (opts.heirId) state.heirs = state.heirs.filter(x => x.id !== opts.heirId);
    log(state, accession + "，年号「" + next + "」，春秋 " + newAge + " 岁。");
    Store.save(state);
    return { next, score, accession };
  }

  return {
    init, tick, reignYears, shouldAbdicate, computeLifeSpan, ensureLifeSpan,
    efficiency, scaleEffects, describeEffects, chainLabel,
    startFocus, completeFocus, abandonFocus, verdict,
    scheduleAppointment, appointmentDue, fulfillAppointment, missAppointment,
    settleYear, fallbackSettle, applySettlement, yearlyAdvance,
    addPolicy, policyAddAllowed, collapsePolicy, rescuePolicy, upgradePolicy, strengthenPolicy, eventActive,
    enterEventMode, exitEventMode, checkHeirBirth, createHeir, trainHeir,
    addGoal, addSubGoal, resolveGoal, evaluateSubGoals, criterionMet, describeCriterion, countSubGoalsDone,
    abdicate, log, todayStr, daysBetween, ERA_NAMES
  };
})();
