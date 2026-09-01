/* Sophrosyne — 政务 / 个人事务场景模板
 * 场景不绑定现实时间；主要/次要政务由用户自选。
 * defaultEffects：无大模型时的兜底增减（小量、可增可减）；配置 LLM 后，由大模型在岁末结算时决定真实增减并风味化。
 * loc：该事务发生的宫殿（用于把政务/事务按地点分配到各建筑的一级按钮）。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Scenes = (function () {
  const SCENES = [
    // —— 前朝 · 政务（学习 / 工作）——
    { id: "audience",   domain: "前朝", loc: "taihemen",  name: "御门听政", gov: "御门听政、面奏章疏", appointment: "沐浴更衣·备朝", defaultEffects: { prestige: 2, order: 1, corruption: -1 }, attrs: ["intellect", "prestige"], primary: "intellect" },
    { id: "summon",     domain: "前朝", loc: "qianqinggong", name: "召见大臣", gov: "廷议、召对重臣", appointment: "下旨召见", defaultEffects: { order: 1, prestige: 1, corruption: -1 }, attrs: ["intellect", "prestige"], primary: "intellect" },
    { id: "memorial",   domain: "前朝", loc: "qianqinggong", name: "批阅奏折", gov: "朱批奏章、票拟", appointment: "传折待批", defaultEffects: { order: 2, corruption: -1 }, attrs: ["intellect", "composure"], primary: "intellect" },
    { id: "inspect",    domain: "前朝", loc: "qianqinggong", name: "微服私访", gov: "体察民情、明察暗访", appointment: "乔装出宫", defaultEffects: { support: 2, order: 1 }, attrs: ["composure", "charm"], primary: "composure" },
    { id: "exam",       domain: "前朝", loc: "baohe",  name: "主持科举", gov: "主持乡试会试、取士", appointment: "张榜布告", defaultEffects: { xiuCai: 20, juRen: 5, jinShi: 2, corruption: -1 }, attrs: ["intellect", "prestige"], primary: "intellect" },
    { id: "compile",    domain: "前朝", loc: "wenyuange", name: "编纂典籍", gov: "修史编书、校勘典籍", appointment: "备齐文房", defaultEffects: { tech: 1, xiuCai: 10 }, attrs: ["intellect", "talent"], primary: "intellect" },
    { id: "build",      domain: "前朝", loc: "taihedian",  name: "督造工程", gov: "兴修水利城防、营造", appointment: "勘测定址", defaultEffects: { infra: 3, treasury: -500 }, attrs: ["intellect", "talent"], primary: "intellect" },
    { id: "army",       domain: "前朝", loc: "junjichu",  name: "筹措军备", gov: "整军经武、筹备军资", appointment: "点兵点将", defaultEffects: { equipment: 2, training: 2, treasury: -300 }, attrs: ["intellect", "energy"], primary: "intellect" },
    { id: "lecture",    domain: "前朝", loc: "wenhuadian", name: "经筵讲学", gov: "御前讲学、研讨经义", appointment: "备经备卷", defaultEffects: { xiuCai: 15, tech: 1 }, attrs: ["intellect"], primary: "intellect" },
    { id: "justice",    domain: "前朝", loc: "qianqinggong", name: "处理刑狱", gov: "断案决狱、平反冤案", appointment: "调卷提审", defaultEffects: { order: 2, corruption: -1 }, attrs: ["intellect", "composure"], primary: "intellect" },
    { id: "relief",     domain: "前朝", loc: "junjichu",  name: "赈灾济民", gov: "开仓放粮、抚恤灾民", appointment: "开仓调粮", defaultEffects: { support: 2, grain: -1000 }, attrs: ["composure", "prestige"], primary: "composure" },
    { id: "envoy",      domain: "前朝", loc: "junjichu",  name: "出使邻邦", gov: "修好邻国、通使缔约", appointment: "备礼饯行", defaultEffects: { diplomacy: 3, prestige: 1 }, attrs: ["intellect", "charm"], primary: "intellect" },

    // —— 内廷 · 个人事务（修身）——
    { id: "ride",       domain: "内廷", loc: "wuyingdian", name: "骑射操练", gov: "骑射、习武、健体", appointment: "更衣备马", defaultEffects: { training: 2, army: 50 }, attrs: ["health", "energy", "charm"], primary: "energy" },
    { id: "march",      domain: "内廷", loc: "wuyingdian", name: "行军拉练", gov: "长跑、行军、耐力", appointment: "整装出营", defaultEffects: { army: 100, training: 1 }, attrs: ["health", "energy"], primary: "energy" },
    { id: "meditate",   domain: "内廷", loc: "qintianjian", name: "斋戒静思", gov: "静坐、正念、冥想", appointment: "焚香静心", defaultEffects: { support: 1 }, attrs: ["composure", "energy"], primary: "composure" },
    { id: "paint",      domain: "内廷", loc: "yangxindian", name: "御笔丹青", gov: "书画、丹青、临帖", appointment: "研墨铺纸", defaultEffects: { xiuCai: 5 }, attrs: ["talent", "composure"], primary: "talent" },
    { id: "music",      domain: "内廷", loc: "changyinge",  name: "宫廷雅乐", gov: "操琴、度曲、雅乐", appointment: "调弦正音", defaultEffects: { support: 1 }, attrs: ["talent", "composure"], primary: "talent" },
    { id: "read",       domain: "内廷", loc: "wenyuange", name: "研读经典", gov: "读书、批注、研习", appointment: "沐浴焚香", defaultEffects: { xiuCai: 10, tech: 1 }, attrs: ["intellect", "composure"], primary: "intellect" },
    { id: "rest",       domain: "内廷", loc: "yangxindian", name: "依时起居", gov: "早睡、作息、养神", appointment: "掌灯更衣", defaultEffects: { population: 500, grain: -100 }, attrs: ["health", "energy"], primary: "health" },
    { id: "finance",    domain: "内廷", loc: "neiweufu", name: "打理内帑", gov: "理账、家务、收纳", appointment: "清点账册", defaultEffects: { treasury: 200 }, attrs: ["energy"], primary: "energy" },
    { id: "banquet",    domain: "内廷", loc: "changyinge",  name: "宴请群臣", gov: "宴饮、会友、社交", appointment: "备宴设席", defaultEffects: { support: 2, prestige: 1, treasury: -200 }, attrs: ["charm", "composure", "prestige"], primary: "charm" },
    { id: "love",       domain: "内廷", loc: "kunninggong",  name: "琴瑟和鸣", gov: "陪伴、约会、经营感情", appointment: "更衣理容", defaultEffects: { support: 2 }, attrs: ["charm", "composure"], primary: "charm" },
    { id: "diet",       domain: "内廷", loc: "yushanfang",  name: "药膳调理", gov: "饮食、药膳、养生", appointment: "传膳备药", defaultEffects: { population: 200, support: 1 }, attrs: ["health", "energy"], primary: "health" },
    { id: "tea",        domain: "内廷", loc: "yuhuayuan",  name: "焚香品茗", gov: "休息、品茗、放松", appointment: "备茶焚香", defaultEffects: { support: 1 }, attrs: ["composure"], primary: "composure" },

    // —— 0.6.0 新开宫殿与既有宫殿补丰富 ——
    { id: "ritual",     domain: "前朝", loc: "zhonghedian", name: "大朝仪礼", gov: "演礼、朝仪、典制", appointment: "设坛备仪", defaultEffects: { order: 1, prestige: 1 }, attrs: ["composure", "prestige"], primary: "composure" },
    { id: "household",  domain: "内廷", loc: "jiaotaidian", name: "整饬宫规", gov: "整理、收纳、居所规整", appointment: "点检宫务", defaultEffects: { order: 1, corruption: -1 }, attrs: ["energy", "composure"], primary: "energy" },
    { id: "proclaim",   domain: "前朝", loc: "wumen",      name: "颁诏天下", gov: "布告、宣示、公开承诺", appointment: "升座宣旨", defaultEffects: { prestige: 1, support: 1 }, attrs: ["intellect", "charm"], primary: "intellect" },
    { id: "patrol",     domain: "内廷", loc: "shenwumen",  name: "巡城阅兵", gov: "散步、巡查、户外活动", appointment: "更衣出巡", defaultEffects: { training: 1, army: 50 }, attrs: ["health", "energy"], primary: "energy" },
    { id: "eldercare",  domain: "内廷", loc: "cininggong", name: "奉养太妃", gov: "探望长辈、陪伴家人", appointment: "请安问膳", defaultEffects: { support: 1 }, attrs: ["charm", "composure"], primary: "charm" },
    { id: "retire",     domain: "内廷", loc: "ningshougong", name: "颐养天年", gov: "养生、规划、安享", appointment: "沐浴安神", defaultEffects: { population: 200 }, attrs: ["health", "composure"], primary: "health" },
    { id: "stargaze",   domain: "内廷", loc: "qintianjian", name: "观星测候", gov: "观察、记录、规划", appointment: "备历登台", defaultEffects: { tech: 1 }, attrs: ["intellect", "talent"], primary: "intellect" },
    { id: "stroll",     domain: "内廷", loc: "yuhuayuan",  name: "游园理政", gov: "散步、放空、沉思", appointment: "更衣游园", defaultEffects: { order: 1 }, attrs: ["composure"], primary: "composure" },
    { id: "taste",      domain: "内廷", loc: "yushanfang", name: "亲尝百膳", gov: "备餐、饮食、觉察", appointment: "传膳试味", defaultEffects: { population: 100, support: 1 }, attrs: ["health"], primary: "health" },
    { id: "thrift",     domain: "内廷", loc: "neiweufu",   name: "节流开源", gov: "理财、预算、记账", appointment: "核账清册", defaultEffects: { treasury: 200, corruption: -1 }, attrs: ["energy", "intellect"], primary: "intellect" },
    { id: "teach",      domain: "内廷", loc: "yuqinggong", name: "教习皇子", gov: "教养、辅导、答疑", appointment: "备书开讲", defaultEffects: { xiuCai: 10 }, attrs: ["intellect", "charm"], primary: "intellect" },
    { id: "prince_martial", domain: "内廷", loc: "yuqinggong", name: "骑射演武", gov: "教皇子习武、骑射、强身", appointment: "更衣备马", defaultEffects: { training: 1, army: 50 }, attrs: ["health", "energy"], primary: "energy" },
    { id: "princess_study", domain: "内廷", loc: "xianfugong", name: "教习公主", gov: "教公主读书、明理、知礼", appointment: "备书开讲", defaultEffects: { xiuCai: 10 }, attrs: ["intellect", "charm"], primary: "intellect" },
    { id: "princess_art",  domain: "内廷", loc: "xianfugong", name: "女红针黹", gov: "刺绣、针线、手工女红", appointment: "备线理针", defaultEffects: { support: 1 }, attrs: ["talent", "composure"], primary: "talent" },
    { id: "princess_music", domain: "内廷", loc: "xianfugong", name: "抚琴品画", gov: "琴棋书画、才艺涵养", appointment: "调弦研墨", defaultEffects: { xiuCai: 5, support: 1 }, attrs: ["talent", "composure"], primary: "talent" },
  ];

  function get(id) { return SCENES.find(s => s.id === id) || null; }
  function all() { return SCENES.slice(); }
  function byDomain(domain) { return SCENES.filter(s => s.domain === domain); }
  function byVenue(loc) { return SCENES.filter(s => s.loc === loc); }

  const ATTR_KEYS = ["health", "energy", "talent", "intellect", "composure", "charm", "prestige"];
  const ATTR_NAMES = {
    health: "健康", energy: "精力", talent: "才华", intellect: "智力",
    composure: "心性", charm: "魅力", prestige: "威望",
  };

  return { get, all, byDomain, byVenue, SCENES, ATTR_KEYS, ATTR_NAMES };
})();
