/* Sophrosyne — 内置大模型（史官 AI · 一日现实任务 → 一年皇帝政务 + 数据结算）
 * 提示词极其重要：向模型完整交代本应用的逻辑（熵潮/政务/修身/典章制度/固化度/下必为例），
 * 并输入今日真实任务、当前全部数据、本朝起居录与前朝实录，以避免前后矛盾。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.LLM = (function () {
  const Metrics = window.Sophrosyne.Metrics;
  const Scenes = window.Sophrosyne.Scenes;

  const SYSTEM = [
    "你是「Sophrosyne·临朝」中的宫廷史官，为一位以「皇帝临朝治国」方式践行自我管理的用户做「岁末结算」。",
    "背景与世界观：",
    "- 用户把拖延/成瘾/启动困难等自控问题，抽象为「熵潮」侵蚀国土；",
    "- 用户每天（现实）完成的真实事务，将折算为皇帝这一年的「政务」（学习/工作）与「修身」（锻炼/阅读/社交等）；",
    "- 用户的长期习惯/规则记为「典章制度」，以「固化度」（坚持天数）衡量其是否深入人心；",
    "- 「下必为例」：一旦某行为被判为允许，便成为成例，不得再反悔。",
    "你的任务：把今日的真实任务，风味化为这一年（可分配到正月到腊月的不同月份）皇帝所做的具体政务/事务，并决定每项对国力的增减（可增可减，符合常理）。",
    "要求：",
    "1. 语气雅正、精炼、有古风，通俗可读，不堆砌文言；",
    "2. 增减幅度要克制、合理，与真实任务的分量匹配（普通一天不必惊天动地）；",
    "3. 必须引用给定数据，前后自洽；不凭空捏造史实；",
    "4. effects 中的增减值必须是 JSON 数字（不可为字符串或缺失键名的猜测值）；",
    "5. 只输出 JSON，不要输出任何多余文字。",
  ].join("\n");

  function config(state) {
    return (state.settings && state.settings.llm) || {};
  }

  function metricLegend() {
    return Metrics.STORED_KEYS.map(k => {
      const d = Metrics.DEFS[k];
      return d.name + "(" + k + ",单位" + (d.unit || "指数") + ",初始" + d.initial + (d.max === 100 ? ",范围0-100" : "") + ")";
    }).join("、");
  }

  function context(state) {
    const r = state.reign;
    const m = r.metrics;
    const a = r.attributes;
    const policies = state.policies.filter(p => p.status === "active");
    const lines = [];
    lines.push("【国号/年号】" + (state.dynasty.name || "未定") + " " + r.eraName + "，在位第 " + (window.Sophrosyne.Engine ? window.Sophrosyne.Engine.reignYears(state) : 1) + " 年");
    lines.push("【当前国力】" + Metrics.STORED_KEYS.map(k => Metrics.DEFS[k].name + "=" + Math.round(m[k]) + Metrics.DEFS[k].unit).join("；"));
    lines.push("【个人属性】健康 " + a.health + " 精力 " + a.energy + " 才华 " + a.talent + " 智力 " + a.intellect + " 心性 " + a.composure + " 魅力 " + a.charm + " 威望 " + a.prestige);
    lines.push("【在行制度】" + (policies.length ? policies.map(p => p.name + "（固化度" + p.solidity + "）").join("、") : "无"));
    const recent = state.log.slice(0, 15);
    lines.push("【近闻起居录】" + (recent.length ? recent.map(e => "- " + e.date + " " + e.text).join("\n") : "（空）"));
    const prev = state.dynasty.lineage.slice(-3);
    lines.push("【前朝实录（摘要）】" + (prev.length ? prev.map(l => l.eraName + "·在位" + l.years + "年·谥" + (l.posthumous || "?")).join("；") : "（无）"));
    return lines.join("\n");
  }

  function buildSettlePrompt(state, tasks) {
    const taskLines = tasks.map((t, i) => {
      const sc = Scenes.get(t.sceneId);
      return (i + 1) + ". " + (sc ? sc.name : t.sceneId) + (t.realTask ? "（真实任务：" + t.realTask + "）" : "") + "，" + (t.chain === "reserve" ? "次要政务" : "主要政务");
    }).join("\n");
    return context(state) +
      "\n\n【今日真实事务】\n" + taskLines +
      "\n\n【可选指标键】" + metricLegend() +
      "\n\n请将上述真实事务折算为皇帝这一年的政务/事务，按月（正月…腊月）分配风味化，并决定对国力的增减。只输出如下 JSON（无其他文字）：" +
      "\n{\"entries\":[{\"month\":\"正月\",\"title\":\"帝御门听政，批阅奏章\",\"effects\":{\"treasury\":1000,\"order\":2},\"note\":\"一句史官评语\"}]}";
  }

  const REQUEST_TIMEOUT_MS = 60000;

  async function chat(state, userContent) {
    const cfg = config(state);
    if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) throw new Error("请先在「设置」配置大模型（Base URL / API Key / 模型名）。");
    const url = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userContent },
          ],
          temperature: 0.7,
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "请求超时（" + REQUEST_TIMEOUT_MS / 1000 + " 秒），请检查网络或稍后再试。" : "网络请求失败：" + e.message);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("LLM 返回 HTTP " + res.status + "：" + t.slice(0, 200));
    }
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error("LLM 返回的不是有效 JSON（可能是网关错误页）。"); }
    const c = data.choices && data.choices[0] && data.choices[0].message;
    return c ? c.content.trim() : "";
  }

  function extractJson(text) {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    try { return JSON.parse(text.slice(s, e + 1)); }
    catch (err) { return null; }
  }

  // 岁末结算：返回 entries 数组；失败抛错（引擎会回退到默认增减）
  async function settle(state, tasks) {
    const text = await chat(state, buildSettlePrompt(state, tasks));
    const obj = extractJson(text);
    if (!obj || !Array.isArray(obj.entries)) throw new Error("LLM 输出无法解析为 JSON");
    return obj.entries.filter(e => e && typeof e === "object" && (e.title || e.note || e.effects));
  }

  // 通用史官评语（起居评语 / 复盘建议 / 盖棺定论）
  async function ask(state, task) {
    let extra = "";
    if (task === "diary") extra = "\n\n请为今日写一则「史官起居评语」（3-6 句、120 字内，含下一步建议）。";
    else if (task === "review") {
      const fallen = state.policies.filter(p => p.status === "fallen").slice(-5).map(p => p.name).join("、") || "（无）";
      extra = "\n\n近期废止制度：" + fallen + "\n请写一则「朝政复盘建议」（分析崩因 + 零敲牛皮糖式拆分改进）。";
    } else if (task === "posthumous") {
      const last = state.dynasty.lineage[state.dynasty.lineage.length - 1];
      if (!last) extra = "\n\n太庙尚空，请说明暂无先帝可评。";
      else extra = "\n\n先帝：" + last.eraName + "（在位" + last.years + "年，谥「" + last.posthumous + "」" + (last.temple ? "，庙号「" + last.temple + "」" : "") + "）。依据：" + (last.score && last.score.reason) + "\n请写「盖棺定论」评语。";
    }
    return chat(state, context(state) + extra);
  }

  // 谥号双轨：大模型评定谥号庙号 + 盖棺定论
  async function posthumous(state, goals, subGoalDone) {
    const goalTxt = (goals || []).map(g => g.name + (g.status === "done" ? "（成）" : "（败）")).join("、") || "无";
    const prompt = context(state) +
      "\n\n本朝大目标：" + goalTxt + "，阶段目标达成 " + (subGoalDone || 0) + " 项。" +
      "\n请为驾崩的皇帝评定谥号与庙号，并写一则盖棺定论评语。只输出 JSON：{\"posthumous\":\"武\",\"temple\":\"太宗\",\"eulogy\":\"评语\"}";
    const text = await chat(state, prompt);
    const obj = extractJson(text);
    if (!obj || !obj.posthumous) throw new Error("LLM 输出无法解析");
    return { posthumous: obj.posthumous, temple: obj.temple || null, eulogy: obj.eulogy || "" };
  }

  // 即位诏书风味化
  async function accession(state, heirName, newAge) {
    const prompt = context(state) + "\n\n新君即位：" + (heirName || "宗室") + "，春秋 " + newAge + " 岁。请写一则即位诏书（3-5 句，古风，称「朕」）。";
    return chat(state, prompt);
  }

  return { settle, ask, posthumous, accession, chat, context, buildSettlePrompt, extractJson, SYSTEM, config, metricLegend };
})();
