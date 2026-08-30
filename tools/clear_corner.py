#!/usr/bin/env python3
"""清除 palace_ground.png 右下角水印区域（填成当地深色）"""
import struct, zlib

def decode(p):
    d = open(p, "rb").read(); pos = 8; w = h = None; idat = b""
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos+4])[0]; typ = d[pos+4:pos+8]; ch = d[pos+8:pos+8+ln]
        if typ == b"IHDR": w, h, bit, color = struct.unpack(">IIBB", ch[:10])
        elif typ == b"IDAT": idat += ch
        pos += 12 + ln
    return w, h, color, zlib.decompress(idat)

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

def write_rgb(path, w, h, px):
    def chunk(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    stride = w * 3
    raw = b"".join(b"\x00" + px[y*stride:(y+1)*stride] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f: f.write(png)

w, h, color, raw = decode("assets/generated/palace_ground.png")
bpp = 4 if color in (4, 6) else 3
px = bytearray(unfilter(w, h, bpp, raw))
# 右下角区域清除（x>=0.78w, y>=0.92h）
x0, y0 = int(w * 0.78), int(h * 0.92)
for y in range(y0, h):
    for x in range(x0, w):
        i = (y * w + x) * bpp
        px[i] = 16; px[i+1] = 20; px[i+2] = 18
write_rgb("assets/generated/palace_ground.png", w, h, bytes(px))
print("cleared bottom-right region x>=", x0, "y>=", y0)
