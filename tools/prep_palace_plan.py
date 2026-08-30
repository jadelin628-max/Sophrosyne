#!/usr/bin/env python3
"""预处理 palace_plan：JPEG→WebP + 清除右下角「AI生成」水印 + 输出检测结果。"""
import struct
from PIL import Image

SRC = "assets/generated/palace_plan.png"   # 实为 JPEG
WEBP = "assets/generated/palace_plan.webp"

im = Image.open(SRC).convert("RGB")
w, h = im.size
print("loaded", im.format, w, "x", h)

# —— 1. 检测右下角水印区域（浅色文字落在暗色护城河上）——
# 采样右下角，找浅色像素（文字）
px = im.load()
x0 = int(w * 0.86), int(w * 0.99)
y0 = int(h * 0.955), int(h * 0.997)
light = 0
for y in range(y0[0], y0[1], 3):
    for x in range(x0[0], x0[1], 3):
        r, g, b = px[x, y]
        if (r + g + b) > 330:  # 浅色文字
            light += 1
print("light(watermark-ish) px in corner:", light)
# 采样护城河主色（避开文字，取左上一点）
sx, sy = int(w * 0.30), int(h * 0.80)
# 用整张图 4 角内圈的平均作为「底色」参考不靠谱，直接取右下角暗色众数
from collections import Counter
c = Counter()
for y in range(y0[0], y0[1], 4):
    for x in range(x0[0], x0[1], 4):
        p = px[x, y]
        if (p[0] + p[1] + p[2]) <= 330:
            c[p] += 1
fillcolor = c.most_common(1)[0][0] if c else (24, 30, 32)
print("fill color:", fillcolor)

# 把右下角水印盒（浅色文字）填成护城河色
for y in range(y0[0], y0[1]):
    for x in range(x0[0], x0[1]):
        p = px[x, y]
        if (p[0] + p[1] + p[2]) > 330:
            px[x, y] = fillcolor

# —— 2. 存储 WebP ——
im.save(WEBP, "WEBP", quality=85)
print("saved", WEBP)

# —— 3. 建筑检测：金黄屋顶 + 朱红墙 blobs ——
import collections
def near(c, target, tol):
    return all(abs(c[i] - target[i]) <= tol for i in range(3))
gold = (201, 162, 39); verm = (192, 57, 43)
mask = Image.new("L", (w, h), 0)
mp = mask.load()
for y in range(0, h, 2):
    for x in range(0, w, 2):
        p = px[x, y]
        if near(p, gold, 60) or near(p, verm, 55):
            mp[x, y] = 255
# 简单分块统计：把图分成 24x46 网格（约 60px/格），统计每格建筑像素数
gx, gy = 16, 31
cw, ch = w // gx, h // gy
grid = [[0] * gx for _ in range(gy)]
for y in range(0, h, 4):
    for x in range(0, w, 4):
        if mp[x, y]:
            grid[min(gy - 1, y // ch)][min(gx - 1, x // cw)] += 1
# 输出每格活跃度（供人工定位对照）
print("grid", gx, "x", gy, "(每格约", cw, "x", ch, "px)")
for row in grid:
    print("".join("#" if v > 60 else ("+" if v > 12 else ("." if v > 3 else " ")) for v in row))
