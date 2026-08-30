#!/usr/bin/env python3
"""精检精确图：找黄色金瓦屋顶块中心（细步长+聚合），输出 west/axis/east。"""
from PIL import Image
from collections import deque
im=Image.open("assets/generated/palace_plan.webp").convert("RGB"); W,H=im.size; px=im.load()
def is_gold(p):
    r,g,b=p
    return r>150 and g>105 and b<115 and r> b+55 and g> b+45
step=5; sw,sh=W//step,H//step
mask=[[0]*sw for _ in range(sh)]
for y in range(0,H,step):
    yy=y//step
    for x in range(0,W,step):
        if is_gold(px[x,y]): mask[yy][x//step]=1
seen=[[0]*sw for _ in range(sh)]; blobs=[]
for yy in range(sh):
    for xx in range(sw):
        if mask[yy][xx] and not seen[yy][xx]:
            q=deque([(xx,yy)]); seen[yy][xx]=1; cells=[]
            while q:
                cx,cy=q.popleft(); cells.append((cx,cy))
                for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0<=nx<sw and 0<=ny<sh and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx]=1; q.append((nx,ny))
            if len(cells)>=6:
                ax=sum(c for c,_ in cells)/len(cells); ay=sum(_ for _,c in cells)/len(cells)
                blobs.append((ax*step/W, ay*step/H, len(cells)))
# 聚合近邻
def cl(blobs,r=0.035):
    out=[]
    for cx,cy,n in sorted(blobs,key=lambda b:b[1]):
        ok=False
        for o in out:
            if abs(cx-o[0])<r and abs(cy-o[1])<r:
                nx=o[2]+n; o[0]=(o[0]*o[2]+cx*n)/nx; o[1]=(o[1]*o[2]+cy*n)/nx; o[2]=nx; ok=True; break
        if not ok: out.append([cx,cy,n])
    return [o for o in out if o[2]>=30]
out=cl(blobs); out.sort(key=lambda o:(o[1],o[0]))
print("gold building clusters:",len(out))
def grp(xa,xb,label):
    g=[o for o in out if xa<=o[0]<xb]; g.sort(key=lambda o:o[1])
    print("\n==",label,len(g),"==")
    for fx,fy,n in g: print("  fx=%.3f fy=%.3f n=%d -> vb(%d,%d)"%(fx,fy,n,fx*640,fy*1240))
grp(0.02,0.36,"WEST"); grp(0.36,0.64,"AXIS"); grp(0.64,0.98,"EAST")
