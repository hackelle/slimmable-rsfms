import sys, json, re, subprocess, pdfplumber, html
def words_bbox(path):
    out=subprocess.run(['pdftotext','-bbox',path,'-'],capture_output=True,text=True).stdout
    ws=[]
    for m in re.finditer(r'<word xMin="(-?[\d.]+)" yMin="(-?[\d.]+)" xMax="(-?[\d.]+)" yMax="(-?[\d.]+)">(.*?)</word>',out):
        x0,y0,x1,y1=map(float,m.groups()[:4]); ws.append(dict(x0=x0,y0=y0,x1=x1,y1=y1,t=html.unescape(m.group(5))))
    return ws
def num(t):
    t=t.replace('−','-').replace('%','')
    try: return float(t)
    except: return None
def col(c):
    if isinstance(c,(int,float)): v=round(c*255); return '#%02x%02x%02x'%(v,v,v)
    if isinstance(c,(list,tuple)) and len(c)==3: return '#%02x%02x%02x'%tuple(round(v*255) for v in c)
    if isinstance(c,(list,tuple)) and len(c)==1: v=round(c[0]*255); return '#%02x%02x%02x'%(v,v,v)
    return str(c)
def plot(path):
    p=pdfplumber.open(path).pages[0]
    objs=p.curves+p.lines
    grid=[o for o in objs if len(o['pts'])==2 and not o.get('fill') and col(o.get('stroking_color')) in ('#cccccc','#b0b0b0','#ebebeb') and o.get('linewidth',0)<1.7]
    hx=sorted({round(o['pts'][0][1],2) for o in grid if abs(o['pts'][0][1]-o['pts'][1][1])<.01})
    vx=sorted({round(o['pts'][0][0],2) for o in grid if abs(o['pts'][0][0]-o['pts'][1][0])<.01})
    ws=words_bbox(path)
    pct=any('%' in w['t'] for w in ws)
    ylab=[];xlab=[]
    for w in ws:
        v=num(w['t'])
        if v is None: continue
        cx=(w['x0']+w['x1'])/2; cy=(w['y0']+w['y1'])/2
        sc=100 if '%' in w['t'] else 1
        if cy>max(hx)+3:
            g=min(vx,key=lambda h:abs(h-cx))
            if abs(g-cx)<4: xlab.append((g,v/sc))
        elif cx<min(vx):
            g=min(hx,key=lambda h:abs(h-cy))
            if abs(g-cy)<4: ylab.append((g,v/sc))
    def fit(pairs):
        import numpy as np
        pairs=sorted(set(pairs))
        while True:
            a=np.array(pairs); k,b=np.polyfit(a[:,0],a[:,1],1)
            r=np.abs(a[:,0]*k+b-a[:,1]); rng=np.ptp(a[:,1])
            if r.max()<1e-5*rng or len(pairs)<=3: break
            pairs.pop(int(r.argmax()))
        assert r.max()<1e-4*rng, ('bad fit',pairs)
        return (lambda x: k*x+b), pairs
    fy,py=fit(ylab); fx,px=fit(xlab)
    series=[]
    for o in objs:
        if len(o['pts'])>3 and not o.get('fill') and o.get('linewidth',0)>=1.5:
            series.append(dict(color=col(o.get('stroking_color')), lw=o.get('linewidth'), dash=str(o.get('dash')),
              pts=[[round(fx(x),5),round(fy(y),5)] for x,y in o['pts']]))
    # dashed/flat reference lines (2-pt, colored, thick)
    refs=[]
    for o in objs:
        if len(o['pts'])==2 and not o.get('fill') and col(o.get('stroking_color')) not in ('#cccccc','#b0b0b0','#ebebeb') and o.get('linewidth',0)>=1:
            refs.append(dict(color=col(o.get('stroking_color')),dash=str(o.get('dash')),pts=[[round(fx(x),5),round(fy(y),5)] for x,y in o['pts']]))
    bands=[]
    for o in objs:
        if o.get('fill') and len(o['pts'])>6:
            c=col(o.get('non_stroking_color'))
            if c in ('#000000','#ffffff'): continue
            bands.append(dict(color=c, pts=[[round(fx(x),5),round(fy(y),5)] for x,y in o['pts']]))
    return dict(yticks=py, xticks=px, series=series, refs=refs, bands=bands)
def legend(path):
    p=pdfplumber.open(path).pages[0]
    objs=[o for o in p.curves+p.lines if not o.get('fill') and o.get('linewidth',0)>=1.5]
    ws=words_bbox(path)
    items=[]
    marks=sorted([(o['pts'][-1][0],o['pts'][0][1],col(o.get('stroking_color')),str(o.get('dash')),o['pts'][0][0]) for o in objs],key=lambda t:(round(t[1]),t[0]))
    for i,(xe,y,c,d,xs) in enumerate(marks):
        nxt=[m[4] for m in marks if abs(m[1]-y)<3 and m[4]>xe]
        lim=min(nxt) if nxt else 1e9
        lab=' '.join(w['t'] for w in sorted(ws,key=lambda w:w['x0']) if abs((w['y0']+w['y1'])/2-y)<6 and xe-2<w['x0']<lim)
        items.append(dict(color=c,dash=d,label=lab))
    return items
if __name__=='__main__':
    kind=sys.argv[1]; r=plot(sys.argv[2]) if kind=='plot' else legend(sys.argv[2])
    print(json.dumps(r))
