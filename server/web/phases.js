const LT = () => document.documentElement.classList.contains('light');
const LMAP = {"#10251A": "#DEF1E7", "#2A2210": "#F1E9D9", "#2C1214": "#EFD7D9", "#6B7280": "#8A919E", "#2A2F38": "#D5D9E0", "#3A3F4A": "#CDD1D8", "#9AA3AE": "#5D6472", "#FFFFFF": "#141414", "#555A63": "#B9BEC7", "#1B1D22": "#E3E6EA", "#2A2E37": "#D5D9E0", "#4A505C": "#C3C8D1", "#5B616D": "#C6CBD3", "#353A44": "#DADDE3", "#1F5C36": "#ACE3C1", "#6B4D12": "#EFD49F", "#6B2222": "#E09F9F", "#15181D": "#E6E8EC", "#A78BFA": "#7C5CE0"};
const TC = c => (LT() && LMAP[c]) || c;

// =====================================================================
//  Radio Studio 2.0 – scheduler, generator, track editor, ads scheduler,
//  voice tracking, announcements, reports, DSP, AUX players, remote
// =====================================================================
const CFG = { city: '', voice: '' };
async function dsLoad(name, def){
  try { const r = await api('/api/store/' + name); if (r.ok) { const v = await r.json(); if (v != null) { store.set('ds_' + name, JSON.stringify(v)); return v; } } } catch(e){}
  try { const v = JSON.parse(store.get('ds_' + name, 'null')); if (v != null) return v; } catch(e){}
  return def;
}
const dsT = {};
function dsSave(name, data){ store.set('ds_' + name, JSON.stringify(data)); clearTimeout(dsT[name]); dsT[name] = setTimeout(() => api('/api/store/' + name, data).catch(() => {}), 500); }
function big(title, html, acts){
  $('#bgH').textContent = title; $('#bgBody').innerHTML = html; $('#bgAct').innerHTML = '';
  (acts || []).forEach(([t, fn, pri]) => { const b = document.createElement('button'); b.className = 'btn sm' + (pri ? ' pri' : ''); b.textContent = t; b.onclick = fn; $('#bgAct').appendChild(b); });
  openModal('mBig');
}
const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysHtml = (sel, id) => `<div class="days" id="${id}">${DAYN.map((d, i) => `<span data-d="${i}" class="${(sel || []).includes(i) ? 'on' : ''}">${d}</span>`).join('')}</div>`;
document.addEventListener('click', e => { const s = e.target.closest('.days span'); if (s) s.classList.toggle('on'); });
const readDays = id => $$('#' + id + ' span.on').map(s => +s.dataset.d);
const dstr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => dstr(new Date());
const toSec = t => { const p = String(t || '0').split(':').map(Number); return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0); };
const opts = (list, v) => list.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
function csvDownload(name, header, rows){
  const cell = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const txt = '\ufeff' + [header].concat(rows).map(r => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); a.download = name; a.click();
}
async function libKind(kind){ try { const d = await (await fetch('/api/library?kind=' + kind, { cache: 'no-store' })).json(); return d.items.map(x => libItem(x, kind)); } catch(e){ return []; } }
async function folderList(){
  const names = { music: 'Music', carts: 'Jingles', ads: 'Ads' }, out = [];
  for (const k of ['music', 'carts', 'ads']) { out.push([k + ':', names[k] + ' (whole folder)']);
    try { const d = await (await fetch('/api/browse?kind=' + k + '&path=')).json(); (d.dirs || []).forEach(n => out.push([k + ':' + n, names[k] + ' / ' + n])); } catch(e){} }
  return out;
}

// ---------------- track meta (cue in / intro / mix / cue out / gain) ----------------
let TM = {};
const tmKey = it => it && (it.id || it.url || it.uid);
function tmOf(it){ return (it && it.kind === 'track' && TM[tmKey(it)]) || {}; }
const GAP = { on: store.get('fxGap', '0') === '1' }, NORM = { on: store.get('fxNorm', '0') === '1' };
function cueInOf(it){
  const tm = tmOf(it); if (tm.cueIn) return tm.cueIn;
  if (GAP.on && it.kind === 'track') { const a = anCache.get(it.id || it.uid); if (a && a.firstSnd > 0.05 && a.firstSnd < 8) return a.firstSnd; }
  return 0;
}
function ampFor(it){
  const ft = ftOf(it); let g = $('#fxAmp').classList.contains('on') ? dbToG(+ft.amp || 0) : 1;
  const tm = tmOf(it); if (tm.gain) g *= dbToG(+tm.gain);
  if (NORM.on && it.kind === 'track') { const a = anCache.get(it.id || it.uid); if (a && a.rms > 0.0005) g *= Math.max(dbToG(-12), Math.min(dbToG(12), dbToG(-16) / a.rms)); }
  return g;
}
$('#fxNorm').classList.toggle('on', NORM.on); $('#fxGap').classList.toggle('on', GAP.on);
$('#fxNorm').onclick = () => { NORM.on = !NORM.on; store.set('fxNorm', NORM.on ? '1' : '0'); $('#fxNorm').classList.toggle('on', NORM.on); decks.forEach(d => { if (d.item && ctx) d.amp.gain.setTargetAtTime(ampFor(d.item), ctx.currentTime, 0.3); }); };
$('#fxGap').onclick = () => { GAP.on = !GAP.on; store.set('fxGap', GAP.on ? '1' : '0'); $('#fxGap').classList.toggle('on', GAP.on); renderPlaylist(); };

// ---------------- play history + server play log ----------------
const HIST = (() => { try { return JSON.parse(store.get('playHist', '[]')); } catch(e){ return []; } })();
function logPlay(it){
  if (!it || ['cmd', 'comment', 'pause'].includes(it.kind)) return;
  const ft = ftOf(it);
  HIST.push({ k: tmKey(it), a: (it.artist || '').toLowerCase(), t: Date.now() }); while (HIST.length > 3000) HIST.shift(); store.set('playHist', JSON.stringify(HIST));
  api('/api/log', { title: it.title, artist: it.artist || '', type: it.kind === 'stream' ? 'Stream' : it.kind === 'line' ? 'Line in' : ft.name, listeners: PL.lastListeners, dur: Math.round(itemDur(it)), playlist: it.campaign ? 'Ad: ' + it.campaign : (activeTab() ? activeTab().name : '') }).catch(() => {});
  if (it.campId) adCount(it);
}

// ---------------- DSP: 5-band EQ + compressor ----------------
let eqNodes = [], comp = null;
const EQF = [[60, 'lowshelf', '60'], [250, 'peaking', '250'], [1000, 'peaking', '1k'], [4000, 'peaking', '4k'], [12000, 'highshelf', '12k']];
let EQV = (() => { try { return JSON.parse(store.get('eqV', '[0,0,0,0,0]')); } catch(e){ return [0, 0, 0, 0, 0]; } })();
let EQON = store.get('eqOn', '0') === '1', COMPON = store.get('compOn', '0') === '1';
function buildDsp(){
  let last = masterIn;
  eqNodes = EQF.map(([f, t]) => { const b = ctx.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = 0.9; last.connect(b); last = b; return b; });
  comp = ctx.createDynamicsCompressor(); comp.knee.value = 6; comp.attack.value = 0.01; comp.release.value = 0.25;
  last.connect(comp); comp.connect(masterGain); applyDsp();
}
function applyDsp(){
  if (!ctx || !comp) return;
  eqNodes.forEach((b, i) => b.gain.setTargetAtTime(EQON ? EQV[i] : 0, ctx.currentTime, 0.05));
  comp.threshold.value = COMPON ? +$('#fxThr').value : 0; comp.ratio.value = COMPON ? +$('#fxRat').value : 1;
}
function renderEq(){
  $('#fxEq').innerHTML = EQF.map((b, i) => `<div class="eqb"><span class="mono" style="font-size:10px" id="eqv${i}">${EQV[i] > 0 ? '+' : ''}${EQV[i]}</span><input type="range" min="-12" max="12" step="1" value="${EQV[i]}" data-i="${i}" aria-label="EQ ${b[2]} Hz"><span class="sub" style="font-size:10px">${b[2]}</span></div>`).join('');
  $('#fxEqOn').classList.toggle('on', EQON); $('#fxCompOn').classList.toggle('on', COMPON);
}
$('#fxEq').addEventListener('input', e => { const i = +e.target.dataset.i; EQV[i] = +e.target.value; $('#eqv' + i).textContent = (EQV[i] > 0 ? '+' : '') + EQV[i]; store.set('eqV', JSON.stringify(EQV)); applyDsp(); });
$('#fxEqOn').onclick = () => { EQON = !EQON; store.set('eqOn', EQON ? '1' : '0'); renderEq(); applyDsp(); };
$('#fxCompOn').onclick = () => { COMPON = !COMPON; store.set('compOn', COMPON ? '1' : '0'); renderEq(); applyDsp(); };
$('#fxThr').value = store.get('cThr', '-18'); $('#fxRat').value = store.get('cRat', '3');
function showComp(){ $('#fxThrV').textContent = $('#fxThr').value + ' dB'; $('#fxRatV').textContent = $('#fxRat').value + ':1';
  $('#fxThr').style.setProperty('--p', ((+$('#fxThr').value + 40) / 40 * 100) + '%'); $('#fxRat').style.setProperty('--p', ((+$('#fxRat').value - 1) / 11 * 100) + '%'); }
showComp();
$('#fxThr').oninput = $('#fxRat').oninput = () => { showComp(); store.set('cThr', $('#fxThr').value); store.set('cRat', $('#fxRat').value); applyDsp(); };
renderEq();

// ---------------- placing items (used by scheduler, ads, announcements, remote) ----------------
function placeItems(items, mode){
  if (!items.length) return;
  const f = PL.cur && findItem(PL.cur);
  if (f) PL.tabs[f.t].items.splice(f.i + 1, 0, ...items); else activeTab().items.push(...items);
  const uids = items.map(i => i.uid);
  if (mode === 'queue') PL.pq.push(...uids); else PL.pq.unshift(...uids);
  PL.shufflePick = null; afterChange();
  if (!ctx) return;
  if (!isPlaying()) { PL.pq = PL.pq.filter(u => u !== items[0].uid); playItem(items[0]); return; }
  if (mode === 'now') { mixFired = true; advance('manual'); }
}

// ---------------- announcements & text to speech ----------------
async function speakItem(text, title){
  if (!text || !text.trim()) return null;
  try { const r = await api('/api/tts', { text, voice: CFG.voice }); const d = await r.json();
    if (!d.url) { toast('Speech: ' + (d.error || 'failed')); return null; }
    return { uid: uidGen(), kind: 'track', url: d.url, title: title || 'Announcement', artist: text.slice(0, 80), ftype: 'Voice track', dur: 0 };
  } catch(e){ toast('Speech: server not reachable'); return null; }
}
function timeText(){
  const n = new Date(); const tpl = store.get('timeTpl', 'The time is {time}');
  return tpl.replace(/\{time\}/g, n.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).replace(/\{hour\}/g, n.getHours()).replace(/\{min\}/g, String(n.getMinutes()).padStart(2, '0'));
}
async function announce(kind){
  if (kind === 'time') return speakItem(timeText(), 'Time announcement');
  try { const w = await (await fetch('/api/weather' + (CFG.city ? '?city=' + encodeURIComponent(CFG.city) : ''))).json();
    if (w.error) { toast('Weather: ' + w.error); return null; }
    const t = store.get('weatherTpl', 'In {city} it is {temp} degrees, {desc}').replace(/\{city\}/g, w.city).replace(/\{temp\}/g, w.temp).replace(/\{desc\}/g, w.desc);
    return speakItem(t, 'Weather');
  } catch(e){ toast('Weather: no internet'); return null; }
}
async function loadVoices(cur){
  try { const d = await (await api('/api/tts/voices')).json();
    $('#cVoice').innerHTML = '<option value="">Default voice</option>' + (d.voices || []).map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    $('#cVoice').value = cur || ''; if (!(d.voices || []).length) $('#cVoice').innerHTML = '<option value="">No speech engine found on this computer</option>';
  } catch(e){}
}
$('#cTimeTpl').value = store.get('timeTpl', 'The time is {time}');
$('#cWeatherTpl').value = store.get('weatherTpl', 'In {city} it is {temp} degrees, {desc}');
function openTts(){
  big('Text to speech', `<div class="sub" style="font-size:12px">Uses the speech voices installed in Windows (Options → Announcements). The audio is made on your computer and goes on air like any track.</div>
  <label for="ttsTxt" class="lbl">TEXT</label><textarea class="inp" id="ttsTxt" style="height:120px;padding:8px;resize:vertical" placeholder="Welcome to Radio…"></textarea>
  <div style="display:flex;gap:8px"><button class="btn sm" id="ttsPre">🎧 Prelisten</button><button class="btn sm" id="ttsIns">Insert after playing</button><button class="btn sm" id="ttsEnd">Add to end of playlist</button><span class="sub" id="ttsMsg" style="align-self:center;font-size:11.5px"></span></div>`);
  const make = async () => { $('#ttsMsg').textContent = 'Generating…'; const it = await speakItem($('#ttsTxt').value, 'TTS: ' + $('#ttsTxt').value.slice(0, 30)); $('#ttsMsg').textContent = it ? 'Ready' : 'Failed'; return it; };
  $('#ttsPre').onclick = async () => { const it = await make(); if (it) prelisten(it); };
  $('#ttsIns').onclick = async () => { const it = await make(); if (it) { insertAfterPlaying([it]); closeModal('mBig'); } };
  $('#ttsEnd').onclick = async () => { const it = await make(); if (it) { addToView([it]); closeModal('mBig'); } };
}

// ---------------- PHASE 2: scheduler ----------------
let SCH = [], schOn = store.get('schOn', '1') === '1', schLast = Date.now();
const schDone = new Set();
const ACTIONS = [['track', 'Play a track / jingle'], ['folder', 'Random track from a folder'], ['playlist', 'Start a playlist'], ['ads', 'Ad break (Ads Scheduler)'], ['time', 'Announce the time'], ['weather', 'Announce the weather'], ['tts', 'Speak text'], ['url', 'Play a stream / URL (relay)'], ['command', 'Command']];
const MODES = [['next', 'After the current track'], ['now', 'Immediately (fade out the current track)'], ['queue', 'Add to the playback queue']];
const CMDS = [['stop', 'stop – stop playback'], ['golive', 'golive – start broadcasting'], ['stoplive', 'stoplive – stop broadcasting'], ['rec on', 'rec on – start recording'], ['rec off', 'rec off – stop recording'], ['setvol 80', 'setvol 80 – playlist volume'], ['shuffle on', 'shuffle on'], ['shuffle off', 'shuffle off'], ['repeat on', 'repeat on'], ['repeat off', 'repeat off']];
function occurrences(ev, day){
  if (!ev.on) return [];
  const ds = dstr(day);
  if (ev.date) { if (ev.date !== ds) return []; } else if (ev.days && ev.days.length && !ev.days.includes(day.getDay())) return [];
  if (ev.from && ds < ev.from) return []; if (ev.to && ds > ev.to) return [];
  const st = toSec(ev.time), out = [st], rep = (+ev.repeat || 0) * 60;
  if (rep > 0) { const end = ev.until ? toSec(ev.until) : 86399; for (let t = st + rep; t <= end && out.length < 1440; t += rep) out.push(t); }
  return out;
}
function nextRun(ev){
  const now = new Date();
  for (let k = 0; k < 8; k++) { const d = new Date(now); d.setDate(now.getDate() + k); d.setHours(0, 0, 0, 0);
    for (const s of occurrences(ev, d)) { const t = d.getTime() + s * 1000; if (t > now.getTime()) return t; } }
  return null;
}
function schLabel(){
  if (!schOn) return 'Scheduler off';
  let best = null; SCH.forEach(e => { const t = nextRun(e); if (t && (!best || t < best.t)) best = { t, e }; });
  return best ? 'Next: ' + (new Date(best.t).toDateString() === new Date().toDateString() ? '' : DAYN[new Date(best.t).getDay()] + ' ') + hm(best.t) + ' · ' + best.e.name : 'Scheduler';
}
function schTick(){
  const now = Date.now(), from = Math.max(schLast, now - 5000); schLast = now; if (!schOn) return;
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  SCH.forEach(ev => occurrences(ev, d).forEach(s => { const t = d.getTime() + s * 1000;
    if (t > from && t <= now) { const key = ev.id + '@' + t; if (!schDone.has(key)) { schDone.add(key); runEvent(ev); } } }));
}
async function randomFrom(arg){
  const [kind, ...r] = String(arg || 'music:').split(':'); const path = r.join(':'); let files = [];
  try { const d = await (await fetch('/api/browse?kind=' + kind + '&path=' + encodeURIComponent(path))).json(); files = (d.files || []).map(x => libItem(x, kind)); } catch(e){}
  if (!files.length) return null;
  const recent = new Set(HIST.slice(-40).map(h => h.k)); const fresh = files.filter(f => !recent.has(f.id)); const pool = fresh.length ? fresh : files;
  return pool[Math.floor(Math.random() * pool.length)];
}
function startPlaylist(name, mode){
  const t = PL.tabs.findIndex(x => x.name === name); if (t < 0) { toast('Scheduler: playlist "' + name + '" not found'); return; }
  const tab = PL.tabs[t]; tab.items.forEach(x => { if (x.uid !== PL.cur) x.played = false; });
  const first = tab.items.find(x => x.kind !== 'comment' && x.uid !== PL.cur); if (!first) return;
  if (!ctx) return;
  if (!isPlaying() || mode === 'now') { playItem(first, { fadeOut: 1 }); }
  else if (mode === 'queue') PL.pq.push(first.uid); else PL.pq.unshift(first.uid);
  afterChange(); toast('Scheduler: playlist ' + name);
}
async function runEvent(ev){
  try {
    let items = [];
    switch (ev.action) {
      case 'track': { let it = libById.get(ev.arg); if (!it) { await libKind('carts'); await libKind('ads'); it = libById.get(ev.arg); } if (it) items = [fromLib(it)]; break; }
      case 'folder': { const it = await randomFrom(ev.arg); if (it) items = [fromLib(it)]; break; }
      case 'playlist': startPlaylist(ev.arg, ev.mode); return;
      case 'ads': adBreak(ev.mode); return;
      case 'time': case 'weather': { const it = await announce(ev.action); if (it) items = [it]; break; }
      case 'tts': { const it = await speakItem(ev.arg, ev.name); if (it) items = [it]; break; }
      case 'url': items = [{ uid: uidGen(), kind: 'stream', url: ev.arg, title: ev.name, artist: '', dur: toSec(ev.dur) }]; break;
      case 'command': items = [{ uid: uidGen(), kind: 'cmd', cmd: ev.arg, title: ev.arg }]; break;
    }
    if (!items.length) { toast('Scheduler: nothing to play for "' + ev.name + '"'); return; }
    items.forEach(i => i.sched = true);
    placeItems(items, ev.mode); toast('Scheduler: ' + ev.name);
  } catch(e){ toast('Scheduler error in "' + ev.name + '"'); }
}
function renderSch(){
  $('#schOn').classList.toggle('on', schOn);
  $('#schList').innerHTML = SCH.length ? SCH.map((e, i) => { const nr = nextRun(e); const nd = nr && new Date(nr);
    const when = e.date ? e.date : e.days && e.days.length && e.days.length < 7 ? e.days.map(d => DAYN[d]).join(' ') : 'every day';
    return `<div class="ev ${e.on ? '' : 'off'}" data-i="${i}"><span class="tgl ${e.on ? 'on' : ''}" data-x="tog" title="Enable / disable"><b></b></span>
    <div style="min-width:0;cursor:pointer" data-x="edit" title="Edit"><div class="ell" style="font-weight:600">${esc(e.name)}</div>
    <div class="sub ell" style="font-size:11px">${esc(String(e.time).slice(0, 5))}${+e.repeat ? ' · every ' + e.repeat + ' min' : ''} · ${when} · ${esc((ACTIONS.find(a => a[0] === e.action) || ['', ''])[1])}</div>
    <div style="font-size:10.5px;color:${nr ? '#8CC2FF' : 'var(--sub)'}">${nr ? 'next ' + (nd.toDateString() === new Date().toDateString() ? '' : DAYN[nd.getDay()] + ' ') + nd.toTimeString().slice(0, 8) : 'no next run'}</div></div>
    <div style="display:flex;gap:2px"><button class="ic" data-x="run" title="Run now" aria-label="Run now">▶</button><button class="ic" data-x="del" title="Delete" aria-label="Delete">✕</button></div></div>`; }).join('')
    : '<div class="sub" style="padding:10px;line-height:1.6">No events yet.<br>Add events to play jingles, ad breaks, time and weather announcements, shows, streams or commands at set times.</div>';
  $('#schNext').textContent = schLabel();
}
$('#schList').onclick = e => { const row = e.target.closest('.ev'), x = e.target.closest('[data-x]'); if (!row || !x) return; const i = +row.dataset.i, ev = SCH[i];
  if (x.dataset.x === 'tog') { ev.on = !ev.on; saveSch(); } else if (x.dataset.x === 'edit') editEvent(i);
  else if (x.dataset.x === 'run') runEvent(ev); else if (x.dataset.x === 'del' && confirm('Delete "' + ev.name + '"?')) { SCH.splice(i, 1); saveSch(); } };
$('#schAdd').onclick = () => editEvent(-1);
$('#schOn').onclick = () => { schOn = !schOn; store.set('schOn', schOn ? '1' : '0'); renderSch(); };
function saveSch(){ dsSave('schedule', SCH); renderSch(); }
async function editEvent(idx){
  const ev = idx > -1 ? JSON.parse(JSON.stringify(SCH[idx])) : { id: uidGen(), name: 'New event', on: true, time: new Date(Date.now() + 120000).toTimeString().slice(0, 5) + ':00', repeat: 0, until: '', days: [], date: '', from: '', to: '', action: 'track', arg: '', mode: 'next', dur: '' };
  const [folders, carts, adl] = await Promise.all([folderList(), libKind('carts'), libKind('ads')]);
  const trackOpts = [['', '— choose —']].concat(carts.map(x => [x.id, 'Jingle: ' + x.title]), adl.map(x => [x.id, 'Ad: ' + x.title]), library.filter(x => !x.file).map(x => [x.id, (x.artist ? x.artist + ' – ' : '') + x.title]));
  const argHtml = a => a === 'track' ? `<select class="inp" id="evArg">${opts(trackOpts, ev.arg)}</select>` :
    a === 'folder' ? `<select class="inp" id="evArg">${opts(folders, ev.arg)}</select>` :
    a === 'playlist' ? `<select class="inp" id="evArg">${opts(PL.tabs.map(t => [t.name, t.name]), ev.arg)}</select>` :
    a === 'command' ? `<select class="inp" id="evArg">${opts(CMDS, ev.arg)}</select>` :
    a === 'tts' ? `<input class="inp" id="evArg" value="${esc(ev.arg)}" placeholder="Text to speak">` :
    a === 'url' ? `<div style="display:flex;gap:6px"><input class="inp" id="evArg" value="${esc(ev.arg)}" placeholder="https://…/stream.mp3" style="flex:1"><input class="inp" id="evDur" value="${esc(ev.dur || '')}" placeholder="length m:ss" style="width:110px"></div>` :
    `<span class="sub" style="font-size:12px;align-self:center">${a === 'ads' ? 'Plays the campaigns that are active now (Tools → Ads Scheduler).' : a === 'time' ? 'Speaks the time text from Options → Announcements.' : 'Speaks the weather text for the city in Options → Announcements.'}</span>`;
  big(idx > -1 ? 'Edit event' : 'New event', `<div class="frm">
  <label for="evName">Name</label><input class="inp" id="evName" value="${esc(ev.name)}">
  <label for="evTime">Start time</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="time" step="1" id="evTime" value="${esc(ev.time)}" style="width:140px"><span class="tgl ${ev.on ? 'on' : ''}" id="evOn"><b></b>Active</span></div>
  <label for="evRep">Repeat every</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" min="0" id="evRep" value="${+ev.repeat || 0}" style="width:80px"><span class="sub">minutes (0 = once) until</span><input class="inp" type="time" id="evUntil" value="${esc(ev.until)}" style="width:120px"></div>
  <label>Days</label><div>${daysHtml(ev.days, 'evDays')}<div class="sub" style="font-size:11px;margin-top:3px">None selected = every day</div></div>
  <label for="evDate">Only on date</label><input class="inp" type="date" id="evDate" value="${esc(ev.date)}" style="width:170px">
  <label for="evFrom">Active from / to</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="date" id="evFrom" value="${esc(ev.from)}" style="width:170px"><span class="sub">–</span><input class="inp" type="date" id="evTo" value="${esc(ev.to)}" style="width:170px"></div>
  <label for="evAct">Action</label><select class="inp" id="evAct">${opts(ACTIONS, ev.action)}</select>
  <label for="evArg">What</label><div id="evArgW">${argHtml(ev.action)}</div>
  <label for="evMode">When it fires</label><select class="inp" id="evMode">${opts(MODES, ev.mode)}</select></div>`,
  [['Save', () => {
    ev.name = $('#evName').value.trim() || 'Event'; ev.time = $('#evTime').value.length === 5 ? $('#evTime').value + ':00' : $('#evTime').value;
    if (!/^\d\d:\d\d:\d\d$/.test(ev.time)) return toast('Enter a start time');
    ev.on = $('#evOn').classList.contains('on'); ev.repeat = Math.max(0, +$('#evRep').value || 0); ev.until = $('#evUntil').value; ev.days = readDays('evDays');
    ev.date = $('#evDate').value; ev.from = $('#evFrom').value; ev.to = $('#evTo').value; ev.action = $('#evAct').value; ev.mode = $('#evMode').value;
    ev.arg = $('#evArg') ? $('#evArg').value : ''; ev.dur = $('#evDur') ? $('#evDur').value : '';
    if (['track', 'tts', 'url'].includes(ev.action) && !ev.arg) return toast('Choose what to play');
    if (idx > -1) SCH[idx] = ev; else SCH.push(ev); saveSch(); closeModal('mBig'); toast('Event saved'); }, true]]);
  $('#evOn').onclick = () => $('#evOn').classList.toggle('on');
  $('#evAct').onchange = () => { ev.action = $('#evAct').value; ev.arg = ''; $('#evArgW').innerHTML = argHtml(ev.action); };
}

// ---------------- PHASE 3: Playlist Generator Pro ----------------
let GENT = [];
async function genSources(){
  const f = await folderList();
  return [['all', 'All music']].concat(f.filter(x => x[0].startsWith('music:') && x[0] !== 'music:').map(x => ['folder:' + x[0], 'Folder: ' + x[1]]), [['carts', 'Jingles folder'], ['ads', 'Ads folder']], FT.map(t => ['type:' + t.name, 'File type: ' + t.name]));
}
async function poolFor(src){
  const nrm = s => String(s || '').toLowerCase().replace(/\\/g, '/');
  if (src === 'all') return library.filter(x => !x.file);
  if (src === 'carts' || src === 'ads') return libKind(src);
  if (src.startsWith('folder:')) { const [, kind, ...r] = src.split(':'); const rel = nrm(r.join(':')); const base = kind === 'music' ? library : await libKind(kind); return base.filter(x => nrm(x.path).includes('/' + rel + '/')); }
  if (src.startsWith('type:')) { const name = src.slice(5); const all = library.concat(await libKind('carts'), await libKind('ads')); return all.filter(x => ftOf(fromLib(x)).name === name); }
  return [];
}
async function generate(g){
  const pools = {}; for (const r of g.rules) pools[r.src] = await poolFor(r.src);
  const out = [], recentA = [], usedNow = new Set(), cut = Date.now() - (+g.titleHours || 0) * 3600e3;
  const usedRecently = new Set(HIST.filter(h => h.t > cut).map(h => h.k));
  let total = 0, loops = 0; const target = (+g.minutes || 60) * 60;
  while (total < target && loops++ < 500) {
    let added = false;
    for (const r of g.rules) { for (let k = 0; k < Math.max(1, +r.n || 1); k++) {
      const pool = pools[r.src] || []; if (!pool.length) continue;
      const sep = +g.artistSep || 0;
      const ok = x => !usedNow.has(x.id) && !usedRecently.has(x.id) && !(sep && x.artist && recentA.slice(-sep).includes(x.artist.toLowerCase()));
      let c = pool.filter(ok); if (!c.length) c = pool.filter(x => !usedNow.has(x.id)); if (!c.length) c = pool;
      const pick = c[Math.floor(Math.random() * c.length)];
      out.push(pick); usedNow.add(pick.id); if (pick.artist) recentA.push(pick.artist.toLowerCase()); total += pick.dur || 180; added = true;
      if (total >= target) break; }
      if (total >= target) break; }
    if (!added) break;
  }
  return { list: out, total };
}
async function openGen(tpl){
  const srcs = await genSources();
  const g = JSON.parse(JSON.stringify(tpl || { name: 'Generated ' + new Date().toTimeString().slice(0, 5), target: 'new', minutes: 60, rules: [{ src: 'all', n: 3 }, { src: 'carts', n: 1 }], artistSep: 4, titleHours: 3 }));
  let result = null;
  const rulesHtml = () => g.rules.map((r, i) => `<div style="display:flex;gap:6px;align-items:center" data-r="${i}"><span class="mono sub" style="width:20px">${i + 1}</span><select class="inp" data-k="src" style="flex:1">${opts(srcs, r.src)}</select><input class="inp" type="number" min="1" data-k="n" value="${r.n}" style="width:70px" aria-label="Tracks"><span class="sub" style="font-size:11px">tracks</span><button class="ic" data-rdel="${i}" aria-label="Remove rule">✕</button></div>`).join('');
  big('Playlist Generator Pro', `<div class="sub" style="font-size:12px;line-height:1.6">Build a playlist from a rotation: the rules are repeated in order until the playlist reaches the length you set. Tracks played recently and the same artist close together are avoided.</div>
  <div class="frm"><label for="gName">Playlist name</label><input class="inp" id="gName" value="${esc(g.name)}">
  <label for="gTarget">Put it in</label><select class="inp" id="gTarget">${opts([['new', 'A new playlist tab'], ['append', 'The end of the playlist on screen'], ['replace', 'Replace unplayed items of the playlist on screen']], g.target)}</select>
  <label for="gMin">Length</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" id="gMin" value="${g.minutes}" style="width:90px"><span class="sub">minutes</span></div>
  <label for="gSep">Artist separation</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" id="gSep" value="${g.artistSep}" style="width:90px"><span class="sub">tracks between the same artist</span></div>
  <label for="gHours">Track repeat</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" id="gHours" value="${g.titleHours}" style="width:90px"><span class="sub">hours before a track can be played again</span></div></div>
  <div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">ROTATION RULES</span><button class="btn sm" id="gAddR">+ Rule</button></div>
  <div id="gRules" style="display:flex;flex-direction:column;gap:5px">${rulesHtml()}</div>
  <div style="display:flex;gap:8px;align-items:center"><button class="btn" id="gRun">Generate preview</button><span class="sub" id="gInfo" style="font-size:12px"></span></div>
  <div class="scroll" id="gOut" style="max-height:220px;border:1px solid var(--line);border-radius:8px"></div>`,
  [['Templates ▾', e => { e.stopPropagation(); const r = e.target.getBoundingClientRect(); showCtx(r.left, r.bottom + 4, GENT.length ? GENT.map((t, i) => [t.name, () => openGen(t)]).concat(['-', ['Delete a template…', () => { const n = prompt('Template name to delete'); const i = GENT.findIndex(t => t.name === n); if (i > -1) { GENT.splice(i, 1); dsSave('generator', GENT); toast('Deleted'); } }]]) : [['No templates yet', null]]); }],
   ['Save as template', () => { read(); const n = prompt('Template name', g.name); if (!n) return; const t = Object.assign(JSON.parse(JSON.stringify(g)), { name: n }); const i = GENT.findIndex(x => x.name === n); if (i > -1) GENT[i] = t; else GENT.push(t); dsSave('generator', GENT); toast('Template saved'); }],
   ['Create playlist', async () => { read(); if (!result) result = await generate(g); apply(); }, true]]);
  function read(){ g.name = $('#gName').value; g.target = $('#gTarget').value; g.minutes = +$('#gMin').value || 60; g.artistSep = +$('#gSep').value || 0; g.titleHours = +$('#gHours').value || 0;
    $$('#gRules [data-r]').forEach(row => { const r = g.rules[+row.dataset.r]; r.src = row.querySelector('[data-k="src"]').value; r.n = +row.querySelector('[data-k="n"]').value || 1; }); }
  $('#gAddR').onclick = () => { read(); g.rules.push({ src: 'all', n: 1 }); $('#gRules').innerHTML = rulesHtml(); };
  $('#gRules').onclick = e => { const d = e.target.closest('[data-rdel]'); if (d) { read(); g.rules.splice(+d.dataset.rdel, 1); $('#gRules').innerHTML = rulesHtml(); } };
  $('#gRun').onclick = async () => { read(); result = await generate(g);
    $('#gInfo').textContent = result.list.length + ' tracks · ' + fmtL(result.total);
    $('#gOut').innerHTML = result.list.length ? '<table class="tbl"><tr><th>#</th><th>Title</th><th>Artist</th><th>Type</th><th>Length</th></tr>' + result.list.map((x, i) => `<tr><td class="mono sub">${i + 1}</td><td>${esc(x.title)}</td><td class="sub">${esc(x.artist)}</td><td>${esc(ftOf(fromLib(x)).name)}</td><td class="mono">${fmtL(x.dur)}</td></tr>`).join('') + '</table>' : '<div class="sub" style="padding:10px">No tracks match these rules. Check the music folders in Options.</div>'; };
  function apply(){
    if (!result || !result.list.length) return toast('Nothing generated');
    const items = result.list.map(fromLib);
    if (g.target === 'new') { const t = newTab(g.name); t.items = items; PL.tabs.push(t); PL.view = PL.tabs.length - 1; }
    else if (g.target === 'replace') { const t = viewTab(); t.items = t.items.filter(x => x.played || x.uid === PL.cur).concat(items); }
    else viewTab().items.push(...items);
    renderTabs(); afterChange(); closeModal('mBig'); toast(items.length + ' tracks generated');
  }
}

// ---------------- PHASE 3: track editor (cue in, intro, mix, cue out, gain) ----------------
const MK = [['cueIn', 'Cue in', '#22C55E'], ['intro', 'Intro end', '#F5A524'], ['mix', 'Mix (next starts)', '#F04444'], ['cueOut', 'Cue out', '#C9CDD6']];
async function openTrackEditor(it){
  if (!it || it.kind !== 'track') return toast('Select a track in the playlist first');
  const key = tmKey(it), m = Object.assign({ cueIn: 0, intro: 0, mix: 0, cueOut: 0, gain: 0 }, TM[key] || {}); let active = 'cueIn', peaks = null, dur = itemDur(it);
  big('Track editor · ' + (it.artist ? it.artist + ' – ' : '') + it.title, `<div class="sub" style="font-size:12px">Pick a marker, then click the waveform to place it. 0 = automatic. The marker values are kept for this track everywhere it is used.</div>
  <canvas id="teW" width="1800" height="220" style="width:100%;height:170px;background:#0F1115;border-radius:8px;cursor:crosshair"></canvas>
  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px" id="teMk">${MK.map(k => `<div class="aux" data-m="${k[0]}" style="cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:${k[2]};font-weight:700;font-size:12px">● ${k[1]}</span><button class="ic" data-pl="${k[0]}" title="Prelisten from here" aria-label="Prelisten from ${k[1]}">🎧</button></div><input class="inp" type="number" step="0.1" min="0" data-v="${k[0]}" value="${m[k[0]] || 0}" aria-label="${k[1]} seconds"></div>`).join('')}</div>
  <div style="display:flex;gap:10px;align-items:center"><label for="teGain" class="lbl">GAIN</label><input class="inp" type="number" step="0.5" id="teGain" value="${m.gain || 0}" style="width:90px"><span class="sub">dB for this track</span><span class="sub" id="teInfo" style="margin-left:auto;font-size:11.5px">Loading waveform…</span></div>`,
  [['Reset all', () => { MK.forEach(k => m[k[0]] = 0); m.gain = 0; $('#teGain').value = 0; sync(); draw(); }], ['Save', () => { read(); const o = {}; ['cueIn', 'intro', 'mix', 'cueOut', 'gain'].forEach(k => { if (+m[k]) o[k] = +m[k]; });
    if (Object.keys(o).length) TM[key] = o; else delete TM[key]; dsSave('trackmeta', TM); closeModal('mBig'); renderAll(); toast('Track markers saved'); }, true]]);
  const sel = () => $$('#teMk [data-m]').forEach(el => el.style.borderColor = el.dataset.m === active ? '#2D8CEB' : '');
  function read(){ $$('#teMk [data-v]').forEach(i => m[i.dataset.v] = Math.max(0, +i.value || 0)); m.gain = +$('#teGain').value || 0; }
  function sync(){ $$('#teMk [data-v]').forEach(i => i.value = (+m[i.dataset.v] || 0).toFixed(1)); }
  function draw(){
    const c = $('#teW'); if (!c) return; const g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    if (peaks) { const mx = Math.max(0.05, ...peaks), bw = W / peaks.length; g.fillStyle = '#3A6EA8'; peaks.forEach((p, i) => { const h = p / mx * (H - 30); g.fillRect(i * bw, (H - h) / 2, Math.max(1, bw - 0.5), h); }); }
    g.font = '22px Inter, sans-serif';
    for (let s = 0; dur && s < dur; s += dur > 240 ? 30 : 10) { const x = s / dur * W; g.fillStyle = '#2A2E37'; g.fillRect(x, H - 14, 1, 14); g.fillStyle = '#6B7280'; g.fillText(fmtL(s) === '—' ? '0:00' : fmtL(s), x + 4, H - 2); }
    if (dur) { if (m.cueIn) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, m.cueIn / dur * W, H); } if (m.cueOut) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(m.cueOut / dur * W, 0, W, H); }
      MK.forEach(k => { const v = +m[k[0]]; if (!v) return; const x = v / dur * W; g.fillStyle = k[2]; g.fillRect(x - 2, 0, 4, H); g.fillText(k[1], Math.min(x + 6, W - 200), 24 + MK.indexOf(k) * 24); }); }
  }
  sel();
  $('#teMk').onclick = e => { const p = e.target.closest('[data-pl]'); if (p) { read(); prelisten(it).then(() => { pfl.currentTime = +m[p.dataset.pl] || 0; }); return; } const b = e.target.closest('[data-m]'); if (b) { active = b.dataset.m; sel(); } };
  $('#teMk').oninput = () => { read(); draw(); };
  $('#teW').onclick = e => { if (!dur) return; const r = e.currentTarget.getBoundingClientRect(); m[active] = Math.round((e.clientX - r.left) / r.width * dur * 10) / 10; sync(); draw(); };
  try {
    const ab = it.file ? await it.file.arrayBuffer() : await (await fetch(it.url)).arrayBuffer();
    const buf = await new OfflineAudioContext(1, 1, 11025).decodeAudioData(ab); dur = buf.duration;
    const ch = buf.getChannelData(0), n = 900, step = Math.max(1, Math.floor(ch.length / n)); peaks = [];
    for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * step; j < (i + 1) * step && j < ch.length; j += 2) { const v = Math.abs(ch[j]); if (v > mx) mx = v; } peaks.push(mx); }
    if ($('#teInfo')) $('#teInfo').textContent = 'Length ' + fmtL(dur);
  } catch(e){ if ($('#teInfo')) $('#teInfo').textContent = 'Could not read the audio'; }
  draw();
}
function selOrCur(){ const f = [...PL.sel].map(u => findItem(u)).filter(Boolean)[0]; return f ? f.item : curItem(); }

// ---------------- PHASE 4: Ads Scheduler ----------------
let ADS = { blocks: '15,45', hours: '06-23', mode: 'next', maxWait: 120, intro: '', outro: '', campaigns: [] };
let adLib = [], adAuto = store.get('adAuto', '0') === '1', lastAdSlot = '';
let ADC = (() => { try { return JSON.parse(store.get('adCounts', '{}')); } catch(e){ return {}; } })();
$('#adAuto').classList.toggle('on', adAuto);
$('#adAuto').onclick = () => { adAuto = !adAuto; store.set('adAuto', adAuto ? '1' : '0'); $('#adAuto').classList.toggle('on', adAuto); };
$('#adNow').onclick = () => adBreak();
$('#adSchedBtn').onclick = () => openAds();
function inHours(spec, h){ if (!spec) return true; return String(spec).split(',').some(r => { const [a, b] = r.split('-').map(x => parseInt(x, 10)); return isNaN(a) ? true : isNaN(b) ? h === a : h >= a && h <= b; }); }
function activeCamps(d){
  const ds = dstr(d), h = d.getHours(), dc = ADC[ds] || {};
  return ADS.campaigns.filter(c => c.on && c.files.length && (!c.from || ds >= c.from) && (!c.to || ds <= c.to) && (!c.days || !c.days.length || c.days.includes(d.getDay())) && inHours(c.hours, h) && (!+c.perDay || (dc[c.id] || 0) < +c.perDay))
    .sort((a, b) => (+b.prio || 0) - (+a.prio || 0));
}
function buildBreak(){
  const items = [];
  activeCamps(new Date()).forEach(c => { c.rot = c.rot || 0;
    for (let k = 0; k < Math.max(1, +c.perBlock || 1); k++) { const id = c.files[c.rot % c.files.length]; c.rot++; const li = libById.get(id);
      if (li) items.push(Object.assign(fromLib(li), { sched: true, campaign: c.name, campId: c.id, ftype: 'Commercial' })); } });
  if (items.length) { const wrap = id => { const li = id && libById.get(id); return li ? Object.assign(fromLib(li), { sched: true, ftype: 'Jingle' }) : null; };
    const a = wrap(ADS.intro), b = wrap(ADS.outro); if (a) items.unshift(a); if (b) items.push(b); }
  return items;
}
async function adBreak(mode){
  await loadServerAds(); await libKind('carts');
  const items = buildBreak(); if (!items.length) { toast('Ad break: no active campaigns right now'); return; }
  const m = mode || ADS.mode; placeItems(items, m); dsSave('ads', ADS);
  if (m === 'next' && +ADS.maxWait > 0 && isPlaying()) { const first = items[0].uid; setTimeout(() => { if (PL.cur !== first && PL.pq[0] === first) { mixFired = true; advance('manual'); } }, +ADS.maxWait * 1000); }
  toast('Ad break: ' + items.filter(i => i.campId).length + ' spot(s)');
}
function adCount(it){ const ds = today(); ADC[ds] = ADC[ds] || {}; ADC[ds][it.campId] = (ADC[ds][it.campId] || 0) + 1;
  Object.keys(ADC).sort().slice(0, -60).forEach(k => delete ADC[k]); store.set('adCounts', JSON.stringify(ADC)); renderAdCard(); }
async function loadServerAds(){ adLib = await libKind('ads'); renderAdCard(); }
function renderAdCard(){ const n = activeCamps(new Date()).length; $('#adInfo').textContent = `${ADS.campaigns.length} campaign${ADS.campaigns.length === 1 ? '' : 's'} · ${n} active now · ${adLib.length} spot file${adLib.length === 1 ? '' : 's'}`; }
function nextBreak(){
  const mins = String(ADS.blocks).split(',').map(x => parseInt(x, 10)).filter(x => x >= 0 && x < 60).sort((a, b) => a - b); if (!mins.length) return null;
  const now = new Date();
  for (let h = 0; h < 48; h++) for (const m of mins) { const t = new Date(now); t.setMinutes(0, 0, 0); t.setHours(now.getHours() + h, m); if (t > now && inHours(ADS.hours, t.getHours())) return t; }
  return null;
}
function adTick(){
  const nb = nextBreak(), now = new Date();
  if (!nb) { $('#adWhen').textContent = 'No break times set'; $('#adCount').textContent = '--:--'; }
  else { $('#adWhen').textContent = nb.toTimeString().slice(0, 5) + (adAuto ? '' : ' (auto off)'); const s = (nb - now) / 1000; $('#adCount').textContent = s >= 3600 ? hms(s) : fmt(s); }
  const mins = String(ADS.blocks).split(',').map(x => parseInt(x, 10)); const slot = dstr(now) + ' ' + now.getHours() + ':' + now.getMinutes();
  if (adAuto && mins.includes(now.getMinutes()) && inHours(ADS.hours, now.getHours()) && lastAdSlot !== slot && now.getSeconds() < 5) { lastAdSlot = slot; adBreak(); }
}
async function openAds(){
  await loadServerAds(); const carts = await libKind('carts');
  const jOpts = [['', 'None']].concat(carts.map(x => [x.id, x.title]));
  const ds = today();
  big('Ads Scheduler', `<div class="frm">
  <label for="aAuto">Automatic breaks</label><div style="display:flex;gap:10px;align-items:center"><span class="tgl ${adAuto ? 'on' : ''}" id="aAuto"><b></b>On</span><span class="sub" style="font-size:12px">Next break: <b id="aNext" class="mono" style="color:var(--amber)"></b></span></div>
  <label for="aBlocks">Break minutes</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="aBlocks" value="${esc(ADS.blocks)}" style="width:140px"><span class="sub">e.g. 15,45 = at :15 and :45 every hour</span></div>
  <label for="aHours">Hours</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="aHours" value="${esc(ADS.hours)}" style="width:140px"><span class="sub">e.g. 06-23 or 07-10,16-20</span></div>
  <label for="aMode">Break starts</label><select class="inp" id="aMode">${opts([['next', 'After the current track'], ['now', 'Immediately (fade out)']], ADS.mode)}</select>
  <label for="aWait">Max wait</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" id="aWait" value="${ADS.maxWait}" style="width:90px"><span class="sub">seconds, then cut the track (0 = always wait)</span></div>
  <label for="aIntro">Break intro / outro</label><div style="display:flex;gap:6px"><select class="inp" id="aIntro">${opts(jOpts, ADS.intro)}</select><select class="inp" id="aOutro">${opts(jOpts, ADS.outro)}</select></div></div>
  <div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">CAMPAIGNS</span><div style="display:flex;gap:6px"><button class="btn sm" id="aReport">Ads report…</button><button class="btn sm" id="aAdd">+ Campaign</button></div></div>
  <div class="scroll" style="max-height:300px;border:1px solid var(--line);border-radius:8px"><table class="tbl"><tr><th></th><th>Campaign</th><th>Client</th><th>Spots</th><th>Dates</th><th>Hours</th><th>Today</th><th></th></tr>
  ${ADS.campaigns.map((c, i) => `<tr><td><span class="tgl ${c.on ? 'on' : ''}" data-ctog="${i}"><b></b></span></td><td><b>${esc(c.name)}</b></td><td class="sub">${esc(c.client || '')}</td><td class="mono">${c.files.length}</td><td class="sub">${esc(c.from || '…')} – ${esc(c.to || '…')}</td><td class="sub">${esc(c.hours || 'all')}</td><td class="mono">${(ADC[ds] || {})[c.id] || 0}${+c.perDay ? ' / ' + c.perDay : ''}</td><td style="white-space:nowrap"><button class="btn sm" data-cedit="${i}">Edit</button> <button class="ic" data-cdel="${i}" aria-label="Delete">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="sub" style="padding:12px">No campaigns yet. Put the ad files in the ads folder, then add a campaign.</td></tr>'}</table></div>`,
  [['Break now', () => { readG(); dsSave('ads', ADS); adBreak(); }], ['Save', () => { readG(); dsSave('ads', ADS); renderAdCard(); closeModal('mBig'); toast('Ads Scheduler saved'); }, true]]);
  const showNext = () => { const nb = nextBreak(); $('#aNext').textContent = nb ? nb.toTimeString().slice(0, 5) + (adAuto ? '' : ' (auto off)') : '—'; };
  $('#aAuto').onclick = () => { $('#adAuto').onclick(); $('#aAuto').classList.toggle('on', adAuto); showNext(); }; showNext();
  function readG(){ ADS.blocks = $('#aBlocks').value; ADS.hours = $('#aHours').value; ADS.mode = $('#aMode').value; ADS.maxWait = +$('#aWait').value || 0; ADS.intro = $('#aIntro').value; ADS.outro = $('#aOutro').value; }
  $('#aAdd').onclick = () => { readG(); editCamp(-1); };
  $('#aReport').onclick = () => { readG(); openReports('ads'); };
  $('#bgBody').onclick = e => { const t = e.target.closest('[data-ctog]'), ed = e.target.closest('[data-cedit]'), dl = e.target.closest('[data-cdel]');
    if (t) { readG(); const c = ADS.campaigns[+t.dataset.ctog]; c.on = !c.on; dsSave('ads', ADS); openAds(); }
    if (ed) { readG(); editCamp(+ed.dataset.cedit); }
    if (dl && confirm('Delete this campaign?')) { readG(); ADS.campaigns.splice(+dl.dataset.cdel, 1); dsSave('ads', ADS); openAds(); } };
}
function editCamp(idx){
  const c = idx > -1 ? JSON.parse(JSON.stringify(ADS.campaigns[idx])) : { id: uidGen(), name: 'New campaign', client: '', on: true, files: [], from: today(), to: '', days: [], hours: '', perDay: 0, perBlock: 1, prio: 1 };
  big(idx > -1 ? 'Edit campaign' : 'New campaign', `<div class="frm">
  <label for="cpName">Name</label><input class="inp" id="cpName" value="${esc(c.name)}">
  <label for="cpClient">Client</label><input class="inp" id="cpClient" value="${esc(c.client)}">
  <label for="cpFrom">Dates</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="date" id="cpFrom" value="${esc(c.from)}" style="width:170px"><span class="sub">–</span><input class="inp" type="date" id="cpTo" value="${esc(c.to)}" style="width:170px"></div>
  <label>Days</label><div>${daysHtml(c.days, 'cpDays')}<div class="sub" style="font-size:11px;margin-top:3px">None selected = every day</div></div>
  <label for="cpHours">Hours</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" id="cpHours" value="${esc(c.hours)}" placeholder="all hours" style="width:150px"><span class="sub">e.g. 07-10,16-19</span></div>
  <label for="cpDay">Plays per day</label><div style="display:flex;gap:6px;align-items:center"><input class="inp" type="number" min="0" id="cpDay" value="${+c.perDay || 0}" style="width:90px"><span class="sub">0 = no limit · spots per break</span><input class="inp" type="number" min="1" id="cpBlock" value="${+c.perBlock || 1}" style="width:70px" aria-label="Spots per break"><span class="sub">priority</span><input class="inp" type="number" id="cpPrio" value="${+c.prio || 1}" style="width:70px" aria-label="Priority"></div>
  <label>Spots</label><div class="scroll" style="max-height:200px;border:1px solid var(--line);border-radius:8px;padding:4px 8px">${adLib.length ? adLib.map(a => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" value="${esc(a.id)}" ${c.files.includes(a.id) ? 'checked' : ''} class="cpF"> <span>${esc(a.artist ? a.artist + ' – ' : '')}${esc(a.title)}</span><span class="sub mono" style="margin-left:auto">${fmtL(a.dur)}</span></label>`).join('') : '<span class="sub">No files in the ads folder (Options → Ads folder).</span>'}</div></div>`,
  [['← Back', () => openAds()], ['Save campaign', () => {
    c.name = $('#cpName').value.trim() || 'Campaign'; c.client = $('#cpClient').value; c.from = $('#cpFrom').value; c.to = $('#cpTo').value; c.days = readDays('cpDays'); c.hours = $('#cpHours').value.trim();
    c.perDay = +$('#cpDay').value || 0; c.perBlock = +$('#cpBlock').value || 1; c.prio = +$('#cpPrio').value || 1; c.files = $$('.cpF:checked').map(x => x.value);
    if (!c.files.length) return toast('Tick at least one spot');
    if (idx > -1) ADS.campaigns[idx] = c; else ADS.campaigns.push(c); dsSave('ads', ADS); renderAdCard(); openAds(); toast('Campaign saved'); }, true]]);
}

// ---------------- PHASE 5: reports ----------------
async function openReports(kind){
  const d0 = new Date(); d0.setDate(d0.getDate() - 6);
  big(kind === 'ads' ? 'Ads report' : 'Report Generator', `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
  <label for="rpFrom" class="sub">From</label><input class="inp" type="date" id="rpFrom" value="${dstr(d0)}" style="width:160px"><label for="rpTo" class="sub">to</label><input class="inp" type="date" id="rpTo" value="${today()}" style="width:160px">
  <select class="inp" id="rpType" style="width:180px">${opts([['', 'All types'], ['ads', 'Ads only']].concat(FT.map(f => [f.name, f.name]), [['Stream', 'Stream'], ['Line in', 'Line in']]), kind === 'ads' ? 'ads' : '')}</select>
  <input class="inp" id="rpQ" placeholder="Filter title / artist / client" style="flex:1;min-width:160px"><button class="btn sm pri" id="rpGo">Show</button><button class="btn sm" id="rpCsv">Export CSV</button></div>
  <div id="rpSum" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"></div>
  <div class="scroll" id="rpOut" style="max-height:330px;border:1px solid var(--line);border-radius:8px"></div>`);
  let rows = [];
  const run = async () => {
    try { const r = await api('/api/playlog?from=' + $('#rpFrom').value + '&to=' + $('#rpTo').value); if (r.status === 401) return toast('Wrong password'); rows = (await r.json()).rows; } catch(e){ return toast('Server not running'); }
    const t = $('#rpType').value, q = $('#rpQ').value.toLowerCase();
    rows = rows.filter(r => (!t || (t === 'ads' ? String(r.playlist).startsWith('Ad: ') : r.type === t)) && (!q || (r.title + ' ' + r.artist + ' ' + r.playlist).toLowerCase().includes(q)));
    const cnt = (keyf) => { const m = new Map(); rows.forEach(r => { const k = keyf(r); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8); };
    const box = (title, list) => `<div class="aux"><div class="lbl">${title}</div>${list.length ? list.map(([k, n]) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><span class="ell">${esc(k)}</span><b class="mono">${n}</b></div>`).join('') : '<span class="sub" style="font-size:12px">—</span>'}</div>`;
    const totalSec = rows.reduce((a, r) => a + (+r.length || 0), 0);
    $('#rpSum').innerHTML = (t === 'ads' ? box('PLAYS PER CAMPAIGN', cnt(r => r.playlist.slice(4))) + box('PLAYS PER SPOT', cnt(r => (r.artist ? r.artist + ' – ' : '') + r.title)) + box('PLAYS PER DAY', cnt(r => r.time.slice(0, 10)))
      : box('TOP TRACKS', cnt(r => r.type === 'Music' ? (r.artist ? r.artist + ' – ' : '') + r.title : '')) + box('TOP ARTISTS', cnt(r => r.type === 'Music' ? r.artist : '')) + `<div class="aux"><div class="lbl">TOTALS</div><div style="font-size:12px;line-height:1.8">${rows.length} items played<br>${hms(totalSec)} of audio<br>Peak listeners ${Math.max(0, ...rows.map(r => +r.listeners || 0))}</div></div>`);
    $('#rpOut').innerHTML = rows.length ? `<table class="tbl"><tr><th>Time</th><th>Title</th><th>Artist</th><th>Type</th><th>Listeners</th><th>Playlist / campaign</th></tr>${rows.slice(-800).reverse().map(r => `<tr><td class="mono sub">${esc(r.time)}</td><td>${esc(r.title)}</td><td class="sub">${esc(r.artist)}</td><td>${esc(r.type)}</td><td class="mono">${esc(r.listeners)}</td><td class="sub">${esc(r.playlist)}</td></tr>`).join('')}</table>` : '<div class="sub" style="padding:12px">Nothing played in this period.</div>';
  };
  $('#rpGo').onclick = run; $('#rpType').onchange = run;
  $('#rpCsv').onclick = () => { if (!rows.length) return toast('Nothing to export'); csvDownload('radio-report_' + $('#rpFrom').value + '_' + $('#rpTo').value + '.csv', ['time', 'title', 'artist', 'type', 'listeners', 'length', 'playlist'], rows.map(r => [r.time, r.title, r.artist, r.type, r.listeners, r.length, r.playlist])); };
  run();
}

// ---------------- PHASE 5: voice tracking ----------------
async function openVT(after){
  after = after || selOrCur();
  const f = after && findItem(after.uid); const tab = f ? PL.tabs[f.t] : viewTab(); const i = f ? f.i : tab.items.length - 1;
  const prev = i > -1 ? tab.items[i] : null, next = tab.items.slice(i + 1).find(x => x.kind !== 'comment');
  let rec = null, chunks = [], blob = null, stream = null, t0 = 0, timer = null;
  big('Record voice track', `<div class="sub" style="font-size:12px;line-height:1.6">The voice track is recorded with MIC 1, saved on your computer (Radio\\data\\voicetracks) and placed between these two items. It overlaps the end of the previous track like a live DJ.</div>
  <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center">
  <div class="aux"><div class="lbl">PREVIOUS</div><div class="ell" style="font-weight:600">${esc(prev ? prev.title : '—')}</div><button class="btn sm" id="vtPrev" ${prev && prev.url ? '' : 'disabled'}>🎧 Hear the last 10 s</button></div>
  <div style="font-size:22px;color:var(--green)">●</div>
  <div class="aux"><div class="lbl">NEXT</div><div class="ell" style="font-weight:600">${esc(next ? next.title : '—')}</div><button class="btn sm" id="vtNext" ${next && next.url ? '' : 'disabled'}>🎧 Hear the first 10 s</button></div></div>
  <div style="display:flex;gap:8px;align-items:center"><button class="btn" id="vtRec" style="min-width:120px;justify-content:center">● Record</button><span class="mono" id="vtTime" style="font-size:22px">00:00</span><button class="btn sm" id="vtPlay" disabled>▶ Listen</button>
  <label for="vtName" class="sub" style="margin-left:auto">Name</label><input class="inp" id="vtName" value="VT ${new Date().toTimeString().slice(0, 5)}" style="width:200px"></div>`,
  [['Save & insert', async () => {
    if (!blob) return toast('Record something first');
    try { const name = $('#vtName').value.trim() || 'Voice track'; const r = await fetch('/api/upload?name=' + encodeURIComponent(name.replace(/[^\w\- ]/g, '_') + '.webm'), { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'audio/webm' }, body: blob });
      const d = await r.json(); if (!d.url) return toast('Upload failed');
      let dur = 0; try { dur = (await new OfflineAudioContext(1, 1, 11025).decodeAudioData(await blob.arrayBuffer())).duration; } catch(e){}
      const it = { uid: uidGen(), kind: 'track', url: d.url, title: name, artist: 'Voice track', ftype: 'Voice track', dur };
      tab.items.splice(i + 1, 0, it); afterChange(); closeModal('mBig'); toast('Voice track inserted');
    } catch(e){ toast('Server not running'); } }, true]]);
  const hear = (it, from) => prelisten(it).then(() => { if (from === 'end') { const d = itemDur(it) || pfl.duration || 0; pfl.currentTime = Math.max(0, d - 10); } else setTimeout(() => { if (pfl.src.includes(it.url)) { pfl.pause(); $('#pfl').style.display = 'none'; } }, 10000); });
  if (prev && prev.url) $('#vtPrev').onclick = () => hear(prev, 'end');
  if (next && next.url) $('#vtNext').onclick = () => hear(next, 'start');
  $('#vtPlay').onclick = () => { if (blob) { pfl.src = URL.createObjectURL(blob); pfl.play(); $('#pfl').style.display = 'flex'; $('#pflName').textContent = 'Voice track'; } };
  $('#vtRec').onclick = async () => {
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    try { const id = store.get('dev_mic1', ''); stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch(e){ return toast('MIC 1: cannot open the microphone'); }
    chunks = []; rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '' , audioBitsPerSecond: 160000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { blob = new Blob(chunks, { type: 'audio/webm' }); stream.getTracks().forEach(t => t.stop()); clearInterval(timer); $('#vtRec').textContent = '● Record again'; $('#vtRec').style.background = ''; $('#vtPlay').disabled = false; };
    rec.start(250); t0 = Date.now(); $('#vtRec').textContent = '■ Stop'; $('#vtRec').style.background = '#3A1416';
    timer = setInterval(() => { if ($('#vtTime')) $('#vtTime').textContent = fmt((Date.now() - t0) / 1000); }, 200);
  };
}

// ---------------- PHASE 5: AUX players ----------------
const AUX = [0, 1].map(n => { let s = {}; try { s = JSON.parse(store.get('aux' + n, '{}')); } catch(e){}
  return { n, items: s.items || [], idx: 0, onAir: !!s.onAir, loop: !!s.loop, vol: s.vol == null ? 80 : s.vol, dev: s.dev || '', audio: null, gain: null, playing: false }; });
function saveAux(a){ store.set('aux' + a.n, JSON.stringify({ items: a.items, onAir: a.onAir, loop: a.loop, vol: a.vol, dev: a.dev })); }
function renderAux(){
  $('#rAux').innerHTML = AUX.map(a => `<div class="aux" data-aux="${a.n}">
  <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:12px">AUX ${a.n + 1}</b><span class="tgl ${a.onAir ? 'on' : ''}" data-ax="air" title="On: mixed into the broadcast. Off: plays only on the chosen output."><b></b>On air</span><span class="tgl ${a.loop ? 'on' : ''}" data-ax="loop"><b></b>Loop</span></div>
  <div style="max-height:90px;overflow:auto">${a.items.length ? a.items.map((x, i) => `<div style="display:flex;gap:6px;align-items:center;font-size:12px;padding:2px 0;${a.playing && i === a.idx ? 'color:#7FE0B5;font-weight:700' : ''}"><span class="mono sub" style="width:16px">${i + 1}</span><span class="ell" style="flex:1">${esc(x.title)}</span><button class="ic" data-ax="rm" data-i="${i}" aria-label="Remove">✕</button></div>`).join('') : '<div class="sub" style="font-size:11.5px">Empty. Add the last library song or the selected playlist track.</div>'}</div>
  <div style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn sm" data-ax="addLib">+ Library</button><button class="btn sm" data-ax="addSel">+ Selected</button><button class="btn sm" data-ax="play">${a.playing ? '❚❚' : '▶'}</button><button class="btn sm" data-ax="stop">■</button><button class="btn sm" data-ax="next">⏭</button></div>
  <div style="display:flex;gap:6px;align-items:center"><span class="lbl">VOL</span><input type="range" class="gray" min="0" max="100" value="${a.vol}" data-ax="vol" style="flex:1;--c:#2D8CEB;--p:${a.vol}%" aria-label="AUX volume"></div>
  ${a.onAir ? '' : `<select class="inp" data-ax="dev" style="height:26px" aria-label="AUX output"><option value="">Default output</option></select>`}</div>`).join('');
  navigator.mediaDevices && navigator.mediaDevices.enumerateDevices().then(devs => { $$('#rAux [data-ax="dev"]').forEach(sel => { const a = AUX[+sel.closest('[data-aux]').dataset.aux];
    sel.innerHTML = '<option value="">Default output</option>' + devs.filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default').map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Output ' + (i + 1))}</option>`).join(''); sel.value = a.dev; }); }).catch(() => {});
}
function auxStop(a){ if (a.audio) { a.audio.onended = null; a.audio.pause(); a.audio = null; } if (a.gain) { try { a.gain.disconnect(); } catch(e){} a.gain = null; } a.playing = false; }
async function auxPlay(a){
  auxStop(a); const it = a.items[a.idx]; if (!it) return renderAux();
  const au = new Audio(it.url); au.volume = a.onAir ? 1 : a.vol / 100;
  if (a.onAir) { if (!ctx) return toast('Start the studio first'); const src = ctx.createMediaElementSource(au); a.gain = ctx.createGain(); a.gain.gain.value = a.vol / 100; src.connect(a.gain); a.gain.connect(cartBus); }
  else if (a.dev && au.setSinkId) { try { await au.setSinkId(a.dev); } catch(e){} }
  au.onended = () => { a.idx++; if (a.idx >= a.items.length) { if (a.loop) a.idx = 0; else { a.idx = 0; a.playing = false; a.audio = null; return renderAux(); } } auxPlay(a); };
  a.audio = au; try { await au.play(); a.playing = true; } catch(e){ toast('AUX ' + (a.n + 1) + ': cannot play ' + it.title); } renderAux();
}
$('#rAux').addEventListener('click', e => { const b = e.target.closest('[data-ax]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return; const a = AUX[+b.closest('[data-aux]').dataset.aux];
  const add = x => { if (x && x.url) { a.items.push({ title: x.title, url: x.url }); saveAux(a); renderAux(); } else toast('Choose a track first'); };
  switch (b.dataset.ax) {
    case 'air': auxStop(a); a.onAir = !a.onAir; saveAux(a); renderAux(); break;
    case 'loop': a.loop = !a.loop; saveAux(a); renderAux(); break;
    case 'rm': a.items.splice(+b.dataset.i, 1); if (a.idx >= a.items.length) a.idx = 0; saveAux(a); renderAux(); break;
    case 'addLib': add(lastLibId && libById.get(lastLibId)); break;
    case 'addSel': add(selOrCur()); break;
    case 'play': if (a.audio && a.playing) { a.audio.pause(); a.playing = false; renderAux(); } else if (a.audio) { a.audio.play(); a.playing = true; renderAux(); } else auxPlay(a); break;
    case 'stop': auxStop(a); a.idx = 0; renderAux(); break;
    case 'next': a.idx = (a.idx + 1) % Math.max(1, a.items.length); auxPlay(a); break;
  } });
$('#rAux').addEventListener('input', e => { const b = e.target.closest('[data-ax="vol"]'); if (!b) return; const a = AUX[+b.closest('[data-aux]').dataset.aux]; a.vol = +b.value; b.style.setProperty('--p', a.vol + '%');
  if (a.gain && ctx) a.gain.gain.setTargetAtTime(a.vol / 100, ctx.currentTime, 0.03); else if (a.audio) a.audio.volume = a.vol / 100; saveAux(a); });
$('#rAux').addEventListener('change', e => { const b = e.target.closest('[data-ax="dev"]'); if (!b) return; const a = AUX[+b.closest('[data-aux]').dataset.aux]; a.dev = b.value; saveAux(a); if (a.audio && a.audio.setSinkId) a.audio.setSinkId(a.dev).catch(() => {}); });

// ---------------- PHASE 5: remote control ----------------
async function remoteTick(){ try { const r = await api('/api/remote'); if (!r.ok) return; const d = await r.json(); (d.cmds || []).forEach(runRemote); } catch(e){} }
function runRemote(c){
  const [k, ...a] = String(c).trim().split(/\s+/); toast('Remote: ' + c);
  switch (k) {
    case 'play': $('#bPlay').onclick(); break; case 'pause': $('#bPause').onclick(); break; case 'stop': stopAll(0.4); break; case 'next': $('#bNext').onclick(); break;
    case 'golive': if (!live) goLive(true); break; case 'stoplive': if (live) goLive(false); break;
    case 'ads': adBreak(); break; case 'time': case 'weather': announce(k).then(it => it && placeItems([it], 'next')); break;
    case 'cart': playCart(Math.max(0, (+a[0] || 1) - 1)); break; case 'mic1': toggleMicN(0); break; case 'mic2': toggleMicN(1); break;
    case 'vol': $('#plVol').value = Math.max(0, Math.min(100, +a[0] || 0)); $('#plVol').oninput(); break;
  }
}

// ---------------- backup / restore ----------------
$('#fRestore').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text());
    if (d.fileTypes) { FT = d.fileTypes; store.set('fileTypes', JSON.stringify(FT)); } if (d.xf) { XF = d.xf; store.set('xfMain', JSON.stringify(XF)); }
    if (d.cart) { CART = d.cart; saveCart(); renderCart(); } if (d.duck) store.set('duckDb', d.duck);
    if (d.schedule) { SCH = d.schedule; saveSch(); } if (d.ads) { ADS = Object.assign(ADS, d.ads); dsSave('ads', ADS); renderAdCard(); }
    if (d.trackmeta) { TM = d.trackmeta; dsSave('trackmeta', TM); } if (d.hotkeys) { HK = Object.assign({}, HK_DEF, d.hotkeys); saveHK(); } if (d.micComp) { MC = d.micComp; saveMC(); inputs.forEach(applyMC); syncCmpBtns(); renderMC(); } if (d.generator) { GENT = d.generator; dsSave('generator', GENT); }
    if (d.playlists && d.playlists.tabs) { PL.tabs = d.playlists.tabs.map(t => Object.assign(newTab(t.name), t)); PL.view = 0; PL.active = 0; renderTabs(); }
    afterChange(); toast('Settings restored'); } catch(err){ toast('This is not an OAB Studio backup file'); } };

Object.assign(ACT, {
  genPro: () => openGen(), adsSched: () => openAds(), adBreakNow: () => adBreak(), reports: () => openReports(''), ttsTool: () => openTts(),
  voiceTrack: () => openVT(), trackEdit: () => openTrackEditor(selOrCur()),
  annTime: async () => { const it = await announce('time'); if (it) placeItems([it], 'next'); },
  annWeather: async () => { const it = await announce('weather'); if (it) placeItems([it], 'next'); },
  remoteInfo: () => { $('#miH').textContent = 'Remote control'; $('#miBody').innerHTML = `Open <b class="mono">http://YOUR-PC-IP:${location.port || 80}/remote</b> on your phone (same Wi-Fi), or <b class="mono">/remote</b> on the public link.<br>Buttons: Play, Next, Stop, MIC, jingles 1–10, ad break, time, broadcast on / off.<br>It uses the broadcast password.`; openModal('mInfo'); },
  restoreBackup: () => $('#fRestore').click(),
  settingsBackup: () => { const data = { version: 2, playlists: serial(), fileTypes: FT, xf: XF, cart: CART, duck: store.get('duckDb', '14'), schedule: SCH, ads: ADS, trackmeta: TM, generator: GENT, hotkeys: JSON.parse(store.get('hotkeys', '{}')), micComp: MC };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = 'oab-studio-backup_' + today() + '.json'; a.click(); },
});


// ---------------- listener links (home network + internet) ----------------
let LINKS = { lan: '', pub: null };
const bestLink = () => LINKS.pub && LINKS.pub.state === 'on' && LINKS.pub.url ? LINKS.pub.url + '/' : (LINKS.lan || location.origin + '/');
function showLinks(s){
  LINKS.lan = s.lan || ''; LINKS.pub = s.public || null;
  $('#lisLink').textContent = bestLink();
  if ($('#mInfo').classList.contains('on') && $('#miH').textContent === 'Links for listeners') renderLinks();
}
function copyTxt(t){ navigator.clipboard.writeText(t).then(() => toast('Copied: ' + t), () => { prompt('Copy this link:', t); }); }
$('#lisCopy').onclick = () => copyTxt(bestLink());
$('#lisLink').onclick = () => copyTxt(bestLink());
function renderLinks(){
  const p = LINKS.pub || { state: 'off' }; const on = p.state === 'on' && p.url;
  const row = (title, url, note) => `<div class="aux" style="margin-bottom:10px"><div class="lbl">${title}</div>${url ? `<div class="mono" style="font-size:14px;color:#8CC2FF;word-break:break-all;margin:4px 0">${esc(url)}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${/^(FOR EVERYONE|FOR PHONES)/.test(title) ? `<button class="btn sm" data-wa="${esc(url)}" style="background:#1F8F4E;border-color:#25D366;color:#fff">Share on WhatsApp</button><button class="btn sm" data-wacopy="${esc(url)}">Copy WhatsApp message</button>` : ''}<button class="btn sm" data-cp="${esc(url)}">Copy link</button><a class="btn sm" href="${esc(url)}" target="_blank" style="color:var(--txt);text-decoration:none">Open</a></div>` : ''}<div class="sub" style="font-size:11.5px;margin-top:4px">${note}</div></div>`;
  $('#miBody').innerHTML =
    row('FOR EVERYONE ON THE INTERNET', on ? p.url + '/' : '', on ? 'Send this link to your listeners (WhatsApp, Facebook…). It changes every time the server restarts.' :
      (p.state === 'error' ? 'Error: ' + esc(p.error || '') + '<br>' : p.state === 'off' ? 'Not created yet. ' : 'Creating the link… (the first time downloads about 30 MB)<br>') + 'Press the button to create a link anyone can open.') +
    `<button class="btn ${on ? '' : 'pri'}" id="lkPub" style="width:100%;justify-content:center;margin-bottom:12px">${on || p.state === 'starting' || p.state === 'downloading' ? 'Close internet link' : 'Create internet link'}</button>` +
    row('FOR PHONES ON YOUR HOME WI-FI', LINKS.lan, 'Works only for devices connected to the same Wi-Fi as this computer.') +
    (on ? row('PHONE BROADCAST APP (INTERNET)', p.url + '/mobile', 'Broadcast from your phone from anywhere (uses the broadcast password).') + row('REMOTE CONTROL (INTERNET)', p.url + '/remote', 'Control the studio from your phone.') :
      row('PHONE BROADCAST APP (HOME WI-FI)', LINKS.lan ? LINKS.lan + 'mobile' : '', 'Broadcast from your phone.') + row('REMOTE CONTROL (HOME WI-FI)', LINKS.lan ? LINKS.lan + 'remote' : '', 'Control the studio from your phone.'));
  $('#lkPub').onclick = () => $('#pubBtn').click();
  $$('#miBody [data-wa]').forEach(b => b.onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent('מחכים לכם, האזינו לשידור:\n' + b.dataset.wa + 'listen'), '_blank'));
  $$('#miBody [data-wacopy]').forEach(b => b.onclick = () => copyTxt('מחכים לכם, האזינו לשידור:\n' + b.dataset.wacopy + 'listen'));
}
$('#miBody').addEventListener('click', e => { const b = e.target.closest('[data-cp]'); if (b) copyTxt(b.dataset.cp); });
function openLinks(){ $('#miH').textContent = 'Links for listeners'; renderLinks(); openModal('mInfo'); }
$('#linkBtn').onclick = openLinks; $('#lisMore').onclick = openLinks;
ACT.public = openLinks;

// ---------------- fit everything on any screen (no hidden parts) ----------------
function fitScreen(){
  const z = Math.min(1, innerWidth / 1366, innerHeight / 800);
  window.UIZ = z; document.documentElement.style.zoom = z < 0.995 ? String(z) : ''; document.documentElement.style.setProperty('--uiz', z < 0.995 ? String(z) : '1');
}
addEventListener('resize', fitScreen); fitScreen();


// ---------------- YouTube link -> song in the playlist ----------------
async function addYt(url, where, hint){
  url = String(url || '').trim();
  if (!YT_RE.test(url)) return toast('This is not a YouTube song link');
  let d;
  try { const r = await api('/api/yt/add', { url }); if (r.status === 401) return toast('Wrong password (Settings → Options)'); d = await r.json(); if (!d.job) return toast(d.error || 'Could not add this link'); }
  catch(e){ return toast('Server not running'); }
  const it = { uid: uidGen(), kind: 'dl', job: d.job, ytUrl: url, ytTitle: hint || '', title: 'YouTube song', prog: 0 };
  if (where === 'next') insertAfterPlaying([it]); else addToView([it]);
  ytPoll();
}
let ytPollT = null;
function ytPending(){ const out = []; PL.tabs.forEach(t => t.items.forEach(x => { if (x.kind === 'dl' && !x.dlErr) out.push(x); })); return out; }
let ytBusy = false;
async function ytPoll(){
  clearTimeout(ytPollT); if (ytBusy) { ytPollT = setTimeout(ytPoll, 300); return; }
  const list = ytPending(); if (!list.length) return; ytBusy = true;
  let saved = false, redraw = false;
  for (const it of list) {
    try { const j = await (await api('/api/yt/job?id=' + encodeURIComponent(it.job))).json();
      if (it.kind !== 'dl') continue;
      if (j.state === 'done' && j.item) {
        const li = libItem(j.item, 'music'); if (!library.some(x => x.id === li.id)) { library.push(li); renderLib(); }
        const uid = it.uid; Object.keys(it).forEach(k => delete it[k]); Object.assign(it, fromLib(li)); it.uid = uid;
        toast((j.note ? j.note + ': ' : 'Ready: ') + (li.artist ? li.artist + ' – ' : '') + li.title); analyze(it); saved = true;
      } else if (j.state === 'error') { it.dlErr = j.error || 'failed'; toast('YouTube: ' + it.dlErr); saved = true; }
      else { const st = { 'preparing-js': 'getting the YouTube helper (first time, ~40 MB)…', preparing: 'getting the downloader (first time)…', updating: 'updating the downloader…', converting: 'converting…', queued: 'waiting…' }[j.state] || '';
        if (j.progress !== it.prog || st !== it.st) { it.prog = j.progress || 0; it.st = st; redraw = true; } }
    } catch(e){}
  }
  ytBusy = false;
  if (saved) afterChange(); else if (redraw) renderPlaylist();
  ytPollT = setTimeout(ytPoll, 1000);
}
document.addEventListener('paste', e => {
  if (e.target.matches && e.target.matches('input,textarea,select')) return;
  const t = ((e.clipboardData || window.clipboardData).getData('text') || '').trim();
  const links = ytLinks(t); if (links.length) { e.preventDefault(); addYtMany(links, 'end'); }
});
async function ytRetry(it){
  try { const r = await api('/api/yt/add', { url: it.ytUrl }); const d = await r.json(); if (!d.job) return toast(d.error || 'Could not retry');
    it.job = d.job; delete it.dlErr; it.prog = 0; it.st = 'waiting…'; renderPlaylist(); ytPoll(); toast('Trying again…'); } catch(e){ toast('Server not running'); }
}
// several links at once (form with 5 boxes; a box may also hold several links)
function ytLinks(text){ return String(text || '').split(/[\s,]+/).map(x => x.trim()).filter(x => YT_RE.test(x)); }
async function addYtMany(links, where){
  links = [...new Set(links)]; if (!links.length) return toast('No YouTube links found');
  if (where === 'next') links = links.slice().reverse();          // keep their order after the playing track
  for (const u of links) await addYt(u, where);
  if (links.length > 1) toast(links.length + ' YouTube songs are downloading');
}
ACT.addYt = () => form('Add songs from YouTube', [1, 2, 3, 4, 5].map(n => ({ k: 'url' + n, l: 'YouTube link ' + n, ph: n === 1 ? 'https://www.youtube.com/watch?v=…' : '(optional)' }))
  .concat([{ k: 'where', l: 'Put them', v: 'end', opts: [['end', 'At the end of the playlist'], ['next', 'Right after the playing track']] }]),
  o => addYtMany(ytLinks([1, 2, 3, 4, 5].map(n => o['url' + n]).join(' ')), o.where),
  'Each song is downloaded to your music folder (YouTube folder). Tip: copy links and press Ctrl+V anywhere in the studio.');

// song requests: "Find" opens the song on YouTube
function openOnYoutube(song){
  const w = window.open('about:blank', '_blank');           // open now, so the browser does not block it
  const results = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(song);
  fetch('/api/search?src=youtube&q=' + encodeURIComponent(song)).then(r => r.json()).then(d => {
    const v = (d.items || []).find(x => x.videoId);
    if (w) w.location.href = v ? 'https://www.youtube.com/watch?v=' + v.videoId : results;
  }).catch(() => { if (w) w.location.href = results; });
  if (!w) window.open(results, '_blank');
}
$('#reqList').onclick = e => { const b = e.target.closest('[data-song]'); if (b) openOnYoutube(b.dataset.song); };
$('#reqModal').onclick = e => { if (e.target.id === 'reqModal') $('#reqModal').classList.remove('on'); const b = e.target.closest('[data-song]'); if (b) openOnYoutube(b.dataset.song); };
setTimeout(ytPoll, 2500);


// ---------------- meters: stereo LED bar (program) + analog VU for each microphone ----------------
const MTR = { L: null, R: null, buf: null, lv: [-90, -90], pk: [-90, -90], pkT: [0, 0], clip: [0, 0], last: performance.now(), vu: [{ pos: 0, peakT: 0 }, { pos: 0, peakT: 0 }], vbuf: null };
function buildMeters(){
  const sp = ctx.createChannelSplitter(2); masterOut.connect(sp);
  MTR.L = ctx.createAnalyser(); MTR.R = ctx.createAnalyser(); MTR.L.fftSize = MTR.R.fftSize = 2048;
  sp.connect(MTR.L, 0); sp.connect(MTR.R, 1); MTR.buf = new Float32Array(2048); MTR.vbuf = new Float32Array(2048);
}
function fitCanvas(c){ const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1; const w = Math.max(10, Math.round(r.width * d)), h = Math.max(10, Math.round(r.height * d)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return [w, h, d]; }
function peakDb(an){ an.getFloatTimeDomainData(MTR.buf); let p = 0; for (let i = 0; i < MTR.buf.length; i++) { const a = Math.abs(MTR.buf[i]); if (a > p) p = a; } return p > 0 ? 20 * Math.log10(p) : -90; }
const LED_MIN = -48, LED_MAX = 3;
function drawLed(dt){
  const c = $('#ledM'); if (!c) return; const [W, H, d] = fitCanvas(c); const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const now = performance.now();
  [MTR.L, MTR.R].forEach((an, ch) => {
    const db = an ? peakDb(an) : -90;
    MTR.lv[ch] = db > MTR.lv[ch] ? db : Math.max(db, MTR.lv[ch] - 26 * dt);            // instant attack, 26 dB/s release
    if (db >= MTR.pk[ch] || now - MTR.pkT[ch] > 1500) { if (db >= MTR.pk[ch]) { MTR.pk[ch] = db; MTR.pkT[ch] = now; } else MTR.pk[ch] = Math.max(MTR.lv[ch], MTR.pk[ch] - 18 * dt); }
    if (db > -0.3) MTR.clip[ch] = now;
  });
  const labH = 10 * d, rowH = (H - labH - 3 * d) / 2, seg = 5 * d, gap = 2 * d, n = Math.floor((W + gap) / (seg + gap)), sw = (W - gap * (n - 1)) / n;
  const pos = db => (Math.min(LED_MAX, Math.max(LED_MIN, db)) - LED_MIN) / (LED_MAX - LED_MIN);
  for (let ch = 0; ch < 2; ch++) {
    const y = ch * (rowH + 3 * d), lit = Math.round(pos(MTR.lv[ch]) * n), pki = Math.min(n - 1, Math.round(pos(MTR.pk[ch]) * n) - 1);
    for (let i = 0; i < n; i++) {
      const dbAt = LED_MIN + (i + 0.5) / n * (LED_MAX - LED_MIN); const z = dbAt >= -3 ? 2 : dbAt >= -12 ? 1 : 0;
      const on = i < lit || (i === pki && MTR.pk[ch] > LED_MIN + 1);
      g.fillStyle = on ? ['#22C55E', '#F5A524', '#F04444'][z] : [TC('#10251A'), TC('#2A2210'), TC('#2C1214')][z];
      g.fillRect(i * (sw + gap), y, sw, rowH);
      if (on) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * (sw + gap), y, sw, Math.max(1, rowH * 0.28)); }
    }
  }
  g.fillStyle = TC('#6B7280'); g.font = (9 * d) + 'px JetBrains Mono, monospace'; g.textBaseline = 'bottom';
  [-48, -40, -30, -24, -18, -12, -9, -6, -3, 0, 3].forEach(v => { const x = pos(v) * W; g.fillStyle = v >= -3 ? '#F08080' : v >= -12 ? '#D9B15A' : TC('#6B7280'); const t = v > 0 ? '+' + v : String(v); const tw = g.measureText(t).width; g.fillText(t, Math.min(W - tw, Math.max(0, x - tw / 2)), H); });
  const top = Math.max(MTR.pk[0], MTR.pk[1]); const el = $('#ledDb');
  const clipNow = now - Math.max(MTR.clip[0], MTR.clip[1]) < 1200;
  el.textContent = clipNow ? 'CLIP' : top <= -60 ? '−∞ dB' : (top > 0 ? '+' : '') + top.toFixed(1) + ' dB'; el.style.color = clipNow ? '#F04444' : top > -3 ? '#F5A524' : '';
}
// meter on the playing playlist row (View → Playlist meter style)
const RM_STYLES = ['Lime spectrum', 'LED spectrum', 'Peak caps', 'Mirror spectrum', 'Rainbow spectrum', 'Stereo LED bars', 'Horizontal stereo', 'Scope line'];
let RM = Math.min(RM_STYLES.length - 1, Math.max(0, +store.get('rmStyle', '0') || 0));
const RSP = { an: null, buf: null, tb: null, h: [0, 0, 0, 0, 0, 0], p: [0, 0, 0, 0, 0, 0], pT: [0, 0, 0, 0, 0, 0] };
function rmLevels(dt, live){
  const edges = [40, 120, 300, 800, 2000, 5000, 14000], now = performance.now();
  if (live) RSP.an.getByteFrequencyData(RSP.buf);
  const hz = ctx.sampleRate / 2 / RSP.buf.length;
  for (let k = 0; k < 6; k++) {
    let v = 0;
    if (live) { const a = Math.max(1, Math.floor(edges[k] / hz)), b = Math.max(a + 1, Math.ceil(edges[k + 1] / hz)); let m = 0; for (let i = a; i < b && i < RSP.buf.length; i++) m = Math.max(m, RSP.buf[i]); v = Math.max(0, (m - 70) / 175); }
    RSP.h[k] = v > RSP.h[k] ? v : Math.max(v, RSP.h[k] - 2.2 * dt);
    if (RSP.h[k] >= RSP.p[k]) { RSP.p[k] = RSP.h[k]; RSP.pT[k] = now; } else if (now - RSP.pT[k] > 400) RSP.p[k] = Math.max(RSP.h[k], RSP.p[k] - 0.9 * dt);
  }
}
function drawRowMeter(dt){
  dt = dt || 0.016;
  const c = document.querySelector('#plBody .plr.playing canvas.rowM'); if (!c) return;
  if (!RSP.an && typeof ctx !== 'undefined' && ctx && masterOut) { RSP.an = ctx.createAnalyser(); RSP.an.fftSize = 1024; RSP.an.smoothingTimeConstant = 0.55; masterOut.connect(RSP.an); RSP.buf = new Uint8Array(RSP.an.frequencyBinCount); RSP.tb = new Uint8Array(RSP.an.fftSize); }
  if (!RSP.an) return;
  const [W, H, d] = fitCanvas(c); const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const live = !!(curDeck && !curDeck.audio.paused);
  rmLevels(dt, live);
  const n = 6, gap = Math.max(1, Math.round(d)), bw = (W - gap * (n - 1)) / n, X = k => Math.round(k * (bw + gap)), BW = Math.ceil(bw);
  const minH = live ? 2 * d : 0, LIME = '#9BE81C';
  const zc = f => f > 0.85 ? '#F04444' : f > 0.62 ? '#F5A524' : '#22C55E';
  if (RM === 0) { for (let k = 0; k < n; k++) { const bh = Math.max(minH, Math.round(RSP.h[k] * H)); g.fillStyle = LIME; g.fillRect(X(k), H - bh, BW, bh); } }
  else if (RM === 1) { const segs = 6, sg = Math.max(1, Math.round(d)), sh = (H - sg * (segs - 1)) / segs;
    for (let k = 0; k < n; k++) { const lit = Math.round(RSP.h[k] * segs) || (live ? 1 : 0); for (let s = 0; s < lit; s++) { g.fillStyle = zc((s + 1) / segs); g.fillRect(X(k), Math.round(H - (s + 1) * sh - s * sg), BW, Math.ceil(sh)); } } }
  else if (RM === 2) { for (let k = 0; k < n; k++) { const bh = Math.max(minH, Math.round(RSP.h[k] * (H - 3 * d))); g.fillStyle = '#2D8CEB'; g.fillRect(X(k), H - bh, BW, bh); if (live) { g.fillStyle = TC('#FFFFFF'); g.fillRect(X(k), Math.round(H - RSP.p[k] * (H - 3 * d) - 2 * d), BW, Math.max(1, Math.round(1.5 * d))); } } }
  else if (RM === 3) { const mid = H / 2; for (let k = 0; k < n; k++) { const bh = Math.max(live ? d : 0, Math.round(RSP.h[k] * H / 2)); g.fillStyle = '#22D3EE'; g.fillRect(X(k), mid - bh, BW, bh * 2); } }
  else if (RM === 4) { const cols = ['#F04444', '#F59E0B', '#FACC15', '#22C55E', '#2D8CEB', '#A855F7']; for (let k = 0; k < n; k++) { const bh = Math.max(minH, Math.round(RSP.h[k] * H)); g.fillStyle = cols[k]; g.fillRect(X(k), H - bh, BW, bh); } }
  else if (RM === 5 || RM === 6) {
    const pos = db => (Math.min(LED_MAX, Math.max(LED_MIN, db)) - LED_MIN) / (LED_MAX - LED_MIN);
    const segs = RM === 5 ? 7 : 10, sg = Math.max(1, Math.round(d));
    for (let ch = 0; ch < 2; ch++) { const f = live ? pos(MTR.lv[ch]) : 0, lit = Math.round(f * segs);
      for (let s = 0; s < segs; s++) { const on = s < lit, col = s >= segs - 1 ? '#F04444' : s >= segs - 3 ? '#F5A524' : '#22C55E'; g.fillStyle = on ? col : (LT() ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)');
        if (RM === 5) { const bw2 = (W - 3 * d) / 2, sh = (H - sg * (segs - 1)) / segs; g.fillRect(Math.round(ch * (bw2 + 3 * d)), Math.round(H - (s + 1) * sh - s * sg), Math.ceil(bw2), Math.ceil(sh)); }
        else { const rh = (H - 3 * d) / 2, sw = (W - sg * (segs - 1)) / segs; g.fillRect(Math.round(s * (sw + sg)), Math.round(H / 2 - rh - 1.5 * d + ch * (rh + 3 * d)), Math.ceil(sw), Math.ceil(rh)); } } } }
  else if (RM === 7) { g.strokeStyle = LIME; g.lineWidth = 1.5 * d; g.lineJoin = 'round'; g.beginPath();
    if (live) RSP.an.getByteTimeDomainData(RSP.tb); const N = 48;
    for (let i = 0; i <= N; i++) { const v = live ? (RSP.tb[Math.floor(i / N * (RSP.tb.length - 1) * 0.25)] - 128) / 128 : 0; const y = H / 2 - Math.max(-1, Math.min(1, v * 1.6)) * (H / 2 - d); i ? g.lineTo(i / N * W, y) : g.moveTo(0, y); }
    g.stroke(); }
}
function setRm(i){ RM = i; store.set('rmStyle', String(i)); syncRm(); toast('Playlist meter: ' + RM_STYLES[i]); }
function syncRm(){ $$('.dd [data-a^="rm"]').forEach(el => { const k = +el.dataset.a.slice(2); if (!isNaN(k)) el.classList.toggle('on', k === RM); }); }
RM_STYLES.forEach((n, i) => ACT['rm' + i] = () => setRm(i));
setTimeout(syncRm, 0);
// analog VU: 0 VU = −18 dBFS RMS, ~300 ms needle, scale linear in voltage like a real VU.
// Works only while the microphone button is on (lamp on); otherwise the needle rests and the lamp is off.
const VU_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const vuP = vu => (Math.pow(10, Math.max(-25, Math.min(3.5, vu)) / 20) - Math.pow(10, -1)) / (Math.pow(10, 3 / 20) - Math.pow(10, -1));
function drawVu(idx, dt){
  const c = $('#vu' + (idx + 1)); if (!c) return; const [W, H, d] = fitCanvas(c); const g = c.getContext('2d');
  const inp = inputs[idx], st = MTR.vu[idx]; let rms = 0, pk = 0; const active = !!(ctx && inp.chain && inp.on);
  if (active) {
    if (inp._tap !== inp.chain.level) { inp._an = ctx.createAnalyser(); inp._an.fftSize = 2048; inp.chain.level.connect(inp._an); inp._tap = inp.chain.level; }
    inp._an.getFloatTimeDomainData(MTR.vbuf); let s2 = 0; for (let i = 0; i < MTR.vbuf.length; i++) { const v = MTR.vbuf[i]; s2 += v * v; const a = Math.abs(v); if (a > pk) pk = a; }
    rms = Math.sqrt(s2 / MTR.vbuf.length);
  }
  const target = active && rms > 0 ? Math.max(-0.1, vuP(20 * Math.log10(rms) + 18)) : -0.1;
  st.pos += (target - st.pos) * (1 - Math.exp(-dt / 0.065)); { const mb = $('#mic' + (idx + 1)); if (mb) mb.style.setProperty('--lv', active ? Math.max(0, Math.min(1, st.pos)).toFixed(3) : '0'); } if (active && pk > 0.708) st.peakT = performance.now();
  st.lamp = (st.lamp || 0) + ((active ? 1 : 0) - (st.lamp || 0)) * (1 - Math.exp(-dt / 0.12));   // lamp fades in / out
  const L = st.lamp;
  g.clearRect(0, 0, W, H);
  // whole meter, centred, fixed proportions (nothing is cut)
  const mw = W / H > 1.62 ? H * 1.62 : W, mh = W / H > 1.62 ? H : Math.min(H, W / 1.42), x0 = (W - mw) / 2, y0 = (H - mh) / 2;
  const bz = Math.max(3 * d, mh * 0.075), fx = x0 + bz, fy = y0 + bz, fw = mw - 2 * bz, fh = mh - 2 * bz, rr = 5 * d;
  // bezel
  let gr = g.createLinearGradient(0, y0, 0, y0 + mh); gr.addColorStop(0, '#3A3D45'); gr.addColorStop(0.5, '#1C1E23'); gr.addColorStop(1, '#0E0F12');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x0, y0, mw, mh, rr + 2 * d); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = d; g.beginPath(); g.roundRect(x0 + 0.5 * d, y0 + 0.5 * d, mw - d, mh - d, rr + 2 * d); g.stroke();
  // face (lit by the lamp)
  g.save(); g.beginPath(); g.roundRect(fx, fy, fw, fh, rr); g.clip();
  const mix = (a, b) => a.map((v, i) => Math.round(b[i] + (v - b[i]) * L));
  const top = mix([250, 238, 204], [74, 70, 58]), bot = mix([226, 205, 150], [52, 49, 41]);
  gr = g.createLinearGradient(0, fy, 0, fy + fh); gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`); g.fillStyle = gr; g.fillRect(fx, fy, fw, fh);
  if (L > 0.02) { const lg = g.createRadialGradient(fx + fw / 2, fy, 0, fx + fw / 2, fy, fh * 1.1); lg.addColorStop(0, `rgba(255,214,140,${0.55 * L})`); lg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = lg; g.fillRect(fx, fy, fw, fh); }
  const ink = L > 0.5 ? '#2A2215' : '#9A927C', red = L > 0.5 ? '#C8302C' : '#8C5650';
  const cx = fx + fw / 2, cy = fy + fh * 1.16, R = fh * 0.92, a0 = -0.74, a1 = 0.74, ang = p => -Math.PI / 2 + a0 + p * (a1 - a0);
  g.lineCap = 'butt';
  g.strokeStyle = ink; g.lineWidth = Math.max(1.2, 1.1 * d); g.beginPath(); g.arc(cx, cy, R, ang(0), ang(vuP(0))); g.stroke();
  g.strokeStyle = red; g.lineWidth = 2.6 * d; g.beginPath(); g.arc(cx, cy, R + 1.2 * d, ang(vuP(0)), ang(1)); g.stroke();
  const small = fh < 52 * d, fs = Math.max(7 * d, fh * 0.13);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(fs)}px Inter, Arial, sans-serif`;
  VU_MARKS.forEach(m => { const a = ang(vuP(m)), big = [-20, -10, -5, 0, 3].includes(m), len = (big ? 5 : 3) * d;
    g.strokeStyle = m > 0 ? red : ink; g.lineWidth = Math.max(1.2, 1.1 * d);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len)); g.stroke();
    if (big) { g.fillStyle = m > 0 ? red : ink; g.fillText(String(Math.abs(m)), cx + Math.cos(a) * (R - fs * 0.95), cy + Math.sin(a) * (R - fs * 0.95)); } });
  g.font = `600 ${fs * 0.95}px Inter, sans-serif`; g.fillStyle = ink; g.fillText('−', cx + Math.cos(ang(0)) * (R + 3 * d) - 7 * d, cy + Math.sin(ang(0)) * (R + 3 * d) - 5 * d);
  g.fillStyle = red; g.fillText('+', cx + Math.cos(ang(1)) * (R + 3 * d) + 5 * d, cy + Math.sin(ang(1)) * (R + 3 * d) - 4 * d);
  g.fillStyle = ink; g.font = `700 ${fs * 1.15}px Inter, sans-serif`; g.fillText('VU', cx, fy + fh * 0.6);
  // thin needle with counterweight, coming out from under the cover plate
  const na = ang(Math.max(-0.1, Math.min(1.1, st.pos)));
  g.strokeStyle = '#101010'; g.lineWidth = Math.max(1.2, 1.0 * d); g.beginPath();
  g.moveTo(cx + Math.cos(na) * R * 0.45, cy + Math.sin(na) * R * 0.45); g.lineTo(cx + Math.cos(na) * (R + 4 * d), cy + Math.sin(na) * (R + 4 * d)); g.stroke();
  // cover plate over the pivot
  gr = g.createLinearGradient(0, fy + fh * 0.76, 0, fy + fh); gr.addColorStop(0, '#2B2C30'); gr.addColorStop(1, '#151618');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, fy + fh * 1.02, fw * 0.24, fh * 0.24, 0, Math.PI, 0); g.fill();
  // peak LED
  const hot = active && performance.now() - st.peakT < 900;
  g.fillStyle = hot ? '#FF3B30' : '#5A2020'; g.beginPath(); g.arc(fx + fw - 6 * d, fy + 6 * d, 2.2 * d, 0, Math.PI * 2); g.fill();
  if (hot) { g.fillStyle = 'rgba(255,59,48,.35)'; g.beginPath(); g.arc(fx + fw - 6 * d, fy + 6 * d, 5 * d, 0, Math.PI * 2); g.fill(); }
  // small lamp inside the glass, top centre
  const bx = cx, by = fy + 3.2 * d;
  if (L > 0.02) { const bg = g.createRadialGradient(bx, by, 0, bx, by, 16 * d); bg.addColorStop(0, `rgba(255,196,110,${0.95 * L})`); bg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 16 * d, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = L > 0.5 ? '#FFE3A0' : '#6E6A60'; g.beginPath(); g.ellipse(bx, by, 4 * d, 2 * d, 0, 0, Math.PI * 2); g.fill(); if (L > 0.5) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(bx, by, 1.8 * d, 0.8 * d, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6 * d; g.stroke();
  // glass cover: inner shadow, reflections
  const sh = g.createLinearGradient(0, fy, 0, fy + 6 * d); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(fx, fy, fw, 6 * d);
  const gl = g.createLinearGradient(fx, fy, fx + fw * 0.55, fy + fh); gl.addColorStop(0, 'rgba(255,255,255,.34)'); gl.addColorStop(0.32, 'rgba(255,255,255,.08)'); gl.addColorStop(0.33, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(fx, fy, fw, fh);
  g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(fx + fw * 0.62, fy); g.lineTo(fx + fw * 0.74, fy); g.lineTo(fx + fw * 0.52, fy + fh); g.lineTo(fx + fw * 0.40, fy + fh); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = d; g.beginPath(); g.roundRect(fx, fy, fw, fh, rr); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 0.7 * d; g.beginPath(); g.roundRect(fx + d, fy + d, fw - 2 * d, fh - 2 * d, rr - d); g.stroke();
}
(function meterLoop(){
  const now = performance.now(), dt = Math.min(0.1, (now - MTR.last) / 1000); MTR.last = now;
  try { drawLed(dt); drawRowMeter(dt); drawVu(0, dt); drawVu(1, dt); } catch(e){}
  requestAnimationFrame(meterLoop);
})();
// mic settings pop-up
$('#micSet').onclick = e => { e.stopPropagation(); $('#micPop').classList.toggle('on'); $('#micSet').classList.toggle('on', $('#micPop').classList.contains('on')); };
$('#micPopX').onclick = () => { $('#micPop').classList.remove('on'); $('#micSet').classList.remove('on'); };
document.addEventListener('mousedown', e => { if (!e.target.closest('#micPop') && !e.target.closest('#micSet')) { $('#micPop').classList.remove('on'); $('#micSet').classList.remove('on'); } });


// ---------------- waveform styles (View → Waveform style) ----------------
const WF_STYLES = ['Mirror gradient', 'Smooth envelope', 'Frequency colours', 'LED dots', 'Neon line', 'Rounded capsules'];
let WF = Math.min(5, Math.max(0, +store.get('wfStyle', '0') || 0));
function wfData(a, n){
  if (!a || !a.peaks) return null; const P = a.peaks, m = Math.max(0.05, ...P), out = [];
  for (let i = 0; i < n; i++) { const k = Math.min(P.length - 1, Math.floor(i / n * P.length)); out.push({ v: Math.max(0.03, P[k] / m), low: a.lows ? a.lows[k] : P[k] / m, mid: a.mids ? a.mids[k] : P[k] / m, high: a.highs ? a.highs[k] : P[k] / m }); }
  return out;
}
function drawWaveStyle(g, W, H, d, a, prog){
  const style = WF;
  if (!a || !a.peaks) { g.fillStyle = TC('#2A2E37'); g.fillRect(0, H / 2 - d / 2, W, d); return; }   // not analysed yet
  const P = prog > 0 ? prog : 0;
  if (style === 0) {            // mirror gradient
    const n = Math.max(40, Math.floor(W / (5 * d))), D = wfData(a, n), bw = W / n, mid = H * 0.64;
    const gp = g.createLinearGradient(0, 0, Math.max(1, P * W), 0); gp.addColorStop(0, '#1E5FD8'); gp.addColorStop(1, '#3FD0FF');
    D.forEach((x, i) => { const h = x.v * (mid - 2 * d), pl = i / n < P; g.fillStyle = pl ? gp : TC('#4A505C'); g.fillRect(i * bw + d * .5, mid - h, bw - d * 1.5, h);
      g.fillStyle = pl ? 'rgba(63,160,255,.38)' : 'rgba(74,80,92,.45)'; g.fillRect(i * bw + d * .5, mid + d, bw - d * 1.5, h * 0.55); });
  } else if (style === 1) {     // smooth envelope
    const n = Math.max(60, Math.floor(W / (3 * d))), D = wfData(a, n), mid = H / 2, pts = D.map((x, i) => [i / (n - 1) * W, x.v * (mid - 3 * d)]);
    const path = () => { g.beginPath(); g.moveTo(0, mid); pts.forEach(([x, h]) => g.lineTo(x, mid - h)); for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], mid + pts[i][1]); g.closePath(); };
    g.save(); path(); g.clip();
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5AA7FF'); gr.addColorStop(.5, '#1F6FD1'); gr.addColorStop(1, '#5AA7FF'); g.fillStyle = gr; g.fillRect(0, 0, P * W, H);
    gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, TC('#5B616D')); gr.addColorStop(.5, TC('#353A44')); gr.addColorStop(1, TC('#5B616D')); g.fillStyle = gr; g.fillRect(P * W, 0, W, H); g.restore();
    path(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = d; g.stroke(); g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, mid - d / 2, W, d);
  } else if (style === 2) {     // frequency colours
    const n = Math.max(60, Math.floor(W / (3 * d))), D = wfData(a, n), bw = W / n, mid = H / 2;
    D.forEach((x, i) => { const pl = i / n < P, al = pl ? 1 : 0.42, m = Math.max(0.05, x.low, x.mid, x.high);
      const lo = x.low / m, mi = x.mid / m, hi = x.high / m, h = Math.max(d, x.v * (mid - d));
      const r = Math.round(255 * Math.min(1, lo * 1.05 + hi * 0.1)), gg = Math.round(30 + 190 * mi * (1 - lo * 0.45)), b = Math.round(20 + 235 * hi * (1 - lo * 0.6));
      g.fillStyle = `rgba(${r},${gg},${b},${al})`; g.fillRect(i * bw, mid - h, bw + 0.3, h * 2);
      const hh = h * (0.25 + 0.45 * hi); g.fillStyle = `rgba(${Math.min(255, r + 25)},${Math.min(255, gg + 35)},${Math.min(255, b + 55)},${al * 0.55})`; g.fillRect(i * bw, mid - hh, bw + 0.3, hh * 2); });
  } else if (style === 3) {     // LED dots
    const cell = Math.max(4 * d, Math.min(7 * d, H / 9)), rows = Math.max(4, Math.floor(H / cell)), rh = H / rows, n = Math.floor(W / (rh * 0.95)), cw = W / n, D = wfData(a, n);
    D.forEach((x, i) => { const lit = Math.max(1, Math.round(x.v * rows)), pl = i / n < P;
      for (let r = 0; r < rows; r++) { const on = r < lit, f = r / rows, z = f >= 0.82 ? 2 : f >= 0.64 ? 1 : 0;
        g.fillStyle = on ? (pl ? ['#22C55E', '#F5A524', '#F04444'][z] : [TC('#1F5C36'), TC('#6B4D12'), TC('#6B2222')][z]) : TC('#15181D');
        g.beginPath(); g.roundRect(i * cw + cw * .14, H - (r + 1) * rh + rh * .14, cw * .72, rh * .72, Math.min(2 * d, rh * .25)); g.fill(); } });
  } else if (style === 4) {     // neon line
    const n = Math.max(60, Math.floor(W / (4 * d))), D = wfData(a, n), mid = H / 2, pts = D.map((x, i) => [i / (n - 1) * W, x.v * (mid - 4 * d)]);
    const draw = (from, to, col, glow, fill) => { if (to <= from) return; g.save(); g.beginPath(); g.rect(from, 0, to - from, H); g.clip();
      g.fillStyle = fill; g.beginPath(); g.moveTo(0, mid); pts.forEach(([x, h]) => g.lineTo(x, mid - h)); for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], mid + pts[i][1]); g.fill();
      g.shadowColor = glow; g.shadowBlur = 8 * d; g.strokeStyle = col; g.lineWidth = 1.6 * d;
      [-1, 1].forEach(sg => { g.beginPath(); pts.forEach(([x, h], i) => i ? g.lineTo(x, mid + sg * h) : g.moveTo(x, mid + sg * h)); g.stroke(); }); g.restore(); };
    draw(0, P * W, '#7DF9FF', 'rgba(0,229,255,1)', 'rgba(0,229,255,.10)'); draw(P * W, W, TC('#A78BFA'), 'rgba(139,92,246,1)', 'rgba(139,92,246,.10)');
  } else {                      // rounded capsules
    const n = Math.max(30, Math.floor(W / (6.5 * d))), D = wfData(a, n), bw = W / n, mid = H / 2;
    const gp = g.createLinearGradient(0, 0, Math.max(1, P * W), 0); gp.addColorStop(0, '#22C55E'); gp.addColorStop(1, '#2D8CEB');
    D.forEach((x, i) => { const h = Math.max(bw * .5, x.v * (H - 4 * d)), pl = i / n < P; g.fillStyle = pl ? gp : TC('#3A3F4A'); g.beginPath(); g.roundRect(i * bw + bw * .25, mid - h / 2, bw * .5, h, bw * .25); g.fill(); });
    if (P > 0) { const gl = g.createRadialGradient(P * W, mid, 0, P * W, mid, 24 * d); gl.addColorStop(0, 'rgba(45,140,235,.55)'); gl.addColorStop(1, 'rgba(45,140,235,0)'); g.fillStyle = gl; g.fillRect(P * W - 24 * d, 0, 48 * d, H); }
  }
}
// time line (ruler) above the player waveform
function drawRuler(c, dur, P){
  if (!c) return; const [W, H, d] = fitCanvas(c); const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  if (!dur || !isFinite(dur)) { g.fillStyle = TC(TC('#2A2F38')); g.fillRect(0, H - d, W, d); return; }
  const cssW = W / d, steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
  const major = steps.find(s => cssW / (dur / s) >= 58) || 1800, minor = major >= 60 ? major / 4 : major / 5;
  g.fillStyle = TC(TC('#2A2F38')); g.fillRect(0, H - d, W, d);
  g.font = (9.5 * d) + 'px JetBrains Mono, monospace'; g.textBaseline = 'top';
  for (let t = 0; t <= dur + 0.001; t += minor) {
    const x = Math.round(t / dur * (W - d)), isMaj = Math.abs(t / major - Math.round(t / major)) < 1e-6, past = t / dur <= P;
    g.fillStyle = isMaj ? (past ? '#7FE0B5' : TC(TC('#6B7280'))) : (past ? '#2F6B4D' : TC(TC('#3A3F4A')));
    const th = isMaj ? 6 * d : 3 * d; g.fillRect(x, H - th, d, th);
    if (isMaj && t > 0 && t < dur - major * 0.35) { const lab = Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0'); const tw = g.measureText(lab).width; g.fillText(lab, Math.min(W - tw, x + 3 * d), 0); }
  }
  g.fillStyle = TC(TC('#9AA3AE')); const end = fmtL(dur); g.fillText('0:00', 2 * d, 0);
  if (P > 0) { const x = P * W; g.fillStyle = TC(TC('#FFFFFF')); g.beginPath(); g.moveTo(x - 4 * d, H - 7 * d); g.lineTo(x + 4 * d, H - 7 * d); g.lineTo(x, H - d); g.closePath(); g.fill(); }
}
function setWf(i){ WF = i; store.set('wfStyle', String(i)); syncWf(); drawWaves(); toast('Waveform: ' + WF_STYLES[i]); }
function syncWf(){ $$('.dd [data-a^="wf"]').forEach(el => el.classList.toggle('on', +el.dataset.a.slice(2) === WF)); }
WF_STYLES.forEach((n, i) => ACT['wf' + i] = () => setWf(i));
syncWf();
window.addEventListener('resize', () => drawWaves());


// ---------------- customisable hot keys ----------------
const seek = sec => { if (curDeck && curDeck.item) { curDeck.audio.currentTime = Math.max(0, curDeck.audio.currentTime + sec); mixFired = false; } };
const HK_ACTIONS = [
  ['Microphones & broadcast'],
  ['mic1', 'MIC 1 on / off', 'Space', () => toggleMicN(0)],
  ['mic2', 'MIC 2 on / off', 'Shift+Space', () => toggleMicN(1)],
  ['micLink', 'LINK both microphones', '', () => $('#micLink').onclick()],
  ['lineIn', 'LINE IN on / off', '', () => setInput(inputs[2], !inputs[2].on)],
  ['golive', 'Start / stop broadcasting', 'Ctrl+E', () => goLive(!live)],
  ['rec', 'Recording on / off', '', () => $('#rec').onclick()],
  ['Player'],
  ['play', 'Play selected', 'Enter', () => $('#bPlay').onclick()],
  ['pause', 'Pause / resume', '', () => $('#bPause').onclick()],
  ['stop', 'Stop', '', () => $('#bStop').onclick()],
  ['next', 'Next (crossfade)', '', () => $('#bNext').onclick()],
  ['prev', 'Previous', '', () => $('#bPrev').onclick()],
  ['seekBack', 'Seek back 10 s', 'Ctrl+,', () => seek(-10)],
  ['seekFwd', 'Seek forward 10 s', 'Ctrl+.', () => seek(10)],
  ['autoMix', 'Auto mix on / off', '', () => $('#autoMix').onclick()],
  ['Playlist'],
  ['insertLib', 'Insert last library song after the playing track', 'Insert', () => lastLibId && insertAfterPlaying([fromLib(libById.get(lastLibId))])],
  ['addLibEnd', 'Add last library song to the end', 'NumpadSubtract', () => lastLibId && addToView([fromLib(libById.get(lastLibId))])],
  ['del', 'Remove selected', 'Delete', () => doAct('del')],
  ['moveUp', 'Move selected up', 'Ctrl+ArrowUp', () => moveSel('up')],
  ['moveDown', 'Move selected down', 'Ctrl+ArrowDown', () => moveSel('down')],
  ['moveNext', 'Move selected to play next', '', () => moveSel('top')],
  ['selAll', 'Select all', 'Ctrl+A', () => doAct('selAll')],
  ['copy', 'Copy', 'Ctrl+C', () => doAct('copy')],
  ['cut', 'Cut', 'Ctrl+X', () => doAct('cut')],
  ['paste', 'Paste (playlist items)', 'Ctrl+V', () => doAct('paste')],
  ['find', 'Find in playlist', 'Ctrl+F', () => doAct('find')],
  ['addYt', 'Add YouTube links…', '', () => doAct('addYt')],
  ['Tools & files'],
  ['newPl', 'New playlist', 'Ctrl+N', () => doAct('newPl')],
  ['openM3u', 'Open playlist (M3U)', 'Ctrl+O', () => doAct('openM3u')],
  ['savePl', 'Save playlists', 'Ctrl+S', () => doAct('savePl')],
  ['options', 'Options', 'Ctrl+P', () => doAct('options')],
  ['adBreak', 'Ad break now', '', () => adBreak()],
  ['annTime', 'Announce the time', '', () => doAct('annTime')],
  ['links', 'Listener links', '', () => openLinks()],
  ['Hot buttons (round pads)'],
  ['hot1', 'Hot button 1 play / stop', 'F1', () => hpPlay(0)],
  ['hot2', 'Hot button 2 play / stop', 'F2', () => hpPlay(1)],
  ['hot3', 'Hot button 3 play / stop', 'F3', () => hpPlay(2)],
  ['hot4', 'Hot button 4 play / stop', 'F4', () => hpPlay(3)],
  ['hot5', 'Hot button 5 play / stop', 'F5', () => hpPlay(4)],
  ['hot6', 'Hot button 6 play / stop', 'F6', () => hpPlay(5)],
  ['hot7', 'Hot button 7 play / stop', 'F7', () => hpPlay(6)],
  ['hot8', 'Hot button 8 play / stop', 'F8', () => hpPlay(7)],
];
const HK_DEF = {}; HK_ACTIONS.forEach(a => { if (a.length > 1) HK_DEF[a[0]] = a[2]; });
let HK = Object.assign({}, HK_DEF, (() => { try { return JSON.parse(store.get('hotkeys', '{}')); } catch(e){ return {}; } })());
function keyName(e){
  const c = e.code || '';
  let k = c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? c :
    ({ Space: 'Space', Comma: ',', Period: '.', Minus: '-', Equal: '=', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`' })[c] || e.key;
  if (k === ' ') k = 'Space';
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k) || /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(c)) return null;
  return k.length === 1 ? k.toUpperCase() : k;
}
function comboOf(e){ const k = keyName(e); if (!k) return null; return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k; }
const prettyKey = k => !k ? '—' : k.replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('NumpadSubtract', 'Num −').replace('NumpadAdd', 'Num +').replace(/^Numpad/, 'Num ').replace(/\+Numpad/, '+Num ');
function handleHotkey(e){
  const combo = comboOf(e); if (!combo) return;
  let act = HK_ACTIONS.find(a => a.length > 1 && HK[a[0]] && HK[a[0]] === combo);
  // Shift + a jingle key restarts that jingle
  if (!act && e.shiftKey) { const plain = combo.replace('Shift+', ''); act = HK_ACTIONS.find(a => a.length > 1 && /^cart/.test(a[0]) && HK[a[0]] === plain); }
  if (!act) return;
  if (act[0] === 'paste' && !PL.clip.length) return;            // let the browser paste (YouTube links)
  if (act[0] !== 'copy' && act[0] !== 'cut') e.preventDefault();
  act[3](e);
}
function saveHK(){ setTimeout(renderCart, 0); const diff = {}; Object.keys(HK).forEach(k => { if (HK[k] !== HK_DEF[k]) diff[k] = HK[k]; }); store.set('hotkeys', JSON.stringify(diff)); dsSave('hotkeys', diff); }
function openHotkeys(){
  const dup = {}; Object.values(HK).forEach(v => { if (v) dup[v] = (dup[v] || 0) + 1; });
  big('Hot keys', `<div class="sub" style="font-size:12px;line-height:1.6">Click a key to change it, then press the new key (with Ctrl / Alt / Shift if you like). <b>Esc</b> cancels, <b>Backspace</b> clears the key. Keys don't work while you type in a text box.</div>
  <div class="scroll" style="max-height:60vh;border:1px solid var(--line);border-radius:8px"><table class="tbl">${HK_ACTIONS.map(a => a.length === 1 ? `<tr><th colspan="3" style="padding-top:10px">${esc(a[0].toUpperCase())}</th></tr>` :
    `<tr><td>${esc(a[1])}</td><td style="width:190px"><button class="btn sm hkbtn" data-hk="${a[0]}" style="min-width:150px;justify-content:center;font-family:var(--mono);${HK[a[0]] && dup[HK[a[0]]] > 1 ? 'border-color:#F04444;color:#FF9A9A' : ''}" title="${HK[a[0]] && dup[HK[a[0]]] > 1 ? 'This key is used twice' : 'Click to change'}">${esc(prettyKey(HK[a[0]]))}</button></td><td style="width:80px">${HK[a[0]] !== HK_DEF[a[0]] ? `<button class="btn sm" data-hkreset="${a[0]}" title="Back to ${esc(prettyKey(HK_DEF[a[0]]))}">Reset</button>` : ''}</td></tr>`).join('')}</table></div>`,
  [['Reset all', () => { if (!confirm('Put all hot keys back to the defaults?')) return; HK = Object.assign({}, HK_DEF); saveHK(); openHotkeys(); toast('Hot keys reset'); }]]);
  $('#bgBody').onclick = e => {
    const r = e.target.closest('[data-hkreset]'); if (r) { HK[r.dataset.hkreset] = HK_DEF[r.dataset.hkreset]; saveHK(); openHotkeys(); return; }
    const b = e.target.closest('[data-hk]'); if (!b) return;
    $$('.hkbtn').forEach(x => x.classList.remove('pri')); b.classList.add('pri'); b.textContent = 'Press a key…'; window.HK_CAPTURE = true;
    const done = () => { window.HK_CAPTURE = false; document.removeEventListener('keydown', cap, true); };
    const cap = ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.key === 'Escape') { done(); openHotkeys(); return; }
      if (ev.key === 'Backspace' && !ev.ctrlKey && !ev.altKey && !ev.shiftKey) { HK[b.dataset.hk] = ''; done(); saveHK(); openHotkeys(); return; }
      const combo = comboOf(ev); if (!combo) return;                  // waiting for a real key after Ctrl / Shift / Alt
      const other = HK_ACTIONS.find(a => a.length > 1 && a[0] !== b.dataset.hk && HK[a[0]] === combo);
      if (other && !confirm(`${prettyKey(combo)} is used by "${other[1]}". Move it here?`)) { done(); openHotkeys(); return; }
      if (other) HK[other[0]] = '';
      HK[b.dataset.hk] = combo; done(); saveHK(); openHotkeys(); toast(prettyKey(combo) + ' → ' + HK_ACTIONS.find(a => a[0] === b.dataset.hk)[1]);
    };
    document.addEventListener('keydown', cap, true);
  };
}
ACT.hotkeys = openHotkeys;
Object.assign(ACT, {
  stats: () => openLinks(), jingles: () => {}, stopCarts: () => stopCarts(),
  recordings: () => { $('#miH').textContent = 'Recordings (stream archive)'; $('#miBody').innerHTML = '<div class="sub" style="font-size:12px;margin-bottom:8px">Saved in the Radio\\recordings folder. Press REC (top bar) to record the broadcast.</div>' + $('#recList').innerHTML; openModal('mInfo'); },
});
function cartKeyLabel(i){ const k = i < 10 && HK['cart' + (i + 1)]; return k ? prettyKey(k) + ' · ' : ''; }
dsLoad('hotkeys', null).then(d => { if (d && typeof d === 'object') { HK = Object.assign({}, HK_DEF, d); store.set('hotkeys', JSON.stringify(d)); } });


// ---------------- LINE IN = computer sound (system audio loopback) ----------------
const LINE_SYS = () => store.get('lineSrc', 'system') === 'system';
function syncLineSrc(){ const v = store.get('lineSrc', 'system'); $('#lineSrc').value = v; $('#lineSrc2').value = v; }
async function changeLineSrc(v){
  store.set('lineSrc', v); syncLineSrc(); const inp = inputs[2];
  if (inp.chain) { const was = inp.on; closeInput(inp); inp.on = false; if (was) await setInput(inp, true); else renderInputs(); }
  if (v === 'tab') { toast('LINE IN = a browser tab: press LINE IN, choose the YouTube tab and keep "Share tab audio" on. The tab goes quiet and you hear it only through OAB (with the ducker).'); return; }
  toast(v === 'system' ? 'LINE IN = only what plays on the computer (no microphone). Press LINE IN, choose "Entire screen" and tick "Share system audio".' : 'LINE IN = a sound card input (choose it in Options – not the PC microphone)');
}
$('#lineSrc').onchange = () => changeLineSrc($('#lineSrc').value);
$('#lineSrc2').onchange = () => changeLineSrc($('#lineSrc2').value);
syncLineSrc();
const _openInputCard = openInput;
openInput = async function(inp){
  if (inp.key !== 'line' || !LINE_SYS()) return _openInputCard(inp);
  if (!navigator.mediaDevices.getDisplayMedia) throw new Error('This browser cannot capture the computer sound');
  const own = (navigator.mediaDevices.getSupportedConstraints() || {}).restrictOwnAudio;
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor', frameRate: 1, width: 320, height: 180 },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true, channelCount: 2 },
    systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'include', windowAudio: 'system' });
  const at = stream.getAudioTracks();
  if (!at.length) { stream.getTracks().forEach(t => t.stop()); toast('No sound was shared. Choose "Entire screen" and tick "Share system audio".'); throw new Error('no audio'); }
  closeInput(inp);
  const src = ctx.createMediaStreamSource(new MediaStream(at));
  const level = ctx.createGain(); level.gain.value = lineGain();
  const onG = ctx.createGain(); onG.gain.value = 0;
  src.connect(level); level.connect(onG); onG.connect(masterIn);
  if (lineMon) onG.connect(monitor);
  inp.chain = { stream, src, level, onG };
  at[0].addEventListener('ended', () => { if (inp.chain && inp.chain.stream === stream) { inp.on = false; closeInput(inp); applyDuck(); renderInputs(); toast('Computer sound sharing stopped – LINE IN is off'); } });
  if (!own) toast('Tip: your browser may also capture the studio itself. Set "Main output" in Options to headphones or another device to avoid an echo.');
  else toast('LINE IN: computer sound is on (the studio\'s own sound is left out)');
  return stream;
};


// ---------------- who is listening (names from the phone player) ----------------
let AUD = [];
const durTxt = s => s < 60 ? s + ' s' : s < 3600 ? Math.floor(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.floor(s / 60) % 60 + ' min';
function renderAudience(st){
  AUD = st.audience || [];
  const named = AUD.filter(a => a.name).length;
  $('#lisTop').title = st.listeners ? `${st.listeners} listening${named ? ': ' + AUD.filter(a => a.name).map(a => a.name).join(', ') : ''} · click for the list` : 'Nobody is listening right now';
  if ($('#audPop').classList.contains('on')) drawAudience();
}
function drawAudience(){
  $('#audSum').textContent = AUD.length + (AUD.length === 1 ? ' listener' : ' listeners');
  $('#audList').innerHTML = AUD.length ? AUD.map(a => `<div class="aud"><span class="av" style="background:${a.name ? colorFor(a.name) : '#3A3F4A'}">${a.name ? esc(initials(a.name)) : '?'}</span><div style="min-width:0;flex:1"><div class="ell" style="font-weight:600">${a.name ? esc(a.name) : '<span class="sub">No name</span>'}</div><div class="sub" style="font-size:11px">${a.name ? 'Phone player' : esc(a.app || 'Other player')} · listening ${durTxt(a.secs)}</div></div></div>`).join('')
    : '<div class="sub" style="padding:6px 0">Nobody is listening right now.</div>';
}
$('#lisTop').onclick = e => { e.stopPropagation(); const p = $('#audPop'); if (p.classList.contains('on')) { p.classList.remove('on'); return; }
  drawAudience(); const r = $('#lisTop').getBoundingClientRect(), Z = window.UIZ || 1; p.classList.add('on');
  const w = p.getBoundingClientRect().width; p.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) / Z + 'px'; p.style.top = (r.bottom + 6) / Z + 'px'; };
document.addEventListener('mousedown', e => { if (!e.target.closest('#audPop') && !e.target.closest('#lisTop')) $('#audPop').classList.remove('on'); });


// mic LINK / LINE IN / settings now live in the Settings menu
Object.assign(ACT, {
  mLink: () => { $('#micLink').onclick(); setTimeout(syncMicMenu, 50); toast(micLinked ? 'MIC 1 + MIC 2 linked' : 'Microphones unlinked'); },
  mLine: async () => { await setInput(inputs[2], !inputs[2].on); syncMicMenu(); toast('LINE IN ' + (inputs[2].on ? 'on' : 'off')); },
  micSettings: () => { $('#micPop').classList.add('on'); },
});
function syncMicMenu(){ const a = document.querySelector('.dd [data-a="mLink"]'), b = document.querySelector('.dd [data-a="mLine"]'); if (a) a.classList.toggle('on', micLinked); if (b) b.classList.toggle('on', inputs[2].on); }
setInterval(syncMicMenu, 1000); syncMicMenu();


// ---------------- sound card outputs: test tones + direct menu ----------------
function toneWavUrl(freq){ const sr = 44100, n = Math.floor(sr * 0.9), b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, env = Math.min(1, t * 30, (0.9 - t) * 30); v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * freq * t) * env * 0.35 * 32767, true); }
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); }
async function testOutput(dev, freq, label){
  const a = new Audio(toneWavUrl(freq));
  if (dev) { if (!a.setSinkId) return toast('This browser cannot choose an output device'); try { await a.setSinkId(dev); } catch(e){ return toast(label + ': this output is not available'); } }
  try { await a.play(); toast(label + ': test tone playing'); } catch(e){ toast('Could not play the test tone'); }
}
$('#tOut').onclick = () => testOutput($('#devOut').value, 660, 'Main output');
$('#tPfl').onclick = () => testOutput($('#devPfl').value, 880, 'Prelisten output');
function outNote(){ const ok = !!(window.AudioContext && AudioContext.prototype.setSinkId) && !!HTMLMediaElement.prototype.setSinkId;
  $('#outNote').textContent = ok ? 'Tip: if the list only shows "Default", press "Refresh device list" and allow the microphone once – the browser then shows all sound card names.' : 'This browser cannot send sound to a chosen output. Use Chrome or Edge.'; }
outNote();
ACT.audioDevices = async () => { await openOptions(); setTimeout(() => { const el = $('#optOutputs'); if (el) el.scrollIntoView({ block: 'start' }); }, 150); };


// ---------------- microphone compressor (per mic) + GR meters ----------------
const MCDEF = { on: true, thr: -24, ratio: 4, att: 5, rel: 200, knee: 6, makeup: 4, hp: 80 };
let MC = (() => { try { return JSON.parse(store.get('micComp', '{}')) || {}; } catch(e){ return {}; } })();
const mcOf = key => Object.assign({}, MCDEF, MC[key] || {});
function saveMC(){ store.set('micComp', JSON.stringify(MC)); }
function applyMC(inp){
  const c = inp.chain; if (!c || !c.comp || !ctx) return; const m = mcOf(inp.key), t = ctx.currentTime;
  c.hp.frequency.setTargetAtTime(m.hp, t, 0.02);
  if (m.on) { c.comp.threshold.setTargetAtTime(m.thr, t, 0.02); c.comp.ratio.setTargetAtTime(m.ratio, t, 0.02); c.comp.knee.setTargetAtTime(m.knee, t, 0.02);
    c.comp.attack.setTargetAtTime(m.att / 1000, t, 0.02); c.comp.release.setTargetAtTime(m.rel / 1000, t, 0.02); c.makeup.gain.setTargetAtTime(dbToG(m.makeup), t, 0.03); }
  else { c.comp.threshold.setTargetAtTime(0, t, 0.02); c.comp.ratio.setTargetAtTime(1, t, 0.02); c.comp.knee.setTargetAtTime(0, t, 0.02); c.makeup.gain.setTargetAtTime(1, t, 0.03); }
}
const _openInputPrev = openInput;
openInput = async function(inp){
  if (!inp.voice) return _openInputPrev(inp);
  const id = store.get('dev_' + inp.key, '');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  closeInput(inp);
  const src = ctx.createMediaStreamSource(stream), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.Q.value = 0.7;
  const comp = ctx.createDynamicsCompressor(), makeup = ctx.createGain(), level = ctx.createGain(), onG = ctx.createGain(); onG.gain.value = 0;
  // channels: a mic on one input of the sound card is heard on both sides (centre) – see Options → MIC channels
  const split = ctx.createChannelSplitter(2), gL = ctx.createGain(), gR = ctx.createGain(), mono = ctx.createGain();
  mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
  const anL = ctx.createAnalyser(), anR = ctx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
  src.connect(split); split.connect(gL, 0); split.connect(gR, 1); split.connect(anL, 0); split.connect(anR, 1); gL.connect(mono); gR.connect(mono);
  const stG = ctx.createGain(); src.connect(stG);
  mono.connect(hp); stG.connect(hp); hp.connect(comp); comp.connect(makeup); makeup.connect(level); level.connect(onG); onG.connect(masterIn);
  inp.chain = { stream, src, hp, comp, makeup, level, onG, split, gL, gR, mono, stG, anL, anR, buf: new Float32Array(1024), pick: null }; applyMC(inp); applyMch(inp); listDevices();
  return stream;
};
function syncCmpBtns(){ [0, 1].forEach(i => $('#cmp' + (i + 1)).classList.toggle('on', mcOf(inputs[i].key).on)); }
[0, 1].forEach(i => {
  $('#cmp' + (i + 1)).onclick = () => { const k = inputs[i].key; MC[k] = Object.assign(mcOf(k), { on: !mcOf(k).on }); saveMC(); applyMC(inputs[i]); syncCmpBtns(); renderMC(); toast(inputs[i].name + ' compressor ' + (MC[k].on ? 'on' : 'off')); };
  $('#gr' + (i + 1)).onclick = () => doAct('micComp');
});
syncCmpBtns();
const GR = [{ v: 0 }, { v: 0 }];
function drawGr(i, dt){
  const c = $('#gr' + (i + 1)); if (!c) return; const [W, H, d] = fitCanvas(c); const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const inp = inputs[i], on = !!(inp.chain && inp.chain.comp && inp.on && mcOf(inp.key).on);
  const red = on ? Math.max(0, -inp.chain.comp.reduction) : 0;              // dB of gain reduction
  GR[i].v = red > GR[i].v ? red : Math.max(red, GR[i].v - 20 * dt);
  const labW = 18 * d, n = 10, gap = 1.5 * d, sw = (W - labW - gap * (n - 1)) / n;
  g.fillStyle = on ? '#C9A25A' : TC('#555A63'); g.font = `700 ${8 * d}px Inter, sans-serif`; g.textBaseline = 'middle'; g.fillText('GR', 0, H / 2);
  for (let k = 0; k < n; k++) { const lit = GR[i].v >= (k + 0.5) * 2;                     // each LED = 2 dB, up to 20 dB
    g.fillStyle = lit ? (k < 3 ? '#F5C46B' : k < 7 ? '#F5A524' : '#F04444') : (on ? TC('#2A2210') : TC('#1B1D22'));
    g.beginPath(); g.roundRect(labW + k * (sw + gap), H * 0.18, sw, H * 0.64, 1.5 * d); g.fill(); }
}
(function grLoop(){ const now = performance.now(); const dt = Math.min(0.1, (now - (grLoop.t || now)) / 1000); grLoop.t = now; try { drawGr(0, dt); drawGr(1, dt); } catch(e){} requestAnimationFrame(grLoop); })();
// settings (Options → Microphone compressor)
const MC_ROWS = [['on', 'Compressor', 'tgl'], ['thr', 'Threshold', -50, 0, 1, ' dB'], ['ratio', 'Ratio', 1, 20, 0.5, ':1'], ['att', 'Attack', 1, 100, 1, ' ms'], ['rel', 'Release', 20, 1000, 10, ' ms'], ['knee', 'Knee', 0, 30, 1, ' dB'], ['makeup', 'Make-up gain', 0, 18, 0.5, ' dB'], ['hp', 'Low cut', 20, 300, 5, ' Hz']];
function renderMC(){
  const box = $('#mcBox'); if (!box) return;
  box.innerHTML = `<div style="display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,1fr);gap:8px 14px;align-items:center"><span></span><b style="font-size:12px">MIC 1</b><b style="font-size:12px">MIC 2</b>` +
    MC_ROWS.map(r => `<span class="sub" style="font-size:12px">${r[1]}</span>` + [0, 1].map(i => { const k = inputs[i].key, m = mcOf(k);
      return r[2] === 'tgl' ? `<span class="tgl ${m.on ? 'on' : ''}" data-mc="${k}" data-p="on"><b></b>${m.on ? 'On' : 'Off'}</span>`
        : `<div style="display:flex;gap:6px;align-items:center"><input type="range" class="gray" data-mc="${k}" data-p="${r[0]}" min="${r[2]}" max="${r[3]}" step="${r[4]}" value="${m[r[0]]}" style="flex:1;min-width:0;--c:#F5A524;--p:${(m[r[0]] - r[2]) / (r[3] - r[2]) * 100}%" aria-label="${inputs[i].name} ${r[1]}"><span class="mono" style="font-size:11px;min-width:54px;text-align:right">${m[r[0]]}${r[5]}</span></div>`; }).join('')).join('') +
    `<span></span><button class="btn sm" id="mcReset" style="justify-self:start">Reset both to default</button><span></span></div>`;
  $('#mcReset').onclick = () => { MC = {}; saveMC(); inputs.forEach(applyMC); syncCmpBtns(); renderMC(); toast('Compressor settings reset'); };
}
$('#mOptions').addEventListener('input', e => { const el = e.target.closest('input[data-mc]'); if (!el) return; const k = el.dataset.mc, p = el.dataset.p, r = MC_ROWS.find(x => x[0] === p);
  MC[k] = Object.assign(mcOf(k), { [p]: +el.value }); saveMC(); applyMC(inputs.find(i => i.key === k));
  el.style.setProperty('--p', ((+el.value - r[2]) / (r[3] - r[2]) * 100) + '%'); el.nextElementSibling.textContent = el.value + r[5]; });
$('#mOptions').addEventListener('click', e => { const t = e.target.closest('.tgl[data-mc]'); if (!t) return; const k = t.dataset.mc; MC[k] = Object.assign(mcOf(k), { on: !mcOf(k).on }); saveMC(); applyMC(inputs.find(i => i.key === k)); syncCmpBtns(); renderMC(); });
renderMC();
ACT.micComp = async () => { await openOptions(); renderMC(); setTimeout(() => { const el = $('#optComp'); if (el) el.scrollIntoView({ block: 'start' }); }, 150); };


// ---------------- floating clock (click the clock in the top bar) ----------------
const CLOCK_STYLES = ['Studio clock (LED ring)', 'Classic', 'Dark modern', 'Neon', 'Digital'];
let CW = (() => { try { return Object.assign({ style: 0, x: 120, y: 120, w: 340, h: 380 }, JSON.parse(store.get('clockWin', '{}'))); } catch(e){ return { style: 0, x: 120, y: 120, w: 340, h: 380 }; } })();
const saveCW = () => store.set('clockWin', JSON.stringify(CW));
$('#cwStyle').innerHTML = CLOCK_STYLES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
function placeCW(){ const el = $('#clockWin'), Z = window.UIZ || 1, vw = innerWidth / Z, vh = innerHeight / Z;
  CW.w = Math.max(170, Math.min(CW.w, vw - 10)); CW.h = Math.max(200, Math.min(CW.h, vh - 10)); CW.x = Math.max(0, Math.min(CW.x, vw - 80)); CW.y = Math.max(0, Math.min(CW.y, vh - 40));
  Object.assign(el.style, { left: CW.x + 'px', top: CW.y + 'px', width: CW.w + 'px', height: CW.h + 'px' }); }
function openClock(){ const el = $('#clockWin'); if (!el.hidden) { el.hidden = true; return; } el.hidden = false; $('#cwStyle').value = CW.style; placeCW(); }
$('#clock').onclick = openClock; $('#clock').onkeydown = e => { if (e.key === 'Enter') openClock(); };
$('#cwClose').onclick = () => { $('#clockWin').hidden = true; };
$('#cwStyle').onchange = () => { CW.style = +$('#cwStyle').value; saveCW(); };
function dragOn(handle, onMove){ handle.addEventListener('pointerdown', e => { if (e.target.closest('select,button')) return; e.preventDefault(); const Z = window.UIZ || 1, sx = e.clientX, sy = e.clientY, st = { ...CW };
  const mv = ev => { onMove(st, (ev.clientX - sx) / Z, (ev.clientY - sy) / Z); placeCW(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); saveCW(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); }); }
dragOn($('#cwBar'), (st, dx, dy) => { CW.x = st.x + dx; CW.y = st.y + dy; });
dragOn($('#cwGrip'), (st, dx, dy) => { CW.w = st.w + dx; CW.h = st.h + dy; });
addEventListener('resize', () => { if (!$('#clockWin').hidden) placeCW(); });

function hand(g, cx, cy, ang, len, w, col, tail, shadow){ g.save(); g.translate(cx, cy); g.rotate(ang); if (shadow) { g.shadowColor = shadow; g.shadowBlur = w * 3; }
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, tail || 0); g.lineTo(0, -len); g.stroke(); g.restore(); }
function drawClock(){
  const c = $('#cwCanvas'); const [W, H, d] = fitCanvas(c); const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const now = new Date(), ms = now.getMilliseconds(), sec = now.getSeconds() + ms / 1000, min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
  const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0'), ss = String(now.getSeconds()).padStart(2, '0');
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const st = CW.style, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 * 0.9, TAU = Math.PI * 2;
  const A = v => v * TAU;                 // 0..1 of a turn, 0 = 12 o'clock (rotate() is clockwise from up)
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (st === 0) {                         // broadcast studio clock: 60 LED dots for the seconds + digital time
    g.fillStyle = '#050608'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const s = now.getSeconds(), rd = R * 0.86, dotR = R * 0.032;
    for (let i = 0; i < 60; i++) { const a = A(i / 60) - Math.PI / 2, x = cx + Math.cos(a) * rd, y = cy + Math.sin(a) * rd, on = i <= s;
      g.fillStyle = on ? '#FF2D2D' : '#2A0B0B'; if (on) { g.shadowColor = '#FF2D2D'; g.shadowBlur = dotR * 2.5; } g.beginPath(); g.arc(x, y, dotR, 0, TAU); g.fill(); g.shadowBlur = 0; }
    for (let i = 0; i < 12; i++) { const a = A(i / 12) - Math.PI / 2, x = cx + Math.cos(a) * R * 0.97, y = cy + Math.sin(a) * R * 0.97;
      g.fillStyle = '#FF5A3C'; g.shadowColor = '#FF5A3C'; g.shadowBlur = dotR * 2; g.beginPath(); g.arc(x, y, dotR * 0.95, 0, TAU); g.fill(); g.shadowBlur = 0; }
    g.fillStyle = '#FF3B30'; g.shadowColor = '#FF3B30'; g.shadowBlur = R * 0.05; g.font = `700 ${R * 0.42}px "JetBrains Mono", monospace`; g.fillText(hh + ':' + mm, cx, cy - R * 0.06);
    g.font = `700 ${R * 0.2}px "JetBrains Mono", monospace`; g.fillText(ss, cx, cy + R * 0.32); g.shadowBlur = 0;
    g.fillStyle = '#8A4A44'; g.font = `600 ${R * 0.075}px Inter, sans-serif`; g.fillText(date.toUpperCase(), cx, cy + R * 0.55);
  } else if (st === 4) {                  // digital
    g.fillStyle = '#E8EAEF'; g.font = `700 ${Math.min(W / 5.2, H / 2.4)}px "JetBrains Mono", monospace`; g.fillText(hh + ':' + mm, cx, cy - H * 0.08);
    g.fillStyle = '#2D8CEB'; g.font = `700 ${Math.min(W / 10, H / 5)}px "JetBrains Mono", monospace`; g.fillText(ss, cx, cy + H * 0.17);
    g.fillStyle = '#9097A6'; g.font = `600 ${Math.min(W / 18, H / 12)}px Inter, sans-serif`; g.fillText(date, cx, cy + H * 0.33);
  } else {                                // analog faces
    const P = [null, { face: '#F7F5EF', rim: '#1C1D21', ink: '#1A1A1A', hand: '#151515', sec: '#E0262B', nums: 'all' },
      { face: '#14161B', rim: '#2A2E37', ink: '#6B7280', hand: '#E8EAEF', sec: '#2D8CEB', nums: 'none' },
      { face: '#07080C', rim: '#00E5FF', ink: '#7DF9FF', hand: '#7DF9FF', sec: '#FF2BD6', nums: 'quarters', glow: true }][st];
    g.fillStyle = P.rim; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const rg = g.createRadialGradient(cx, cy - R * 0.3, R * 0.1, cx, cy, R * 0.95); rg.addColorStop(0, P.face); rg.addColorStop(1, st === 1 ? '#E6E1D6' : P.face);
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R * 0.94, 0, TAU); g.fill();
    if (P.glow) { g.strokeStyle = P.rim; g.lineWidth = R * 0.02; g.shadowColor = P.rim; g.shadowBlur = R * 0.08; g.beginPath(); g.arc(cx, cy, R * 0.94, 0, TAU); g.stroke(); g.shadowBlur = 0; }
    for (let i = 0; i < 60; i++) { const big = i % 5 === 0; g.save(); g.translate(cx, cy); g.rotate(A(i / 60));
      g.strokeStyle = P.ink; g.lineWidth = big ? R * 0.028 : R * 0.01; if (P.glow && big) { g.shadowColor = P.ink; g.shadowBlur = R * 0.04; }
      g.beginPath(); g.moveTo(0, -R * 0.9); g.lineTo(0, -R * (big ? 0.78 : 0.85)); g.stroke(); g.restore(); }
    if (P.nums !== 'none') { g.fillStyle = P.ink; g.font = `700 ${R * 0.15}px Inter, sans-serif`;
      for (let n = 1; n <= 12; n++) { if (P.nums === 'quarters' && n % 3) continue; const a = A(n / 12) - Math.PI / 2; g.fillText(String(n), cx + Math.cos(a) * R * 0.64, cy + Math.sin(a) * R * 0.64); } }
    g.fillStyle = st === 1 ? '#6B6B6B' : P.ink; g.font = `600 ${R * 0.07}px Inter, sans-serif`; g.fillText('RADIO', cx, cy - R * 0.32);
    g.font = `600 ${R * 0.06}px Inter, sans-serif`; g.fillText(date, cx, cy + R * 0.36);
    hand(g, cx, cy, A(hr / 12), R * 0.5, R * 0.06, P.hand, R * 0.08, P.glow ? P.hand : (st === 1 ? 'rgba(0,0,0,.25)' : null));
    hand(g, cx, cy, A(min / 60), R * 0.74, R * 0.04, P.hand, R * 0.1, P.glow ? P.hand : (st === 1 ? 'rgba(0,0,0,.25)' : null));
    hand(g, cx, cy, A(sec / 60), R * 0.84, R * 0.014, P.sec, R * 0.18, P.glow ? P.sec : null);
    g.fillStyle = P.sec; g.beginPath(); g.arc(cx, cy, R * 0.035, 0, TAU); g.fill();
    if (st === 1) { const gl = g.createLinearGradient(cx - R, cy - R, cx + R * 0.3, cy + R * 0.2); gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, R * 0.94, 0, TAU); g.fill(); }
  }
}
(function clockLoop(){ if (!$('#clockWin').hidden) { try { drawClock(); } catch(e){} } requestAnimationFrame(clockLoop); })();


// ---------------- prelisten player (left of the transport buttons) ----------------
const PFL_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>', PFL_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
pfl.volume = (+store.get('pflVol', '90')) / 100; $('#pflVol').value = Math.round(pfl.volume * 100); $('#pflVol').style.setProperty('--p', $('#pflVol').value + '%');
let pflSeeking = false;
function pflUI(){
  const d = pfl.duration, t = pfl.currentTime, ok = isFinite(d) && d > 0;
  $('#pflTime').textContent = (pfl.src ? fmt(t) : '--:--') + ' / ' + (ok ? fmt(d) : '--:--');
  if (!pflSeeking) { const v = ok ? Math.round(t / d * 1000) : 0; $('#pflSeek').value = v; $('#pflSeek').style.setProperty('--p', v / 10 + '%'); }
  const playing = !pfl.paused && !!pfl.src; $('#pflPlay').innerHTML = playing ? PFL_PAUSE : PFL_PLAY; $('#pfl').classList.toggle('live', playing);
}
function markPflRows(){
  const c = window.pflCur, on = !!(c && pfl.src && !pfl.paused);
  $$('#plBody .plr').forEach(r => { let hit = false; if (on) { const f = findItem(r.dataset.uid); hit = !!f && ((c.uid && f.item.uid === c.uid) || (!c.uid && c.url && f.item.url === c.url)); } r.classList.toggle('pflOn', hit); });
}
const _renderPlaylistBase = renderPlaylist;
renderPlaylist = function(...a){ _renderPlaylistBase(...a); markPflRows(); };
['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended', 'emptied'].forEach(ev => pfl.addEventListener(ev, () => { pflUI(); markPflRows(); }));
$('#pflPlay').onclick = () => { if (!pfl.src) return toast('Drop a song on the prelisten player, or press 🎧 on a song'); if (pfl.paused) pfl.play().catch(() => {}); else pfl.pause(); };
$('#pflStop').onclick = () => { pfl.pause(); try { pfl.currentTime = 0; } catch(e){} pflUI(); };
$('#pflSeek').addEventListener('input', () => { pflSeeking = true; $('#pflSeek').style.setProperty('--p', $('#pflSeek').value / 10 + '%'); });
$('#pflSeek').addEventListener('change', () => { const d = pfl.duration; if (isFinite(d) && d > 0) pfl.currentTime = (+$('#pflSeek').value / 1000) * d; pflSeeking = false; pflUI(); });
$('#pflVol').oninput = () => { pfl.volume = +$('#pflVol').value / 100; store.set('pflVol', $('#pflVol').value); $('#pflVol').style.setProperty('--p', $('#pflVol').value + '%'); };
// drop a song from the library, explorer or playlist onto the prelisten player
$('#pfl').addEventListener('dragover', e => { e.preventDefault(); $('#pfl').classList.add('drop'); });
$('#pfl').addEventListener('dragleave', () => $('#pfl').classList.remove('drop'));
$('#pfl').addEventListener('drop', e => { e.preventDefault(); $('#pfl').classList.remove('drop');
  const lib = e.dataTransfer.getData('text/lib'); let it = lib ? libById.get(lib) : null;
  if (!it && dragUids) { const f = findItem(dragUids[0]); it = f ? f.item : null; dragUids = null; }
  if (!it && e.dataTransfer.files && e.dataTransfer.files.length) it = localFiles(e.dataTransfer.files)[0];
  if (it) prelisten(it); else toast('Drop a song here'); });
pflUI();

// ---------------- phase init ----------------
setInterval(schTick, 1000);
setInterval(renderSch, 30000);
renderAux();
(async () => {
  try { const r = await api('/api/config'); if (r.ok) { const c = await r.json(); CFG.city = c.city || ''; CFG.voice = c.ttsVoice || ''; } } catch(e){}
  TM = (await dsLoad('trackmeta', {})) || {}; SCH = (await dsLoad('schedule', [])) || [];
  const a = await dsLoad('ads', null); if (a) ADS = Object.assign(ADS, a);
  GENT = (await dsLoad('generator', [])) || [];
  renderSch(); renderAdCard(); renderPlaylist();
})();

// ---------------- Requests column: close with ✕, bring back from View → Requests column ----------------
function setReqCol(on){ VIEW.req = !!on; store.set('vReq', on ? '1' : '0'); $('.main').classList.toggle('noReq', !on); syncChecks(); if (typeof drawWaves === 'function') setTimeout(drawWaves, 0); }
$('#reqClose').onclick = () => { setReqCol(false); toast('Requests column hidden – View → Requests column to show it again'); };
function setLibCol(on){ VIEW.lib = !!on; $('.main').classList.toggle('noLib', !on); syncChecks(); if (typeof drawWaves === 'function') setTimeout(drawWaves, 0); }
$('#libClose').onclick = e => { e.stopPropagation(); setLibCol(false); toast('Column hidden – View → Library column to show it again'); };
// the studio always opens with only the playlist column; View menu brings the others back
setReqCol(false); setLibCol(false);

// ---------------- message to listeners (envelope next to GO LIVE) ----------------
$('#msgOpen').onclick = () => { $('#msgSt').textContent = ''; openModal('mMsg'); setTimeout(() => $('#msgTxt').focus(), 50); };
$('#msgTxt').addEventListener('input', () => { $('#msgCnt').textContent = $('#msgTxt').value.length + ' / 500'; });
$('#msgTxt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#msgSend').click(); } e.stopPropagation(); });
$('#msgSend').onclick = async () => {
  const text = $('#msgTxt').value.trim(); if (!text) { $('#msgSt').textContent = 'Write a message first'; $('#msgTxt').focus(); return; }
  $('#msgSend').disabled = true;
  try {
    const r = await fetch('/api/message', { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, font: $('#msgFont').value }) });
    if (r.status === 401) { $('#msgSt').textContent = 'Wrong broadcast password (Settings → Options)'; return; }
    const d = await r.json(); $('#msgTxt').value = ''; $('#msgCnt').textContent = '0 / 500';
    closeModal('mMsg'); toast(`Message sent · ${d.listeners} listening now`);
  } catch(e){ $('#msgSt').textContent = 'Server not running'; }
  finally { $('#msgSend').disabled = false; }
};

// emoji library + font for the listener message
const EMO = [
  ['Radio', '📻 🎙️ 🎧 🎚️ 🎛️ 📡 🔴 🟢 ⏺️ ⏯️ 🔊 🔉 📢 📣 🎤 🔈 📶 🗣️ 🎬 ⏰'],
  ['Music', '🎵 🎶 🎸 🎹 🥁 🎷 🎺 🎻 🪕 🪗 💿 📀 🎼 🪘 🕺 💃 🪩 🎟️'],
  ['Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😜 🤗 🤔 😴 😢 😭 😮 😱'],
  ['Love & hands', '👍 👏 🙌 🙏 👋 🤝 ✌️ 🤘 🤙 👌 💪 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💯 ✨'],
  ['Party', '🎉 🎊 🎂 🎁 🎈 🥂 🍾 🏆 🥇 🎯 ⭐ 🌟 🔥 💥 🎆 🎇'],
  ['Time & weather', '☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 🌈 🌙 🌅 🌃 ⏳ ⌛ 🕐 📅 🗓️'],
  ['Food', '☕ 🍕 🍔 🍟 🌮 🍩 🍰 🍫 🍿 🍺 🍷 🧃'],
  ['More', '🚗 🏖️ ✈️ 🏠 📍 ⚽ 🏀 🎮 📺 📱 💌 📩 ✉️ ❗ ❓ ✅ 👉 🆕'],
  ['Israel & holidays', '🇮🇱 ✡️ 🕎 🕯️ 🍯 🍎 🌼 🍞']
].map(([n, e]) => [n, e.split(' ')]);
const MSG_FONTS = ['Heebo', 'Rubik', 'Assistant', 'Varela Round', 'Secular One', 'Suez One', 'Frank Ruhl Libre', 'David Libre', 'Alef', 'Amatic SC', 'Karantina', 'Bellefair'];
function loadFont(){ if (document.querySelector('link[data-f]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.f = '1'; l.href = '/fonts/fonts.css'; document.head.appendChild(l); }
let emoCat = 0;
function renderEmo(){
  $('#emoTabs').innerHTML = EMO.map(([n], i) => `<button type="button" role="tab" aria-selected="${i === emoCat}" class="${i === emoCat ? 'on' : ''}" data-c="${i}">${n}</button>`).join('');
  $('#emoGrid').innerHTML = EMO[emoCat][1].map(e => `<button type="button" data-e="${e}" aria-label="${e}">${e}</button>`).join('');
}
$('#emoTabs').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; emoCat = +b.dataset.c; renderEmo(); };
$('#emoGrid').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; const t = $('#msgTxt'), a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a;
  if (t.value.length + b.dataset.e.length > 500) return; t.value = t.value.slice(0, a) + b.dataset.e + t.value.slice(z); const p = a + b.dataset.e.length; t.focus(); t.setSelectionRange(p, p); t.dispatchEvent(new Event('input')); };
$('#emoBtn').onclick = () => { const p = $('#emoPanel'); p.hidden = !p.hidden; $('#emoBtn').setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) renderEmo(); };
$('#msgFont').innerHTML = MSG_FONTS.map(f => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
$('#msgFont').value = MSG_FONTS.includes(store.get('msgFont', 'Heebo')) ? store.get('msgFont', 'Heebo') : 'Heebo';
function applyMsgFont(){ const f = $('#msgFont').value; loadFont(f); $('#msgTxt').style.fontFamily = `'${f}', system-ui, sans-serif`; store.set('msgFont', f); }
$('#msgFont').onchange = applyMsgFont; applyMsgFont();
loadFont();

// ---------------- hot buttons: 5 round pads that play over the music (music ducks, then comes back) ----------------
const HP_N = 8, HP_C = 157.08;
let HP = (() => { try { const a = JSON.parse(store.get('hotPads', '[]')); return Array.from({ length: HP_N }, (_, i) => a[i] || {}); } catch(e){ return Array.from({ length: HP_N }, () => ({})); } })();
const hpBufs = new Map(), hpPlaying = new Map();
let hpOut = null;
function saveHp(){ store.set('hotPads', JSON.stringify(HP)); fetch('/api/store/hotpads', { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify(HP) }).catch(() => {}); }
const hpDuckLv = () => (+store.get('hpDuck', '30')) / 100, hpFade = () => +store.get('hpFade', '0.4'), hpVol = () => (+store.get('hpVol', '100')) / 100;
function renderHp(){
  $$('#hpWrap .hp').forEach(b => { const i = +b.dataset.i, h = HP[i];
    b.classList.toggle('empty', !h.url); b.classList.toggle('on', hpPlaying.has(i));
    b.querySelector('small').textContent = h.url ? (h.name || '').slice(0, 10) : '';
    b.removeAttribute('title'); b.setAttribute('aria-label', h.url ? `Hot button ${i + 1}: ${h.name}` : `Hot button ${i + 1} (empty)`);
    if (!hpPlaying.has(i)) b.querySelector('.hpProg').style.strokeDashoffset = HP_C; });
}
function hpDuckTo(on){
  if (!ctx || !hpDuck) return; const t = ctx.currentTime, f = Math.max(0.01, hpFade()), g = hpDuck.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? hpDuckLv() : 1, t + f);
}
async function hpBuf(h){ if (hpBufs.has(h.url)) return hpBufs.get(h.url); const b = await ctx.decodeAudioData(await (await fetch(h.url)).arrayBuffer()); hpBufs.set(h.url, b); return b; }
function hpStop(i, quick){ const p = hpPlaying.get(i); if (!p) return; p.src.onended = null; const t = ctx.currentTime; p.g.gain.setTargetAtTime(0, t, quick ? 0.01 : 0.06); try { p.src.stop(t + (quick ? 0.05 : 0.25)); } catch(e){} hpPlaying.delete(i); if (!hpPlaying.size) hpDuckTo(false); renderHp(); }
async function hpPlay(i){
  const h = HP[i]; if (!h.url) { toast('Right-click the pad to load an audio file'); return; }
  if (!ctx) { toast('Press START first'); return; }
  if (hpPlaying.has(i)) { hpStop(i); return; }
  if (!hpOut) { hpOut = ctx.createGain(); hpOut.connect(masterIn); hpOut.connect(monitor); }
  hpOut.gain.value = hpVol();
  try {
    const buf = await hpBuf(h); const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.connect(g); g.connect(hpOut);
    hpPlaying.set(i, { src: s, g, start: ctx.currentTime, dur: buf.duration });
    s.onended = () => { hpPlaying.delete(i); if (!hpPlaying.size) hpDuckTo(false); renderHp(); };
    hpDuckTo(true); s.start(); renderHp();
    if (!h.dur || Math.abs(h.dur - buf.duration) > 0.5) { h.dur = buf.duration; saveHp(); }
  } catch(e){ toast('Cannot play ' + (h.name || 'this file')); }
}
(function hpTick(){
  hpPlaying.forEach((p, i) => { const b = document.querySelector(`#hpWrap .hp[data-i="${i}"]`); if (!b) return; const f = Math.min(1, (ctx.currentTime - p.start) / p.dur); b.querySelector('.hpProg').style.strokeDashoffset = HP_C * (1 - f); });
  requestAnimationFrame(hpTick);
})();
async function hpLoadFile(i, file){
  if (!file) return; if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|aac|ogg|opus|flac|webm)$/i.test(file.name)) { toast('Choose an audio file'); return; }
  toast('Loading ' + file.name + '…');
  try {
    const r = await fetch('/api/upload?name=' + encodeURIComponent('hot' + (i + 1) + '_' + file.name), { method: 'POST', headers: { 'X-Radio-Key': KEY() }, body: file });
    if (r.status === 401) { toast('Wrong broadcast password (Settings → Options)'); return; }
    const d = await r.json(); if (!d.url) throw 0;
    let dur = 0; try { if (ctx) dur = (await hpBuf({ url: d.url })).duration; } catch(e){}
    HP[i] = { name: file.name.replace(/\.[^.]+$/, ''), url: d.url, dur }; saveHp(); renderHp(); toast(`Hot button ${i + 1}: ${HP[i].name}`);
  } catch(e){ toast('Could not load the file'); }
}
function hpPick(i){ const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac'; inp.onchange = () => hpLoadFile(i, inp.files[0]); inp.click(); }
$('#hpWrap').addEventListener('click', e => { const b = e.target.closest('.hp'); if (b) hpPlay(+b.dataset.i); });
$('#hpWrap').addEventListener('contextmenu', e => { const b = e.target.closest('.hp'); if (!b) return; e.preventDefault(); const i = +b.dataset.i, h = HP[i];
  const selIt = [...PL.sel].map(u => findItem(u)).filter(Boolean).map(f => f.item).find(it => it.kind === 'track' && it.url);
  showCtx(e.clientX, e.clientY, [
    ['Load audio file…', () => hpPick(i)],
    selIt ? ['Use selected playlist song', () => { HP[i] = { name: selIt.title, url: selIt.url, dur: itemDur(selIt) }; saveHp(); renderHp(); }] : null,
    h.url ? ['Rename…', () => { const n = prompt('Name', h.name); if (n) { h.name = n; saveHp(); renderHp(); } }] : null,
    h.url ? ['Clear', () => { hpStop(i, true); HP[i] = {}; saveHp(); renderHp(); }] : null,
    ['Hot button settings…', () => ACT.hotSettings()]
  ].filter(Boolean)); });
$('#hpWrap').addEventListener('dragover', e => { const b = e.target.closest('.hp'); if (!b) return; e.preventDefault(); $$('#hpWrap .hp.drop').forEach(x => x.classList.remove('drop')); b.classList.add('drop'); });
$('#hpWrap').addEventListener('dragleave', e => { const b = e.target.closest('.hp'); if (b) b.classList.remove('drop'); });
$('#hpWrap').addEventListener('drop', e => { const b = e.target.closest('.hp'); if (!b) return; e.preventDefault(); b.classList.remove('drop'); const i = +b.dataset.i;
  if (e.dataTransfer.files && e.dataTransfer.files.length) return hpLoadFile(i, e.dataTransfer.files[0]);
  const lib = e.dataTransfer.getData('text/lib'); let it = lib ? libById.get(lib) : null;
  if (!it && dragUids) { const f = findItem(dragUids[0]); it = f && f.item.kind === 'track' && f.item.url ? f.item : null; dragUids = null; }
  if (it) { HP[i] = { name: it.title, url: it.url, dur: itemDur(it) || it.dur }; saveHp(); renderHp(); } });
function hpSettingsUI(){
  const d = store.get('hpDuck', '30'), f = store.get('hpFade', '0.4'), v = store.get('hpVol', '100');
  $('#hpDuckR').value = d; $('#hpFadeR').value = f; $('#hpVolR').value = v;
  $('#hpDuckV').textContent = +d === 0 ? 'silent' : d + '% (' + (20 * Math.log10(d / 100)).toFixed(0) + ' dB)'; $('#hpFadeV').textContent = (+f).toFixed(1) + ' s'; $('#hpVolV').textContent = v + '%';
  $('#hpDuckR').style.setProperty('--p', d + '%'); $('#hpFadeR').style.setProperty('--p', f / 2 * 100 + '%'); $('#hpVolR').style.setProperty('--p', v / 150 * 100 + '%');
}
$('#hpDuckR').oninput = () => { store.set('hpDuck', $('#hpDuckR').value); hpSettingsUI(); if (hpPlaying.size) hpDuckTo(true); };
$('#hpFadeR').oninput = () => { store.set('hpFade', $('#hpFadeR').value); hpSettingsUI(); };
$('#hpVolR').oninput = () => { store.set('hpVol', $('#hpVolR').value); hpSettingsUI(); if (hpOut) hpOut.gain.setTargetAtTime(hpVol(), ctx.currentTime, 0.03); };
hpSettingsUI(); renderHp();
fetch('/api/store/hotpads', { headers: { 'X-Radio-Key': KEY() } }).then(r => r.ok ? r.json() : null).then(d => { if (Array.isArray(d) && d.some(x => x && x.url) && !HP.some(x => x.url)) { HP = Array.from({ length: HP_N }, (_, i) => d[i] || {}); store.set('hotPads', JSON.stringify(HP)); renderHp(); } }).catch(() => {});

// hover tooltip for the hot buttons (the name is shown only on hover)
$('#hpWrap').addEventListener('mouseover', e => { const b = e.target.closest('.hp'); const t = $('#hpTip'); if (!b) return; const i = +b.dataset.i, h = HP[i], k = HK['hot' + (i + 1)];
  t.innerHTML = h.url ? `<b>${i + 1} · ${esc(h.name)}</b> <span>· ${fmtL(h.dur)}${k ? ' · ' + prettyKey(k) : ''}</span>` : `<b>Hot button ${i + 1}</b> <span>· right-click to load${k ? ' · ' + prettyKey(k) : ''}</span>`;
  const wr = $('#hpWrap').getBoundingClientRect(), br = b.getBoundingClientRect(), Z = (typeof UIZ !== 'undefined' && UIZ) || 1;
  t.classList.add('on'); const half = t.offsetWidth / 2, x = (br.left + br.width / 2 - wr.left) / Z, maxX = wr.width / Z - half; t.style.left = Math.min(Math.max(half, x), maxX) + 'px'; });
$('#hpWrap').addEventListener('mouseleave', () => $('#hpTip').classList.remove('on'));
$('#hpWrap').addEventListener('contextmenu', () => $('#hpTip').classList.remove('on'), true);


// ---------------- studio light: a USB lamp that is on while a microphone is on ----------------
// WebHID: USB relay modules (16c0:05df), blink(1) (27b8:01ed), Luxafor (04d8:f372) · Web Serial: Arduino etc. ("1" / "0")
const LIGHT = { dev: null, port: null, writer: null, state: null, type: store.get('lightType', '') };
const LIGHT_FILTERS = { relay: [{ vendorId: 0x16c0, productId: 0x05df }], blink1: [{ vendorId: 0x27b8, productId: 0x01ed }], luxafor: [{ vendorId: 0x04d8, productId: 0xf372 }] };
function lightSt(t){ const e = $('#lightSt'); if (e) e.textContent = t; }
function lightRGB(){ const h = store.get('lightColor', '#ff0000'); return [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)); }
async function lightOpenHid(dev){ if (!dev.opened) await dev.open(); LIGHT.dev = dev; lightSt('Connected: ' + (dev.productName || 'USB device')); LIGHT.state = null; lightSync(); }
async function lightAuto(){
  LIGHT.type = store.get('lightType', '');
  try {
    if (LIGHT_FILTERS[LIGHT.type] && navigator.hid) { const ds = (await navigator.hid.getDevices()).filter(d => LIGHT_FILTERS[LIGHT.type].some(f => f.vendorId === d.vendorId && f.productId === d.productId)); if (ds[0]) return lightOpenHid(ds[0]); }
    if (LIGHT.type === 'serial' && navigator.serial) { const ps = await navigator.serial.getPorts(); if (ps[0]) return lightOpenSerial(ps[0]); }
  } catch(e){}
  lightSt(LIGHT.type ? 'Not connected – press Connect…' : 'Off');
}
async function lightOpenSerial(port){ try { await port.open({ baudRate: 9600 }); } catch(e){} LIGHT.port = port; LIGHT.writer = port.writable.getWriter(); lightSt('Connected: serial board'); LIGHT.state = null; lightSync(); }
async function lightSet(on){
  try {
    const t = LIGHT.type;
    if (t === 'relay' && LIGHT.dev) { const ch = store.get('lightRelay', '1'); const cmd = ch === 'all' ? (on ? 0xFE : 0xFC) : (on ? 0xFF : 0xFD); await LIGHT.dev.sendFeatureReport(0, new Uint8Array([cmd, ch === 'all' ? 0 : +ch, 0, 0, 0, 0, 0, 0])); }
    else if (t === 'blink1' && LIGHT.dev) { const [r, g, b] = on ? lightRGB() : [0, 0, 0]; await LIGHT.dev.sendFeatureReport(1, new Uint8Array([0x63, r, g, b, 0, 10, 0, 0])); }
    else if (t === 'luxafor' && LIGHT.dev) { const [r, g, b] = on ? lightRGB() : [0, 0, 0]; await LIGHT.dev.sendReport(0, new Uint8Array([1, 0xFF, r, g, b, 0, 0, 0])); }
    else if (t === 'serial' && LIGHT.writer) await LIGHT.writer.write(new TextEncoder().encode(on ? '1\n' : '0\n'));
    else return false;
    return true;
  } catch(e){ lightSt('Lost connection – press Connect…'); LIGHT.dev = null; LIGHT.writer = null; return false; }
}
function lightSync(){ const want = !!micOn; if (want === LIGHT.state) return; LIGHT.state = want; lightSet(want); }
setInterval(lightSync, 150);
$('#lightType').value = LIGHT.type;
$('#lightColor').value = store.get('lightColor', '#ff0000');
$('#lightRelay').value = store.get('lightRelay', '1');
$('#lightType').onchange = async () => { if (LIGHT.state) await lightSet(false); store.set('lightType', $('#lightType').value); LIGHT.dev = null; LIGHT.writer = null; LIGHT.state = null; lightAuto(); };
$('#lightColor').oninput = () => { store.set('lightColor', $('#lightColor').value); LIGHT.state = null; };
$('#lightRelay').onchange = async () => { if (LIGHT.state) await lightSet(false); store.set('lightRelay', $('#lightRelay').value); LIGHT.state = null; };
$('#lightConnect').onclick = async () => {
  const t = $('#lightType').value; if (!t) { lightSt('Choose the device type first'); return; }
  try {
    if (t === 'serial') { if (!navigator.serial) return lightSt('This browser has no USB serial support – use Chrome or Edge'); return lightOpenSerial(await navigator.serial.requestPort()); }
    if (!navigator.hid) return lightSt('This browser has no WebHID – use Chrome or Edge');
    const ds = await navigator.hid.requestDevice({ filters: LIGHT_FILTERS[t] }); if (ds[0]) await lightOpenHid(ds[0]); else lightSt('No device chosen');
  } catch(e){ lightSt('Could not connect: ' + (e.message || e)); }
};
$('#lightTest').onclick = async () => { if (!(await lightSet(true))) { lightSt('Not connected – press Connect…'); return; } lightSt('Test: lamp on for 2 seconds'); setTimeout(async () => { await lightSet(!!micOn); LIGHT.state = !!micOn; lightSt('Connected'); }, 2000); };
if (navigator.hid) { navigator.hid.addEventListener('connect', () => { if (!LIGHT.dev) lightAuto(); }); navigator.hid.addEventListener('disconnect', e => { if (e.device === LIGHT.dev) { LIGHT.dev = null; lightSt('Unplugged'); } }); }
window.addEventListener('beforeunload', () => { try { lightSet(false); } catch(e){} });
lightAuto();

// ---------------- mic channels: mono mic on one side of a stereo sound card → both sides ----------------
const mchOf = inp => store.get('mch_' + inp.key, 'auto');
function rmsOf(an, buf){ an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i += 2) s += buf[i] * buf[i]; return Math.sqrt(s / (buf.length / 2)); }
function applyMch(inp){
  const c = inp.chain; if (!c || !c.gL || !ctx) return; const m = mchOf(inp), t = ctx.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.05);
  // mono node averages its inputs ((L+R)/2), so one live side is lifted ×2 to keep the level
  if (m === 'st') { set(c.gL, 0); set(c.gR, 0); set(c.stG, 1); return; }
  set(c.stG, 0);
  let k = m === 'auto' ? (c.pick || 'mix') : m;
  if (k === 'l') { set(c.gL, 2); set(c.gR, 0); } else if (k === 'r') { set(c.gL, 0); set(c.gR, 2); } else { set(c.gL, 1); set(c.gR, 1); }
}
// automatic: find the side the mic is really on (only while there is sound)
setInterval(() => { if (!ctx) return; [inputs[0], inputs[1]].forEach(inp => { const c = inp.chain; if (!c || !c.anL || mchOf(inp) !== 'auto') return;
  if (c.src.channelCount === 1 && c.stream.getAudioTracks()[0] && (c.stream.getAudioTracks()[0].getSettings().channelCount || 2) === 1) { if (c.pick !== 'mix') { c.pick = 'mix'; applyMch(inp); } return; }
  const l = rmsOf(c.anL, c.buf), r = rmsOf(c.anR, c.buf); if (Math.max(l, r) < 0.003) return;
  const k = l > r * 8 ? 'l' : r > l * 8 ? 'r' : 'mix'; if (k !== c.pick) { c.pick = k; applyMch(inp); } }); }, 400);
[1, 2].forEach(n => { const sel = $('#mch' + n), inp = inputs[n - 1]; sel.value = mchOf(inp); sel.onchange = () => { store.set('mch_' + inp.key, sel.value); if (inp.chain) { inp.chain.pick = null; applyMch(inp); } toast(inp.name + ': ' + sel.options[sel.selectedIndex].text); }; });

// ---------------- ducker: music down while a mic is on (playlist, and LINE IN if chosen) ----------------
const _applyDuckPrev = applyDuck;
applyDuck = function(){
  _applyDuckPrev();
  const L = inputs[2];
  if (ctx && L && L.on && L.chain && L.chain.onG) L.chain.onG.gain.setTargetAtTime(micOn && store.get('duckLine', '1') === '1' ? duckGain() : 1, ctx.currentTime, micOn ? 0.08 : 0.25);
  if (ctx && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(micOn ? duckGain() : 1, ctx.currentTime, micOn ? 0.08 : 0.25); }
};
$('#duckLine').classList.toggle('on', store.get('duckLine', '1') === '1');
$('#duckLine').onclick = () => { store.set('duckLine', store.get('duckLine', '1') === '1' ? '0' : '1'); $('#duckLine').classList.toggle('on', store.get('duckLine', '1') === '1'); applyDuck(); };

// headphones = the programme (what listeners hear) or music only
$('#monMode').value = store.get('monMode2', 'music');
$('#monMode').onchange = () => { setMonMode($('#monMode').value); toast($('#monMode').value === 'prog' ? 'Headphones: everything incl. microphones (with delay)' : 'Headphones: everything except microphones – use Direct monitor for your voice'); };
// hot buttons duck LINE IN too (when the ducker for LINE IN is on)
const _hpDuckToPrev = hpDuckTo;
hpDuckTo = function(on){ _hpDuckToPrev(on); const L = inputs[2]; if (ctx && L && L.on && L.chain && L.chain.onG && store.get('duckLine', '1') === '1') { const t = ctx.currentTime, g = L.chain.onG.gain, v = on ? hpDuckLv() : (micOn ? duckGain() : 1); g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + Math.max(0.01, hpFade())); } };

// ---------------- LINE IN from a browser tab (YouTube …): the tab is muted locally and heard only through OAB ----------------
const _openInputTab = openInput;
openInput = async function(inp){
  if (inp.key !== 'line' || store.get('lineSrc', 'system') !== 'tab') return _openInputTab(inp);
  if (!navigator.mediaDevices.getDisplayMedia) throw new Error('This browser cannot capture a tab');
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 1, width: 320, height: 180 },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: true, channelCount: 2 },
    preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'exclude' });
  const at = stream.getAudioTracks();
  if (!at.length) { stream.getTracks().forEach(t => t.stop()); toast('No sound was shared. Choose the YouTube tab and keep "Share tab audio" on.'); throw new Error('no audio'); }
  stream.getVideoTracks().forEach(t => { try { t.applyConstraints({ frameRate: 1 }); } catch(e){} });
  try { await at[0].applyConstraints({ suppressLocalAudioPlayback: true }); } catch(e){}
  closeInput(inp);
  const src = ctx.createMediaStreamSource(new MediaStream(at));
  const level = ctx.createGain(); level.gain.value = lineGain();
  const onG = ctx.createGain(); onG.gain.value = 0;
  src.connect(level); level.connect(onG); onG.connect(masterIn); onG.connect(monitor);   // the tab is silent locally, so OAB plays it in the headphones
  inp.chain = { stream, src, level, onG, tab: true };
  at[0].addEventListener('ended', () => { if (inp.chain && inp.chain.stream === stream) { inp.on = false; closeInput(inp); applyDuck(); renderInputs(); toast('Tab sharing stopped – LINE IN is off'); } });
  toast('LINE IN: ' + (at[0].label || 'browser tab') + ' – the tab now plays only through OAB');
  return stream;
};

// ---------------- Options window: categories on the left ----------------
function optShow(sec){
  if (!document.querySelector(`.optSec[data-sec="${sec}"]`)) sec = 'general';
  $$('.optSec').forEach(x => x.hidden = x.dataset.sec !== sec);
  $$('.optNav[data-sec]').forEach(b => { const on = b.dataset.sec === sec; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  store.set('optSec', sec); const body = $('.optBody'); if (body) body.scrollTop = 0;
}
$('.optSide').addEventListener('click', e => { const b = e.target.closest('.optNav'); if (!b) return; if (b.dataset.sec) return optShow(b.dataset.sec); closeModal('mOptions'); doAct(b.dataset.open); });
const optGo = (sec, focus) => async () => { await openOptions(sec); if (focus) { const el = $(focus); if (el) { el.scrollIntoView({ block: 'center' }); try { el.focus({ preventScroll: true }); } catch(e){} } } };
Object.assign(ACT, {
  optGeneral: optGo('general'), optOutputs: optGo('outputs'), optMics: optGo('mics'), optLine: optGo('line'), optHot: optGo('hot'), optLight: optGo('light'), optFolders: optGo('folders'), optAnn: optGo('ann'),
  streamQual: optGo('general', '#sQual'), hotSettings: optGo('hot'), lightSettings: optGo('light'), audioDevices: optGo('outputs'), micSettings: optGo('mics', '#duckR'), micComp: optGo('mics', '#optComp'),
  liveToggle: () => $('#golive').click(), msgListeners: () => $('#msgOpen').click(), listenLinks: () => openLinks(),
  whoListens: () => setTimeout(() => $('#lisTop').click(), 0), micA: () => toggleMicN(0), micB: () => toggleMicN(1),
  tLight: () => setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light'),
  rTrack: () => $('#bRepTrack').click(), rStopAfter: () => $('#bStopAfter').click(), rShuffle: () => $('#bShuffle').click(), rList: () => $('#bRepList').click(), recToggle: () => $('#rec').onclick(),
  tGlass: () => setTheme(document.documentElement.classList.contains('glass') ? 'dark' : 'glass')
});
// ---------------- light / dark interface ----------------
function setTheme(t){
  const H = document.documentElement;
  H.classList.toggle('light', t === 'light'); H.classList.toggle('glass', t === 'glass'); store.set('uiTheme', t);
  const sel = $('#uiTheme'); if (sel) sel.value = t; syncChecks(); placeGlass();
  try { drawWaves(); } catch(e){}
}
$('#uiTheme').value = document.documentElement.classList.contains('light') ? 'light' : document.documentElement.classList.contains('glass') ? 'glass' : 'dark';
// studio (glass) look: the mic rings and the ON AIR glow are placed in CSS (viewport units, same as the photo)
function placeGlass(){
  const glass = document.documentElement.classList.contains('glass'), l = $('#micLink'), mb = $('#menubar'), tool = $('.tool');
  if (glass) { const c = $('#clock'); if (l && c && l.previousElementSibling !== c) c.after(l); if (mb && tool && mb.parentNode !== tool) tool.firstElementChild.after(mb); }
  else { const m = $('#mic1'); if (l && m && l.previousElementSibling !== m) m.after(l); if (mb && tool && mb.parentNode === tool) tool.before(mb); }
}
placeGlass();
// play / pause share one button in the studio look
setInterval(() => document.documentElement.classList.toggle('isPlay', !!(curDeck && curDeck.audio && !curDeck.audio.paused)), 250);
// dock volume = playlist volume
(() => { const d = $('#dockVol'), p = $('#plVol'); if (!d || !p) return;
  const sync = () => { d.value = p.value; d.style.setProperty('--p', p.value + '%'); };
  d.oninput = () => { p.value = d.value; p.oninput(); sync(); }; p.addEventListener('input', sync); sync(); setInterval(sync, 1000); })();
// intro animation after the opening screen
$('#startBtn').addEventListener('click', () => { const H = document.documentElement; if (!H.classList.contains('glass')) return; H.classList.add('glassIn'); setTimeout(() => H.classList.remove('glassIn'), 2200); });
$('#uiTheme').onchange = () => setTheme($('#uiTheme').value);

// remaining time on the playing row
setInterval(() => { const r = document.querySelector('#plBody .plr.playing .pln'); if (!r || !curDeck || !curDeck.item) return; if (curDeck.item.uid !== r.closest('.plr').dataset.uid) return; r.textContent = '-' + fmtL(Math.max(0, itemDur(curDeck.item) - curDeck.audio.currentTime)); }, 500);

// ---------------- desktop app (OAB Studio.exe): LINE IN = the OAB YouTube window or a sound card input ----------------
// "Computer sound" would also catch OAB's own output (echo), so the desktop app offers its own YouTube window instead:
// that window is silent on the PC and its sound goes only through OAB (ducker, headphones, broadcast).
if (/Electron/i.test(navigator.userAgent) && window.oabDesktop) {
  document.documentElement.classList.add('desktopApp');
  ['#lineSrc', '#lineSrc2'].forEach(sel => { const el = $(sel); if (!el) return;
    $$(sel + ' option').forEach(o => { if (o.value === 'tab' || o.value === 'system') o.remove(); });
    const o = document.createElement('option'); o.value = 'ytwin'; o.textContent = 'OAB YouTube window – YouTube plays only through OAB (recommended)'; el.insertBefore(o, el.firstChild); });
  if (!['ytwin', ''].includes(store.get('lineSrc', 'system'))) store.set('lineSrc', 'ytwin');
  syncLineSrc();
  const n = document.createElement('div'); n.className = 'sub'; n.style.cssText = 'font-size:11.5px;line-height:1.5';
  n.innerHTML = '<b>OAB YouTube window:</b> press LINE IN – a YouTube window opens. Play anything there: it is silent on the computer and you hear it only through OAB, with the ducker when a microphone is on. For another player use the free <b>VB-Audio Virtual Cable</b> and choose "Sound card input" → CABLE Output.';
  const sec = document.querySelector('.optSec[data-sec="line"]'); if (sec) sec.appendChild(n);
  const _openInputYt = openInput;
  openInput = async function(inp){
    if (inp.key !== 'line' || store.get('lineSrc', '') !== 'ytwin') return _openInputYt(inp);
    await window.oabDesktop.openYouTube();
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1, width: 320, height: 180 }, audio: true });
    const at = stream.getAudioTracks(); if (!at.length) { stream.getTracks().forEach(t => t.stop()); throw new Error('no audio'); }
    closeInput(inp);
    const src = ctx.createMediaStreamSource(new MediaStream(at));
    const level = ctx.createGain(); level.gain.value = lineGain();
    const onG = ctx.createGain(); onG.gain.value = 0;
    src.connect(level); level.connect(onG); onG.connect(masterIn); onG.connect(monitor);
    inp.chain = { stream, src, level, onG, tab: true };
    at[0].addEventListener('ended', async () => {
      if (!inp.chain || inp.chain.stream !== stream) return;
      const wasOn = inp.on; closeInput(inp); inp.on = false; applyDuck(); renderInputs();
      if (wasOn && await window.oabDesktop.youTubeOpen()) setTimeout(() => setInput(inp, true), 600);   // page changed – pick it up again
      else toast('YouTube window closed – LINE IN is off');
    });
    toast('LINE IN = OAB YouTube window');
    return stream;
  };
  ACT.ytWindow = async () => { store.set('lineSrc', 'ytwin'); syncLineSrc(); if (!inputs[2].on) await setInput(inputs[2], true); else window.oabDesktop.openYouTube(); };
  const bm = document.querySelector('.menubar .dd [data-a="mLine"]');
  if (bm) { const d = document.createElement('div'); d.dataset.a = 'ytWindow'; d.textContent = 'YouTube window (through OAB)…'; bm.after(d); }
}

// ---------------- desktop app: ALL computer sound through OAB ----------------
// Windows plays everything into the VB-Audio virtual cable, OAB takes it as LINE IN (with the ducker)
// and plays the programme on your real speakers / headphones. Switched back when OAB closes.
if (window.oabDesktop && window.oabDesktop.pcRoute) {
  let pcOn = false;
  const syncPc = () => { $$('.dd [data-a="pcThrough"]').forEach(el => el.classList.toggle('on', pcOn)); const t = $('#pcThroughT'); if (t) t.classList.toggle('on', pcOn); };
  const devList = async kind => (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === kind && d.deviceId !== 'default' && d.deviceId !== 'communications');
  function needCable(){
    $('#miH').textContent = 'All computer sound through OAB';
    $('#miBody').innerHTML = `<div style="line-height:1.7;font-size:13px">This needs the free <b>VB-Audio Virtual Cable</b> (a virtual sound card):<ol style="margin:8px 0 8px 18px;padding:0"><li>Download it from <a href="https://vb-audio.com/Cable/" target="_blank">vb-audio.com/Cable</a> and unzip.</li><li>Right-click <b>VBCABLE_Setup_x64.exe</b> → <b>Run as administrator</b> → Install Driver.</li><li>Restart the computer, open OAB Studio and turn this on again.</li></ol>Nothing else to set: OAB switches Windows to the cable while it is open and back to your speakers when it closes.</div>`;
    openModal('mInfo');
  }
  async function pcThrough(on){
    if (!ctx) { toast('Press START first'); return; }
    if (!on) {
      await window.oabDesktop.pcRoute(false); pcOn = false; store.set('pcThrough', '0'); syncPc();
      if (inputs[2].on) await setInput(inputs[2], false);
      toast('Computer sound plays straight to the speakers again'); return;
    }
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); } catch(e){}
    const t = await window.oabDesktop.pcRouteTarget();
    if (t.error) { toast('Could not read the Windows sound devices: ' + t.error); return; }
    if (t.cable === false) { needCable(); return; }
    // 1. OAB itself must play on the real speakers / headphones (not on the cable)
    const outs = await devList('audiooutput'), nm = (t.name || '').toLowerCase();
    const real = outs.find(d => d.label && d.label.toLowerCase() === nm) || outs.find(d => d.label && nm && (d.label.toLowerCase().includes(nm) || nm.includes(d.label.toLowerCase()))) || outs.find(d => !/cable/i.test(d.label));
    if (!real) { toast('Could not find your speakers – choose Main output in Options → Sound outputs'); return; }
    store.set('devOut', real.deviceId); try { await ctx.setSinkId(real.deviceId); } catch(e){}
    if (!store.get('devPfl', '')) { try { await pfl.setSinkId(real.deviceId); } catch(e){} }
    // 2. Windows plays everything into the cable
    const r = await window.oabDesktop.pcRoute(true);
    if (r.error === 'nocable') { needCable(); return; }
    if (r.error) { toast('Could not switch the Windows sound: ' + r.error); return; }
    // 3. LINE IN = CABLE Output, heard in the headphones, with the ducker
    await new Promise(res => setTimeout(res, 400));
    const cable = (await devList('audioinput')).find(d => /CABLE Output/i.test(d.label));
    if (!cable) { toast('CABLE Output not found – restart the computer after installing VB-Cable'); await window.oabDesktop.pcRoute(false); return; }
    store.set('lineSrc', ''); store.set('dev_line', cable.deviceId); syncLineSrc();
    if (!lineMon) $('#lineMon').click();
    if (store.get('duckLine', '1') !== '1') $('#duckLine').click();
    if (inputs[2].on) await setInput(inputs[2], false);
    await setInput(inputs[2], true);
    pcOn = true; store.set('pcThrough', '1'); syncPc();
    toast('All computer sound now goes through OAB → ' + (real.label || 'speakers'));
  }
  ACT.pcThrough = () => pcThrough(!pcOn);
  const bm = document.querySelector('.menubar .dd [data-a="mLine"]');
  if (bm) { const d = document.createElement('div'); d.className = 'chk'; d.dataset.a = 'pcThrough'; d.textContent = 'All computer sound through OAB'; bm.before(d); }
  const sec = document.querySelector('.optSec[data-sec="line"] .frm');
  if (sec) { sec.insertAdjacentHTML('afterbegin', '<label>Computer sound</label><span class="tgl" id="pcThroughT"><b></b>All computer sound goes through OAB while it is open (ducker works on everything)</span>'); $('#pcThroughT').onclick = () => pcThrough(!pcOn); }
  // turn it on again by itself when the studio starts
  $('#startBtn').addEventListener('click', () => { if (store.get('pcThrough', '0') === '1') setTimeout(() => pcThrough(true), 1500); });
  syncPc();
}
