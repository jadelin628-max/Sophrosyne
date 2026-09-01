/* Sophrosyne — 内置大模型（史官 AI）
 * 0.6.0：提示词现代化 + 输入输出限额 + 双语起居录 + 国策风味化 + 议定先帝。
 * 提示词可在设置页自定义（存 settings.prompts），留空回退 DEFAULT_PROMPTS。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.LLM = (function () {
  const Metrics = window.Sophrosyne.Metrics;
  const Scenes = window.Sophrosyne.Scenes;
  const Engine = () => window.Sophrosyne.Engine;

  const DEFAULT_PROMPTS = {
    system: [
      "你是「Sophrosyne·临朝」的宫廷史官，为一位以「皇帝临朝治国」方式践行自我管理的用户服务。",
      "世界观与术语：",
      "- 用户每天（现实）完成的真实事务，折算为皇帝这一年的「政务」（学习/工作）与「修身」（锻炼/阅读/社交等）；",
      "- 长期习惯/规则记为「典章制度」，以「固化度」（坚持天数）衡量是否深入人心；制度含可执行规则：触发条件、最小行动、完成证据、允许例外、恢复动作；",
      "- 「下必为例」：一旦某行为被判为允许，即成为成例，不得再反悔；",
      "- 「金口玉言」：皇帝对预约的承诺链，失信一次则整链作废；",
      "- 用户可立「国策」（现实大目标，可为御敌亦可为国内改革），并分解「阶段目标」。",
      "通用要求：",
      "1. 语气雅正、精炼、有古风，通俗可读，不堆砌文言；",
      "2. 增减幅度克制合理，与真实任务分量匹配；",
      "3. 必须引用给定数据，前后自洽，不凭空捏造史实；",
      "4. effects 中的增减值必须是 JSON 数字（不得为字符串或猜测键名）；",
      "5. 只输出要求的 JSON，不输出任何多余文字。",
    ].join("\n"),

    settle: [
      "请为皇帝这一年（正月…腊月）撰写一份完整的「起居录」，把今日的真实事务、国策与制度都风味化为具体的历史事件与故事，合理有趣地反映一位皇帝一年的生活与政务。",
      "一、生成 10–24 条起居录条目 entries，按月份（正月→腊月）排序，每条含：",
      "  month（月份）、title（简短标题）、classical（古代起居录体，写成具体事件/故事，如「正月，帝御太和殿，行元日大朝，百官拜贺」）、modern（白话翻译，说明对应的真实行为/含义）、note（一句史官评语，可空）、effects（国力增减，键只能取自【可选指标键】）。",
      "二、条目必须覆盖四类内容：",
      "  1) 今日真实政务：每件折为一条具体事件；effects 给与真实事务分量匹配的增减；",
      "  2) 国策实施：对每个国策，用其风味名写一条今年推进情况的事件（无 effects 或微小）；",
      "  3) 制度维护：对每个在行制度，用其风味名写一条坚持/守制的事件（无 effects 或微小）；",
      "  4) 岁时节气与宫廷日常：酌情加入元日大朝、仲春劝农、科举取士、秋狝、冬至祭天、腊月封印等，充实一年。",
      "三、同时输出（用于更新国策/制度/阶段目标的显示名与评述）：goalTitles（国策风味名）、goalVerdicts（国策评述）、subGoalTitles（阶段目标风味名）、subGoalVerdicts（阶段目标评述）、policyTitles（制度风味名）。",
      "四、语气雅正精炼、有古风、有趣可读，不堆砌文言；只输出 JSON，无其他文字。",
      "只输出如下 JSON：",
      '{"entries":[{"month":"正月","title":"…","classical":"古体起居录","modern":"白话翻译","note":"…","effects":{"treasury":1000,"order":2}}],"goalTitles":[{"goalId":"…","title":"…"}],"goalVerdicts":[{"goalId":"…","verdict":"…"}],"subGoalTitles":[{"subGoalId":"…","title":"…"}],"subGoalVerdicts":[{"subGoalId":"…","verdict":"…"}],"policyTitles":[{"policyId":"…","title":"…"}]}',
    ].join("\n"),

    posthumous: [
      "请为驾崩的先帝「议定先帝」：依据【前朝实录摘要】【国力变动】【个人属性】【国策与阶段目标实现】做公允的叙事性评定，",
      "给出谥号（1-2 字）、庙号（可为空，不入庙则省略）与盖棺定论（eulogy，史官曰，2-4 句）。",
      "不要重复罗列数值，不要与规则评分的数字重复；只做定性评价，做到不冲突、不重复、尽量合理。",
      "只输出 JSON：{\"posthumous\":\"…\",\"temple\":\"…\",\"eulogy\":\"…\"}",
    ].join("\n"),

    accession: [
      "新君即位。请写一则即位诏书（3-5 句，古风，称「朕」），体现继往开来、励精图治。",
    ].join("\n"),
  };

  function config(state) {
    return (state.settings && state.settings.llm) || {};
  }
  // 用户自定义提示词：settings.prompts[key] 覆盖默认；留空回退默认
  function prompt(state, key) {
    const p = (state.settings && state.settings.prompts) || {};
    return (typeof p[key] === "string" && p[key].trim()) ? p[key] : DEFAULT_PROMPTS[key];
  }
  function truncate(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function metricLegend() {
    return Metrics.STORED_KEYS.map(k => {
      const d = Metrics.DEFS[k];
      return d.name + "(" + k + ",单位" + (d.unit || "指数") + ",初始" + d.initial + (d.max === 100 ? ",范围0-100" : "") + ")";
    }).join("、");
  }

  // 有界上下文（输入限额）：只送入必要摘要，避免 token 溢出
  function context(state) {
    const r = state.reign;
    const m = r.metrics;
    const a = r.attributes;
    const E = Engine();
    const years = E ? E.reignYears(state) : 1;
    const policies = state.policies.filter(p => p.status === "active").slice(0, 10);
    const lines = [];
    lines.push("【国号/年号】" + (state.dynasty.name || "未定") + " " + r.eraName + "，在位第 " + years + " 年");
    lines.push("【当前国力】" + Metrics.STORED_KEYS.map(k => Metrics.DEFS[k].name + "=" + Math.round(m[k])).join("；"));
    lines.push("【个人属性】健康" + a.health + " 精力" + a.energy + " 才华" + a.talent + " 智力" + a.intellect + " 心性" + a.composure + " 魅力" + a.charm + " 威望" + a.prestige);
    lines.push("【金口玉言】已许 " + (state.chains.oath ? state.chains.oath.records.length : 0) + " 诺");
    lines.push("【在行制度】" + (policies.length ? policies.map(p => truncate(p.name, 20) + "（固化" + p.solidity + "）").join("、") : "无"));
    if (r.digest) lines.push("【上轮起居录摘要】" + truncate(r.digest, 600));
    const recent = state.log.slice(0, 8);
    lines.push("【近闻起居录】" + (recent.length ? recent.map(e => "- " + e.date + " " + truncate(e.text, 120)).join("\n") : "（空）"));
    const prev = state.dynasty.lineage.slice(-2);
    lines.push("【前朝实录（摘要）】" + (prev.length ? prev.map(l => l.eraName + "·在位" + l.years + "年·谥" + (l.posthumous || "?") + (l.digest ? "·" + truncate(l.digest, 200) : "")).join("；") : "（无）"));
    const goals = state.goals.filter(g => g.status === "active").slice(0, 5);
    lines.push("【国策列表】" + (goals.length ? goals.map(g => g.id + ":" + truncate(g.title || g.name, 20) + (g.flavor ? "(" + truncate(g.flavor, 20) + ")" : "")).join("；") : "（无进行中国策）"));
    return lines.join("\n");
  }

  function buildSettlePrompt(state, tasks) {
    const taskLines = tasks.map((t, i) => {
      const sc = Scenes.get(t.sceneId);
      return (i + 1) + ". " + (sc ? sc.name : t.sceneId) + (t.realTask ? "（真实任务：" + truncate(t.realTask, 60) + "）" : "") + "，" + (t.chain === "reserve" ? "次要政务" : "主要政务");
    }).join("\n");
    return context(state) +
      "\n\n【今日真实事务】\n" + (taskLines || "（无）") +
      "\n\n【可选指标键】" + metricLegend() +
      "\n\n【在行制度列表】" + JSON.stringify(state.policies.filter(p => p.status === "active").map(p => ({ policyId: p.id, name: p.name, title: p.title }))) +
      "\n\n【国策与阶段目标】" + JSON.stringify(state.goals.filter(g => g.status === "active").map(g => ({ goalId: g.id, name: g.name, title: g.title, flavor: g.flavor, subGoals: (g.subGoals || []).map(sg => ({ subGoalId: sg.id, name: sg.name, done: sg.done })) }))) +
      "\n\n" + prompt(state, "settle");
  }

  const REQUEST_TIMEOUT_MS = 60000;
  async function chat(state, userContent, maxTokens) {
    const cfg = config(state);
    if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) throw new Error("请先在「设置」配置大模型（Base URL / API Key / 模型名）。");
    // 兼容两种写法：Base URL 若已含 /chat/completions 则原样使用，否则拼接
    let url = String(cfg.baseUrl).trim().replace(/\/+$/, "");
    if (!/\/chat\/completions$/.test(url)) url += "/chat/completions";
    // 输出限额：maxTokens=0 表示「不限制」（省略 max_tokens，交给服务商默认）；正数 clamp 到 512–16384；未配置→4096
    const raw = Number(maxTokens);
    const mt = Number.isFinite(raw) ? raw : 4096;
    const body = {
      model: cfg.model,
      messages: [
        { role: "system", content: prompt(state, "system") },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    };
    if (mt > 0) body.max_tokens = Math.max(512, Math.min(16384, mt));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "请求超时（" + REQUEST_TIMEOUT_MS / 1000 + " 秒），请检查网络或稍后再试。" : "网络请求失败：" + e.message);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("LLM 返回 HTTP " + res.status + "（请求 " + url + "）：" + truncate(t, 200));
    }
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error("LLM 返回的不是有效 JSON（可能是网关错误页）。"); }
    const c = data.choices && data.choices[0] && data.choices[0].message;
    if (!c) throw new Error("模型未返回内容（choices 为空）。");
    const content = (typeof c.content === "string") ? c.content : "";
    const reasoning = (typeof c.reasoning_content === "string") ? c.reasoning_content : "";
    // 推理模型：正式结论在 content；若 content 为空，退而用 reasoning_content（结论常在思考末尾）
    const text = content.trim() || reasoning.trim();
    if (!text) throw new Error("模型返回了空内容（无 content 也无 reasoning_content）。");
    return text;
  }

  // 括号配平：截断的 JSON 补齐缺失的闭合括号，用于挽救被 max_tokens 截断的输出
  function balanceJson(s) {
    const stack = [];
    let inStr = false, esc = false;
    for (const ch of s) {
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { inStr = true; continue; }
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") { if (stack.length && stack[stack.length - 1] === ch) stack.pop(); }
    }
    return stack.length ? s + stack.reverse().join("") : s;
  }
  function extractJson(text) {
    if (!text) return null;
    let s = String(text).trim().replace(/```[a-zA-Z]*\s*/g, "").trim();   // 去 markdown 代码围栏
    const i = s.indexOf("{");
    if (i < 0) return null;
    const seg = s.slice(i);
    // 1) 常见情形：完整 JSON（或其后还跟着说明文字）——截到最后一个 } 尝试解析
    const last = seg.lastIndexOf("}");
    if (last >= 0) { try { return JSON.parse(seg.slice(0, last + 1)); } catch (e) { /* 继续尝试 */ } }
    // 2) 被截断：补齐缺失括号再解析
    const repaired = balanceJson(seg);
    if (repaired !== seg) { try { return JSON.parse(repaired); } catch (e) { /* 继续尝试 */ } }
    // 3) 推理模型：思考过程里可能夹多个 {} 片段，结论 JSON 通常在末尾——从右往左逐个尝试
    for (let p = s.lastIndexOf("{"); p >= 0; p = s.lastIndexOf("{", p - 1)) {
      const sub = s.slice(p);
      const e = sub.lastIndexOf("}");
      if (e > 0) { try { const o = JSON.parse(sub.slice(0, e + 1)); if (o && typeof o === "object") return o; } catch (err) {} }
      const b = balanceJson(sub);
      if (b !== sub) { try { const o = JSON.parse(b); if (o && typeof o === "object") return o; } catch (err) {} }
    }
    return null;
  }

  // 岁末结算（旧路径，保留）：返回 entries；失败抛错
  async function settle(state, tasks) {
    const text = await chat(state, buildSettlePrompt(state, tasks), config(state).maxTokens);
    const obj = extractJson(text);
    if (!obj || !Array.isArray(obj.entries)) throw new Error("LLM 输出无法解析为 JSON（原文片段：" + truncate(text, 240) + "）");
    return obj.entries.filter(e => e && typeof e === "object" && (e.title || e.note || e.effects));
  }

  const MAX_ENTRIES = 30;
  const MAX_STR = { title: 80, note: 200, classical: 160, modern: 200, verdict: 240 };
  function cleanStr(v, key) {
    if (typeof v !== "string") return "";
    return v.trim().slice(0, MAX_STR[key] || 120);
  }
  function cleanEffects(eff) {
    const out = {};
    if (eff && typeof eff === "object") {
      for (const k of Object.keys(eff)) {
        if (!Metrics.DEFS[k]) continue;                      // 仅允许合法指标键
        const v = Number(eff[k]);
        if (!Number.isFinite(v)) continue;
        const def = Metrics.DEFS[k];
        const capped = def.max === 100 ? Math.max(-15, Math.min(15, v)) : Math.max(-100000, Math.min(100000, v));
        out[k] = Math.round(capped);
      }
    }
    return out;
  }
  function cleanIdList(arr, keyName, textName, limit) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const it of arr.slice(0, limit || 20)) {
      if (!it || typeof it !== "object") continue;
      const id = typeof it[keyName] === "string" ? it[keyName].trim().slice(0, 40) : "";
      const txt = cleanStr(it[textName], textName === "verdict" ? "verdict" : "title");
      if (!id || !txt) continue;
      out.push({ [keyName]: id, [textName]: txt });
    }
    return out;
  }
  // 严格结构校验：限制条目数、字段名与数值范围；校验新增的双语/国策/评述字段
  function sanitizeDraft(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.entries)) return null;
    const entries = [];
    for (const e of obj.entries.slice(0, MAX_ENTRIES)) {
      if (!e || typeof e !== "object") continue;
      const title = cleanStr(e.title, "title");
      const note = cleanStr(e.note, "note");
      const classical = cleanStr(e.classical, "classical");
      const modern = cleanStr(e.modern, "modern");
      const effects = cleanEffects(e.effects);
      if (!title && !note && !classical && !modern && !Object.keys(effects).length) continue;
      entries.push({ title, note, classical, modern, effects });
    }
    return {
      title: cleanStr(obj.title, "title"),
      note: cleanStr(obj.note, "note"),
      entries,
      goalTitles: cleanIdList(obj.goalTitles, "goalId", "title", 20),
      goalVerdicts: cleanIdList(obj.goalVerdicts, "goalId", "verdict", 20),
      subGoalTitles: cleanIdList(obj.subGoalTitles, "subGoalId", "title", 40),
      subGoalVerdicts: cleanIdList(obj.subGoalVerdicts, "subGoalId", "verdict", 40),
      policyTitles: cleanIdList(obj.policyTitles, "policyId", "title", 30),
    };
  }

  // 提案式岁末结算：返回经严格校验的草案；解析失败抛错（引擎回退本地规则）
  async function proposeSettlement(state, tasks) {
    const text = await chat(state, buildSettlePrompt(state, tasks), config(state).maxTokens);
    const draft = sanitizeDraft(extractJson(text));
    // entries 允许为空（今日无待结算事务，但可能有国策/制度风味化）
    if (!draft) throw new Error("LLM 输出无法解析（原文片段：" + truncate(text, 240) + "）");
    return draft;
  }

  // 议定先帝：谥号庙号 + 盖棺定论（规则评分的叙事补充，二者不重复）
  async function posthumous(state, prevRecord, deltas, goalsSummary, subGoalDone) {
    const parts = [];
    parts.push(context(state));
    if (prevRecord) parts.push("\n\n【前朝实录摘要】\n" + truncate(prevRecord, 900));
    if (deltas) parts.push("\n\n【国力变动（登基→驾崩）】\n" + (Object.keys(deltas).map(k => (Metrics.DEFS[k] ? Metrics.DEFS[k].name : k) + " " + (deltas[k] >= 0 ? "+" : "") + Math.round(deltas[k])).join("；") || "无变动"));
    parts.push("\n\n【个人属性】" + JSON.stringify(state.reign.attributes));
    parts.push("\n\n【国策与阶段目标实现】\n" + (goalsSummary || "无") + "，阶段目标达成 " + (subGoalDone || 0) + " 项。");
    const text = await chat(state, parts.join("") + "\n\n" + prompt(state, "posthumous"), Math.min(512, config(state).maxTokens || 512));
    const obj = extractJson(text);
    if (!obj || !obj.posthumous) throw new Error("LLM 输出无法解析");
    return { posthumous: cleanStr(obj.posthumous, "title").slice(0, 4), temple: cleanStr(obj.temple, "title").slice(0, 4) || null, eulogy: cleanStr(obj.eulogy, "verdict") };
  }

  // 即位诏书风味化
  async function accession(state, heirName, newAge) {
    const p = context(state) + "\n\n新君即位：" + (heirName || "宗室") + "，春秋 " + newAge + " 岁。" + "\n\n" + prompt(state, "accession");
    return chat(state, p, 256);
  }

  // 通用史官评语（保留向后兼容；UI 已收敛到结算/议定先帝）
  async function ask(state, task) {
    let extra = "";
    if (task === "diary") extra = "\n\n请为今日写一则「史官起居评语」（3-6 句、120 字内，含下一步建议）。";
    else if (task === "review") extra = "\n\n请写一则「朝政复盘建议」。";
    else extra = "\n\n请写一则「盖棺定论」评语。";
    return chat(state, context(state) + extra, 512);
  }

  // 测试接通：发一个极小请求，返回 { ok, message }，不抛错（供设置页展示诊断信息）
  async function testConnection(state) {
    const cfg = config(state);
    if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) return { ok: false, message: "请先填写 Base URL / API Key / 模型名。" };
    try {
      const text = await chat(state, "请只回复两个字：接通", 512);
      return { ok: true, message: "已接通：" + truncate(text, 60) };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }

  return { settle, proposeSettlement, sanitizeDraft, posthumous, accession, ask, testConnection, chat, context, buildSettlePrompt, extractJson, prompt, truncate, DEFAULT_PROMPTS, config, metricLegend };
})();
