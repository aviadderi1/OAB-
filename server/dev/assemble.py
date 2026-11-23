# Builds web/studio.html from web/studio.tpl.html + web/core.js + web/phases.js (run after every studio change)
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
W=os.path.join(HERE,'..','web')+os.sep
d=json.load(open(os.path.join(HERE,'oldparts.json'),encoding='utf-8'))
core=open(W+'core.js').read()
inp=d['INPUTS'].replace("document.querySelector('details.set').addEventListener('toggle', e => { if (e.target.open) listDevices(true); });\n","")
for k,v in [('INPUTS',inp),('ENCODER',d['ENCODER']),('REC',d['REC']),('PUB',d['PUB']),('REQPOP',d['REQPOP']),('SPOTIFY',d['SPOTIFY']),('YOUTUBE',d['YOUTUBE'])]:
    core=core.replace('/*@@%s@@*/'%k,v)
i=core.index("$('#startBtn').onclick")
body=core[:i]+open(W+'phases.js').read()+"\n// ---------------- start ----------------\n"+core[i:]
open(W+'studio.html','w').write(open(W+'studio.tpl.html').read().replace('/*@@CORE@@*/',body))
