# 2026-08-29

## 美术资产批量生成

按照 `美术资产提示词.md` 投喂 `ImageGen`，全部 30 张资产已生成并落入
`assets/generated/`，按英文 / 中文拼音规范命名。

**18 建筑**：baohe, cehua_donghua (侧华/东华), gongqiang_segment (宫墙), jiaolou (角楼),
jiaotaidian (交泰), junjichu (军机处), kunninggong (坤宁), qianqinggong (乾清),
qintianjian (钦天监), shangshufang (上书房), shenwumen (神武门), taihedian (太和),
taimiao (太庙), wenyuange (文渊阁), wumen (午门), yangxindian (养心),
yuhuayuan (御花园), zhonghedian (中和)

**3 地图**：`map_ground` (整图地面), `brick_floor_texture`, `marble_steps_texture`

**5 UI**：`ui_scroll_panel`, `ui_jade_seal`, `ui_gold_button`, `ui_dragon_border`, `ui_fret_divider`

**4 内景（横版 1536x1024）**：`interior_taihedian`, `interior_junjichu`, `interior_wenyuange`, `interior_taimiao`

## 关键经验

- `ImageGen` 输出文件名基于秒级时间戳 → **并行调用时同秒内会互相覆盖**。
  教训：从 batch 2 起改为"生成 1 张 + 立即 mv 改名"的串行节奏。
- `size` 参数有"宽 / 高都 ≥ 256"硬约束，超细横条（如回纹分隔线 1536x64）会报错，
  退化为 512x256 即可。
- 全部用全局风格锚点（vermilion + 金黄琉璃 + 青灰台基 + 等距 45° + 干净背景），
  视觉一致性较好。下一步建议：
  1. 把图片接入 `<image>` SVG 贴图前，**所有图统一二次抠图 / 调饱和度**，避免不同 batch 间色偏。
  2. 设定固定 seed 或固定参考图（image-to-image）以锁死风格。
3. 用户的台词提到要把建筑"按英文拼音放在 `assets/` 根目录"以便 SVG 接入，但目前
   我放在了 `assets/generated/` 子目录。需询问是否要把它们上移到 `assets/` 根。

## v2 · 透明背景重生成 + 12 新建筑

按 `美术资产提示词_v2_透明背景.md` 的指引，**严格串行**节奏重生成 18 建筑 + 5 UI
（透明背景覆盖式更新），并新增 12 座建筑：
- 18 建筑已覆盖 → 全部使用 `background=transparent` 重新生成。
- 5 UI 已覆盖 → 全部透明背景。
- 12 新建筑（不重名，全新）：`taihemen`, `qianqingmen`, `wenhuadian`, `wuyingdian`,
  `cininggong`, `ningshougong`, `neiweufu`, `yushanfang`, `changyinge`, `yuhuage`,
  `yinghuadian`, `jianting`。

合计 `assets/generated/` 下 42 张 PNG：
- 30 建筑（18 透明覆盖 + 12 新）
- 5 UI（透明覆盖）
- 3 地图 / 纹理（保留 v1，**未透明化**——v2 doc 没要求）
- 4 内景（保留 v1，**未透明化**——v2 doc 没要求）

## 实践细节补充

- 用 `mv` 改名会**自动覆盖已存在的同名文件**（v1 的深色版被 v2 透明版自然替换），
  无需先 `rm`。
- v2 prompt 在描"ground/drop shadow/people"几次强调后，输出仍偶尔把屋顶描在地平面上
  —— 需要后续在 PIL 里二次抠图或裁剪。
- 30 张透明版共用同一锚点 A、5 张 UI 共用锚点 B，色温 / 视角的统一性肉眼可观。
- 工作流可总结为可复用 skill（见下一步）。

## v3 · 单图 · palace_ground.png

竖版 600×1200 俯视紫禁城深青砖地面 + 金色中轴线 + 院格 + 汉白玉台基 + 左右对称，
单图任务，无串行/避碰策略要求。

## v4 · 补充 10 张

按 `美术资产提示词_v4_补充.md` 一对一生成（10 张）：

- `panel_wide.png` (1024×512 透明背景 · 宽版暗色面板底纹，可平铺)
- `base_texture.png` (512×512 · 深棕皮革/宣纸无缝平铺底纹)
- `interior_qianqinggong.png` (1536×1024 · 乾清宫室内，金龙宝座+屏风)
- `interior_yangxindian.png` (1536×1024 · 养心殿内书房，案牍+屏风)
- `interior_yuhuayuan.png` (1536×1024 · 御花园八角亭 + 花木小径)
- 5 个 512×512 透明功能小图标：
  - `icon_zhengwu.png` (政务 / 圣旨卷轴)
  - `icon_xiushen.png` (修身 / 法轮莲花)
  - `icon_dianzhang.png` (典章 / 竹简+玉玺)
  - `icon_qijvzhou.png` (起居注 / 线装日记+毛笔)
  - `icon_shenggong.png` (圣躬 / 龙椅宝座)

合计 `assets/generated/` 现 53 张 PNG。所有 v4 图严格串行生成，零碰撞。
v4 prompt 在锚点中加 `no multiple objects` 负向，防止背景里出现杂项。

## 全部 53 张分布概览

- 30 建筑（v2 透明版 + 18 覆盖 + 12 新）
- 5 UI 元素（v2 透明版）
- 3 地图/纹理（v1 深色，**未透明化**）
- 7 内室（v2 太和+军机+文渊+太庙 + v4 乾清+养心+御花园）
- 5 功能小图标（v4）
- 1 竖版地面背景（v3）
- 1 宽面板 + 1 平铺底纹（v4）
