#!/usr/bin/env python3
"""预处理精确平面图：JPEG→WebP + 检测独立性较好的建筑中心。"""
from PIL import Image
from collections import deque

src="assets/generated/palace_plan_precise.png"
im=Image.open(src).convert("RGB"); W,H=im.size; px=im.load()
print("loaded", im.format, W, "x", H, "aspect %.4f"%(W/H))
# 存 webp（覆盖）
im.save("assets/generated/palace_plan.webp","WEBP",quality=85)
print("saved palace_plan.webp")

# 建筑颜色（金黄屋顶/朱红墙/青灰）
def is_build(p):
    r,g,b=p
    if abs(r-201)<=60 and abs(g-162)<=52 and abs(b-39)<=60: return True
    if abs(r-192)<=52 and abs(g-57)<=46 and abs(b-43)<=46: return True
    if abs(r-154)<=40 and abs(g-140)<=40 and abs(b-110)<=40: return True  # 灰/青灰台基
    return False

step=8; sw,sh=W//step,H//step
d=[[0]*sw for _ in range(sh)]
for y in range(0,H,step):
    yy=y//step
    for x in range(0,W,step):
        if is_build(px[x,y]): d[yy][x//step]=1
dense=[[0]*sw for _ in range(sh)]
for yy in range(sh):
    for xx in range(sw):
        s=0
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                ny,nx=yy+dy,xx+dx
                if 0<=ny<sh and 0<=nx<sw: s+=d[ny][nx]
        dense[yy][xx]=s
th=6
mask=[[1 if dense[yy][xx]>=th else 0 for xx in range(sw)] for yy in range(sh)]
seen=[[0]*sw for _ in range(sh)]; zones=[]
for yy in range(sh):
    for xx in range(sw):
        if mask[yy][xx] and not seen[yy][xx]:
            q=deque([(xx,yy)]); seen[yy][xx]=1; cells=[]
            while q:
                cx,cy=q.popleft(); cells.append((cx,cy))
                for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0<=nx<sw and 0<=ny<sh and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx]=1; q.append((nx,ny))
            if len(cells)>=14:
                ax=sum(c for c,_ in cells)/len(cells); ay=sum(_ for _,c in cells)/len(cells)
                zones.append((ax*step/W, ay*step/H, len(cells)))
zones.sort(key=lambda z:(z[1],z[0]))
print("zone count:", len(zones))
def grp(xa,xb,label):
    g=[z for z in zones if xa<=z[0]<xb]; g.sort(key=lambda z:z[1])
    print("\n==",label,len(g),"==")
    for fx,fy,n in g:
        print("  fx=%.3f fy=%.3f n=%d -> vb(%d,%d)"%(fx,fy,n,fx*640,fy*1240))
grp(0.02,0.34,"WEST")
grp(0.34,0.66,"AXIS")
grp(0.66,0.98,"EAST")
