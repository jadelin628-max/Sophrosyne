#!/usr/bin/env python3
# 生成 Sophrosyne 的 iOS/桌面图标 PNG（纯标准库，无字体，几何图形）。
import zlib, struct

def write_png(path, size):
    w = h = size
    bg = (43, 29, 20, 255)     # #2b1d14
    gold = (201, 162, 39, 255) # #c9a227
    verm = (192, 57, 43, 255)  # #c0392b

    def px(x, y):
        cx = cy = w / 2.0
        r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        if abs(r - w * 0.36) < w * 0.045:
            return gold
        if r < w * 0.25:
            return verm
        return bg

    rows = []
    for y in range(h):
        row = bytearray([0])  # filter type 0
        for x in range(w):
            row += bytes(px(x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, data):
        c = t + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)

if __name__ == "__main__":
    write_png("icon-180.png", 180)
    write_png("icon-512.png", 512)
