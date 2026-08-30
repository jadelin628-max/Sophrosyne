#!/usr/bin/env python3
"""Sophrosyne — 白底抠图（洪泛去底，纯标准库，无 PIL 依赖）
把 assets/generated/ 中白底/浅底建筑与 UI 元素，转为透明 RGBA 保存到 assets/transparent/。
"""
import struct, zlib, os
from collections import deque

SRC = "assets/generated"
DST = "assets/transparent"

# 需要抠白的文件（建筑 + 少量 UI 元素；面板/内景/地图底图/纹理保持不透明）
BUILDINGS = [
    "taihedian", "zhonghedian", "baohe", "qianqinggong", "jiaotaidian", "kunninggong",
    "yangxindian", "junjichu", "wenyuange", "taimiao", "shangshufang", "yuhuayuan",
    "qintianjian", "wumen", "shenwumen", "cehua_donghua", "jiaolou", "gongqiang_segment",
    "changyinge", "cininggong", "jianting", "neiweufu", "ningshougong", "qianqingmen",
    "taihemen", "wenhuadian", "wuyingdian", "yinghuadian", "yuhuage", "yushanfang",
]
UI = ["ui_jade_seal", "ui_gold_button", "ui_fret_divider", "ui_dragon_border"]
FILES = BUILDINGS + UI

# 判定为“背景”的阈值：足够亮 且 低饱和（白/浅灰）
def is_bg(r, g, b):
    return (r + g + b) > 640 and (max(r, g, b) - min(r, g, b)) < 18

def decode_png(path):
    d = open(path, "rb").read()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "not PNG"
    pos = 8; w = h = bit = color = None; idat = b""
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos+4])[0]; typ = d[pos+4:pos+8]; ch = d[pos+8:pos+8+ln]
        if typ == b"IHDR": w, h, bit, color = struct.unpack(">IIBB", ch[:10])
        elif typ == b"IDAT": idat += ch
        pos += 12 + ln
    return w, h, bit, color, zlib.decompress(idat)

def unfilter(w, h, bpp, raw):
    stride = w * bpp; out = bytearray(); prev = bytearray(stride); pos = 0
    for _ in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if f == 1:
            for i in range(bpp, stride): line[i] = (line[i] + line[i-bpp]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                b = prev[i]; c = prev[i-bpp] if i >= bpp else 0
                p = a + b - c; pa = abs(p-a); pb = abs(p-b); pc = abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out += line; prev = line
    return bytes(out)

def flood_remove(w, h, px):
    keep = bytearray(b"\x01") * (w * h)
    q = deque()
    def seed(x, y):
        i = y * w + x
        r, g, b = px[i*3], px[i*3+1], px[i*3+2]
        if is_bg(r, g, b) and keep[i]:
            keep[i] = 0; q.append((x, y))
    for x in range(w):
        seed(x, 0); seed(x, h-1)
    for y in range(h):
        seed(0, y); seed(w-1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if keep[i]:
                    r, g, b = px[i*3], px[i*3+1], px[i*3+2]
                    if is_bg(r, g, b):
                        keep[i] = 0; q.append((nx, ny))
    return keep

def write_rgba(path, w, h, rgba):
    def chunk(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    stride = w * 4
    raw = b"".join(b"\x00" + rgba[y*stride:(y+1)*stride] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f: f.write(png)

def main():
    os.makedirs(DST, exist_ok=True)
    for name in FILES:
        src = os.path.join(SRC, name + ".png")
        dst = os.path.join(DST, name + ".png")
        if not os.path.exists(src):
            print("MISS", name); continue
        w, h, bit, color, raw = decode_png(src)
        bpp = 4 if color in (4, 6) else 3
        px = unfilter(w, h, bpp, raw)
        keep = flood_remove(w, h, px)
        removed = keep.count(0)
        rgba = bytearray(w * h * 4)
        for i in range(w * h):
            if keep[i]:
                rgba[i*4] = px[i*3]; rgba[i*4+1] = px[i*3+1]; rgba[i*4+2] = px[i*3+2]; rgba[i*4+3] = 255
            # else: 全 0 = 透明
        write_rgba(dst, w, h, bytes(rgba))
        print("%-22s %5dx%-5d removed=%.1f%%" % (name, w, h, 100.0 * removed / (w * h)))

if __name__ == "__main__":
    main()
