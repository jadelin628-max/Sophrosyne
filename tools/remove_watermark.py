#!/usr/bin/env python3
"""Sophrosyne — 去除右下角水印（把右下角区域设为透明）
对 assets/transparent/ 下的 RGBA 透明图，清除右下角水印区域（x>=0.75w, y>=0.90h）的 alpha。
"""
import struct, zlib, os, glob

SRC = "assets/transparent"

def decode(path):
    d = open(path, "rb").read()
    pos = 8; w = h = color = None; idat = b""
    while pos < len(d):
        ln = struct.unpack(">I", d[pos:pos+4])[0]; typ = d[pos+4:pos+8]; ch = d[pos+8:pos+8+ln]
        if typ == b"IHDR": w, h, bit, color = struct.unpack(">IIBB", ch[:10])
        elif typ == b"IDAT": idat += ch
        pos += 12 + ln
    return w, h, color, zlib.decompress(idat)

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
    for p in sorted(glob.glob(SRC + "/*.png")):
        w, h, color, raw = decode(p)
        bpp = 4 if color in (4, 6) else 3
        px = bytearray(unfilter(w, h, bpp, raw))
        x0, y0 = int(w * 0.75), int(h * 0.90)
        cleared = 0
        for y in range(y0, h):
            for x in range(x0, w):
                i = (y * w + x) * bpp
                if px[i+3] != 0:  # 原本不透明（可能是水印文字）
                    px[i] = px[i+1] = px[i+2] = px[i+3] = 0
                    cleared += 1
        write_rgba(p, w, h, bytes(px))
        print("%-24s cleared=%d" % (os.path.basename(p), cleared))

if __name__ == "__main__":
    main()
