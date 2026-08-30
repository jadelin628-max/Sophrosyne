#!/usr/bin/env python3
"""按用户要求批量更新 PALACE：指定殿 x±20；可点宫殿 s 再缩小 20%（以宫殿为中心）。"""
import re, math
p="js/ui.js"; s=open(p,encoding="utf8").read()
pat=r'\{ x: (\d+),\s*y: (\d+),\s*s: (\d+),\s*l: "([^"]+)"(?:,\s*v: "([^"]+)")?\s*\}'
def repl(m):
    x=int(m.group(1)); y=int(m.group(2)); s=int(m.group(3)); l=m.group(4); v=m.group(5)
    if l in ("翊坤宫","咸福宫","太极殿") or l=="养心殿": x+=20
    if l in ("景仁宫","钟粹宫","永和宫") or l=="奉先殿": x-=20
    if v: s=max(36, int(round(s*0.8)))
    out='{ x: %d, y: %d, s: %d, l: "%s"'%(x,y,s,l)
    if v: out+=', v: "%s"'%v
    return out+' }'
m=re.search(r'const PALACE = \[(.*?)\];', s, re.S)
nb=re.sub(pat, repl, m.group(1))
open(p,"w",encoding="utf8").write(s[:m.start(1)]+nb+s[m.end(1):])
print("done: 西六宫右列+养心殿 x+20；东六宫左列+奉先殿 x-20；可点 s*0.8(≥36)")
