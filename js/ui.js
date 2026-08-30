/* Sophrosyne — UI 层 v6（阶段 C：政务/事务按地点分布到各宫殿；一级按钮承载动作，二级仅查看） */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.UI = (function () {
  const Engine = Sophrosyne.Engine;
  const Store = Sophrosyne.Store;
  const Scenes = Sophrosyne.Scenes;
  const Metrics = Sophrosyne.Metrics;

  let state = null;
  let selectedSceneId = null;
  let selectedChain = "main";
  let verdictTarget = null;
  let subGoalGoalId = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function trim0(s) { return s.replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1"); }
  function fmtNum(v) {
    v = Math.round(v);
    if (Math.abs(v) >= 1e8) return trim0((v / 1e8).toFixed(2)) + "亿";
    if (Math.abs(v) >= 1e4) return trim0((v / 1e4).toFixed(1)) + "万";
    return String(v);
  }

  const METRIC_GROUPS = [
    { title: "疆土与人口", keys: ["territory", "population", "farmland", "workshop", "merchant"] },
    { title: "财政与储备", keys: ["revenue", "treasury", "grain"] },
    { title: "军事", keys: ["army", "training", "equipment"] },
    { title: "社会与民心", keys: ["support", "order", "corruption", "prestige", "living", "unemployment"] },
    { title: "文教与科技", keys: ["xiuCai", "juRen", "jinShi", "cultureScore", "tech", "infra", "diplomacy"] },
  ];

  // 各殿宇（场馆）说明与一级动作按钮
  const VENUES = {
    taihemen:     { name: "太和门", sub: "外朝 · 御门听政" },
    taihedian:    { name: "太和殿", sub: "外朝 · 大典营造" },
    baohe:        { name: "保和殿", sub: "外朝 · 殿试取士" },
    qianqinggong: { name: "乾清宫", sub: "内廷 · 听政理政" },
    junjichu:     { name: "军机处", sub: "军国 · 经略" },
    wenhuadian:   { name: "文华殿", sub: "文教 · 经筵讲学" },
    wuyingdian:   { name: "武英殿", sub: "武备 · 操练" },
    wenyuange:    { name: "文渊阁", sub: "文教 · 修典史馆" },
    yangxindian:  { name: "养心殿", sub: "修身 · 内务" },
    kunninggong:  { name: "坤宁宫", sub: "后宫 · 琴瑟" },
    neiweufu:     { name: "内务府", sub: "内廷 · 理财" },
    yushanfang:   { name: "御膳房", sub: "内廷 · 药膳" },
    shangshufang: { name: "上书房", sub: "内廷 · 育才" },
    qintianjian:  { name: "钦天监", sub: "内廷 · 历法祭祀" },
    changyinge:   { name: "畅音阁", sub: "内廷 · 宴乐" },
    yuhuayuan:    { name: "御花园", sub: "颐养 · 风雅" },
  };
  const VENUE_ACTIONS = {
    qianqinggong: [ { label: "报备突发事件", act: "event" }, { label: "立大志", act: "goal" } ],
    junjichu:     [ { label: "颁行制度", act: "policy-add" } ],
    wenyuange:    [ { label: "史官 AI", act: "llm" } ],
    qintianjian:  [ { label: "岁末结算", act: "settle" } ],
  };
  // 二级详情面板（默认收起）：每个场馆的信息按钮 → 展开对应面板
  const VENUE_INFO = {
    taihemen:     [ { label: "本殿事务", targets: ["[data-venue-info=taihemen]"] } ],
    taihedian:    [ { label: "勤政纪录", targets: ["#chain-main", "#chain-reserve"] } ],
    baohe:        [ { label: "本殿事务", targets: ["[data-venue-info=baohe]"] } ],
    qianqinggong: [
      { label: "今日国是", targets: ["#court-today"] },
      { label: "国力各项", targets: ["#court-metrics"] },
      { label: "突发事件", targets: ["#event-status"] },
      { label: "大目标", targets: ["#goal-list"] },
      { label: "近闻", targets: ["#court-log"] },
    ],
    junjichu:     [ { label: "典章制度树", targets: ["#policy-tree"] } ],
    wenhuadian:   [ { label: "本殿事务", targets: ["[data-venue-info=wenhuadian]"] } ],
    wuyingdian:   [ { label: "军备", targets: ["#wuying-metrics"] } ],
    wenyuange:    [ { label: "起居注", targets: ["#full-log"] } ],
    yangxindian:  [ { label: "圣躬属性", targets: ["#court-attrs"] } ],
    kunninggong:  [ { label: "本殿事务", targets: ["[data-venue-info=kunninggong]"] } ],
    neiweufu:     [ { label: "本殿事务", targets: ["[data-venue-info=neiweufu]"] } ],
    yushanfang:   [ { label: "本殿事务", targets: ["[data-venue-info=yushanfang]"] } ],
    shangshufang: [ { label: "子嗣", targets: ["#heir-list"] } ],
    qintianjian:  [ { label: "岁末结算", targets: ["#settle-hint"] } ],
    changyinge:   [ { label: "本殿事务", targets: ["[data-venue-info=changyinge]"] } ],
    yuhuayuan:    [ { label: "本殿事务", targets: ["[data-venue-info=yuhuayuan]"] } ],
  };

  // 宫殿交互点（x/y=中心, s=热点边长, l=标签, v=点击进入的视图）——按精确紫禁城平面图对位
  const PALACE = [
    // 中轴（北→南）
    { x: 320, y: 81,  s: 70,  l: "神武门" },
    { x: 320, y: 198, s: 90,  l: "御花园", v: "yuhuayuan" },
    { x: 320, y: 310, s: 80,  l: "坤宁宫", v: "kunninggong" },
    { x: 320, y: 384, s: 62,  l: "交泰殿" },
    { x: 320, y: 471, s: 100, l: "乾清宫", v: "court" },
    { x: 320, y: 546, s: 70,  l: "乾清门" },
    { x: 320, y: 632, s: 86,  l: "保和殿", v: "baohe" },
    { x: 320, y: 707, s: 62,  l: "中和殿" },
    { x: 320, y: 806, s: 118, l: "太和殿", v: "focus" },
    { x: 320, y: 967, s: 84,  l: "太和门", v: "taihemen" },
    { x: 320, y: 1141, s: 84, l: "午门" },
    // 西侧（内廷·西六宫/养心殿/军机处/隆宗门；外朝·武英殿/弘义阁；服务·御膳房/内务府）
    { x: 83,  y: 248, s: 66,  l: "慈宁宫" },
    { x: 90,  y: 328, s: 44,  l: "永寿宫" },
    { x: 128, y: 328, s: 44,  l: "翊坤宫" },
    { x: 90,  y: 404, s: 44,  l: "储秀宫" },
    { x: 128, y: 404, s: 44,  l: "咸福宫" },
    { x: 90,  y: 476, s: 44,  l: "长春宫" },
    { x: 128, y: 476, s: 44,  l: "太极殿" },
    { x: 98,  y: 530, s: 72,  l: "养心殿", v: "chain" },
    { x: 130, y: 560, s: 52,  l: "军机处", v: "policy" },
    { x: 170, y: 550, s: 38,  l: "隆宗门" },
    { x: 150, y: 806, s: 42,  l: "弘义阁" },
    { x: 90,  y: 918, s: 80,  l: "武英殿", v: "wuyingdian" },
    { x: 70,  y: 719, s: 52,  l: "御膳房", v: "yushanfang" },
    { x: 72,  y: 818, s: 54,  l: "内务府", v: "neiweufu" },
    { x: 22,  y: 880, s: 38,  l: "西华门" },
    // 东侧（内廷·东六宫/奉先殿/上书房/景运门/宁寿宫/畅音阁/钦天监；外朝·文华殿/文渊阁/体仁阁）
    { x: 557, y: 248, s: 70, l: "宁寿宫" },
    { x: 514, y: 328, s: 44, l: "景仁宫" },
    { x: 552, y: 328, s: 44, l: "承乾宫" },
    { x: 514, y: 404, s: 44, l: "钟粹宫" },
    { x: 552, y: 404, s: 44, l: "景阳宫" },
    { x: 514, y: 476, s: 44, l: "永和宫" },
    { x: 552, y: 476, s: 44, l: "延禧宫" },
    { x: 508, y: 484, s: 64, l: "奉先殿", v: "history" },
    { x: 528, y: 512, s: 56, l: "上书房", v: "shangshufang" },
    { x: 462, y: 546, s: 38, l: "景运门" },
    { x: 566, y: 452, s: 52, l: "畅音阁", v: "changyinge" },
    { x: 518, y: 560, s: 54, l: "钦天监", v: "qintianjian" },
    { x: 486, y: 806, s: 42, l: "体仁阁" },
    { x: 544, y: 818, s: 72, l: "文渊阁", v: "record" },
    { x: 544, y: 918, s: 82, l: "文华殿", v: "wenhuadian" },
    { x: 616, y: 880, s: 38, l: "东华门" },
  ];

  function init(s, opts) {
    state = s;
    renderVenueHeros();
    bindEvents();
    renderPalace();
    renderAll();
    setInterval(updateTimers, 1000);
    if (opts && opts.firstRun) $("#setup-modal").hidden = false;
  }
  function renderPalace() {
    const svg = $("#palace-map");
    if (!svg) return;
    // 单张俯视平面图铺满 viewBox
    let html = '<rect x="0" y="0" width="640" height="1240" fill="#171310"/>' +
      '<image href="assets/generated/palace_plan.webp" x="0" y="0" width="640" height="1240" preserveAspectRatio="none"/>';
    // 各建筑：可点 → 交互热点 + 标签；装饰 → 仅标签
    for (const b of PALACE) {
      const cx = b.x - b.s / 2, cy = b.y - b.s / 2;
      const tx = b.x, ty = b.y + b.s / 2 + 14;
      if (b.v) {
        html += '<g class="bldg" data-building="' + b.v + '">' +
          '<rect class="hotspot" x="' + cx + '" y="' + cy + '" width="' + b.s + '" height="' + b.s + '" rx="7"/>' +
          '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" fill="#f6df9b" font-size="12" stroke="#1d1510" stroke-width="3" paint-order="stroke">' + b.l + '</text></g>';
      } else {
        html += '<g class="bldg-deco">' +
          '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" fill="#c9a227" font-size="11" stroke="#1d1510" stroke-width="3" paint-order="stroke" opacity="0.85">' + b.l + '</text></g>';
      }
    }
    svg.insertAdjacentHTML("beforeend", html);
  }

  // 各殿宇 hero：一次渲染结构（场景按钮 + 任务输入 + 开始 + 动作按钮 + 信息按钮）
  function renderVenueHeros() {
    $$("[data-venue-hero]").forEach(el => {
      const key = el.dataset.venueHero;
      const v = VENUES[key];
      if (!v) return;
      const scenes = Scenes.byVenue(key);
      const sceneBtns = scenes.map(c =>
        '<div class="scene-item">' +
          '<button class="scene-btn" data-scene="' + c.id + '">' + escapeHtml(c.name) + '</button>' +
          '<button class="appoint-btn" data-appoint="' + c.id + '" title="预约：' + escapeHtml(c.appointment) + '">预约</button>' +
        '</div>'
      ).join("");
      const actions = (VENUE_ACTIONS[key] || []).map(a => '<button class="act-btn" data-act="' + a.act + '">' + a.label + '</button>').join("");
      const infoBtns = (VENUE_INFO[key] || []).map(i => '<button class="info-btn" data-targets="' + i.targets.join(",") + '">' + i.label + '</button>').join("");
      el.innerHTML =
        '<h2>' + v.name + '</h2>' +
        '<div class="hero-sub">' + v.sub + (scenes.length ? ' · ' + scenes.length + ' 项事务' : '') + '</div>' +
        '<div class="venue-scenes">' + sceneBtns + '</div>' +
        '<div class="venue-pick" hidden>' +
          '<div class="chain-picker"><button class="chain-toggle" data-chain="main">主要政务</button><button class="chain-toggle" data-chain="reserve">次要政务</button></div>' +
          '<div class="custom-row"><input class="venue-task" type="text" placeholder="真实任务（如：背英语单词200个）"><button class="btn primary venue-start">开始临朝</button></div>' +
          '<p class="hint venue-selected"></p>' +
        '</div>' +
        (actions ? '<div class="hero-buttons venue-actions">' + actions + '</div>' : '') +
        (infoBtns ? '<div class="info-buttons">' + infoBtns + '</div>' : '');
    });
  }

  // 选中状态（不重绘输入框，保留输入）
  function updateVenueSelection() {
    const sc = selectedSceneId ? Scenes.get(selectedSceneId) : null;
    const loc = sc ? sc.loc : null;
    $$("[data-venue-hero]").forEach(el => {
      const key = el.dataset.venueHero;
      const isThis = key === loc;
      const pick = el.querySelector(".venue-pick");
      if (pick) pick.hidden = !isThis;
      el.querySelectorAll(".scene-btn").forEach(b => b.classList.toggle("selected", b.dataset.scene === selectedSceneId));
      el.querySelectorAll(".chain-toggle").forEach(b => b.classList.toggle("active", b.dataset.chain === selectedChain));
      if (isThis) {
        const task = el.querySelector(".venue-task");
        const sel = el.querySelector(".venue-selected");
        if (sel) sel.textContent = sc ? '将临朝：「' + sc.name + '」' + (task.value.trim() ? "——" + task.value.trim() : "") : "尚未择政务。";
      }
    });
  }

  function renderAll() {
    renderHeader();
    updateVenueSelection();
    renderStatusBar();
    renderCourt();           // 乾清宫：国是 / 国力 / 事件 / 目标 / 近闻
    renderAttrs($("#court-attrs"));   // 养心殿：圣躬属性
    renderHeirs($("#heir-list"));     // 上书房：子嗣
    renderMilitary();         // 武英殿：军备
    renderChain();            // 太和殿：主要/次要政务链
    renderPolicy();           // 军机处：典章制度
    renderRecord();           // 文渊阁：起居注
    Object.keys(VENUES).forEach(renderVenueInfo);  // 各殿「本殿事务」说明
    renderHistory();          // 奉先殿：实录
  }

  function renderStatusBar() {
    const af = state.activeFocus;
    const ap = state.activeAppointment || state.chains.appointment.active;
    const dot = $("#status-dot"), st = $("#status-text"), timer = $("#status-timer");
    const fa = $("#status-focus-actions"), aa = $("#status-appoint-actions");
    const row = $("#status-row");
    if (af) {
      dot.className = "status-dot focus";
      st.textContent = "临朝 · " + af.gov + (af.realTask ? "——" + af.realTask : "");
      row.dataset.nav = "";
      fa.hidden = false; aa.hidden = true;
      updateStatusTimer();
    } else if (ap) {
      dot.className = "status-dot appoint";
      st.textContent = "预约 · " + ap.name + "（" + ap.appointment + "）";
      row.dataset.nav = "";
      fa.hidden = true; aa.hidden = false;
      updateStatusTimer();
    } else {
      dot.className = "status-dot idle";
      const last = state.log[0];
      st.textContent = last ? "起居注 · " + last.text : "起居注尚空";
      row.dataset.nav = "record";
      fa.hidden = true; aa.hidden = true;
      timer.textContent = "";
    }
  }

  function renderHeader() {
    $("#dynasty-name").textContent = state.dynasty.name || "未定";
    $("#era-name").textContent = state.reign.eraName + " · 在位第 " + Engine.reignYears(state) + " 年 · 春秋 " + state.reign.age + " 岁";
    $("#stat-treasury").textContent = fmtNum(state.reign.metrics.treasury);
    $("#stat-support").textContent = Math.round(state.reign.metrics.support);
    $("#stat-prestige").textContent = state.reign.attributes.prestige;
    $("#stat-main").textContent = state.chains.main.records.length;
  }

  function renderCourt() {
    const items = [
      ["在位", "第 " + Engine.reignYears(state) + " 年（" + state.reign.eraName + "）"],
      ["君主", "春秋 " + state.reign.age + " 岁（寿 " + state.reign.lifeSpan + "）"],
      ["勤政（主要政务）", state.chains.main.records.length + " 次"],
      ["今日已记事务", state.reign.todayTasks.length + " 件"],
      ["在行制度", state.policies.filter(p => p.status === "active").length + " 条（共 " + state.policies.length + " 条）"],
    ];
    $("#court-today").innerHTML = items.map(([k, v]) => '<li><span class="k">' + k + '</span><span class="v">' + escapeHtml(String(v)) + '</span></li>').join("");
    renderMetrics($("#court-metrics"));
    renderEventStatus($("#event-status"));
    renderGoals();
    $("#court-log").innerHTML = renderLog(state.log.slice(0, 6));
  }

  function metricDisplay() {
    const d = Metrics.computeDerived(state.reign.metrics);
    const out = {};
    for (const k of Metrics.STORED_KEYS) out[k] = { name: Metrics.DEFS[k].name, unit: Metrics.DEFS[k].unit, value: state.reign.metrics[k] };
    out.revenue = { name: "岁入", unit: "两/年", value: d.revenue };
    out.living = { name: "生活水平", unit: "", value: d.living };
    out.unemployment = { name: "失业率", unit: "%", value: d.unemployment };
    out.cultureScore = { name: "文治总分", unit: "", value: d.cultureScore };
    return out;
  }
  function renderMetrics(el) {
    if (!el) return;
    const all = metricDisplay();
    el.innerHTML = METRIC_GROUPS.map(g => {
      const rows = g.keys.map(k => { const m = all[k]; if (!m) return ""; return '<div class="metric-row"><span class="m-name">' + m.name + '</span><span class="m-val">' + fmtNum(m.value) + (m.unit ? " " + m.unit : "") + '</span></div>'; }).join("");
      return '<div class="metric-group"><div class="metric-title">' + g.title + '</div>' + rows + '</div>';
    }).join("");
  }
  function renderMilitary() {
    const el = $("#wuying-metrics");
    if (!el) return;
    const all = metricDisplay();
    const keys = ["army", "training", "equipment"];
    el.innerHTML = keys.map(k => { const m = all[k]; return '<div class="metric-row"><span class="m-name">' + m.name + '</span><span class="m-val">' + fmtNum(m.value) + (m.unit ? " " + m.unit : "") + '</span></div>'; }).join("");
  }
  function renderVenueInfo(key) {
    const el = document.querySelector('[data-venue-info="' + key + '"]');
    if (!el) return;
    const scenes = Scenes.byVenue(key);
    el.innerHTML = scenes.map(c =>
      '<div class="scene-desc"><b>' + escapeHtml(c.name) + '</b>' +
      '<div class="hint">' + escapeHtml(c.gov) + '</div>' +
      '<div class="hint">预约：' + escapeHtml(c.appointment) + '</div>' +
      '<div class="hint">' + escapeHtml(Engine.describeEffects(c.defaultEffects) || "无默认增减") + '</div></div>'
    ).join("") || '<p class="hint">本殿无事务。</p>';
  }
  function renderAttrs(el) {
    if (!el) return;
    el.innerHTML = Scenes.ATTR_KEYS.map(k => '<div class="metric-row"><span class="m-name">' + Scenes.ATTR_NAMES[k] + '</span><span class="m-val">' + state.reign.attributes[k] + '</span></div>').join("");
  }
  function renderHeirs(el) {
    if (!el) return;
    if (!state.heirs.length) { el.innerHTML = '<p class="hint">尚无子嗣（琴瑟和鸣等事务可加速诞育）。</p>'; return; }
    el.innerHTML = state.heirs.map(h =>
      '<div class="goal-row"><div class="goal-name"><b>' + escapeHtml(h.name) + '</b> <span class="hint">' + (h.gender === "male" ? "皇子" : "公主") + ' · ' + h.age + ' 岁 · 智' + h.attributes.intellect + '</span></div>' +
      '<span class="goal-actions"><button data-hact="train" data-id="' + escapeHtml(h.id) + '">培养</button></span></div>'
    ).join("");
  }
  function renderEventStatus(el) {
    const em = state.reign.eventMode;
    if (!em || !em.active) { el.innerHTML = '<p class="hint">天下无事。</p>'; return; }
    el.innerHTML = '<div class="banner"><p>非常时期：「' + escapeHtml(em.text || "") + '」——制度树冻结、不计坚持天数。</p></div>' +
      '<div class="row"><button data-eact="ok" class="btn">结束（合规）</button><button data-eact="bad" class="btn danger">结束（违规·重置制度树）</button></div>';
  }
  function renderGoals() {
    const el = $("#goal-list");
    if (!state.goals.length) { el.innerHTML = '<p class="hint">尚无大志。</p>'; return; }
    el.innerHTML = state.goals.map(g => {
      const subs = (g.subGoals || []).map(sg => {
        const crits = (sg.criteria || []).map(c => {
          const ok = Engine.criterionMet(state, c);
          return '<div class="subgoal-crit' + (ok ? " ok" : "") + '">' + (ok ? "✓" : "·") + ' ' + escapeHtml(Engine.describeCriterion(state, c)) + '</div>';
        }).join("");
        return '<div class="subgoal' + (sg.done ? " done" : "") + '"><b>' + (sg.done ? "✓" : "·") + ' ' + escapeHtml(sg.name) + '</b>' + crits + '</div>';
      }).join("");
      const txt = g.status === "done" ? "已击退" : (g.status === "failed" ? "已兵败" : "进行中");
      return '<div class="goal-row ' + escapeHtml(g.status) + '"><div class="goal-name"><b>' + escapeHtml(g.name) + '</b>' + (g.flavor ? ' <span class="hint">' + escapeHtml(g.flavor) + '</span>' : '') + subs + '</div>' +
        '<span class="goal-status">' + txt + '</span>' +
        (g.status === "active" ? '<span class="goal-actions"><button data-gact="sub" data-id="' + escapeHtml(g.id) + '">加阶段目标</button><button data-gact="done" data-id="' + escapeHtml(g.id) + '">大捷</button><button data-gact="failed" data-id="' + escapeHtml(g.id) + '">兵败</button></span>' : '') +
        '</div>';
    }).join("");
  }

  function renderChain() {
    renderChainList($("#chain-main"), state.chains.main, "主要政务");
    renderChainList($("#chain-reserve"), state.chains.reserve, "次要政务");
    $("#chain-main-precedents").innerHTML = renderPrecedents(state.chains.main.precedents, "主要政务成例");
    $("#chain-reserve-precedents").innerHTML = renderPrecedents(state.chains.reserve.precedents, "次要政务成例");
  }
  function renderChainList(el, chain, title) {
    if (!el) return;
    const recs = chain.records;
    if (!recs.length) { el.innerHTML = '<p class="hint">尚无纪录。</p>'; return; }
    let html = '<div class="chain-title">' + title + ' · 共 ' + recs.length + ' 次</div>';
    for (let i = 0; i < recs.length; i++) {
      const n = i + 1;
      if (n % 9 === 1) html += '<div class="qun">### 第 ' + Math.ceil(n / 9) + ' 群（大政务）</div>';
      if (n % 3 === 1) html += '<div class="zu">## 第 ' + Math.ceil(n / 3) + ' 组（中政务）</div>';
      const r = recs[i];
      html += '<div class="chain-row"><span class="num">#' + n + '</span><span class="gov">' + escapeHtml(r.gov) + (r.realTask ? '——' + escapeHtml(r.realTask) : '') + '</span><span class="date">' + escapeHtml(r.date) + '</span>' + (n % 3 === 0 ? '<span class="tag">小成</span>' : '') + (n % 9 === 0 ? '<span class="tag big">大成</span>' : '') + '</div>';
    }
    el.innerHTML = html;
  }
  function renderPrecedents(list, label) {
    if (!list.length) return '<p class="hint">' + label + '：无。</p>';
    return '<div class="chain-title">' + label + '</div>' + list.map((t, i) => '<div class="chain-row"><span class="num">' + (i + 1) + '</span><span class="gov">' + escapeHtml(t) + '</span></div>').join("");
  }

  function renderPolicy() {
    const tree = $("#policy-tree");
    $("#policy-add-hint").textContent = Engine.policyAddAllowed(state) ? "今日尚可颁行一条制度。" : "今日已颁行过制度，明日再议。";
    const parentSel = $("#policy-parent");
    parentSel.innerHTML = '<option value="">（根基制度）</option>' + state.policies.filter(p => p.status === "active").map(p => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>').join("");
    const groups = {};
    state.policies.forEach(p => { if (p.group) groups[p.group] = (groups[p.group] || 0) + 1; });
    tree.innerHTML = '<p class="hint">分组：' + (Object.keys(groups).map(g => g + " ×" + groups[g]).join(" · ") || "无") + '</p>';
    if (!state.policies.length) { tree.innerHTML += '<p class="hint">尚无制度。</p>'; return; }
    state.policies.filter(p => !p.parentId).forEach(r => tree.appendChild(renderPolicyNode(r, 0)));
  }
  function renderPolicyNode(p, depth) {
    const el = document.createElement("div");
    el.className = "policy-node" + (p.status === "fallen" ? " fallen" : "");
    el.style.marginLeft = (depth * 18) + "px";
    el.innerHTML =
      '<div class="policy-line"><span class="policy-name">' + escapeHtml(p.name) + '</span>' +
      (p.group ? '<span class="policy-group">' + escapeHtml(p.group) + '</span>' : '') +
      '<span class="policy-status">' + (p.status === "active" ? "在行" : "已废") + '</span>' +
      '<span class="policy-meta">固化 ' + p.solidity + '/' + (p.solidityCap || 100) + ' · 坚持 ' + p.survivalDays + ' 天 · Lv' + p.level + (p.revive ? ' · 复活×' + p.revive : '') + (p.strengthened ? ' · 已强化' : '') + '</span>' +
      '<div class="policy-actions">' +
      (p.status === "active" ? '<button data-act="upgrade" data-id="' + escapeHtml(p.id) + '">升级</button><button data-act="strengthen" data-id="' + escapeHtml(p.id) + '">强化</button><button data-act="collapse" data-id="' + escapeHtml(p.id) + '">失守</button>' : '<button data-act="rescue" data-id="' + escapeHtml(p.id) + '">迁都</button>') +
      '</div></div>' +
      '<div class="policy-bar"><div class="policy-bar-fill" style="width:' + Math.min(100, (p.solidity / (p.solidityCap || 100)) * 100) + '%"></div></div>';
    state.policies.filter(c => c.parentId === p.id).forEach(c => el.appendChild(renderPolicyNode(c, depth + 1)));
    return el;
  }

  function renderRecord() {
    $("#settle-hint").textContent = "今日已记 " + state.reign.todayTasks.length + " 件事务。";
    $("#full-log").innerHTML = renderLog(state.log);
  }
  function renderLog(entries) {
    if (!entries.length) return '<p class="hint">起居注尚空。</p>';
    return entries.map(e => '<li><span class="k">' + (e.year ? "第" + e.year + "年 " : "") + e.date + '</span><span class="v">' + escapeHtml(e.text) + '</span></li>').join("");
  }
  function renderHistory() {
    $("#abdicate-banner").hidden = !Engine.shouldAbdicate(state);
    const lineage = state.dynasty.lineage;
    const el = $("#lineage");
    if (!lineage.length) { el.innerHTML = '<p class="hint">奉先殿尚空。</p>'; return; }
    el.innerHTML = lineage.slice().reverse().map(l => {
      const title = "「" + escapeHtml(l.eraName) + "」" + (l.posthumous ? " · 谥「" + escapeHtml(l.posthumous) + "」" : "") + (l.temple ? " · 庙号「" + escapeHtml(l.temple) + "」" : "");
      const recs = (l.veritableRecords || []);
      const recHtml = recs.map(r => '<li><span class="k">' + escapeHtml(r.date) + '</span><span class="v">' + escapeHtml(r.text) + '</span></li>').join("");
      return '<div class="emperor"><div class="emperor-title">' + title + '</div>' +
        '<div class="emperor-meta">在位 ' + l.years + ' 年 · 享年 ' + l.age + ' 岁 · ' + escapeHtml(l.reason) + '</div>' +
        (l.score && l.score.reason ? '<div class="emperor-basis">谥号依据：' + escapeHtml(l.score.reason) + '</div>' : '') +
        (l.eulogy ? '<div class="emperor-basis">史官曰：' + escapeHtml(l.eulogy) + '</div>' : '') +
        '<details><summary>实录（' + recs.length + ' 条）</summary><ul class="log">' + (recHtml || '<li><span class="v">（空）</span></li>') + '</ul></details></div>';
    }).join("");
  }

  function updateTimers() {
    // 跨现实日自动结算（一天 = 一年），避免应用常驻时不刷新导致年龄停滞
    if (state.meta.lastTickDate !== Engine.todayStr()) {
      state = Engine.tick(state);
      renderAll();
    }
    updateStatusTimer();
  }
  function fmt(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }
  function updateStatusTimer() {
    const af = state.activeFocus;
    const ap = state.activeAppointment || state.chains.appointment.active;
    const timer = $("#status-timer");
    if (!timer) return;
    if (af) timer.textContent = fmt(af.endsAt - Date.now());
    else if (ap) timer.textContent = fmt(ap.dueAt - Date.now());
    else timer.textContent = "";
  }

  function currentVenue(el) {
    const hero = el.closest("[data-venue-hero]");
    return hero ? hero.dataset.venueHero : null;
  }
  function startFromVenue(btn) {
    if (!selectedSceneId) { toast("请先择一项政务/事务。"); return; }
    const key = currentVenue(btn);
    if (!Scenes.byVenue(key).some(c => c.id === selectedSceneId)) { toast("请先择本殿的政务/事务。"); return; }
    const task = btn.closest(".venue-pick").querySelector(".venue-task").value.trim();
    const r = Engine.startFocus(state, selectedSceneId, selectedChain, task);
    if (!r || r.blocked) { toast((r && r.reason) || "临朝未开始。"); return; }
    renderAll(); toast("临朝开始，专注 " + state.settings.focusMinutes + " 分钟。");
  }
  // 二级详情：点击一级信息按钮 → 展开对应面板（其余面板隐藏）
  function revealPanels(targets) {
    const view = document.querySelector(".view.active");
    const d = view ? view.querySelector(".view-details") : null;
    if (!d) return;
    d.classList.add("open");
    const want = new Set();
    targets.forEach(sel => {
      const t = document.querySelector(sel);
      if (t) { const p = t.closest(".panel"); if (p) want.add(p); }
    });
    d.querySelectorAll(".panel").forEach(p => p.style.display = want.has(p) ? "" : "none");
    const first = Array.from(want)[0];
    if (first) setTimeout(() => first.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  function handleVenueAction(act, btn) {
    if (act === "event") { $("#event-text").value = ""; $("#event-modal").hidden = false; }
    else if (act === "goal") { $("#goal-name").value = ""; $("#goal-flavor").value = ""; $("#goal-modal").hidden = false; }
    else if (act === "policy-add") {
      if (!Engine.policyAddAllowed(state)) { toast("今日已颁行过制度，明日再议。"); return; }
      if (Engine.eventActive(state)) { toast("突发事件期间禁止颁行制度。"); return; }
      $("#policy-modal").hidden = false;
    }
    else if (act === "settle") { doSettle(btn); }
    else if (act === "llm") { openLlm(); }
    else if (act === "abdicate") { openAbdicate(); }
  }
  async function doSettle(btn) {
    btn.disabled = true; const orig = btn.textContent; btn.textContent = "结算中…";
    try {
      const r = await Engine.settleYear(state, true);
      toast(r.llmFailed ? "史官缺席，以常例结算（" + r.llmFailed + "）。" : "岁末结算完成。");
    } catch (e) { toast("结算出错：" + e.message); }
    btn.disabled = false; btn.textContent = orig; renderAll();
  }
  function openLlm() {
    $("#llm-result").hidden = true; $("#llm-result").textContent = ""; $("#llm-actions").hidden = true; $("#llm-modal").hidden = false;
  }
  function openAbdicate() {
    const sel = $("#abdicate-heir");
    sel.innerHTML = '<option value="">（无子嗣，宗室即位）</option>' + state.heirs.map(h => '<option value="' + escapeHtml(h.id) + '">' + escapeHtml(h.name) + '（' + h.age + ' 岁）</option>').join("");
    $("#abdicate-modal").hidden = false;
  }

  function bindEvents() {
    // 皇宫地图导航
    $("#palace-map").addEventListener("click", (e) => {
      const b = e.target.closest(".bldg");
      if (b) openView(b.dataset.building);
    });
    $$(".back-btn[data-back]").forEach(btn => btn.addEventListener("click", backToPalace));
    $$(".back-btn[data-close]").forEach(btn => btn.addEventListener("click", () => {
      const d = btn.closest(".view-details"); if (d) d.classList.remove("open");
    }));

    // 一级按钮（场景选择 / 链切换 / 开始 / 动作 / 信息展开 / 预约选择）——事件委托
    document.addEventListener("click", (e) => {
      const sceneBtn = e.target.closest(".scene-btn");
      if (sceneBtn) { selectedSceneId = sceneBtn.dataset.scene; updateVenueSelection(); return; }
      const chainBtn = e.target.closest(".chain-toggle");
      if (chainBtn) { selectedChain = chainBtn.dataset.chain; updateVenueSelection(); return; }
      const startBtn = e.target.closest(".venue-start");
      if (startBtn) { startFromVenue(startBtn); return; }
      const actBtn = e.target.closest(".act-btn");
      if (actBtn) { handleVenueAction(actBtn.dataset.act, actBtn); return; }
      const infoBtn = e.target.closest(".info-btn");
      if (infoBtn) { revealPanels(infoBtn.dataset.targets.split(",")); return; }
      const appointBtn = e.target.closest(".appoint-btn");
      if (appointBtn) { Engine.scheduleAppointment(state, appointBtn.dataset.appoint); renderAll(); toast("已预约，一刻钟内须临朝。"); return; }
    });
    document.addEventListener("input", (e) => {
      if (!e.target.classList.contains("venue-task")) return;
      const pick = e.target.closest(".venue-pick");
      const sel = pick.querySelector(".venue-selected");
      const sc = selectedSceneId ? Scenes.get(selectedSceneId) : null;
      sel.textContent = sc ? '将临朝：「' + sc.name + '」' + (e.target.value.trim() ? "——" + e.target.value.trim() : "") : "尚未择政务。";
    });

    $("#focus-complete").addEventListener("click", () => { const r = Engine.completeFocus(state); renderAll(); toast(r ? "功成！主要政务 #" + r.number : "已功成"); });
    $("#focus-abandon").addEventListener("click", () => { const v = Engine.abandonFocus(state); if (v) openVerdict(v.target, "临朝中失守，当廷议裁定。"); });
    $("#appointment-fulfill").addEventListener("click", () => {
      const r = Engine.fulfillAppointment(state);
      if (r && r.blocked) { toast(r.reason); return; }
      renderAll(); toast("守信履约，威望 +1，开始临朝。");
    });
    $("#appointment-miss").addEventListener("click", () => { Engine.missAppointment(state); renderAll(); toast("失信失约，威望 -1。"); });

    $("#verdict-collapse").addEventListener("click", () => { Engine.verdict(state, verdictTarget, "collapse", null); closeVerdict(); renderAll(); toast("已废黜，纪录清零。"); });
    $("#verdict-precedent").addEventListener("click", () => { Engine.verdict(state, verdictTarget, "precedent", $("#verdict-text").value.trim()); closeVerdict(); renderAll(); toast("已下诏成例。"); });

    $("#policy-cancel").addEventListener("click", () => $("#policy-modal").hidden = true);
    $("#policy-save").addEventListener("click", () => {
      const name = $("#policy-name").value.trim();
      if (!name) { toast("请输入制度名。"); return; }
      const r = Engine.addPolicy(state, { name, group: $("#policy-group").value.trim(), flavor: $("#policy-flavor").value.trim(), parentId: $("#policy-parent").value || null });
      if (!r.ok) { toast(r.reason); return; }
      $("#policy-modal").hidden = true; renderAll(); toast("已颁行制度：「" + name + "」");
    });
    $("#policy-tree").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]"); if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      if (act === "collapse") {
        if (confirm("诏废「" + (state.policies.find(p => p.id === id)?.name || "") + "」及其从属制度？")) { const r = Engine.collapsePolicy(state, id); renderAll(); toast(r.revived ? "赖升级之资复活，降级免删。" : "已诏废。"); }
      } else if (act === "rescue") { Engine.rescuePolicy(state, id, null); renderAll(); toast("已迁都改隶为根基制度。"); }
      else if (act === "upgrade") { const r = Engine.upgradePolicy(state, id); renderAll(); toast(r.ok ? "已升级。" : r.reason); }
      else if (act === "strengthen") { const r = Engine.strengthenPolicy(state, id); renderAll(); toast(r.ok ? "已强化。" : r.reason); }
    });

    $("#heir-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hact]"); if (!btn) return;
      const r = Engine.trainHeir(state, btn.dataset.id); renderAll(); toast(r.ok ? "已培养。" : r.reason);
    });

    $("#event-cancel").addEventListener("click", () => $("#event-modal").hidden = true);
    $("#event-enter").addEventListener("click", () => {
      const text = $("#event-text").value.trim();
      if (!text) { toast("请描述事件。"); return; }
      Engine.enterEventMode(state, text); $("#event-modal").hidden = true; renderAll(); toast("已进入非常时期。");
    });
    $("#event-status").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-eact]"); if (!btn) return;
      Engine.exitEventMode(state, btn.dataset.eact === "ok"); renderAll(); toast(btn.dataset.eact === "ok" ? "合规结束。" : "违规结束，制度树已重置。");
    });

    $("#goal-cancel").addEventListener("click", () => $("#goal-modal").hidden = true);
    $("#goal-save").addEventListener("click", () => {
      const name = $("#goal-name").value.trim();
      if (!name) { toast("请输入大目标。"); return; }
      Engine.addGoal(state, { name, flavor: $("#goal-flavor").value.trim() });
      $("#goal-modal").hidden = true; $("#goal-name").value = ""; $("#goal-flavor").value = ""; renderAll();
    });
    $("#goal-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-gact]"); if (!btn) return;
      if (btn.dataset.gact === "sub") { subGoalGoalId = btn.dataset.id; openSubGoalModal(); }
      else { Engine.resolveGoal(state, btn.dataset.id, btn.dataset.gact); renderAll(); }
    });
    $("#subgoal-add-criterion").addEventListener("click", () => {
      $("#subgoal-criteria").insertAdjacentHTML("beforeend", criterionRowHtml("focus-total"));
    });
    $("#subgoal-criteria").addEventListener("change", (e) => {
      const row = e.target.closest(".criterion"); if (!row) return;
      if (e.target.classList.contains("crit-type")) {
        const args = row.querySelector(".crit-args");
        args.innerHTML = criterionArgsHtml(e.target.value);
      }
    });
    $("#subgoal-criteria").addEventListener("click", (e) => {
      const rm = e.target.closest(".crit-remove"); if (!rm) return;
      const box = $("#subgoal-criteria");
      rm.closest(".criterion").remove();
      if (!box.querySelector(".criterion")) box.insertAdjacentHTML("beforeend", criterionRowHtml("focus-total"));
    });
    $("#subgoal-cancel").addEventListener("click", () => $("#subgoal-modal").hidden = true);
    $("#subgoal-save").addEventListener("click", () => {
      const name = $("#subgoal-name").value.trim();
      if (!name || !subGoalGoalId) { toast("请填写名称。"); return; }
      const criteria = collectCriteria();
      if (!criteria.length) { toast("请至少添加一条评判标准。"); return; }
      const r = Engine.addSubGoal(state, subGoalGoalId, { name, criteria });
      $("#subgoal-modal").hidden = true; renderAll(); toast(r.ok ? "已分解阶段目标。" : r.reason);
    });

    $("#abdicate-cancel").addEventListener("click", () => $("#abdicate-modal").hidden = true);
    $("#abdicate-confirm").addEventListener("click", async () => {
      const mode = $("#abdicate-mode").value;
      const heirId = $("#abdicate-heir").value || null;
      const btn = $("#abdicate-confirm"); btn.disabled = true; btn.textContent = "结算中…";
      let r;
      try { r = await Engine.abdicate(state, "禅位", { mode, heirId }); }
      catch (e) { toast("驾崩出错：" + e.message); btn.disabled = false; btn.textContent = "确认禅位"; return; }
      btn.disabled = false; btn.textContent = "确认禅位";
      $("#abdicate-modal").hidden = true; renderAll();
      toast("已禅位，谥「" + r.score.posthumous + "」" + (r.score.temple ? "，庙号「" + r.score.temple + "」" : "") + "。新君「" + state.reign.eraName + "」即位。");
    });

    $("#settings-btn").addEventListener("click", () => {
      $("#set-dynasty").value = state.dynasty.name || ""; $("#set-era").value = state.reign.eraName || "";
      const llm = state.settings.llm || {};
      $("#set-llm-base").value = llm.baseUrl || ""; $("#set-llm-key").value = llm.apiKey || ""; $("#set-llm-model").value = llm.model || "";
      $("#settings-modal").hidden = false;
    });
    $("#status-row").addEventListener("click", () => {
      const nav = $("#status-row").dataset.nav;
      if (nav) openView(nav);
    });
    // 键盘可达：status-row 与模态 ESC 关闭
    $("#status-row").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#status-row").click(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      let closed = false;
      $$(".modal").forEach(m => { if (!m.hidden) { m.hidden = true; closed = true; } });
      if (closed && verdictTarget) verdictTarget = null;
    });
    $("#settings-cancel").addEventListener("click", () => $("#settings-modal").hidden = true);
    $("#settings-save").addEventListener("click", () => {
      if ($("#set-dynasty").value.trim()) state.dynasty.name = $("#set-dynasty").value.trim();
      if ($("#set-era").value.trim()) state.reign.eraName = $("#set-era").value.trim();
      state.settings.llm = { baseUrl: $("#set-llm-base").value.trim(), apiKey: $("#set-llm-key").value.trim(), model: $("#set-llm-model").value.trim() };
      Store.save(state); $("#settings-modal").hidden = true; renderAll(); toast("已保存。");
    });
    $("#reset-btn").addEventListener("click", () => {
      if (!confirm("确定完全重置所有数据？")) return;
      state = Engine.tick(Store.reset()); $("#settings-modal").hidden = true; renderAll(); toast("已重置。");
    });
    $("#export-btn").addEventListener("click", () => {
      const dump = JSON.parse(JSON.stringify(state));
      if (dump.settings && dump.settings.llm) delete dump.settings.llm.apiKey; // 导出脱敏，备份文件不含密钥
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sophrosyne-backup-" + Engine.todayStr() + ".json";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); toast("已导出存档（不含 API Key）。");
    });
    $("#import-btn").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = Store.revive(JSON.parse(reader.result));
          if (!obj) throw new Error("格式不符：缺少 reign / chains / policies 结构");
          state = Engine.tick(obj); Store.save(state); renderAll(); toast("已导入。");
        } catch (err) { toast("导入失败：" + err.message); }
      };
      reader.readAsText(f); e.target.value = "";
    });

    $("#llm-ask").addEventListener("click", async () => {
      const btn = $("#llm-ask"); btn.disabled = true; btn.textContent = "史官拟诏中…";
      try { const text = await Sophrosyne.LLM.ask(state, $("#llm-task").value); $("#llm-result").textContent = text; $("#llm-result").hidden = false; $("#llm-actions").hidden = false; }
      catch (err) { $("#llm-result").textContent = "出错：" + err.message; $("#llm-result").hidden = false; $("#llm-actions").hidden = false; }
      finally { btn.disabled = false; btn.textContent = "召唤史官"; }
    });
    $("#llm-append").addEventListener("click", () => {
      const text = $("#llm-result").textContent;
      if (text && !text.startsWith("出错")) { Engine.log(state, "【史官】" + text); Store.save(state); renderAll(); toast("已采纳入起居注。"); }
      $("#llm-modal").hidden = true;
    });
    $("#llm-close").addEventListener("click", () => $("#llm-modal").hidden = true);

    $("#setup-save").addEventListener("click", () => {
      if ($("#setup-dynasty").value.trim()) state.dynasty.name = $("#setup-dynasty").value.trim();
      if ($("#setup-era").value.trim()) state.reign.eraName = $("#setup-era").value.trim();
      Store.save(state); $("#setup-modal").hidden = true; renderAll();
    });
  }

  function criterionArgsHtml(type) {
    if (type === "focus-total") {
      return '<span class="crit-inline">总数 ≥ <input type="number" class="crit-count" value="3" min="1"> 次</span>';
    }
    if (type === "metric") {
      const opts = Metrics.STORED_KEYS.map(k => '<option value="' + k + '">' + Metrics.DEFS[k].name + '</option>').join("");
      return '<span class="crit-inline"><select class="crit-key">' + opts + '</select> 达到 <input type="number" class="crit-target" value="60" min="0"></span>';
    }
    if (type === "policy-days") {
      const act = state.policies.filter(p => p.status === "active");
      const opts = act.length ? act.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join("") : '<option value="">（暂无在行制度）</option>';
      return '<span class="crit-inline"><select class="crit-policy">' + opts + '</select> 坚持 <input type="number" class="crit-days" value="21" min="1"> 天</span>';
    }
    return "";
  }
  function criterionRowHtml(type) {
    return '<div class="criterion">' +
      '<select class="crit-type">' +
        '<option value="focus-total"' + (type === "focus-total" ? " selected" : "") + '>政务总数</option>' +
        '<option value="metric"' + (type === "metric" ? " selected" : "") + '>国力属性</option>' +
        '<option value="policy-days"' + (type === "policy-days" ? " selected" : "") + '>制度坚持天数</option>' +
      '</select>' +
      '<div class="crit-args">' + criterionArgsHtml(type) + '</div>' +
      '<button class="crit-remove" title="删除">×</button>' +
      '</div>';
  }
  function collectCriteria() {
    const out = [];
    $$("#subgoal-criteria .criterion").forEach(row => {
      const type = row.querySelector(".crit-type").value;
      if (type === "focus-total") {
        const n = parseInt(row.querySelector(".crit-count").value, 10);
        if (n && n > 0) out.push({ type: "focus-total", count: n });
      } else if (type === "metric") {
        const key = row.querySelector(".crit-key").value;
        const t = parseInt(row.querySelector(".crit-target").value, 10);
        if (key && !isNaN(t)) out.push({ type: "metric", key, target: t });
      } else if (type === "policy-days") {
        const policyId = row.querySelector(".crit-policy").value;
        const d = parseInt(row.querySelector(".crit-days").value, 10);
        if (policyId && d && d > 0) out.push({ type: "policy-days", policyId, days: d });
      }
    });
    return out;
  }
  function openSubGoalModal() {
    $("#subgoal-name").value = "";
    $("#subgoal-criteria").innerHTML = criterionRowHtml("focus-total");
    $("#subgoal-modal").hidden = false;
  }
  function openVerdict(target, context) {
    verdictTarget = target; $("#verdict-context").textContent = context; $("#verdict-text").value = ""; $("#verdict-modal").hidden = false;
  }
  function closeVerdict() { verdictTarget = null; $("#verdict-modal").hidden = true; }

  function openView(viewId) {
    $$(".view").forEach(v => v.classList.remove("active"));
    const v = $("#view-" + viewId);
    if (v) v.classList.add("active");
    renderAll();
    window.scrollTo(0, 0);
  }
  function backToPalace() {
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-palace").classList.add("active");
    renderAll();
    window.scrollTo(0, 0);
  }

  return { init, toast };
})();
