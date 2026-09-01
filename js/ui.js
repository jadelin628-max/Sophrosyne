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
  let renameHeirId = null;
  let pendingSettlement = null;
  let storedLlmKey = "";   // 打开设置时读取已存 Key，用于脱敏展示与「留空不覆盖」
  // 开发开关：URL 带 ?dev 或 localStorage sophrosyne.dev=1 时显示坐标网格/轴标
  const DEV = (function () {
    try { return location.search.includes("dev") || localStorage.getItem("sophrosyne.dev") === "1"; }
    catch (e) { return false; }
  })();

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
  // 日常汇总态势：只露五类头面指标，20 项国力细节留在乾清宫「国力各项」
  const SUMMARY = [
    { title: "政务", items: [["order", "治安"], ["prestige", "皇威"]] },
    { title: "民生", items: [["support", "民心"], ["living", "生活"]] },
    { title: "军备", items: [["army", "军队"], ["training", "训练"]] },
    { title: "文治", items: [["cultureScore", "文治"], ["tech", "科技"]] },
    { title: "朝纲", items: [["treasury", "国库"], ["corruption", "腐败"]] },
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
    zhonghedian:  { name: "中和殿", sub: "外朝 · 礼仪" },
    jiaotaidian:  { name: "交泰殿", sub: "内廷 · 宫规" },
    wumen:        { name: "午门", sub: "外朝 · 颁诏" },
    shenwumen:    { name: "神武门", sub: "北门 · 巡阅" },
    cininggong:   { name: "慈宁宫", sub: "内廷 · 奉养" },
    ningshougong: { name: "宁寿宫", sub: "内廷 · 颐养" },
    yuqinggong:   { name: "毓庆宫", sub: "内廷 · 皇子事务" },
    xianfugong:   { name: "咸福宫", sub: "内廷 · 公主事务" },
  };
  const VENUE_ACTIONS = {
    qianqinggong: [ { label: "报备突发事件", act: "event" }, { label: "定国策", act: "goal" } ],
    junjichu:     [ { label: "颁行制度", act: "policy-add" } ],
    kunninggong:  [ { label: "岁末结算", act: "settle" } ],
  };
  // 二级详情面板（默认收起）：只保留真正有二级内容的宫殿
  const VENUE_INFO = {
    taihedian:    [ { label: "勤政纪录", targets: ["#chain-main", "#chain-reserve", "#chain-oath"] } ],
    qianqinggong: [
      { label: "今日国是", targets: ["#court-today"] },
      { label: "国力各项", targets: ["#court-metrics"] },
      { label: "突发事件", targets: ["#event-status"] },
      { label: "国策", targets: ["#goal-list"] },
      { label: "近闻", targets: ["#court-log"] },
    ],
    junjichu:     [ { label: "典章制度树", targets: ["#policy-tree"] } ],
    wuyingdian:   [ { label: "军备", targets: ["#wuying-metrics"] } ],
    wenyuange:    [ { label: "起居注", targets: ["#full-log"] } ],
    yangxindian:  [ { label: "圣躬属性", targets: ["#court-attrs"] } ],
    shangshufang: [ { label: "子嗣", targets: ["#heir-list"] } ],
    kunninggong:  [ { label: "岁末结算", targets: ["#settle-hint"] } ],
  };

  // 宫殿交互点（x/y=中心, s=热点边长, l=标签, v=点击进入的视图）——按精确紫禁城平面图对位
  const PALACE = [
    // 中轴（北→南）
    { x: 320, y: 81, s: 70, l: "神武门", v: "shenwumen" },
    { x: 320, y: 198, s: 56, l: "御花园", v: "yuhuayuan" },
    { x: 320, y: 310, s: 51, l: "坤宁宫", v: "kunninggong" },
    { x: 320, y: 384, s: 62, l: "交泰殿", v: "jiaotaidian" },
    { x: 320, y: 471, s: 62, l: "乾清宫", v: "court" },
    { x: 320, y: 546, s: 66, l: "乾清门" },
    { x: 320, y: 632, s: 54, l: "保和殿", v: "baohe" },
    { x: 320, y: 707, s: 62, l: "中和殿", v: "zhonghedian" },
    { x: 320, y: 806, s: 72, l: "太和殿", v: "focus" },
    { x: 320, y: 967, s: 53, l: "太和门", v: "taihemen" },
    { x: 320, y: 1141, s: 80, l: "午门", v: "wumen" },
    // 西侧（内廷·西六宫贴坤宁宫两翼/养心殿/军机处/隆宗门；外朝·武英殿/弘义阁；服务·御膳房/内务府）
    { x: 105, y: 190, s: 64, l: "慈宁宫", v: "cininggong" },
    { x: 185, y: 240, s: 42, l: "永寿宫" },
    { x: 228, y: 240, s: 42, l: "翊坤宫" },
    { x: 185, y: 314, s: 42, l: "储秀宫" },
    { x: 228, y: 314, s: 42, l: "咸福宫", v: "xianfugong" },
    { x: 185, y: 388, s: 42, l: "长春宫" },
    { x: 228, y: 388, s: 42, l: "太极殿" },
    { x: 218, y: 436, s: 46, l: "养心殿", v: "chain" },
    { x: 200, y: 520, s: 36, l: "军机处", v: "policy" },
    { x: 240, y: 590, s: 38, l: "隆宗门" },
    { x: 160, y: 750, s: 42, l: "弘义阁" },
    { x: 102, y: 746, s: 51, l: "武英殿", v: "wuyingdian" },
    { x: 120, y: 480, s: 36, l: "御膳房", v: "yushanfang" },
    { x: 120, y: 560, s: 37, l: "内务府", v: "neiweufu" },
    { x: 42, y: 706, s: 38, l: "西华门" },
    // 东侧（内廷·东六宫贴坤宁宫两翼/奉先殿/上书房/景运门/宁寿宫/畅音阁/钦天监；外朝·文华殿/文渊阁/体仁阁）
    { x: 535, y: 190, s: 70, l: "宁寿宫", v: "ningshougong" },
    { x: 412, y: 240, s: 42, l: "景仁宫" },
    { x: 455, y: 240, s: 42, l: "承乾宫" },
    { x: 412, y: 314, s: 42, l: "钟粹宫" },
    { x: 455, y: 314, s: 42, l: "景阳宫" },
    { x: 412, y: 388, s: 42, l: "永和宫" },
    { x: 455, y: 388, s: 42, l: "延禧宫" },
    { x: 418, y: 426, s: 42, l: "奉先殿", v: "history" },
    { x: 418, y: 560, s: 38, l: "毓庆宫", v: "yuqinggong" },
    { x: 480, y: 496, s: 38, l: "上书房", v: "shangshufang" },
    { x: 400, y: 590, s: 38, l: "景运门" },
    { x: 512, y: 302, s: 36, l: "畅音阁", v: "changyinge" },
    { x: 550, y: 620, s: 37, l: "钦天监", v: "qintianjian" },
    { x: 460, y: 744, s: 42, l: "体仁阁" },
    { x: 532, y: 760, s: 46, l: "文渊阁", v: "record" },
    { x: 480, y: 992, s: 51, l: "文华殿", v: "wenhuadian" },
    { x: 598, y: 706, s: 38, l: "东华门" },
  ];

  function init(s, opts) {
    state = s;
    state.settings.devMode = !!DEV;   // 开发模式来源（URL ?dev / localStorage）同步给引擎
    renderVenueHeros();
    Sophrosyne.Events.bind(api);
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
    // 坐标网格 + 轴标（仅开发模式显示）
    if (DEV) {
      for (let gx = 0; gx <= 640; gx += 80) {
        html += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="1240" stroke="rgba(201,162,39,0.10)" stroke-width="1"/>';
      }
      for (let gy = 0; gy <= 1240; gy += 124) {
        html += '<line x1="0" y1="' + gy + '" x2="640" y2="' + gy + '" stroke="rgba(201,162,39,0.10)" stroke-width="1"/>';
      }
      for (let gx = 0; gx <= 640; gx += 80) {
        html += '<text x="' + gx + '" y="14" text-anchor="middle" fill="rgba(233,220,195,0.72)" font-size="11" stroke="rgba(0,0,0,0.7)" stroke-width="2" paint-order="stroke">' + gx + '</text>';
      }
      for (let gy = 0; gy <= 1240; gy += 124) {
        html += '<text x="12" y="' + (gy + 4) + '" text-anchor="start" fill="rgba(233,220,195,0.72)" font-size="11" stroke="rgba(0,0,0,0.7)" stroke-width="2" paint-order="stroke">' + gy + '</text>';
      }
    }
    // 各建筑：可点 → 交互热点 + 标签；装饰 → 仅标签
    for (const b of PALACE) {
      const cx = b.x - b.s / 2, cy = b.y - b.s / 2;
      const tx = b.x, ty = b.y + b.s / 2 + 14;
      const lbl = b.l + (DEV ? " (" + b.x + "," + b.y + ")" : "");
      if (b.v) {
        html += '<g class="bldg" data-building="' + b.v + '">' +
          '<rect class="hotspot" x="' + cx + '" y="' + cy + '" width="' + b.s + '" height="' + b.s + '" rx="7"/>' +
          '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" fill="#f6df9b" font-size="12" stroke="#1d1510" stroke-width="3" paint-order="stroke" pointer-events="none">' + lbl + '</text></g>';
      } else {
        html += '<g class="bldg-deco">' +
          '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" fill="#c9a227" font-size="11" stroke="#1d1510" stroke-width="3" paint-order="stroke" opacity="0.85">' + lbl + '</text></g>';
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
    renderHistory();          // 奉先殿：实录
    renderConsole();          // 地图底部控制台
  }

  function renderStatusBar() {
    const af = state.activeFocus;
    const ap = state.activeAppointment || state.chains.appointment.active;
    const dot = $("#status-dot"), st = $("#status-text"), timer = $("#status-timer");
    const fa = $("#status-focus-actions"), aa = $("#status-appoint-actions");
    const row = $("#status-row");
    if (af) {
      dot.className = "status-dot focus";
      if (af.status === "awaiting-confirmation") {
        st.textContent = "临朝到时 · " + af.gov + (af.realTask ? "——" + af.realTask : "") + "（待确认功成或失守）";
        timer.textContent = "已到时";
      } else {
        st.textContent = "临朝 · " + af.gov + (af.realTask ? "——" + af.realTask : "");
      }
      row.dataset.nav = "";
      fa.hidden = false; aa.hidden = true;
      // 勤政不可提前结束：只有到时（待确认）才显示「功成记录」，否则仅可「失守廷议」
      const fc = $("#focus-complete");
      if (fc) fc.style.display = (af.status === "awaiting-confirmation") ? "" : "none";
      if (af.status !== "awaiting-confirmation") updateStatusTimer();
    } else if (ap) {
      dot.className = "status-dot appoint";
      if (ap.status === "overdue") {
        st.textContent = "预约逾期 · " + ap.name + "（仅可确认失信）";
        timer.textContent = "已逾期";
      } else {
        st.textContent = "预约 · " + ap.name + "（" + ap.appointment + "）";
      }
      row.dataset.nav = "";
      fa.hidden = true; aa.hidden = false;
      const fulfill = $("#appointment-fulfill");
      if (fulfill) fulfill.style.display = ap.status === "overdue" ? "none" : "";
      if (ap.status !== "overdue") updateStatusTimer();
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
    $("#stat-main").textContent = state.chains.main.records.length;
    $("#stat-oath").textContent = Engine.countOath(state);
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
  function renderAttrs(el) {
    if (!el) return;
    el.innerHTML = Scenes.ATTR_KEYS.map(k => '<div class="metric-row"><span class="m-name">' + Scenes.ATTR_NAMES[k] + '</span><span class="m-val">' + state.reign.attributes[k] + '</span></div>').join("");
  }
  function renderHeirs(el) {
    if (!el) return;
    if (!state.heirs.length) { el.innerHTML = '<p class="hint">尚无子嗣（琴瑟和鸣等事务可加速诞育）。</p>'; return; }
    el.innerHTML = state.heirs.map(h => {
      const attrs = Scenes.ATTR_KEYS.map(k => Scenes.ATTR_NAMES[k] + " " + h.attributes[k]).join(" · ");
      const nameTxt = (h.named === false ? escapeHtml(h.name) + "（待命名）" : escapeHtml(h.name));
      return '<div class="goal-row"><div class="goal-name"><b>' + nameTxt + '</b> <span class="hint">' + (h.gender === "male" ? "皇子" : "公主") + ' · ' + h.age + ' 岁</span><div class="hint">' + escapeHtml(attrs) + '</div></div>' +
        '<span class="goal-actions"><button data-hact="rename" data-id="' + escapeHtml(h.id) + '">' + (h.named === false ? "命名" : "改名") + '</button><button data-hact="train" data-id="' + escapeHtml(h.id) + '">培养</button></span></div>';
    }).join("");
  }
  function renderEventStatus(el) {
    el.innerHTML = '<p class="hint">突发事件报备时，逐项对受影响制度裁决（判失守 / 立为成例）。</p>';
  }
  function renderGoals() {
    const el = $("#goal-list");
    if (!state.goals.length) { el.innerHTML = '<p class="hint">尚无国策。</p>'; return; }
    el.innerHTML = state.goals.map(g => {
      const subs = (g.subGoals || []).map(sg => {
        const crits = (sg.criteria || []).map(c => {
          const ok = Engine.criterionMet(state, c);
          return '<div class="subgoal-crit' + (ok ? " ok" : "") + '">' + (ok ? "✓" : "·") + ' ' + escapeHtml(Engine.describeCriterion(state, c)) + '</div>';
        }).join("");
        return '<div class="subgoal' + (sg.done ? " done" : "") + '"><b>' + (sg.done ? "✓" : "·") + ' ' + escapeHtml(sg.title || sg.name) + '</b>' + (sg.title && sg.title !== sg.name ? ' <span class="hint">（' + escapeHtml(sg.name) + '）</span>' : '') + (sg.verdict ? '<div class="hint">' + escapeHtml(sg.verdict) + '</div>' : '') + crits + '</div>';
      }).join("");
      const title = g.title || g.name;
      const txt = g.status === "done" ? "已成" : (g.status === "failed" ? "未竟" : "进行中");
      return '<div class="goal-row ' + escapeHtml(g.status) + '"><div class="goal-name"><b>' + escapeHtml(title) + '</b>' + (g.title && g.title !== g.name ? ' <span class="hint">（' + escapeHtml(g.name) + '）</span>' : '') + (g.verdict ? '<div class="hint">' + escapeHtml(g.verdict) + '</div>' : '') + subs + '</div>' +
        '<span class="goal-status">' + txt + '</span>' +
        (g.status === "active" ? '<span class="goal-actions"><button data-gact="sub" data-id="' + escapeHtml(g.id) + '">加阶段目标</button><button data-gact="done" data-id="' + escapeHtml(g.id) + '">已成</button><button data-gact="failed" data-id="' + escapeHtml(g.id) + '">未竟</button></span>' : '') +
        '</div>';
    }).join("");
  }

  function renderChain() {
    renderChainList($("#chain-main"), state.chains.main, "主要政务");
    renderChainList($("#chain-reserve"), state.chains.reserve, "次要政务");
    renderOathChain($("#chain-oath"), state.chains.oath);
    $("#chain-main-precedents").innerHTML = renderPrecedents(state.chains.main.precedents, "主要政务成例");
    $("#chain-reserve-precedents").innerHTML = renderPrecedents(state.chains.reserve.precedents, "次要政务成例");
    const op = $("#chain-oath-precedents");
    if (op) op.innerHTML = renderPrecedents((state.chains.oath && state.chains.oath.precedents) || [], "金口玉言成例");
  }
  function renderOathChain(el, chain) {
    if (!el) return;
    const recs = (chain && chain.records) || [];
    if (!recs.length) { el.innerHTML = '<p class="hint">尚无承诺（预约）纪录。</p>'; return; }
    let html = '<div class="chain-title">金口玉言 · 共 ' + recs.length + ' 诺</div>';
    for (let i = recs.length - 1; i >= 0; i--) {
      const r = recs[i];
      html += '<div class="chain-row"><span class="num">#' + r.number + '</span><span class="gov">' + escapeHtml(r.name) + (r.appointment ? ' · ' + escapeHtml(r.appointment) : '') + '</span><span class="tag' + (r.status === "kept" ? "" : "") + '">' + (r.status === "kept" ? "已履约" : "待履约") + '</span><span class="date">' + escapeHtml(r.date) + '</span></div>';
    }
    el.innerHTML = html;
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
      '<div class="policy-line"><span class="policy-name">' + escapeHtml(p.title || p.name) + '</span>' +
      (p.title && p.title !== p.name ? '<span class="policy-group">' + escapeHtml(p.name) + '</span>' : '') +
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
  function logItemHtml(e) {
    const modern = e.modern ? '<div class="log-modern">' + escapeHtml(e.modern) + '</div>' : '';
    const month = e.month ? '<span class="log-month">' + escapeHtml(e.month) + '</span>' : '';
    return '<li><span class="k">' + (e.year ? "第" + e.year + "年 " : "") + e.date + '</span><span class="v">' + month + escapeHtml(e.text) + modern + '</span></li>';
  }
  function renderLog(entries) {
    if (!entries.length) return '<p class="hint">起居注尚空。</p>';
    return entries.map(logItemHtml).join("");
  }
  function renderHistory() {
    $("#abdicate-banner").hidden = !Engine.shouldAbdicate(state);
    const lineage = state.dynasty.lineage;
    const el = $("#lineage");
    if (!lineage.length) { el.innerHTML = '<p class="hint">奉先殿尚空。</p>'; return; }
    el.innerHTML = lineage.slice().reverse().map(l => {
      const title = "「" + escapeHtml(l.eraName) + "」" + (l.posthumous ? " · 谥「" + escapeHtml(l.posthumous) + "」" : "") + (l.temple ? " · 庙号「" + escapeHtml(l.temple) + "」" : "");
      const recs = (l.veritableRecords || []);
      const recHtml = recs.map(r => logItemHtml(r)).join("");
      return '<div class="emperor"><div class="emperor-title">' + title + '</div>' +
        '<div class="emperor-meta">在位 ' + l.years + ' 年 · 享年 ' + l.age + ' 岁 · ' + escapeHtml(l.reason) + '</div>' +
        (l.score && l.score.reason ? '<div class="emperor-basis">谥号依据：' + escapeHtml(l.score.reason) + '</div>' : '') +
        (l.eulogy ? '<div class="emperor-basis">史官曰：' + escapeHtml(l.eulogy) + '</div>' : '') +
        '<details><summary>实录（' + recs.length + ' 条）</summary><ul class="log">' + (recHtml || '<li><span class="v">（空）</span></li>') + '</ul></details></div>';
    }).join("");
  }

  function renderConsole() {
    const st = $("#console-status"), pending = $("#console-pending"), quick = $("#console-quick");
    if (!st) return;
    const af = state.activeFocus;
    const ap = state.activeAppointment || state.chains.appointment.active;
    if (af) st.textContent = (af.status === "awaiting-confirmation" ? "临朝待确认" : "临朝中") + " · " + af.gov;
    else if (ap) st.textContent = (ap.status === "overdue" ? "预约逾期" : "预约中") + " · " + ap.name;
    else st.textContent = "今日无事";
    renderConsoleSummary();
    pending.textContent = state.reign.todayTasks.length ? "待结算 " + state.reign.todayTasks.length + " 件" : "";
    const seen = new Set(); const rec = [];
    const all = state.chains.main.records.concat(state.chains.reserve.records).slice(-24).reverse();
    for (const r of all) { if (!r.sceneId || seen.has(r.sceneId)) continue; seen.add(r.sceneId); rec.push(r); if (rec.length >= 3) break; }
    quick.innerHTML = rec.map(r =>
      '<button class="scene-btn console-scene" data-quick-scene="' + r.sceneId + '">' + escapeHtml(r.name) + '</button>'
    ).join("") || '<span class="hint">尚无临朝纪录。</span>';
  }
  function renderConsoleSummary() {
    const el = $("#console-summary");
    if (!el) return;
    const all = metricDisplay();
    el.innerHTML = SUMMARY.map(g => {
      const rows = g.items.map(([k, label]) => {
        const m = all[k]; if (!m) return "";
        return '<div class="sum-row"><span class="sum-k">' + label + '</span><span class="sum-v">' + fmtNum(m.value) + (m.unit ? m.unit : "") + '</span></div>';
      }).join("");
      return '<div class="sum-tile"><div class="sum-title">' + g.title + '</div>' + rows + '</div>';
    }).join("");
  }

  function updateTimers() {
    // 跨现实日自动结算（一天 = 一年），避免应用常驻时不刷新导致年龄停滞
    if (state.meta.lastTickDate !== Engine.todayStr()) {
      state = Engine.tick(state);
      renderAll();
      return;
    }
    // 状态收敛：临朝到时→待确认结束；预约到期→已逾期（业务规则在引擎）
    if (Engine.advanceTimers(state)) {
      renderStatusBar();
      return;
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
    if (act === "event") { $("#event-text").value = ""; renderEventPolicies(); $("#event-modal").hidden = false; }
    else if (act === "goal") { $("#goal-name").value = ""; $("#goal-flavor").value = ""; $("#goal-modal").hidden = false; }
    else if (act === "policy-add") {
      if (!Engine.policyAddAllowed(state)) { toast("今日已颁行过制度，明日再议。"); return; }
      $("#policy-modal").hidden = false;
    }
    else if (act === "settle") { openSettle(); }
    else if (act === "abdicate") { openAbdicate(); }
  }
  function renderEventPolicies() {
    const el = $("#event-policies");
    if (!el) return;
    const act = state.policies.filter(p => p.status === "active");
    if (!act.length) { el.innerHTML = '<p class="hint">暂无在行制度，无需逐项裁决。</p>'; return; }
    el.innerHTML = act.map(p =>
      '<div class="ev-policy" data-policy-id="' + p.id + '"><span class="ev-name">' + escapeHtml(p.name) + '</span>' +
      '<label class="ev-opt"><input type="radio" name="ev-' + p.id + '" value="ignore" checked> 不受影响</label>' +
      '<label class="ev-opt"><input type="radio" name="ev-' + p.id + '" value="collapse"> 判失守</label>' +
      '<label class="ev-opt"><input type="radio" name="ev-' + p.id + '" value="precedent"> 立为成例</label></div>'
    ).join("");
  }
  function llmConfigured() {
    const llm = state.settings.llm || {};
    return !!(llm.baseUrl && llm.apiKey && llm.model);
  }
  // 岁末结算入口：已配置 LLM 时先展示「外发摘要」确认，否则直接本地常例（不外发）
  function openSettle() {
    if (llmConfigured()) {
      renderSendSummary();
      $("#send-modal").hidden = false;
    } else {
      doSettle(null);
    }
  }
  function renderSendSummary() {
    const el = $("#send-summary");
    if (!el) return;
    const tasks = state.reign.todayTasks;
    const taskHtml = tasks.length
      ? tasks.map(t => { const sc = Scenes.get(t.sceneId); return '<li>' + escapeHtml((sc ? sc.name : t.sceneId) + (t.realTask ? "——" + t.realTask : "")) + '</li>'; }).join("")
      : '<li>（今日尚无事务）</li>';
    const act = state.policies.filter(p => p.status === "active");
    const polHtml = act.length ? act.map(p => '<li>' + escapeHtml(p.name) + '（固化度 ' + p.solidity + '）</li>').join("") : '<li>（无在行制度）</li>';
    const recent = state.log.slice(0, 15);
    const logHtml = recent.length ? recent.map(e => '<li>' + escapeHtml(e.date + " " + e.text) + '</li>').join("") : '<li>（起居注尚空）</li>';
    el.innerHTML =
      '<div class="send-block"><b>今日事务（' + tasks.length + ' 件）</b><ul>' + taskHtml + '</ul></div>' +
      '<div class="send-block"><b>在行制度（' + act.length + ' 条）</b><ul>' + polHtml + '</ul></div>' +
      '<div class="send-block"><b>近闻起居注（最近 ' + recent.length + ' 条）</b><ul>' + logHtml + '</ul></div>';
  }
  async function doSettle(btn) {
    const orig = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = "拟诏中…"; }
    else toast("无外发，按本地常例拟定草案。");
    try {
      const r = await Engine.proposeSettlement(state, true);
      pendingSettlement = r;
      renderSettleEntries(r);
      $("#settle-modal").hidden = false;
    } catch (e) { toast("结算出错：" + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
  function effectsToText(eff) {
    return Object.keys(eff || {}).map(k => k + ":" + eff[k]).join(",");
  }
  function renderSettleLegend() {
    const el = $("#settle-legend");
    if (!el) return;
    el.textContent = "可编辑指标：" + Metrics.STORED_KEYS.map(k => Metrics.DEFS[k].name + "=" + k).join("、");
  }
  function renderFlavorPreview(r) {
    const draft = (r && r.draft) || {};
    const lines = [];
    for (const it of (draft.goalTitles || [])) {
      const g = state.goals.find(x => x.id === it.goalId);
      if (g && it.title) lines.push("国策「" + (g.title || g.name) + "」风味名 → 「" + it.title + "」");
    }
    for (const it of (draft.goalVerdicts || [])) {
      const g = state.goals.find(x => x.id === it.goalId);
      if (g && it.verdict) lines.push("国策评述：" + it.verdict);
    }
    for (const it of (draft.subGoalTitles || [])) {
      let nm = "";
      for (const g of state.goals) { const sg = (g.subGoals || []).find(x => x.id === it.subGoalId); if (sg) { nm = sg.title || sg.name; break; } }
      if (it.title) lines.push("阶段目标「" + nm + "」风味名 → 「" + it.title + "」");
    }
    for (const it of (draft.subGoalVerdicts || [])) {
      let nm = "";
      for (const g of state.goals) { const sg = (g.subGoals || []).find(x => x.id === it.subGoalId); if (sg) { nm = sg.name; break; } }
      if (it.verdict) lines.push("阶段目标「" + nm + "」评述：" + it.verdict);
    }
    for (const it of (draft.policyTitles || [])) {
      const p = state.policies.find(x => x.id === it.policyId);
      if (p && it.title) lines.push("制度「" + (p.title || p.name) + "」风味名 → 「" + it.title + "」");
    }
    if (!lines.length) return "";
    return '<div class="flavor-preview"><div class="fp-title">国策 / 制度风味化</div>' +
      lines.map(l => '<div class="fp-line">' + escapeHtml(l) + '</div>').join("") + '</div>';
  }
  function renderSettleEntries(r) {
    const src = r.source === "llm"
      ? "史官拟定的草案（可编辑后确认）"
      : (r.error ? "本地常例草案（大模型未接通：" + r.error + "，可编辑后确认）" : "本地常例草案（可编辑后确认）");
    $("#settle-source").textContent = src;
    renderSettleLegend();
    const el = $("#settle-entries");
    const entries = (r.draft && r.draft.entries) || [];
    el.innerHTML = entries.map((e, i) =>
      '<div class="settle-entry">' +
        (e.month ? '<div class="se-month">' + escapeHtml(e.month) + '</div>' : '') +
        '<input class="se-title" value="' + escapeHtml(e.title || "") + '" placeholder="标题">' +
        '<input class="se-note" value="' + escapeHtml(e.note || "") + '" placeholder="评语">' +
        '<input class="se-effects" value="' + escapeHtml(effectsToText(e.effects)) + '" placeholder="指标:数值（如 treasury:1000,support:2）">' +
        (e.classical ? '<div class="se-preview">' + escapeHtml(e.classical) + '</div>' : '') +
        (e.modern ? '<div class="se-preview log-modern">' + escapeHtml(e.modern) + '</div>' : '') +
        '<input type="hidden" class="se-month" value="' + escapeHtml(e.month || "") + '">' +
        '<input type="hidden" class="se-classical" value="' + escapeHtml(e.classical || "") + '">' +
        '<input type="hidden" class="se-modern" value="' + escapeHtml(e.modern || "") + '">' +
      '</div>'
    ).join("") || '<p class="hint">（今日无待结算事务）</p>';
    const fp = $("#settle-flavors");
    if (fp) fp.innerHTML = renderFlavorPreview(r);
  }
  function openAbdicate() {
    const sel = $("#abdicate-heir");
    sel.innerHTML = '<option value="">（无子嗣，宗室即位）</option>' + state.heirs.map(h => '<option value="' + escapeHtml(h.id) + '">' + escapeHtml(h.name) + '（' + h.age + ' 岁）</option>').join("");
    const era = $("#abdicate-era");
    if (era) era.value = "";
    $("#abdicate-modal").hidden = false;
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
  function openHeirName(id) {
    const h = state.heirs.find(x => x.id === id);
    renameHeirId = id;
    $("#heir-name").value = h ? h.name : "";
    $("#heir-name-modal").hidden = false;
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

  // 事件绑定门面：events.js 经此调用渲染/导航/动作，并读写界面状态（不直接触达闭包变量）
  const api = {
    getState: () => state,
    setState: (s) => { state = s; },
    renderAll, toast, openView, backToPalace,
    updateVenueSelection, startFromVenue, revealPanels, handleVenueAction,
    doSettle, renderSettleEntries,
    openVerdict, closeVerdict, openSubGoalModal, openHeirName,
    criterionRowHtml, criterionArgsHtml, collectCriteria, llmConfigured,
    get selectedSceneId() { return selectedSceneId; },
    set selectedSceneId(v) { selectedSceneId = v; },
    get selectedChain() { return selectedChain; },
    set selectedChain(v) { selectedChain = v; },
    get verdictTarget() { return verdictTarget; },
    set verdictTarget(v) { verdictTarget = v; },
    get subGoalGoalId() { return subGoalGoalId; },
    set subGoalGoalId(v) { subGoalGoalId = v; },
    get renameHeirId() { return renameHeirId; },
    set renameHeirId(v) { renameHeirId = v; },
    get pendingSettlement() { return pendingSettlement; },
    set pendingSettlement(v) { pendingSettlement = v; },
    get storedLlmKey() { return storedLlmKey; },
    set storedLlmKey(v) { storedLlmKey = v; },
  };

  return { init, toast };
})();
