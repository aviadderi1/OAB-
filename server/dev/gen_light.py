# Regenerates the light-theme CSS block inside studio.tpl.html (run after changing studio CSS, then assemble.py)
import re, colorsys, os
TPL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','web','studio.tpl.html')
s=open(TPL,encoding='utf-8').read()
a=s.index('<style>')+7; b=s.index('</style>')
css=s[a:b]
css_nolight=re.sub(r'/\*LIGHT\*/.*?/\*ENDLIGHT\*/','',css,flags=re.S)
def hx(c):
    c=c.lstrip('#')
    if len(c)==3: c=''.join(ch*2 for ch in c)
    return tuple(int(c[i:i+2],16)/255 for i in (0,2,4))
def tohex(r,g,b): return '#%02X%02X%02X'%tuple(max(0,min(255,round(v*255))) for v in (r,g,b))
def light_of(c, prop):
    r,g,b=hx(c); h,l,sat=colorsys.rgb_to_hls(r,g,b)
    if l>0.97: return None
    if prop=='color' and sat<0.25 and 0.3<=l<=0.72: return None   # mid-grey text stays readable on white                                # white stays white (text on coloured buttons, switch knobs)
    if sat>0.35 and 0.30<l<0.75: return None              # accents stay
    nl=1-l
    if l<0.5: nl=min(0.99, 0.93+ (0.5-l)*0.12) if sat<0.2 else min(0.95, 1-l*0.9)   # dark backgrounds -> near white
    else: nl=max(0.08, 1-l) if sat<0.2 else max(0.2,1-l)  # light text -> dark
    if sat<0.2: sat=min(sat,0.12)
    return tohex(*colorsys.hls_to_rgb(h,nl,sat))
def conv_value(val, prop):
    out=val; changed=False
    for c in set(re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b',val)):
        n=light_of(c,prop)
        if n: out=re.sub(re.escape(c)+r'\b',n,out); changed=True
    def rgba(m):
        nonlocal changed
        r,g,b,al=m.group(1),m.group(2),m.group(3),m.group(4)
        if int(r)>200 and int(g)>200 and int(b)>200: changed=True; return f'rgba(20,24,32,{al})'
        return m.group(0)
    out=re.sub(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)',rgba,out)
    if 'box-shadow' in prop:
        out2=re.sub(r'rgba\(0,\s*0,\s*0,\s*\.?([\d.]+)\)',lambda m:'rgba(0,0,0,%.2f)'%(float('0.'+m.group(1).lstrip('0.')) if m.group(1).startswith('.') else float(m.group(1))*0.35 if float(m.group(1))<=1 else 0.1),out)
        if out2!=out: out=out2; changed=True
    return out if changed else None
rules=[]
def conv_any_rule(decls, body): return True
for m in re.finditer(r'([^{}@]+)\{([^{}]*)\}',css_nolight):
    sel=m.group(1).strip(); body=m.group(2)
    if 'vinyl' in sel or '.lab' in sel: continue
    if not sel or sel.startswith(':root') or sel.startswith('from') or sel.startswith('to') or re.match(r'^[\d.%, ]+$',sel): continue
    decls=[]; conv_any=False
    for d in body.split(';'):
        if ':' not in d: continue
        p,v=d.split(':',1); p=p.strip(); v=v.strip()
        if p.startswith('--') or p in ('animation','transition','font','font-family','content'): continue
        nv=conv_value(v,p)
        if nv: decls.append(f'{p}:{nv}'); conv_any=True
        elif re.search(r'#[0-9A-Fa-f]{3,6}\b|rgba?\(|var\(--(acc|red|green|amber)',v) and p in ('background','background-color','color','border','border-color','box-shadow','fill','stroke','outline','border-top','border-bottom','border-left','border-right'): decls.append(f'{p}:{v}')
    if decls and conv_any_rule(decls, body):
        sels=','.join('html.light '+x.strip() for x in sel.split(','))
        rules.append(sels+'{'+';'.join(decls)+'}')
# inline styles in the template body
body_html=s[b:]
inl=set()
for st in re.findall(r'style="([^"]*)"',body_html):
    for d in st.split(';'):
        if ':' not in d: continue
        p,v=d.split(':',1); p=p.strip(); v=v.strip()
        if p.startswith('--'): continue
        if re.search(r'#[0-9A-Fa-f]{3,6}|rgba\(',v):
            nv=conv_value(v,p)
            if nv: inl.add((p, d.strip(), nv))
for p,raw,nv in sorted(inl):
    rules.append(f'html.light [style*="{raw}"]{{{p}:{nv}!important}}')
root='html.light{--bg:#F3F4F7;--bar:#FFFFFF;--panel:#FFFFFF;--panel2:#F2F3F6;--inset:#F7F8FA;--line:#E2E5EA;--line2:#D5D9E0;--txt:#161A21;--sub:#5D6472;color-scheme:light}'
extra='html.light body{background:var(--bg);color:var(--txt)}html.light .tgl b{background:#C3C8D1}html.light .tgl.on b{background:var(--acc)}html.light .dd{box-shadow:0 12px 30px rgba(20,24,32,.14)}'
light='/*LIGHT*/\n'+root+'\n'+'\n'.join(rules)+'\n'+extra+'\n/*ENDLIGHT*/'
css_new=css_nolight.rstrip()+'\n'+light+'\n'
s=s[:a]+css_new+s[b:]
open(TPL,'w',encoding='utf-8').write(s)
print(len(rules),'rules', len(inl),'inline')
