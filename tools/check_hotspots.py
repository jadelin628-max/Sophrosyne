#!/usr/bin/env python3
"""校验：把 PALACE 热点中心画到 palace_plan 上，输出叠加图供查看。"""
import re
from PIL import Image, ImageDraw

src="assets/generated/palace_plan.webp"
im=Image.open(src).convert("RGB"); W,H=im.size
draw=ImageDraw.Draw(im)
# 读取 ui.js 中 PALACE 的 {x, y, s, l, v}
txt=open("js/ui.js",encoding="utf8").read()
m=re.search(r'const PALACE = \[(.*?)\];', txt, re.S)
ents=re.findall(r'\{\s*x: (\d+),\s*y: (\d+),\s*s: (\d+),\s*l: "([^"]+)"(?:,\s*v: "([^"]+)")?\s*\}', m.group(1))
for x,y,s,l,v in ents:
    x,y,s=int(x),int(y),int(s)
    # viewBox 640x1240, preserveAspectRatio=none -> image fills 640x1240
    px=x/640*W; py=y/1240*H
    col=(0,255,0) if v else (255,140,0)
    draw.ellipse([px-5,py-5,px+5,py+5], fill=col)
    draw.text((px+6,py+4), l, fill=col)
im.resize((W//2,H//2)).save("assets/generated/_hotspot_check.jpg","JPEG",quality=88)
print("saved _hotspot_check.jpg  (green=clickable, orange=decor)")
