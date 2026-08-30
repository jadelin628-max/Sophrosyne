#!/usr/bin/env python3
"""还原所有建筑图（从原始图重新抠白），并仅对"顶部确有 Placeholder/StaticMesh 图例"的建筑清除顶部；
御花园（整幅花园场景）不做顶部清除（避免误伤树木/屋顶）。"""
import struct, zlib, os, glob
from collections import deque

# 仅这张图顶部确有 "Placeholder / StaticMesh" 游戏引擎图例（已用 vision 模型确认）；
# 其余图的绿色只是绿琉璃(脊/斗拱)等建筑细节，绝不能按颜色误判清除。
LEGEND_ONLY = {"kunninggong.png"}

def decode(p):
    d = open(p, "rb").read(); pos = 8; w = h = None; idat = b""
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos+4])[0]; typ = d[pos+4:pos+8]; ch = d[pos+8:pos+8+ln]
        if typ == b"IHDR": w, h, bit, color = struct.unpack(">IIBB", ch[:10])
        elif typ == b"IDAT": idat += ch
        pos += 12 + ln
    return w, h, zlib.decompress(idat)

def unfilter(w, h, bpp, raw):
    s = w * bpp; o = bytearray(); p = bytearray(s); pos = 0
    for _ in range(h):
        f = raw[pos]; pos += 1
        L = bytearray(raw[pos:pos+s]); pos += s
        if f == 1:
            for i in range(bpp, s): L[i] = (L[i] + L[i-bpp]) & 255
        elif f == 2:
            for i in range(s): L[i] = (L[i] + p[i]) & 255
        elif f == 3:
            for i in range(s):
                a = L[i-bpp] if i >= bpp else 0
                L[i] = (L[i] + ((a + p[i]) >> 1)) & 255
        elif f == 4:
            for i in range(s):
                a = L[i-bpp] if i >= bpp else 0
                b = p[i]; c = p[i-bpp] if i >= bpp else 0
                q = a + b - c; pa = abs(q-a); pb = abs(q-b); pc = abs(q-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                L[i] = (L[i] + pr) & 255
        o += L; p = L
    return bytes(o)

def write_rgba(path, w, h, rgba):
    def ch(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    s = w * 4
    raw = b"".join(b"\x00" + rgba[y*s:(y+1)*s] for y in range(h))
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", ihdr) + ch(b"IDAT", zlib.compress(raw, 9)) + ch(b"IEND", b""))

def is_bg(r, g, b):
    return (r + g + b) > 640 and (max(r, g, b) - min(r, g, b)) < 20

def remove_bg(w, h, px):
    keep = bytearray(b"\x01") * (w * h)
    q = deque()
    def seed(x, y):
        i = y * w + x
        r, g, b = px[i*3], px[i*3+1], px[i*3+2]
        if is_bg(r, g, b) and keep[i]: keep[i] = 0; q.append((x, y))
    for x in range(w): seed(x, 0); seed(x, h-1)
    for y in range(h): seed(0, y); seed(w-1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if keep[i]:
                    r, g, b = px[i*3], px[i*3+1], px[i*3+2]
                    if is_bg(r, g, b): keep[i] = 0; q.append((nx, ny))
    return keep

def has_legend(w, h, px):
    # 顶部 18% 内是否有"亮绿色"图例色块
    n = 0
    for y in range(int(h * 0.18)):
        for x in range(w):
            i = (y * w + x) * 3
            r, g, b = px[i], px[i+1], px[i+2]
            if g > 110 and g > r + 20 and g > b + 20: n += 1
    return n > 120

def clean_legend(w, h, keep, rgba):
    topy = int(h * 0.25)
    for y in range(min(topy, h)):
        for x in range(w):
            i = y * w + x
            rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = rgba[i*4+3] = 0

for p in sorted(glob.glob("assets/transparent/*.png")):
    b = os.path.basename(p)
    if b.startswith(("ui_", "icon_")) or b == "panel_wide.png": continue
    src = "assets/generated/" + b
    if not os.path.exists(src):
        print("skip", b, "(no original)"); continue
    w, h, raw = decode(src)
    px = bytearray(unfilter(w, h, 3, raw))
    keep = remove_bg(w, h, px)
    rgba = bytearray(w * h * 4)
    for i in range(w * h):
        if keep[i]:
            rgba[i*4] = px[i*3]; rgba[i*4+1] = px[i*3+1]; rgba[i*4+2] = px[i*3+2]; rgba[i*4+3] = 255
    if b == "yuhuayuan.png":
        print(b, "restored (garden, no top-clear)"); write_rgba(p, w, h, bytes(rgba)); continue
    if b in LEGEND_ONLY:
        clean_legend(w, h, keep, rgba)
        print(b, "restored + legend cleared")
    else:
        print(b, "restored (no legend)")
    write_rgba(p, w, h, bytes(rgba))
print("done")
