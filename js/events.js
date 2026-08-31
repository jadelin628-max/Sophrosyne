/* Sophrosyne — 事件绑定（独立模块）
 * 从 UI 层剥离：所有交互绑定集中于此，经 api 门面调用 UI 的渲染/导航/动作方法，
 * 并统一通过 api 读写界面状态（state / 选中项 / 待确认草案 / 已存密钥等）。
 * 引擎规则仍只存在于 engine.js，本模块不包含业务规则。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Events = (function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function bind(api) {
    const Engine = window.Sophrosyne.Engine;
    const Store = window.Sophrosyne.Store;
    const Scenes = window.Sophrosyne.Scenes;
    const LLM = window.Sophrosyne.LLM;
    const S = () => api.getState();   // 始终取最新 state 引用（reset/import/tick 会整体替换）

    // 皇宫地图导航
    $("#palace-map").addEventListener("click", (e) => {
      const b = e.target.closest(".bldg");
      if (b) api.openView(b.dataset.building);
    });
    $$(".back-btn[data-back]").forEach(btn => btn.addEventListener("click", api.backToPalace));
    $$(".back-btn[data-close]").forEach(btn => btn.addEventListener("click", () => {
      const d = btn.closest(".view-details"); if (d) d.classList.remove("open");
    }));

    // 一级按钮（场景选择 / 链切换 / 开始 / 动作 / 信息展开 / 预约）——事件委托
    document.addEventListener("click", (e) => {
      const sceneBtn = e.target.closest(".scene-btn");
      if (sceneBtn) { api.selectedSceneId = sceneBtn.dataset.scene; api.updateVenueSelection(); return; }
      const chainBtn = e.target.closest(".chain-toggle");
      if (chainBtn) { api.selectedChain = chainBtn.dataset.chain; api.updateVenueSelection(); return; }
      const startBtn = e.target.closest(".venue-start");
      if (startBtn) { api.startFromVenue(startBtn); return; }
      const actBtn = e.target.closest(".act-btn");
      if (actBtn) { api.handleVenueAction(actBtn.dataset.act, actBtn); return; }
      const infoBtn = e.target.closest(".info-btn");
      if (infoBtn) { api.revealPanels(infoBtn.dataset.targets.split(",")); return; }
      const appointBtn = e.target.closest(".appoint-btn");
      if (appointBtn) { Engine.scheduleAppointment(S(), appointBtn.dataset.appoint); api.renderAll(); api.toast("已预约，一刻钟内须临朝。"); return; }
      const quickBtn = e.target.closest("[data-quick-scene]");
      if (quickBtn) {
        const r = Engine.startFocus(S(), quickBtn.dataset.quickScene, "main", "");
        if (r && r.blocked) api.toast(r.reason); else { api.renderAll(); api.toast("已开始临朝。"); }
        return;
      }
    });
    document.addEventListener("input", (e) => {
      if (!e.target.classList.contains("venue-task")) return;
      const pick = e.target.closest(".venue-pick");
      const sel = pick.querySelector(".venue-selected");
      const sc = api.selectedSceneId ? Scenes.get(api.selectedSceneId) : null;
      sel.textContent = sc ? '将临朝：「' + sc.name + '」' + (e.target.value.trim() ? "——" + e.target.value.trim() : "") : "尚未择政务。";
    });

    $("#focus-complete").addEventListener("click", () => { const r = Engine.completeFocus(S()); api.renderAll(); api.toast(r ? "功成！主要政务 #" + r.number : "已功成"); });
    $("#focus-abandon").addEventListener("click", () => { const v = Engine.abandonFocus(S()); if (v) api.openVerdict(v.target, "临朝中失守，当廷议裁定。"); });
    $("#appointment-fulfill").addEventListener("click", () => {
      const r = Engine.fulfillAppointment(S());
      if (r && r.blocked) { api.toast(r.reason); return; }
      api.renderAll(); api.toast("守信履约，威望 +1，开始临朝。");
    });
    $("#appointment-miss").addEventListener("click", () => { Engine.missAppointment(S()); api.renderAll(); api.toast("失信失约，威望 -1。"); });

    $("#verdict-collapse").addEventListener("click", () => { Engine.verdict(S(), api.verdictTarget, "collapse", null); api.closeVerdict(); api.renderAll(); api.toast("已废黜，纪录清零。"); });
    $("#verdict-precedent").addEventListener("click", () => { Engine.verdict(S(), api.verdictTarget, "precedent", $("#verdict-text").value.trim()); api.closeVerdict(); api.renderAll(); api.toast("已下诏成例。"); });

    $("#policy-cancel").addEventListener("click", () => $("#policy-modal").hidden = true);
    $("#policy-save").addEventListener("click", () => {
      const name = $("#policy-name").value.trim();
      if (!name) { api.toast("请输入制度名。"); return; }
      const r = Engine.addPolicy(S(), { name, group: $("#policy-group").value.trim(), flavor: $("#policy-flavor").value.trim(), parentId: $("#policy-parent").value || null });
      if (!r.ok) { api.toast(r.reason); return; }
      $("#policy-modal").hidden = true; api.renderAll(); api.toast("已颁行制度：「" + name + "」");
    });
    $("#policy-tree").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]"); if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      if (act === "collapse") {
        if (confirm("诏废「" + (S().policies.find(p => p.id === id)?.name || "") + "」及其从属制度？")) { const r = Engine.collapsePolicy(S(), id); api.renderAll(); api.toast(r.revived ? "赖升级之资复活，降级免删。" : "已诏废。"); }
      } else if (act === "rescue") { Engine.rescuePolicy(S(), id, null); api.renderAll(); api.toast("已迁都改隶为根基制度。"); }
      else if (act === "upgrade") { const r = Engine.upgradePolicy(S(), id); api.renderAll(); api.toast(r.ok ? "已升级。" : r.reason); }
      else if (act === "strengthen") { const r = Engine.strengthenPolicy(S(), id); api.renderAll(); api.toast(r.ok ? "已强化。" : r.reason); }
    });

    $("#heir-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hact]"); if (!btn) return;
      const r = Engine.trainHeir(S(), btn.dataset.id); api.renderAll(); api.toast(r.ok ? "已培养。" : r.reason);
    });

    $("#event-cancel").addEventListener("click", () => $("#event-modal").hidden = true);
    $("#event-enter").addEventListener("click", () => {
      const text = $("#event-text").value.trim();
      if (!text) { api.toast("请描述事件。"); return; }
      const decisions = [];
      $$("#event-policies .ev-policy").forEach(row => {
        const checked = row.querySelector('input[type="radio"]:checked');
        if (checked && checked.value !== "ignore") decisions.push({ policyId: row.dataset.policyId, decision: checked.value });
      });
      Engine.adjudicateEvent(S(), { text, decisions });
      $("#event-modal").hidden = true; api.renderAll(); api.toast("已报备并逐项裁决。");
    });
    $("#settle-apply").addEventListener("click", () => {
      if (!api.pendingSettlement) return;
      const entries = [];
      $$("#settle-entries .settle-entry").forEach(row => {
        const title = row.querySelector(".se-title").value.trim();
        const note = row.querySelector(".se-note").value.trim();
        const effects = {};
        row.querySelector(".se-effects").value.split(",").forEach(pair => {
          const idx = pair.indexOf(":"); if (idx <= 0) return;
          const k = pair.slice(0, idx).trim(); const n = Number(pair.slice(idx + 1));
          if (k && Number.isFinite(n)) effects[k] = n;
        });
        entries.push({ title, note, effects });
      });
      Engine.applySettlementDraft(S(), { entries });
      api.pendingSettlement = null;
      $("#settle-modal").hidden = true; api.renderAll(); api.toast("岁末结算完成。");
    });
    $("#settle-reject").addEventListener("click", async () => {
      const r = await Engine.proposeSettlement(S(), false);
      api.pendingSettlement = r; api.renderSettleEntries(r);
    });
    $("#send-cancel").addEventListener("click", () => $("#send-modal").hidden = true);
    $("#send-confirm").addEventListener("click", () => {
      $("#send-modal").hidden = true;
      api.doSettle($("#send-confirm"));
    });

    $("#goal-cancel").addEventListener("click", () => $("#goal-modal").hidden = true);
    $("#goal-save").addEventListener("click", () => {
      const name = $("#goal-name").value.trim();
      if (!name) { api.toast("请输入大目标。"); return; }
      Engine.addGoal(S(), { name, flavor: $("#goal-flavor").value.trim() });
      $("#goal-modal").hidden = true; $("#goal-name").value = ""; $("#goal-flavor").value = ""; api.renderAll();
    });
    $("#goal-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-gact]"); if (!btn) return;
      if (btn.dataset.gact === "sub") { api.subGoalGoalId = btn.dataset.id; api.openSubGoalModal(); }
      else { Engine.resolveGoal(S(), btn.dataset.id, btn.dataset.gact); api.renderAll(); }
    });
    $("#subgoal-add-criterion").addEventListener("click", () => {
      $("#subgoal-criteria").insertAdjacentHTML("beforeend", api.criterionRowHtml("focus-total"));
    });
    $("#subgoal-criteria").addEventListener("change", (e) => {
      const row = e.target.closest(".criterion"); if (!row) return;
      if (e.target.classList.contains("crit-type")) {
        const args = row.querySelector(".crit-args");
        args.innerHTML = api.criterionArgsHtml(e.target.value);
      }
    });
    $("#subgoal-criteria").addEventListener("click", (e) => {
      const rm = e.target.closest(".crit-remove"); if (!rm) return;
      const box = $("#subgoal-criteria");
      rm.closest(".criterion").remove();
      if (!box.querySelector(".criterion")) box.insertAdjacentHTML("beforeend", api.criterionRowHtml("focus-total"));
    });
    $("#subgoal-cancel").addEventListener("click", () => $("#subgoal-modal").hidden = true);
    $("#subgoal-save").addEventListener("click", () => {
      const name = $("#subgoal-name").value.trim();
      if (!name || !api.subGoalGoalId) { api.toast("请填写名称。"); return; }
      const criteria = api.collectCriteria();
      if (!criteria.length) { api.toast("请至少添加一条评判标准。"); return; }
      const r = Engine.addSubGoal(S(), api.subGoalGoalId, { name, criteria });
      $("#subgoal-modal").hidden = true; api.renderAll(); api.toast(r.ok ? "已分解阶段目标。" : r.reason);
    });

    $("#abdicate-cancel").addEventListener("click", () => $("#abdicate-modal").hidden = true);
    $("#abdicate-confirm").addEventListener("click", async () => {
      const mode = $("#abdicate-mode").value;
      const heirId = $("#abdicate-heir").value || null;
      const btn = $("#abdicate-confirm"); btn.disabled = true; btn.textContent = "结算中…";
      let r;
      try { r = await Engine.abdicate(S(), "禅位", { mode, heirId }); }
      catch (e) { api.toast("驾崩出错：" + e.message); btn.disabled = false; btn.textContent = "确认禅位"; return; }
      btn.disabled = false; btn.textContent = "确认禅位";
      $("#abdicate-modal").hidden = true; api.renderAll();
      api.toast("已禅位，谥「" + r.score.posthumous + "」" + (r.score.temple ? "，庙号「" + r.score.temple + "」" : "") + "。新君「" + S().reign.eraName + "」即位。");
    });

    $("#settings-btn").addEventListener("click", () => {
      $("#set-dynasty").value = S().dynasty.name || ""; $("#set-era").value = S().reign.eraName || "";
      const llm = S().settings.llm || {};
      api.storedLlmKey = llm.apiKey || "";
      $("#set-llm-base").value = llm.baseUrl || "";
      $("#set-llm-key").value = "";   // 不把真实密钥回填输入框：脱敏展示
      $("#set-llm-key").placeholder = api.storedLlmKey ? "已配置（脱敏 · 留空则保持不变，输入新值可覆盖）" : "sk-...";
      $("#set-llm-model").value = llm.model || "";
      const st = $("#llm-status");
      if (st) {
        if (api.llmConfigured()) st.textContent = "已配置：Base URL / 模型 / 密钥均已就绪。";
        else if (api.storedLlmKey || llm.baseUrl || llm.model) st.textContent = "部分配置：请补齐 Base URL、API Key 与模型名。";
        else st.textContent = "未配置：结算将使用本地确定性规则，不外发数据。";
      }
      $("#settings-modal").hidden = false;
    });
    $("#status-row").addEventListener("click", () => {
      const nav = $("#status-row").dataset.nav;
      if (nav) api.openView(nav);
    });
    $("#console-toggle").addEventListener("click", () => {
      const body = $("#console-body"), btn = $("#console-toggle");
      const hidden = body.hidden; body.hidden = !hidden;
      btn.textContent = hidden ? "▴" : "▾";
      btn.setAttribute("aria-expanded", String(hidden));
    });
    $("#console-review").addEventListener("click", () => api.openView("record"));
    // 键盘可达：status-row 与模态 ESC 关闭
    $("#status-row").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#status-row").click(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      let closed = false;
      $$(".modal").forEach(m => { if (!m.hidden) { m.hidden = true; closed = true; } });
      if (closed && api.verdictTarget) api.verdictTarget = null;
    });
    $("#settings-cancel").addEventListener("click", () => $("#settings-modal").hidden = true);
    $("#settings-save").addEventListener("click", () => {
      if ($("#set-dynasty").value.trim()) S().dynasty.name = $("#set-dynasty").value.trim();
      if ($("#set-era").value.trim()) S().reign.eraName = $("#set-era").value.trim();
      const keyInput = $("#set-llm-key").value.trim();
      S().settings.llm = { baseUrl: $("#set-llm-base").value.trim(), apiKey: keyInput || api.storedLlmKey, model: $("#set-llm-model").value.trim() };
      Store.save(S()); $("#settings-modal").hidden = true; api.renderAll(); api.toast("已保存。");
    });
    $("#llm-key-clear").addEventListener("click", () => {
      api.storedLlmKey = ""; $("#set-llm-key").value = ""; $("#set-llm-key").placeholder = "sk-...";
      api.toast("已清除已存密钥（点「保存」后生效）。");
    });
    $("#reset-btn").addEventListener("click", () => {
      if (!confirm("确定完全重置所有数据？")) return;
      api.setState(Engine.tick(Store.reset())); $("#settings-modal").hidden = true; api.renderAll(); api.toast("已重置。");
    });
    $("#export-btn").addEventListener("click", () => {
      const dump = JSON.parse(JSON.stringify(S()));
      if (dump.settings && dump.settings.llm) delete dump.settings.llm.apiKey; // 导出脱敏，备份文件不含密钥
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sophrosyne-backup-" + Engine.todayStr() + ".json";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); api.toast("已导出存档（不含 API Key）。");
    });
    $("#import-btn").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = Store.revive(JSON.parse(reader.result));
          if (!obj) throw new Error("格式不符：缺少 reign / chains / policies 结构");
          api.setState(Engine.tick(obj)); Store.save(S()); api.renderAll(); api.toast("已导入。");
        } catch (err) { api.toast("导入失败：" + err.message); }
      };
      reader.readAsText(f); e.target.value = "";
    });

    $("#llm-ask").addEventListener("click", async () => {
      const btn = $("#llm-ask"); btn.disabled = true; btn.textContent = "史官拟诏中…";
      try { const text = await LLM.ask(S(), $("#llm-task").value); $("#llm-result").textContent = text; $("#llm-result").hidden = false; $("#llm-actions").hidden = false; }
      catch (err) { $("#llm-result").textContent = "出错：" + err.message; $("#llm-result").hidden = false; $("#llm-actions").hidden = false; }
      finally { btn.disabled = false; btn.textContent = "召唤史官"; }
    });
    $("#llm-append").addEventListener("click", () => {
      const text = $("#llm-result").textContent;
      if (text && !text.startsWith("出错")) { Engine.log(S(), "【史官】" + text); Store.save(S()); api.renderAll(); api.toast("已采纳入起居注。"); }
      $("#llm-modal").hidden = true;
    });
    $("#llm-close").addEventListener("click", () => $("#llm-modal").hidden = true);

    $("#setup-save").addEventListener("click", () => {
      if ($("#setup-dynasty").value.trim()) S().dynasty.name = $("#setup-dynasty").value.trim();
      if ($("#setup-era").value.trim()) S().reign.eraName = $("#setup-era").value.trim();
      Store.save(S()); $("#setup-modal").hidden = true; api.renderAll();
    });
  }

  return { bind };
})();
