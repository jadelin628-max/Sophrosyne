#!/usr/bin/env python3
"""统一微调 PALACE 两侧坐标：西侧 左移+上移，东侧 右移+上移；中轴(x=320)不动。"""
import re
p="js/ui.js"; s=open(p,encoding="utf8").read()
dx,dy=40,40
pat=r'\{ x: (\d+),\s*y: (\d+),\s*s: (\d+),\s*l: "([^"]+)"(?:,\s*v: "([^"]+)")?\s*\}'
def repl(m):
    x=int(m.group(1)); y=int(m.group(2)); s=int(m.group(3)); l=m.group(4); v=m.group(5)
    nx,ny=x,y
    if x<320: nx,ny=x-dx,y-dy
    elif x>320: nx,ny=x+dx,y-dy
    out='{ x: %d, y: %d, s: %d, l: "%s"'%(nx,ny,s,l)
    if v: out+=', v: "%s"'%v
    return out+' }'
m=re.search(r'const PALACE = \[(.*?)\];', s, re.S)
newbody=re.sub(pat, repl, m.group(1))
s=s[:m.start(1)]+newbody+s[m.end(1):]
open(p,"w",encoding="utf8").write(s)
print("shifted: west x-20 y-20, east x+20 y-20; axis unchanged")
