#!/usr/bin/env python3
"""去除 UI 贴图的灰色棋盘格（透明底示意），保留深色卷轴/金边内容，输出透明 RGBA"""
import struct, zlib
from collections import deque

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
    def chunk(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    stride = w * 4
    raw = b"".join(b"\x00" + rgba[y*stride:(y+1)*stride] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f: f.write(png)

def is_gray_bg(r, g, b):
    # 亮灰色棋盘（低饱和、亮度 100-240），非深色内容、非金边
    mx = max(r, g, b); mn = min(r, g, b)
    return (mx - mn) < 22 and 100 <= (r + g + b) // 3 <= 245

def clear(src_name, dst_name):
    w, h, raw = decode("assets/generated/" + src_name)
    px = bytearray(unfilter(w, h, 3, raw))
    keep = bytearray(b"\x01") * (w * h)
    q = deque()
    def seed(x, y):
        i = y * w + x
        r, g, b = px[i*3], px[i*3+1], px[i*3+2]
        if is_gray_bg(r, g, b) and keep[i]: keep[i] = 0; q.append((x, y))
    for x in range(w): seed(x, 0); seed(x, h-1)
    for y in range(h): seed(0, y); seed(w-1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0<=nx<w and 0<=ny<h:
                i = ny*w+nx
                if keep[i]:
                    r, g, b = px[i*3], px[i*3+1], px[i*3+2]
                    if is_gray_bg(r, g, b): keep[i] = 0; q.append((nx, ny))
    rgba = bytearray(w*h*4)
    for i in range(w*h):
        if keep[i]:
            rgba[i*4] = px[i*3]; rgba[i*4+1] = px[i*3+1]; rgba[i*4+2] = px[i*3+2]; rgba[i*4+3] = 255
    write_rgba("assets/transparent/" + dst_name, w, h, bytes(rgba))
    print("cleared", src_name, "->", dst_name, "removed(kept)", keep.count(0), w*h)

for s, d in [("ui_scroll_panel.png", "ui_scroll_panel.png"), ("ui_dragon_border.png", "ui_dragon_border.png"), ("ui_fret_divider.png", "ui_fret_divider.png")]:
    clear(s, d)
