/* Sophrosyne — 风味化规则表（任务 → 政务映射 + 属性来源 + 具体国力指标 + 文案）
 * METRICS：各指标含名称、单位、初始值（具体量纲，无上限，除民望为 0-100 支持度）。
 * gain：该政务完成后对所属指标的具体增益量（单位见 METRICS[key].unit）。
 */
window.Sophrosyne = window.Sophrosyne || {};
Sophrosyne.Flavor = (function () {
  const METRICS = {
    population: { name: "人口", unit: "万口", initial: 3000 },
    treasury:   { name: "岁入", unit: "万两", initial: 500 },
    military:   { name: "军备", unit: "万卒", initial: 20 },
    culture:    { name: "文治", unit: "万卷", initial: 100 },
    support:    { name: "民望", unit: "%",   initial: 50 },
  };
  const METRIC_KEYS = ["population", "treasury", "military", "culture", "support"];

  const CATEGORIES = [
    // —— 前朝 · 政务 ——
    { id: "english",  domain: "前朝", label: "学英语 / 外语", gov: "处理外交番邦事务", dept: "礼部 · 鸿胪寺", gain: 2,  metric: "support",    attrs: ["intellect", "talent"], primary: "intellect", result: "抚柔远人，四夷宾服。" },
    { id: "politics", domain: "前朝", label: "学政治 / 思政", gov: "平衡朝堂、铨选人事", dept: "吏部", gain: 3,  metric: "culture",    attrs: ["intellect", "prestige"], primary: "intellect", result: "澄清吏治，朝纲肃然。" },
    { id: "math",     domain: "前朝", label: "数学 / 逻辑", gov: "精算钱粮赋税", dept: "户部", gain: 20, metric: "treasury",   attrs: ["intellect"], primary: "intellect", result: "国计充盈，度支有方。" },
    { id: "core",     domain: "前朝", label: "专业课 / 核心学习", gov: "修撰国史、编修典章", dept: "翰林院", gain: 30, metric: "culture", attrs: ["intellect"], primary: "intellect", result: "典章明备，文脉绵长。" },
    { id: "writing",  domain: "前朝", label: "写论文 / 写作", gov: "主持编修国史、起草诏书", dept: "翰林院", gain: 30, metric: "culture", attrs: ["intellect", "talent"], primary: "intellect", result: "诏书既下，字字千钧。" },
    { id: "coding",   domain: "前朝", label: "学编程 / 技术", gov: "督造工程、工部技艺", dept: "工部", gain: 30, metric: "treasury", attrs: ["intellect", "talent"], primary: "intellect", result: "营造精进，百工咸理。" },
    { id: "plan",     domain: "前朝", label: "做计划 / 复盘", gov: "制定方略、召集朝议", dept: "中枢", gain: 1,  metric: "support", attrs: ["intellect", "composure"], primary: "intellect", result: "庙算既定，胜于未战。" },

    // —— 内廷 · 修身 ——
    { id: "reading",  domain: "内廷", label: "读书 / 阅读", gov: "研读圣贤经典、批阅奏折", dept: "内廷", gain: 10, metric: "culture", attrs: ["intellect", "composure"], primary: "intellect", result: "开卷有益，涵养心性。" },
    { id: "exercise", domain: "内廷", label: "锻炼 / 健身", gov: "骑射操练、整军经武", dept: "兵部", gain: 1,  metric: "military", attrs: ["health", "energy", "charm"], primary: "energy", result: "体魄强健，武备不废。" },
    { id: "running",  domain: "内廷", label: "跑步", gov: "行军拉练", dept: "兵部", gain: 1,  metric: "military", attrs: ["health", "energy"], primary: "energy", result: "步伐稳健，意志愈坚。" },
    { id: "meditate", domain: "内廷", label: "冥想 / 正念", gov: "斋戒静思、祭天祈福", dept: "内廷", gain: 1,  metric: "support", attrs: ["composure", "energy"], primary: "composure", result: "心境澄明，不役于物。" },
    { id: "sleep",    domain: "内廷", label: "早睡 / 作息", gov: "依时起居、按时宫禁", dept: "内廷", gain: 3,  metric: "population", attrs: ["health", "energy"], primary: "health", result: "起居有常，元气渐复。" },
    { id: "chores",   domain: "内廷", label: "杂务 / 家务", gov: "处理内帑杂务", dept: "内廷", gain: 10, metric: "treasury", attrs: ["energy"], primary: "energy", result: "内帑井然，无琐事之扰。" },
    { id: "social",   domain: "内廷", label: "社交 / 见朋友", gov: "宴请群臣、会见外使", dept: "中枢", gain: 1,  metric: "support", attrs: ["charm", "composure", "prestige"], primary: "charm", result: "宾主尽欢，人望日隆。" },
    { id: "love",     domain: "内廷", label: "恋爱 / 约会", gov: "内廷情感、琴瑟和鸣", dept: "内廷（后宫）", gain: 1, metric: "support", attrs: ["charm", "composure"], primary: "charm", result: "琴瑟在御，莫不静好。" },
    { id: "art",      domain: "内廷", label: "画画 / 音乐 / 写字", gov: "御笔丹青、宫廷雅乐", dept: "内廷", gain: 10, metric: "culture", attrs: ["talent", "composure"], primary: "talent", result: "丹青雅乐，养性怡情。" },
  ];

  const ATTR_KEYS = ["health", "energy", "talent", "intellect", "composure", "charm", "prestige"];
  const ATTR_NAMES = {
    health: "健康", energy: "精力", talent: "才华", intellect: "智力",
    composure: "心性", charm: "魅力", prestige: "威望",
  };

  function get(id) { return CATEGORIES.find(c => c.id === id) || null; }
  function all() { return CATEGORIES.slice(); }
  function byDomain(domain) { return CATEGORIES.filter(c => c.domain === domain); }
  function custom(label) {
    return {
      id: "custom", domain: "前朝", label: label,
      gov: "临朝理政（自拟政务）", dept: "中枢", gain: 5,
      metric: "support", attrs: ["intellect"], primary: "intellect",
      result: "勤政不怠，社稷赖之。"
    };
  }

  return { get, all, byDomain, custom, CATEGORIES, ATTR_KEYS, ATTR_NAMES, METRICS, METRIC_KEYS };
})();
