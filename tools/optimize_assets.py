# 一次性资产瘦身：引用中的 PNG → WebP（降采样），删除未被引用的孤儿资产。
# 用法：在仓库根目录运行  python tools/optimize_assets.py
# 转换后需同步更新 js/ui.js / styles.css / index.html / sw.js 中的 .png 引用。
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, "assets", "generated")
TRA = os.path.join(ROOT, "assets", "transparent")

# ui.js PALACE 数组中的 25 张建筑图（cehua_donghua 在东西两侧复用，仅一个文件）
BUILDINGS = {
    "shenwumen", "yuhuayuan", "kunninggong", "jiaotaidian", "qianqinggong",
    "qianqingmen", "baohe", "zhonghedian", "taihedian", "taihemen", "wumen",
    "cininggong", "yushanfang", "neiweufu", "yangxindian", "junjichu",
    "wuyingdian", "cehua_donghua", "ningshougong", "qintianjian", "changyinge",
    "shangshufang", "taimiao", "wenhuadian", "wenyuange",
}
# styles.css 引用的 UI 底图（按钮/面板/玉玺）
UI_IMAGES = {"ui_jade_seal", "panel_wide", "ui_gold_button"}
# styles.css / index.html 引用的内景与纹理
INTERIORS = {
    "interior_qianqinggong", "interior_taihedian", "interior_yangxindian",
    "interior_junjichu", "interior_wenyuange", "interior_taimiao",
    "interior_yuhuayuan", "base_texture",
}

REFERENCED_TRA = BUILDINGS | UI_IMAGES
REFERENCED_GEN = INTERIORS

# 各类目标：(最长边像素, WebP 质量)
PLAN = {
    "building": (320, 85),
    "ui": (512, 85),
    "interior": (1280, 80),
    "texture": (512, 80),
}


def classify_gen(name):
    if name.startswith("interior_"):
        return "interior"
    if name == "base_texture":
        return "texture"
    return None


def classify_tra(name):
    if name in BUILDINGS:
        return "building"
    if name in UI_IMAGES:
        return "ui"
    return None


def convert(directory, names, classifier):
    kept, deleted = [], []
    for f in sorted(os.listdir(directory)):
        if not f.lower().endswith(".png"):
            continue
        stem = f[:-4]
        kind = classifier(stem)
        path = os.path.join(directory, f)
        if kind is None:
            deleted.append((path, os.path.getsize(path)))
            os.remove(path)
            continue
        max_side, quality = PLAN[kind]
        img = Image.open(path)
        img.load()
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() or img.mode == "P" else "RGB")
        w, h = img.size
        scale = min(1.0, max_side / max(w, h))
        if scale < 1.0:
            img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        out = os.path.join(directory, stem + ".webp")
        img.save(out, "WEBP", quality=quality, method=6)
        before, after = os.path.getsize(path), os.path.getsize(out)
        kept.append((f, img.size, before, after))
        os.remove(path)
    return kept, deleted


def fmt(n):
    return f"{n / 1024:.0f} KB"


gen_kept, gen_del = convert(GEN, REFERENCED_GEN, classify_gen)
tra_kept, tra_del = convert(TRA, REFERENCED_TRA, classify_tra)

print(f"{'文件':<32} {'尺寸':<12} {'原':>9} {'新':>9}")
for f, size, b, a in gen_kept + tra_kept:
    print(f"{f:<32} {f'{size[0]}x{size[1]}':<12} {fmt(b):>9} {fmt(a):>9}")
total_before = sum(b for *_, b, a in gen_kept + tra_kept) + sum(s for _, s in gen_del + tra_del)
total_after = sum(a for *_, b, a in gen_kept + tra_kept)
print(f"\n转换 {len(gen_kept) + len(tra_kept)} 个 → {fmt(total_after)}（原 {fmt(sum(b for *_, b, a in gen_kept + tra_kept))}）")
print(f"删除孤儿 {len(gen_del) + len(tra_del)} 个，共 {fmt(sum(s for _, s in gen_del + tra_del))}")
print(f"资产总体积：{fmt(total_before)} → {fmt(total_after)}")
