// ================= Radio Studio 1.0 – phase 1 =================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const store = { get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const fmtL = s => { if (!s || !isFinite(s)) return '—'; s = Math.round(s); return s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const hms = s => { s = Math.floor(s || 0); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const hm = t => new Date(t).toTimeString().slice(0, 5);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#7C3AED', '#0E7490', '#9D174D', '#B45309', '#15803D', '#1D4ED8', '#BE185D', '#4338CA'];
const colorFor = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]; };
const initials = s => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const dbToG = db => Math.pow(10, db / 20);
const uidGen = () => 'u' + Math.random().toString(36).slice(2, 10);
function toast(t){ const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 3200); }
$('#pw').value = store.get('radioKey', 'radio1234');
const KEY = () => $('#pw').value;
const api = (path, body, method) => fetch(path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined });
const VIEW = { info: store.get('vInfo', '1') === '1', autoscroll: store.get('vAuto', '1') === '1', follow: store.get('vFollow', '0') === '1', hours: false };

// ---------------- file types & crossfades ----------------
const FT_DEFAULT = [
  { name: 'Music', ident: '', folder: '', color: '#2D8CEB', fadeIn: 0, fadeOut: 2, mix: 2.5, prev: '', amp: 0 },
  { name: 'Station ID', ident: 'Station ID', folder: '', color: '#B57BF0', fadeIn: 0, fadeOut: 0.3, mix: 0.4, prev: '1', amp: 0 },
  { name: 'Jingle', ident: 'Jingle', folder: '', color: '#D946EF', fadeIn: 0, fadeOut: 0.3, mix: 0.4, prev: '1', amp: 0 },
  { name: 'Commercial', ident: 'Commercial', folder: '', color: '#F5A524', fadeIn: 0, fadeOut: 0.3, mix: 0.3, prev: '0.5', amp: 0 },
  { name: 'Voice track', ident: 'VT:', folder: '', color: '#3FB37F', fadeIn: 0, fadeOut: 0.5, mix: 0.5, prev: '1.5', amp: 0 },
  { name: 'News', ident: 'News', folder: '', color: '#EF4444', fadeIn: 0, fadeOut: 0.5, mix: 0.3, prev: '0.3', amp: 0 }];
let FT = (() => { try { return JSON.parse(store.get('fileTypes', '')) || FT_DEFAULT; } catch(e){ return FT_DEFAULT; } })();
let XF = (() => { try { return Object.assign({ trigger: -14, useTrigger: true }, JSON.parse(store.get('xfMain', '{}'))); } catch(e){ return { trigger: -14, useTrigger: true }; } })();
const YT_RE = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?|shorts\/|live\/|embed\/)|youtu\.be\/)\S+$/i;
const skipK = x => !x || x.kind === 'comment' || x.kind === 'dl';
const SPECIAL = { dl: { name: 'YouTube', color: '#FF5A52' }, stream: { name: 'Stream', color: '#8A8F9C' }, line: { name: 'Line in', color: '#A78BFA' }, cmd: { name: 'Command', color: '#8A8F9C' }, pause: { name: 'Pause', color: '#8A8F9C' }, comment: { name: 'Comment', color: '#C9B48A' } };
function ftOf(it){
  if (!it) return FT[0];
  if (SPECIAL[it.kind]) return Object.assign({}, FT[0], SPECIAL[it.kind], { fadeIn: 0, fadeOut: 0.5, mix: 0.5, prev: '', amp: 0 });
  if (it.ftype) { const f = FT.find(x => x.name === it.ftype); if (f) return f; }
  if (it.libKind === 'ads') return FT.find(x => x.name === 'Commercial') || FT[0];
  if (it.libKind === 'carts') return FT.find(x => x.name === 'Jingle') || FT[0];
  const hay = ((it.title || '') + ' ' + (it.artist || '') + ' ' + (it.path || '')).toLowerCase();
  for (const f of FT.slice(1)) {
    if (f.folder && it.path && it.path.toLowerCase().startsWith(f.folder.toLowerCase())) return f;
    if (f.ident && hay.includes(f.ident.toLowerCase())) return f;
  }
  return FT[0];
}
const tagHtml = f => `<span class="tag" style="background:${f.color}22;color:${f.color}">${esc(f.name.toUpperCase())}</span>`;
function renderFt(){
  $('#ftList').innerHTML = FT.map((f, i) => `<div class="ftrow" data-i="${i}" style="grid-template-columns:26px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 56px 56px 56px 56px 56px 26px">
    <input type="color" value="${f.color}" data-k="color" style="width:24px;height:24px;border:0;background:none;padding:0" aria-label="Color">
    <input class="inp" value="${esc(f.name)}" data-k="name" aria-label="Name" ${i === 0 ? 'disabled' : ''}>
    <input class="inp" value="${esc(f.ident)}" data-k="ident" placeholder="identifier" aria-label="Identifier" ${i === 0 ? 'disabled' : ''}>
    <input class="inp" value="${esc(f.folder)}" data-k="folder" placeholder="folder (optional)" aria-label="Folder" ${i === 0 ? 'disabled' : ''}>
    <input class="inp" type="number" step="0.1" value="${f.fadeIn}" data-k="fadeIn" aria-label="Fade in" title="Fade in (s)">
    <input class="inp" type="number" step="0.1" value="${f.fadeOut}" data-k="fadeOut" aria-label="Fade out" title="Fade out (s)">
    <input class="inp" type="number" step="0.1" value="${f.mix}" data-k="mix" aria-label="Mix" title="Mix point (s before end)">
    <input class="inp" type="number" step="0.1" value="${f.prev}" data-k="prev" placeholder="—" aria-label="Override previous mix" title="Override previous track's mix (s)" ${i === 0 ? 'disabled' : ''}>
    <input class="inp" type="number" step="0.5" value="${f.amp}" data-k="amp" aria-label="Amp dB" title="Amp (dB)">
    ${i === 0 ? '<span></span>' : `<button class="ic" data-del="${i}" aria-label="Delete">✕</button>`}</div>`).join('');
  $('#ftList').insertAdjacentHTML('afterbegin', '<div class="ftrow lbl" style="font-size:10px;grid-template-columns:26px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 56px 56px 56px 56px 56px 26px"><span></span><span>NAME</span><span>IDENTIFIER</span><span>FOLDER</span><span>FADE IN</span><span>FADE OUT</span><span>MIX</span><span>PREV</span><span>AMP dB</span><span></span></div>');
  $('#xfTrig').value = XF.trigger; $('#xfTrigOn').classList.toggle('on', XF.useTrigger);
}
$('#ftList').onclick = e => { const b = e.target.closest('[data-del]'); if (b) { readFt(); FT.splice(+b.dataset.del, 1); renderFt(); } };
function readFt(){ $$('#ftList .ftrow[data-i]').forEach(r => { const f = FT[+r.dataset.i]; r.querySelectorAll('[data-k]').forEach(inp => { const k = inp.dataset.k; f[k] = ['fadeIn', 'fadeOut', 'mix', 'amp'].includes(k) ? (+inp.value || 0) : inp.value; }); }); }
$('#ftAdd').onclick = () => { readFt(); FT.push({ name: 'New type', ident: '', folder: '', color: '#64748B', fadeIn: 0, fadeOut: 0.5, mix: 0.5, prev: '', amp: 0 }); renderFt(); };
$('#xfTrigOn').onclick = () => $('#xfTrigOn').classList.toggle('on');
$('#ftSave').onclick = () => { readFt(); XF.trigger = +$('#xfTrig').value || -14; XF.useTrigger = $('#xfTrigOn').classList.contains('on');
  store.set('fileTypes', JSON.stringify(FT)); store.set('xfMain', JSON.stringify(XF)); anCache.clear(); renderAll(); closeModal('mXf'); toast('Crossfades saved'); };

// ---------------- audio engine ----------------
let monMusic, monProg;
function setMonMode(m){ store.set('monMode2', m); if (!ctx || !monMusic) return; const t = ctx.currentTime; monMusic.gain.setTargetAtTime(m === 'prog' ? 0 : 1, t, 0.02); monProg.gain.setTargetAtTime(m === 'prog' ? 1 : 0, t, 0.02); }
let ctx, masterIn, masterGain, limiter, masterOut, musicBus, plVolG, hpDuck, cartBus, monitor, micOn = false, fxMeter = null;
function initAudio(){
  ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100, latencyHint: 'interactive' });
  masterIn = ctx.createGain(); masterGain = ctx.createGain(); masterGain.gain.value = (+store.get('fxGain', '100')) / 100;
  limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  masterOut = ctx.createGain(); masterOut.channelCount = 2; masterOut.channelCountMode = 'explicit';
  buildDsp(); masterGain.connect(limiter); limiter.connect(masterOut);
  musicBus = ctx.createGain(); musicBus.connect(masterIn);
  plVolG = ctx.createGain(); plVolG.gain.value = (+$('#plVol').value) / 100; hpDuck = ctx.createGain(); plVolG.connect(hpDuck); hpDuck.connect(musicBus);
  cartBus = ctx.createGain(); cartBus.connect(masterIn);
  monitor = ctx.createGain(); monMusic = ctx.createGain(); monProg = ctx.createGain(); monitor.connect(monMusic); monMusic.connect(ctx.destination);
  masterOut.connect(monProg); monProg.connect(ctx.destination); setMonMode(store.get('monMode2', 'music'));
  musicBus.connect(monitor); cartBus.connect(monitor);
  decks.forEach(d => { d.src = ctx.createMediaElementSource(d.audio); d.fade = ctx.createGain(); d.amp = ctx.createGain(); d.src.connect(d.fade); d.fade.connect(d.amp); d.amp.connect(plVolG); });
  const an = ctx.createAnalyser(); an.fftSize = 1024; masterOut.connect(an); fxMeter = { an, buf: new Float32Array(1024), lv: 0 };
  setupEncoder();
  buildMeters();
  const out = store.get('devOut', ''); if (out && ctx.setSinkId) ctx.setSinkId(out).catch(() => {});
  requestAnimationFrame(drawFx);
}
function drawFx(){
  if (fxMeter && $('#lFx').classList.contains('on')) {
    fxMeter.an.getFloatTimeDomainData(fxMeter.buf); let p = 0; for (const v of fxMeter.buf) { const a = Math.abs(v); if (a > p) p = a; }
    const lvl = Math.max(0, Math.min(1, ((p > 0 ? 20 * Math.log10(p) : -90) + 48) / 48)); fxMeter.lv = lvl > fxMeter.lv ? lvl : fxMeter.lv * 0.9 + lvl * 0.1;
    const c = $('#fxMeter'), g = c.getContext('2d'), N = 36, gap = 4, w = (c.width - gap * (N - 1)) / N, lit = Math.round(fxMeter.lv * N);
    g.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < N; i++) { const on = i < lit; g.fillStyle = i < 25 ? (on ? '#22C55E' : '#14261B') : i < 31 ? (on ? '#F5A524' : '#2A2110') : (on ? '#F04444' : '#2A1214'); g.fillRect(i * (w + gap), 0, w, c.height); }
  }
  requestAnimationFrame(drawFx);
}
$('#fxGain').value = store.get('fxGain', '100');
function showFxGain(){ const v = +$('#fxGain').value; $('#fxGainV').textContent = v === 0 ? '−∞' : (20 * Math.log10(v / 100)).toFixed(1) + ' dB'; $('#fxGain').style.setProperty('--p', (v / 2) + '%'); }
showFxGain();
$('#fxGain').oninput = () => { showFxGain(); store.set('fxGain', $('#fxGain').value); if (ctx) masterGain.gain.setTargetAtTime(+$('#fxGain').value / 100, ctx.currentTime, 0.03); };
$('#fxLim').onclick = () => { const on = !$('#fxLim').classList.contains('on'); $('#fxLim').classList.toggle('on', on); if (ctx) { limiter.threshold.value = on ? -1 : 0; limiter.ratio.value = on ? 20 : 1; } };
$('#fxAmp').onclick = () => { $('#fxAmp').classList.toggle('on'); };
$('#plVol').value = store.get('plVol', '100');
function showVol(){ $('#plVol').style.setProperty('--p', $('#plVol').value + '%'); const v = $('#plVolV'); if (v) v.textContent = $('#plVol').value + '%'; }
showVol();
$('#plVol').oninput = () => { showVol(); store.set('plVol', $('#plVol').value); if (ctx) plVolG.gain.setTargetAtTime(+$('#plVol').value / 100, ctx.currentTime, 0.03); };

// ---------------- library / search / explorer ----------------
let TAGOV = {}; try { TAGOV = JSON.parse(store.get('tagEdits', '{}')) || {}; } catch(e){}
const library = []; const libById = new Map(); let lastLibId = null;
function libItem(x, kind){ const ov = TAGOV[x.id]; if (ov) x = Object.assign({}, x, ov); const it = { id: x.id, url: x.url, title: x.title, artist: x.artist, cover: x.cover, dur: x.dur || 0, path: x.path || '', libKind: kind || 'music' }; libById.set(x.id, it); return it; }
async function loadServerLib(){
  try { const d = await (await fetch('/api/library?kind=music', { cache: 'no-store' })).json();
    const local = library.filter(i => i.file); library.length = 0;
    d.items.forEach(x => library.push(libItem(x, 'music'))); library.push(...local); renderLib();
    if (d.scanning) setTimeout(loadServerLib, 2500); } catch(e){}
}
function artStyle(it){ const img = it.cover || it.image; return img ? `background-image:url('${esc(img)}')` : `background:${colorFor(it.artist || it.title)}`; }
function artText(it){ return (it.cover || it.image) ? '' : esc(initials(it.artist || it.title)); }
const libRow = it => `<div class="row" draggable="true" data-lib="${esc(it.id)}" title="Double-click: add · Alt+click: prelisten"><div class="art" style="${artStyle(it)}">${artText(it)}</div><div style="flex:1;min-width:0"><div class="ell" style="font-weight:600">${esc(it.title)}</div><div class="ell sub" style="font-size:11px">${esc(it.artist || 'Unknown artist')} · ${fmtL(it.dur)}</div></div><button class="ic" data-la="pfl" title="Prelisten" aria-label="Prelisten">🎧</button><button class="ic" data-la="after" title="Insert after playing (Insert)" aria-label="Insert after playing">⤵</button><button class="ic" data-la="end" title="Add to end (Num −)" aria-label="Add to end">＋</button></div>`;
let srcTab = 'lib', onlineRes = [], onlineNote = '', searchT;
function renderLib(){
  if (srcTab !== 'lib') { renderOnline(); return; }
  const q0 = $('#search').value.trim();
  if (YT_RE.test(q0)) { $('#libCount').textContent = 'YouTube link'; $('#libList').innerHTML = `<div class="row"><div class="art" style="background:#FF0000;color:#fff">▶</div><div style="flex:1;min-width:0"><div style="font-weight:600">Song from YouTube</div><div class="ell sub" style="font-size:11px">${esc(q0)}</div></div><button class="btn sm pri" data-ytlink="${esc(q0)}">⬇ Add to playlist</button></div>`; return; }
  const q = $('#search').value.trim().toLowerCase();
  const list = library.filter(i => !q || (i.title + ' ' + i.artist).toLowerCase().includes(q));
  $('#libCount').textContent = library.length ? `${library.length} songs · ${Math.min(list.length, 300)} shown · Insert = after playing` : 'No songs. Set your music folder in Settings → Options.';
  $('#libList').innerHTML = list.slice(0, 300).map(libRow).join('');
}
$('#search').oninput = () => { if (srcTab === 'lib') renderLib(); else { clearTimeout(searchT); searchT = setTimeout(runOnline, 450); } };
$('#stabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; srcTab = b.dataset.t;
  [...$('#stabs').children].forEach(x => x.style.background = x === b ? '#262A33' : ''); if (srcTab === 'lib') renderLib(); else runOnline(); };
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/official|video|lyrics|audio|hd|4k/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function libMatch(r){ const t = norm(r.title), a = norm(r.artist); return library.find(i => { const it = norm(i.title); return it && (t.includes(it) || it.includes(t)) && (!a || !i.artist || a.includes(norm(i.artist)) || norm(i.artist).includes(a) || t.includes(norm(i.artist))); }); }
async function runOnline(){
  const q = $('#search').value.trim();
  if (!q) { onlineRes = []; onlineNote = 'Type a song or artist.'; renderOnline(); return; }
  $('#libCount').textContent = 'Searching…';
  try { const d = await (await fetch('/api/search?src=' + srcTab + '&q=' + encodeURIComponent(q))).json(); onlineRes = d.items || []; onlineNote = d.note || ''; }
  catch(e){ onlineRes = []; onlineNote = 'Search failed. Check the internet connection.'; }
  renderOnline();
}
function renderOnline(){
  $('#libCount').textContent = onlineNote || (onlineRes.length + ' results · songs play from your own files');
  $('#libList').innerHTML = onlineRes.map((r, i) => { const m = libMatch(r);
    return m ? libRow(m) : `<div class="row"><div class="art" style="${r.image ? `background-image:url('${esc(r.image)}')` : 'background:' + colorFor(r.artist)}">${r.image ? '' : esc(initials(r.artist))}</div><div style="flex:1;min-width:0"><div class="ell" style="font-weight:600">${esc(r.title)}</div><div class="ell sub" style="font-size:11px">${esc(r.artist)} · not in library</div></div>${r.videoId ? `<button class="btn sm" data-ytadd="${i}" title="Download and add to the playlist">⬇ Add</button>` : `<button class="btn sm" data-find="${i}">Find</button>`}</div>`; }).join('');
}
function onLibClick(e){
  const ya = e.target.closest('[data-ytadd]'); if (ya) { const r = onlineRes[+ya.dataset.ytadd]; addYt('https://www.youtube.com/watch?v=' + r.videoId, 'end', r.title); return; }
  const yl = e.target.closest('[data-ytlink]'); if (yl) { addYt(yl.dataset.ytlink, 'end'); $('#search').value = ''; renderLib(); return; }
  const f = e.target.closest('[data-find]'); if (f) { const r = onlineRes[+f.dataset.find]; $('#stabs button[data-t="lib"]').click(); $('#search').value = r.title.replace(/\(.*?\)|\[.*?\]/g, '').trim(); renderLib(); return; }
  const row = e.target.closest('[data-lib]'); if (!row) return; const it = libById.get(row.dataset.lib); if (!it) return; lastLibId = it.id;
  const a = e.target.closest('[data-la]');
  if (e.altKey || (a && a.dataset.la === 'pfl')) { prelisten(it); return; }
  if (a && a.dataset.la === 'after') { insertAfterPlaying([fromLib(it)]); return; }
  if (a && a.dataset.la === 'end') { addToView([fromLib(it)]); return; }
}
$('#libList').addEventListener('click', onLibClick);
$('#libList').addEventListener('dblclick', e => { const row = e.target.closest('[data-lib]'); if (row && !e.target.closest('button')) addToView([fromLib(libById.get(row.dataset.lib))]); });
// explorer
let exKind = 'music', exPath = '', exFiles = [];
async function explore(kind, path){
  exKind = kind; exPath = path || '';
  try { const d = await (await fetch('/api/browse?kind=' + kind + '&path=' + encodeURIComponent(exPath))).json();
    exPath = d.path || ''; exFiles = d.files.map(x => libItem(x, kind));
    const parts = exPath ? exPath.split('/') : [];
    $('#exCrumbs').innerHTML = `<span data-p="">${{ music: 'Music', ads: 'Ads', carts: 'Jingles' }[kind]}</span>` + parts.map((p, i) => ` / <span data-p="${esc(parts.slice(0, i + 1).join('/'))}">${esc(p)}</span>`).join('');
    $('#exList').innerHTML = (d.error ? `<div class="sub" style="padding:8px">${esc(d.error)} – set it in Settings → Options.</div>` : '') +
      d.dirs.map(n => `<div class="row" data-dir="${esc((exPath ? exPath + '/' : '') + n)}" style="cursor:pointer"><span style="width:32px;text-align:center;font-size:16px">📁</span><div class="ell" style="flex:1">${esc(n)}</div></div>`).join('') + exFiles.map(libRow).join('');
  } catch(e){ $('#exList').innerHTML = '<div class="sub" style="padding:8px">Server not reachable.</div>'; }
}
$$('[data-root]').forEach(b => b.onclick = () => explore(b.dataset.root, ''));
$('#exCrumbs').onclick = e => { const s = e.target.closest('[data-p]'); if (s) explore(exKind, s.dataset.p); };
$('#exList').addEventListener('click', e => { const d = e.target.closest('[data-dir]'); if (d) { explore(exKind, d.dataset.dir); return; } onLibClick(e); });
$('#exList').addEventListener('dblclick', e => { const row = e.target.closest('[data-lib]'); if (row && !e.target.closest('button')) addToView([fromLib(libById.get(row.dataset.lib))]); });
$('#exAddAll').onclick = () => { if (exFiles.length) addToView(exFiles.map(fromLib)); };
function libDragStart(e){ const row = e.target.closest('[data-lib]'); if (!row) return; e.dataTransfer.setData('text/lib', row.dataset.lib); e.dataTransfer.effectAllowed = 'copy'; }
$('#libList').addEventListener('dragstart', libDragStart); $('#exList').addEventListener('dragstart', libDragStart);

// ---------------- playlists ----------------
const PL = { tabs: [], view: 0, active: 0, cur: null, pq: [], sel: new Set(), anchor: null, clip: [], repeatTrack: false, stopAfter: false, shuffle: false, repeatList: false, shufflePick: null, stopOnce: false, lastListeners: 0 };
function newTab(name){ return { id: uidGen(), name: name || 'Playlist ' + (PL.tabs.length + 1), items: [], queueMode: false }; }
function fromLib(it){ return { uid: uidGen(), kind: 'track', id: it.id, url: it.url, file: it.file, title: it.title, artist: it.artist, cover: it.cover, dur: it.dur, path: it.path, libKind: it.libKind }; }
const viewTab = () => PL.tabs[PL.view];
const activeTab = () => PL.tabs[PL.active];
function findItem(uid){ for (let t = 0; t < PL.tabs.length; t++) { const i = PL.tabs[t].items.findIndex(x => x.uid === uid); if (i > -1) return { t, i, item: PL.tabs[t].items[i] }; } return null; }
const curItem = () => { const f = PL.cur && findItem(PL.cur); return f ? f.item : null; };
function addToView(items, at){ const tab = viewTab(); if (at == null) tab.items.push(...items); else tab.items.splice(at, 0, ...items); afterChange(); toast(items.length === 1 ? 'Added: ' + items[0].title : items.length + ' items added'); }
function insertAfterPlaying(items){
  const f = PL.cur && findItem(PL.cur);
  if (f) { PL.tabs[f.t].items.splice(f.i + 1, 0, ...items); PL.shufflePick = null; afterChange(); toast('Inserted after the playing track'); }
  else addToView(items);
}
let saveT;
function afterChange(){ renderPlaylist(); updateNext(); clearTimeout(saveT); saveT = setTimeout(savePlaylists, 1200); }
function serial(){ return { active: PL.active, view: PL.view, tabs: PL.tabs.map(t => ({ id: t.id, name: t.name, queueMode: t.queueMode, items: t.items.filter(i => !i.file).map(i => { const o = Object.assign({}, i); delete o.file; delete o.startedAt; return o; }) })) }; }
async function savePlaylists(manual){
  const data = serial(); store.set('playlists', JSON.stringify(data));
  try { const r = await api('/api/playlists', data); if (manual) toast(r.ok ? 'Playlists saved' : 'Save failed (password?)'); } catch(e){ if (manual) toast('Saved in this browser (server offline)'); }
}
async function loadPlaylists(){
  let data = null;
  try { const r = await api('/api/playlists'); if (r.ok) data = await r.json(); } catch(e){}
  if (!data || !data.tabs) { try { data = JSON.parse(store.get('playlists', 'null')); } catch(e){} }
  if (data && data.tabs && data.tabs.length) { PL.tabs = data.tabs.map(t => Object.assign(newTab(t.name), t)); PL.view = Math.min(data.view || 0, PL.tabs.length - 1); PL.active = Math.min(data.active || 0, PL.tabs.length - 1); }
  else PL.tabs = [newTab('Main'), newTab('Night')];
  renderTabs(); renderPlaylist(); updateNext();
}
function renderTabs(){
  $('#plTabs').innerHTML = PL.tabs.map((t, i) => `<span class="${i === PL.view ? 'on' : ''}" data-tab="${i}" title="Right-click for options">${esc(t.name)}${i === PL.active ? ' <span style="color:var(--green)">●</span>' : ''}${t.queueMode ? ' <span class="sub" style="font-size:10px">Q</span>' : ''}</span>`).join('') +
    `<span data-tab="+" title="New playlist">+</span><div style="margin-left:auto;display:flex;align-items:center;gap:8px;padding-bottom:5px"><span class="sub" style="font-size:11px" id="plSum"></span><button class="btn sm" id="plAdd">+ Add ▾</button></div>`;
  $('#plAdd').onclick = e => { e.stopPropagation(); showCtx(e.clientX, e.clientY + 10, [['Add file…', () => doAct('addFiles')], ['Add folder…', () => doAct('addFolder')], ['Add Line In…', () => doAct('addLine')], ['Add YouTube link…', () => doAct('addYt')]]); };
}
$('#plTabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (!t) return; if (t.dataset.tab === '+') { PL.tabs.push(newTab()); PL.view = PL.tabs.length - 1; } else PL.view = +t.dataset.tab; PL.sel.clear(); renderTabs(); afterChange(); });
$('#plTabs').addEventListener('contextmenu', e => { const t = e.target.closest('[data-tab]'); if (!t || t.dataset.tab === '+') return; e.preventDefault(); const i = +t.dataset.tab, tab = PL.tabs[i];
  showCtx(e.clientX, e.clientY, [['Rename…', () => { const n = prompt('Playlist name', tab.name); if (n) { tab.name = n.trim(); renderTabs(); afterChange(); } }],
    [(tab.queueMode ? '✓ ' : '') + 'Queue mode (remove after playback)', () => { tab.queueMode = !tab.queueMode; renderTabs(); afterChange(); }],
    ['Set as active playlist', () => { PL.active = i; renderTabs(); afterChange(); }],
    ['Export as M3U…', () => exportM3u(tab)], '-',
    ['Delete playlist', () => { if (PL.tabs.length < 2) return toast('Keep at least one playlist'); if (!confirm('Delete "' + tab.name + '"?')) return; if (findItem(PL.cur) && findItem(PL.cur).t === i) return toast('This playlist is playing'); PL.tabs.splice(i, 1); PL.view = 0; if (PL.active >= PL.tabs.length) PL.active = 0; else if (PL.active > i) PL.active--; renderTabs(); afterChange(); }]]); });

// ---- analysis (waveform + level-triggered mix point) ----
const anCache = new Map(); const anQueue = []; let anBusy = false;
function srcUrl(it){ if (it.file) { if (!it._blob) it._blob = URL.createObjectURL(it.file); return it._blob; } if (it.kind === 'stream') return '/proxy?key=' + encodeURIComponent(KEY()) + '&url=' + encodeURIComponent(it.url); return it.url; }
function analyze(it){ if (!it || it.kind !== 'track') return null; const k = it.id || it.uid; if (anCache.has(k)) return anCache.get(k); if (!anQueue.includes(it)) { anQueue.push(it); runAn(); } return null; }
async function runAn(){
  if (anBusy) return; const it = anQueue.shift(); if (!it) return; anBusy = true;
  try {
    const ab = it.file ? await it.file.arrayBuffer() : await (await fetch(it.url)).arrayBuffer();
    const oc = new OfflineAudioContext(1, 1, 11025); const buf = await oc.decodeAudioData(ab);
    const ch = buf.getChannelData(0), sr = buf.sampleRate, n = 200, step = Math.max(1, Math.floor(ch.length / n)), peaks = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step && j < ch.length; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; } peaks.push(m); }
    const lows = new Array(n).fill(0), mids = new Array(n).fill(0), highs = new Array(n).fill(0);
    { const k1 = 1 - Math.exp(-2 * Math.PI * 200 / sr), k2 = 1 - Math.exp(-2 * Math.PI * 2200 / sr); let l1 = 0, l2 = 0;
      for (let j = 0; j < ch.length; j++) { const x = ch[j]; l1 += k1 * (x - l1); l2 += k2 * (x - l2); const i = Math.min(n - 1, Math.floor(j / step));
        const lo = Math.abs(l1), mi = Math.abs(l2 - l1), hi = Math.abs(x - l2); if (lo > lows[i]) lows[i] = lo; if (mi > mids[i]) mids[i] = mi; if (hi > highs[i]) highs[i] = hi; }
      const nm = arr => { const m = Math.max(1e-4, ...arr); for (let i = 0; i < arr.length; i++) arr[i] /= m; }; nm(lows); nm(mids); nm(highs); }
    const win = Math.floor(sr * 0.1); let lastLoud = 0, firstLoud = null, sumAll = 0, cntAll = 0; const thr = dbToG(XF.trigger); const sil = dbToG(-45); let firstSnd = null, lastSnd = 0;
    for (let p = 0; p + win <= ch.length; p += win) { let s = 0; for (let j = p; j < p + win; j += 2) s += ch[j] * ch[j]; const rms = Math.sqrt(s / (win / 2)); if (rms > sil) { sumAll += s; cntAll += win / 2; lastSnd = (p + win) / sr; if (firstSnd === null) firstSnd = p / sr; } if (rms > thr) { lastLoud = (p + win) / sr; if (firstLoud === null) firstLoud = p / sr; } }
    anCache.set(it.id || it.uid, { peaks, lows, mids, highs, lastLoud, firstLoud: firstLoud || 0, dur: buf.duration, rms: cntAll ? Math.sqrt(sumAll / cntAll) : 0, firstSnd: firstSnd || 0, lastSnd: lastSnd || buf.duration });
    decks.forEach(d => { if (d.item === it) d.amp.gain.setTargetAtTime(ampFor(it), ctx.currentTime, 0.3); });
    if (!it.dur) it.dur = buf.duration;
    drawWaves(); if (anQueue.length === 0) renderPlaylist();
  } catch(e){ anCache.set(it.id || it.uid, null); }
  anBusy = false; setTimeout(runAn, 30);
}
function itemDur(it){ if (!it) return 0; if (it.kind === 'comment' || it.kind === 'cmd') return 0; const a = it.kind === 'track' && anCache.get(it.id || it.uid); return (a && a.dur) || it.dur || 0; }
function mixStart(it, nx){
  const dur = itemDur(it); if (!dur) return Infinity;
  if (it.kind === 'pause' || it.kind === 'line') return dur;
  const nf = nx ? ftOf(nx) : null;
  if (nf && nf.prev !== '' && nf.prev != null && !isNaN(+nf.prev)) return Math.max(0, (tmOf(it).cueOut || dur) - (+nf.prev));
  const f = ftOf(it); const tm = tmOf(it); const end = tm.cueOut || dur;
  if (tm.mix) return Math.min(tm.mix, end);
  let start = end - (+f.mix || 0);
  const a = it.kind === 'track' && anCache.get(it.id || it.uid);
  if (f === FT[0] && XF.useTrigger && a && a.lastLoud > 0 && !tm.cueOut) start = Math.min(start, a.lastLoud);
  if (GAP.on && a && a.lastSnd && !tm.cueOut) start = Math.min(start, a.lastSnd - (+f.mix || 0) * 0.5);
  return Math.max(0, start);
}

// ---- decks / engine ----
const decks = [0, 1].map(n => { const a = new Audio(); a.preload = 'auto'; return { n, audio: a, item: null, retiring: false, token: 0 }; });
decks.forEach(d => { d.audio.addEventListener('ended', () => onDeckEnded(d)); d.audio.addEventListener('error', () => { if (d.item && d.item.uid === PL.cur && !d.retiring) { toast('Cannot play: ' + d.item.title); markPlayed(d.item); PL.cur = null; advance('error'); } }); });
let curDeck = null, mixFired = false, pauseState = null, lineState = null;
const isPlaying = () => !!(curDeck && !curDeck.audio.paused) || !!pauseState || !!lineState;
function peekNext(){
  if (PL.pq.length) { const f = findItem(PL.pq[0]); if (!f) { PL.pq.shift(); return peekNext(); } if (!skipK(f.item)) return f.item; }
  const tab = activeTab(); if (!tab) return null; const items = tab.items; const idx = items.findIndex(x => x.uid === PL.cur);
  if (PL.shuffle) {
    if (PL.shufflePick && items.some(x => x.uid === PL.shufflePick)) return items.find(x => x.uid === PL.shufflePick);
    let c = items.filter(x => x.uid !== PL.cur && !x.played && !skipK(x));
    if (!c.length && PL.repeatList) c = items.filter(x => x.uid !== PL.cur && !skipK(x));
    if (!c.length) return null; const p = c[Math.floor(Math.random() * c.length)]; PL.shufflePick = p.uid; return p;
  }
  for (let j = idx + 1; j < items.length; j++) if (!skipK(items[j])) return items[j];
  if (PL.repeatList) for (let j = 0; j < items.length; j++) if (!skipK(items[j]) && items[j].uid !== PL.cur) return items[j];
  return null;
}
function takeNext(){ const n = peekNext(); if (n && PL.pq[0] === n.uid) PL.pq.shift(); PL.shufflePick = null; return n; }
function markPlayed(it){
  if (!it) return; it.played = true;
  const f = findItem(it.uid); if (f && PL.tabs[f.t].queueMode && !PL.repeatTrack) PL.tabs[f.t].items.splice(f.i, 1);
}
function retire(d, fadeOut){
  if (!d || !d.item) return; d.retiring = true; const tok = ++d.token;
  if (fadeOut > 0.05) { const t = ctx.currentTime; d.fade.gain.cancelScheduledValues(t); d.fade.gain.setValueAtTime(d.fade.gain.value, t); d.fade.gain.linearRampToValueAtTime(0, t + fadeOut);
    setTimeout(() => { if (d.token === tok) { d.audio.pause(); d.item = null; d.retiring = false; } }, fadeOut * 1000 + 60); }
}
async function playItem(it, opts = {}){
  if (!ctx) return;
  if (it.kind === 'dl') { if (it.dlErr) ytRetry(it); else toast('Still downloading from YouTube – it will play when ready'); return; }
  const prev = curItem(), prevDeck = curDeck;
  // finish previous
  if (pauseState) { clearTimeout(pauseState.t); pauseState = null; }
  if (lineState) { clearTimeout(lineState.t); lineState = null; if (inputs[2].on) setInput(inputs[2], false); }
  if (prev && prev.uid !== it.uid) markPlayed(prev);
  const f = findItem(it.uid); if (f) PL.active = f.t;
  PL.cur = it.uid; mixFired = false; it.played = false; it.startedAt = Date.now(); it.listeners = PL.lastListeners;
  const fadeOutPrev = opts.fadeOut != null ? opts.fadeOut : (prev ? (+ftOf(prev).fadeOut || 0) : 0);
  if (it.kind === 'comment') { markPlayed(it); return advance('skip'); }
  if (it.kind === 'cmd') { if (prevDeck) retire(prevDeck, fadeOutPrev); curDeck = null; return runCmd(it); }
  if (it.kind === 'pause' || it.kind === 'line') {
    if (prevDeck) retire(prevDeck, fadeOutPrev); curDeck = null;
    const dur = itemDur(it);
    if (it.kind === 'line') { await setInput(inputs[2], true); lineState = { start: Date.now(), dur, t: dur ? setTimeout(() => { lineState = null; setInput(inputs[2], false); advance('end'); }, dur * 1000) : null }; }
    else pauseState = { start: Date.now(), dur, t: setTimeout(() => { pauseState = null; advance('end'); }, (dur || 1) * 1000) };
    sendMeta(it); logPlay(it); renderAll(); return;
  }
  const d = decks.find(x => x !== prevDeck && !x.item) || decks.find(x => x !== prevDeck) || decks[0];
  if (d.retiring) { d.token++; d.audio.pause(); d.retiring = false; }
  const ft = ftOf(it), t = ctx.currentTime;
  d.item = it; d.token++;
  const url = srcUrl(it); if (d.audio.dataset.src !== url) { d.audio.src = url; d.audio.dataset.src = url; }
  d.audio.currentTime = opts.from != null ? opts.from : cueInOf(it);
  d.amp.gain.value = ampFor(it);
  d.fade.gain.cancelScheduledValues(t);
  if (ft.fadeIn > 0.05) { d.fade.gain.setValueAtTime(0, t); d.fade.gain.linearRampToValueAtTime(1, t + ft.fadeIn); } else d.fade.gain.setValueAtTime(1, t);
  try { await d.audio.play(); } catch(e){ toast('Cannot play: ' + it.title); markPlayed(it); d.item = null; return advance('error'); }
  if (prevDeck && prevDeck !== d) retire(prevDeck, fadeOutPrev);
  curDeck = d; analyze(it); sendMeta(it); loadArt(it); logPlay(it);
  if (VIEW.follow) { PL.sel = new Set([it.uid]); }
  renderAll(true);
}
function advance(mode){
  if (PL.stopOnce) { PL.stopOnce = false; if (mode === 'auto') return; return stopAll(0.3); }
  const nx = takeNext();
  if (!nx) { if (mode !== 'auto') { const c = curItem(); if (c) markPlayed(c); PL.cur = null; curDeck = null; renderAll(); } return; }
  playItem(nx, mode === 'manual' ? { fadeOut: 1 } : {});
}
function runCmd(it){
  const [c, ...a] = (it.cmd || '').trim().split(/\s+/); const arg = a.join(' ');
  markPlayed(it); PL.cur = it.uid;
  switch ((c || '').toLowerCase()) {
    case 'stop': case 'pause': PL.cur = null; renderAll(); return;
    case 'setvol': $('#plVol').value = Math.max(0, Math.min(100, +arg || 0)); $('#plVol').oninput(); break;
    case 'golive': if (!live) goLive(true); break;
    case 'stoplive': if (live) goLive(false); break;
    case 'rec': fetch('/api/rec', { method: 'POST', headers: { 'X-Radio-Key': KEY() }, body: JSON.stringify({ on: arg !== 'off' }) }); break;
    case 'shuffle': PL.shuffle = arg !== 'off'; break;
    case 'repeat': PL.repeatList = arg !== 'off'; break;
  }
  advance('skip');
}
function onDeckEnded(d){
  if (d !== curDeck || d.retiring) { d.item = null; d.retiring = false; return; }
  const it = d.item;
  if (PL.repeatTrack && it) { d.audio.currentTime = 0; d.audio.play(); it.startedAt = Date.now(); mixFired = false; renderAll(); return; }
  if (PL.stopAfter || PL.stopEach) { const nx = peekNext(); PL.stopAfter = false; setT('bStopAfter', false); markPlayed(it); PL.cur = null; curDeck = null; d.item = null; waitNext(nx); renderAll(); return; }
  if (!mixFired) { d.item = null; curDeck = null; advance('end'); }
  else { d.item = null; }
}
function stopAll(fade){
  decks.forEach(d => { if (d.item) retire(d, fade || 0.3); });
  if (pauseState) { clearTimeout(pauseState.t); pauseState = null; } if (lineState) { clearTimeout(lineState.t); lineState = null; setInput(inputs[2], false); }
  curDeck = null; mixFired = false; renderAll();
}
function engineTick(){
  if (!ctx) return;
  const it = curItem();
  if (curDeck && it && !curDeck.audio.paused && !mixFired && $('#autoMix').classList.contains('on') && !PL.stopAfter && !PL.stopEach && !PL.repeatTrack) {
    const pos = curDeck.audio.currentTime, nx = peekNext(); const ms = mixStart(it, nx); const co = tmOf(it).cueOut;
    if ((it.kind === 'stream' && it.dur && pos >= it.dur) || (co && pos >= co)) { mixFired = true; if (nx) advance('auto'); else { stopAll(0.5); } }
    else if (nx && isFinite(ms) && pos >= ms) {
      if (nx.kind === 'cmd' && /^(stop|pause)\b/i.test(nx.cmd || '')) { mixFired = true; takeNext(); markPlayed(nx); PL.stopAfter = true; }
      else { mixFired = true; advance('auto'); }
    }
  }
  if (curDeck && it && !curDeck.audio.paused && !mixFired && tmOf(it).cueOut && curDeck.audio.currentTime >= tmOf(it).cueOut) { mixFired = true; if (PL.stopAfter || PL.stopEach || !peekNext()) { const nx = peekNext(); PL.stopAfter = false; setT('bStopAfter', false); markPlayed(it); PL.cur = null; stopAll(0.4); waitNext(nx); } else advance('auto'); }
  // preload analysis of next
  const nx = peekNext(); if (nx) analyze(nx);
  updatePlayerUI();
}
// transport buttons
$('#bPlay').onclick = () => {
  if (!ctx) return; if (curDeck && curDeck.audio.paused && curDeck.item) { curDeck.audio.play(); renderAll(); return; }
  const tab = viewTab(); let it = [...PL.sel].map(u => findItem(u)).filter(Boolean).map(f => f.item)[0] || tab.items.find(x => !x.played && !skipK(x)) || tab.items[0];
  if (!it) return toast('The playlist is empty'); playItem(it, { fadeOut: 1 });
};
$('#bPause').onclick = () => { if (curDeck && curDeck.item) { if (curDeck.audio.paused) curDeck.audio.play(); else curDeck.audio.pause(); renderAll(); } };
$('#bStop').onclick = () => stopAll(0.4);
$('#bNext').onclick = () => { if (!ctx) return; if (!PL.cur) return $('#bPlay').onclick(); mixFired = true; advance('manual'); };
$('#bPrev').onclick = () => { const f = PL.cur && findItem(PL.cur); if (!f) return; const items = PL.tabs[f.t].items; for (let j = f.i - 1; j >= 0; j--) if (!skipK(items[j])) return playItem(items[j], { fadeOut: 1 }); };
function setT(id, on){ $('#' + id).classList.toggle('on', on); }
$('#bRepTrack').onclick = () => { PL.repeatTrack = !PL.repeatTrack; setT('bRepTrack', PL.repeatTrack); };
$('#bStopAfter').onclick = () => { PL.stopAfter = !PL.stopAfter; setT('bStopAfter', PL.stopAfter); };
// stop after every song: the playlist stops when a song ends and the next song waits (selected) for Play
PL.stopEach = store.get('stopEach', '0') === '1';
function waitNext(nx){ try { if (nx) { PL.sel = new Set([nx.uid]); PL.anchor = nx.uid; renderPlaylist(); } } catch(e){} }
$('#bStopEach').onclick = () => { PL.stopEach = !PL.stopEach; store.set('stopEach', PL.stopEach ? '1' : '0'); setT('bStopEach', PL.stopEach); toast(PL.stopEach ? 'Stop after song ON – after each song the playlist stops and the next song waits for Play' : 'Stop after song OFF – the playlist plays on'); };
setT('bStopEach', PL.stopEach);
$('#bShuffle').onclick = () => { PL.shuffle = !PL.shuffle; PL.shufflePick = null; setT('bShuffle', PL.shuffle); updateNext(); };
$('#bRepList').onclick = () => { PL.repeatList = !PL.repeatList; setT('bRepList', PL.repeatList); updateNext(); };
$('#autoMix').classList.toggle('on', store.get('autoMix', '1') === '1');
$('#autoMix').onclick = () => { const on = !$('#autoMix').classList.contains('on'); $('#autoMix').classList.toggle('on', on); store.set('autoMix', on ? '1' : '0'); syncChecks(); toast('Auto mix ' + (on ? 'on' : 'off')); };

// ---------------- rendering ----------------
function computeStarts(tab){
  const res = new Map(); const items = tab.items; let i0 = items.findIndex(x => x.uid === PL.cur); let t;
  if (i0 > -1) {
    const cur = items[i0]; res.set(cur.uid, cur.startedAt);
    const pos = curDeck && curDeck.item === cur ? curDeck.audio.currentTime : pauseState ? (Date.now() - pauseState.start) / 1000 : lineState ? (Date.now() - lineState.start) / 1000 : 0;
    const nx = items.slice(i0 + 1).find(x => !skipK(x)); const ms = mixStart(cur, nx);
    t = Date.now() + ((isFinite(ms) ? ms : itemDur(cur)) - pos) * 1000;
    items.slice(0, i0).forEach(x => x.startedAt && res.set(x.uid, x.startedAt));
  } else { t = Date.now(); i0 = -1; }
  for (let j = i0 + 1; j < items.length; j++) { const x = items[j]; res.set(x.uid, t); if (skipK(x)) continue; const nx = items.slice(j + 1).find(y => !skipK(y)); const ms = mixStart(x, nx); t += (isFinite(ms) ? ms : itemDur(x)) * 1000; }
  return res;
}
const KI = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  ad: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  stream: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  line: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  cmd: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  comment: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', dl: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'
};
function kindIcon(it, ft){
  const n = (ft && ft.name || '').toLowerCase();
  const k = KI[it.kind] ? it.kind : /jingle|voice|id/.test(n) ? 'mic' : /ad|promo|spot/.test(n) ? 'ad' : 'music';
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KI[k]}</svg>`;
}
function stateIcon(it, isCur, isNext){
  const ft = ftOf(it);
  if (isCur) return curDeck && curDeck.audio.paused ? `<div class="st" style="color:#fff">❚❚</div>` : `<div class="st stm"><canvas class="rowM" aria-label="Playing – level"></canvas></div>`;
  if (isNext) return `<div class="st" style="background:#13233A;color:#8CC2FF">▸</div>`;
  if (it.played) return `<div class="st pdone">✓</div>`;
  return `<div class="st">${it.sched ? '⏱' : ''}</div>`;
}
let lastCurRendered = null;
function renderPlaylist(scrollToCur){
  const tab = viewTab(); if (!tab) return;
  const starts = computeStarts(tab); const nx = PL.tabs[PL.active] === tab || true ? peekNext() : null;
  let lastHour = null, n = 0, html = '';
  const totalDur = tab.items.reduce((a, x) => a + itemDur(x), 0);
  tab.items.forEach(it => {
    const st = starts.get(it.uid);
    if (VIEW.hours && st) { const h = new Date(st).getHours(); if (h !== lastHour) { html += `<div class="hm">— ${String(h).padStart(2, '0')}:00 —</div>`; lastHour = h; } }
    n++; const isCur = it.uid === PL.cur, isNext = nx && it.uid === nx.uid; const ft = ftOf(it); const qi = PL.pq.indexOf(it.uid);
    const cls = ['plr', it.played && !isCur ? 'played' : '', isCur ? 'playing' : '', isNext ? 'next' : '', PL.sel.has(it.uid) ? 'sel' : '', it.kind === 'comment' ? 'comment' : '', ft.name === 'Voice track' ? 'vt' : ''].join(' ');
    const title = it.kind === 'dl' ? (it.dlErr ? '✕ YouTube failed (double-click to retry): ' + it.dlErr : '⬇ Downloading from YouTube… ' + Math.round(it.prog || 0) + '%' + (it.st ? ' · ' + it.st : '') + (it.ytTitle ? ' · ' + it.ytTitle : '')) : it.kind === 'cmd' ? 'Command: ' + it.cmd : it.kind === 'pause' ? 'Timed pause' : it.kind === 'comment' ? it.title : it.title;
    const artist = it.kind === 'dl' ? (it.ytUrl || '') : it.kind === 'stream' ? (it.url || '') : it.kind === 'line' ? 'Line input' : it.kind === 'comment' ? '' : (it.artist || '');
    const cov = it.cover || it.image;
    const lenTxt = it.kind === 'comment' || it.kind === 'cmd' ? '' : (isCur && curDeck && curDeck.item === it ? '-' + fmtL(Math.max(0, itemDur(it) - curDeck.audio.currentTime)) : fmtL(itemDur(it)));
    html += `<div class="${cls}" draggable="true" data-uid="${it.uid}"><span class="pn">${n}</span>${stateIcon(it, isCur, isNext).replace('</div>', qi > -1 ? `<span class="qn">${qi + 1}</span></div>` : '</div>')}`
      + (cov ? `<span class="pcv" style="background-image:url('${esc(cov)}')"></span>` : `<span class="pcv">${kindIcon(it, ft)}</span>`)
      + `<div class="ptx"><span class="ell ttl" title="${esc(title)}"${it.dlErr ? ' style="color:#FF9A9A"' : ''}>${esc(title)}${it.file ? ' <span class="sub" style="font-size:10px">(local)</span>' : ''}</span>${artist ? `<span class="ell part">${esc(artist)}</span>` : ''}</div>`
      + `${it.kind === 'comment' ? '<span></span>' : tagHtml(ft)}<span class="pln">${lenTxt}</span><span class="acts"><button class="ic" data-act="up" title="Move up (Ctrl+↑)" aria-label="Move up">▲</button><button class="ic" data-act="down" title="Move down (Ctrl+↓)" aria-label="Move down">▼</button><button class="ic" data-act="pfl" title="Prelisten" aria-label="Prelisten"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="5" height="7" rx="1.5"/><rect x="17" y="14" width="5" height="7" rx="1.5"/></svg></button><button class="ic" data-act="del" title="Remove" aria-label="Remove">✕</button></span></div>`;
  });
  if (!tab.items.length) html = `<div class="sub" style="padding:18px;line-height:1.7">This playlist is empty.<br>Double-click songs in Search / Explorer, drag them here, or use <b>+ Add</b>.</div>`;
  $('#plBody').innerHTML = html;
  const sum = $('#plSum'); if (sum) sum.textContent = `${tab.items.length} items · ${fmtL(totalDur)}${tab.items.length && starts.size ? ' · ends ' + hm([...starts.values()].pop() + itemDur(tab.items[tab.items.length - 1]) * 1000) : ''}`;
  if ((scrollToCur || PL.cur !== lastCurRendered) && VIEW.autoscroll) { const el = $('#plBody .plr.playing'); if (el) el.scrollIntoView({ block: 'center' }); }
  lastCurRendered = PL.cur;
  renderInfo();
}
function updateNext(){
  const nx = peekNext(); const ft = nx && ftOf(nx);
  $('#nextTitle').textContent = nx ? (nx.kind === 'cmd' ? 'Command: ' + nx.cmd : nx.kind === 'pause' ? 'Timed pause ' + fmtL(nx.dur) : nx.title) : '—';
  $('#nextArtist').textContent = nx ? (nx.artist || (nx.kind === 'stream' ? nx.url : nx.kind === 'line' ? 'Line input' : '')) : (PL.repeatList ? '' : 'End of playlist');
  $('#nextType').outerHTML = nx ? tagHtml(ft).replace('class="tag"', 'class="tag" id="nextType"') : '<span class="tag" id="nextType"></span>';
  setLabel($('#lNext'), nx); drawWaves(); renderNextIn();
}
function renderNextIn(){
  const el = $('#nextIn'); if (!el) return; const nx = peekNext(), t = $('#nextTitle').textContent;
  if (!nx || !t || t === '—') { el.classList.remove('on'); el.innerHTML = ''; return; }
  const a = $('#nextArtist').textContent, at = $('#nextAt').textContent;
  el.innerHTML = `▶ NEXT: <b>${esc(t)}</b>${a ? ' – ' + esc(a) : ''}${at ? ' · ' + esc(at) : ''}`; el.title = el.textContent; el.classList.add('on');
}
function renderAll(scroll){ renderPlaylist(scroll); updateNext(); updatePlayerUI(true); clearTimeout(saveT); saveT = setTimeout(savePlaylists, 1500); }
const artCache = new Map();
async function loadArt(it){ if (!it || it.cover || it.image || !it.artist || it.kind !== 'track') return; const k = it.artist.toLowerCase();
  if (artCache.has(k)) { it.image = artCache.get(k); return; }
  try { const d = await (await fetch('/api/artist?name=' + encodeURIComponent(it.artist))).json(); artCache.set(k, d.image || ''); it.image = d.image || ''; if (it.image) { updatePlayerUI(true); renderInfo(); } } catch(e){ artCache.set(k, ''); } }
function setLabel(el, it){
  const img = it && (it.cover || it.image);
  if (img) { el.style.backgroundSize = ''; el.style.backgroundImage = `url('${img}')`; el.textContent = ''; el.style.backgroundColor = '#222'; }
  else if (!it) { el.style.backgroundImage = "url('/oab-logo.png')"; el.style.backgroundSize = '94%'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center'; el.style.backgroundColor = '#0B1424'; el.textContent = ''; }
  else { el.style.backgroundSize = ''; el.style.backgroundImage = ''; el.style.backgroundColor = it ? ftOf(it) !== FT[0] && it.kind === 'track' ? ftOf(it).color : colorFor(it.artist || it.title) : '#2A2E37'; el.textContent = it ? initials(it.artist || it.title) : ''; }
}
function drawWave(canvas, it, prog, showMix){
  const [W, H, d] = fitCanvas(canvas); const g = canvas.getContext('2d'); g.clearRect(0, 0, W, H);
  const a = it && it.kind === 'track' && anCache.get(it.id || it.uid);
  drawWaveStyle(g, W, H, d, a, prog);
  const dur = itemDur(it);
  if (showMix && it && dur) {
    const ft = ftOf(it);
    if (ft.fadeIn > 0) { g.fillStyle = 'rgba(56,138,221,.18)'; g.fillRect(0, 0, ft.fadeIn / dur * W, H); }
    const ms = mixStart(it, peekNext()); if (isFinite(ms) && ms < dur) { g.fillStyle = 'rgba(56,138,221,.14)'; g.fillRect(ms / dur * W, 0, Math.min(ft.fadeOut || 0, dur - ms) / dur * W, H); g.fillStyle = '#F04444'; g.fillRect(ms / dur * W - d, 0, 2 * d, H); }
  }
  if (prog > 0 && prog <= 1) { g.save(); g.shadowColor = 'rgba(255,255,255,.85)'; g.shadowBlur = 8 * d; g.fillStyle = '#fff'; g.fillRect(prog * W - d, 0, 2 * d, H); g.restore(); }
}
function drawWaves(){ const it = curItem(); const pos = curDeck && curDeck.item === it ? curDeck.audio.currentTime : 0; const dur = itemDur(it); drawWave($('#wNow'), it, dur ? pos / dur : 0, true); if (typeof drawRuler === 'function') drawRuler($('#tNow'), dur, dur ? pos / dur : 0); }
$('#tNow').onclick = e => $('#wNow').onclick(e);
$('#wNow').onclick = e => { if (!curDeck || !curDeck.item) return; const dur = itemDur(curDeck.item); if (!dur) return; const r = e.currentTarget.getBoundingClientRect(); curDeck.audio.currentTime = (e.clientX - r.left) / r.width * dur; mixFired = false; };
let uiLastSec = -1;
function updatePlayerUI(full){
  const it = curItem();
  const pos = curDeck && curDeck.item === it ? curDeck.audio.currentTime : pauseState ? (Date.now() - pauseState.start) / 1000 : lineState ? (Date.now() - lineState.start) / 1000 : 0;
  const dur = itemDur(it); const paused = curDeck && curDeck.audio.paused;
  $('#pNow').classList.toggle('glow', !!(it && curDeck && curDeck.item === it && !paused));
  if (full) {
    $('#nowTitle').textContent = it ? (it.kind === 'pause' ? 'Timed pause' : it.kind === 'cmd' ? 'Command' : it.title) : 'Nothing playing';
    $('#nowArtist').textContent = it ? (it.artist || (it.kind === 'stream' ? it.url : it.kind === 'line' ? 'Line input is on air' : '')) : 'Add tracks to the playlist and press Play';
    const ft = it ? ftOf(it) : null;
    $('#nowType').outerHTML = it ? tagHtml(ft).replace('class="tag"', 'class="tag" id="nowType"') : '<span class="tag" id="nowType"></span>';
    $('#nowLbl').textContent = !it ? 'STOPPED' : paused ? 'PAUSED' : 'ON AIR'; $('#nowLbl').style.color = !it ? '' : paused ? '#F5C46B' : '#7FE0B5';
    setLabel($('#lNow'), it);
    $('#vNow').classList.toggle('run', !!(it && curDeck && !paused)); $('#vNext').classList.remove('run');
    $('#nowTimes').textContent = it && it.startedAt ? 'Started ' + new Date(it.startedAt).toTimeString().slice(0, 8) + (dur ? ' · ends ' + new Date(it.startedAt + dur * 1000).toTimeString().slice(0, 8) : '') : '';
  }
  const tmI = it ? tmOf(it) : {}; const rem = dur ? (tmI.cueOut || dur) - pos : 0;
  const intro = tmI.intro && pos < tmI.intro ? tmI.intro - pos : 0; $('#nowLbl').textContent = !it ? 'STOPPED' : paused ? 'PAUSED' : intro ? 'INTRO ' + Math.ceil(intro) + 's' : 'ON AIR'; $('#nowLbl').style.color = intro && !paused ? '#F5A524' : !it ? '' : paused ? '#F5C46B' : '#7FE0B5';
  $('#nowRem').textContent = it ? (dur ? '-' + fmt(rem) : fmt(pos)) : '-00:00';
  $('#nowRem').style.color = it && dur && rem < 20 && !paused ? '#F04444' : '';
  const s = Math.floor(Date.now() / 1000);
  if (s !== uiLastSec || full) { uiLastSec = s; drawWaves(); const st = computeStarts(activeTab()); const nx = peekNext(); $('#nextAt').textContent = nx && st.get(nx.uid) ? 'at ' + new Date(st.get(nx.uid)).toTimeString().slice(0, 8) : ''; renderNextIn(); }
  $('#stPl').textContent = `Playlist: ${activeTab() ? activeTab().name : ''}${PL.pq.length ? ' · queue ' + PL.pq.length : ''}`;
  $('#schInfo').textContent = schLabel();
  $('#stXf').textContent = `Mix: ${FT[0].mix}s / fade ${FT[0].fadeOut}s${XF.useTrigger ? ' · trigger ' + XF.trigger + ' dB' : ''}`;
  $('#xfInfo').textContent = `Crossfade ${FT[0].fadeOut}s${XF.useTrigger ? ' · trigger ' + XF.trigger + ' dB' : ''}`;
}

// ---------------- selection, context menu, drag & drop, keys ----------------
let plLastClick = {};
$('#plBody').addEventListener('click', e => {
  const row = e.target.closest('.plr'); if (!row) return; const uid = row.dataset.uid; const f = findItem(uid); if (!f) return;
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'del') { removeUids([uid]); return; }
  if (act && (act.dataset.act === 'up' || act.dataset.act === 'down')) { if (!PL.sel.has(uid)) PL.sel = new Set([uid]); moveSel(act.dataset.act); return; }
  if ((act && act.dataset.act === 'pfl') || e.altKey) { prelisten(f.item); return; }
  const now = performance.now();
  if (!act && !e.shiftKey && !e.ctrlKey && !e.metaKey && plLastClick.uid === uid && now - plLastClick.t < 450) { plLastClick = {}; PL.sel = new Set([uid]); PL.anchor = uid; if (ctx) playItem(f.item, { fadeOut: 1 }); renderPlaylist(); return; }
  plLastClick = { uid, t: now };
  const items = viewTab().items;
  if (e.shiftKey && PL.anchor) { const a = items.findIndex(x => x.uid === PL.anchor), b = f.i; PL.sel = new Set(items.slice(Math.min(a, b), Math.max(a, b) + 1).map(x => x.uid)); }
  else if (e.ctrlKey || e.metaKey) { PL.sel.has(uid) ? PL.sel.delete(uid) : PL.sel.add(uid); PL.anchor = uid; }
  else { PL.sel = new Set([uid]); PL.anchor = uid; }
  renderPlaylist();
});
// double-click a row = play it now (detected here because a click re-draws the list, so the browser's dblclick never arrives)
$('#plBody').addEventListener('contextmenu', e => {
  const row = e.target.closest('.plr'); if (!row) return; e.preventDefault(); const uid = row.dataset.uid; if (!PL.sel.has(uid)) { PL.sel = new Set([uid]); renderPlaylist(); }
  const f = findItem(uid); const it = f.item; const sel = [...PL.sel];
  showCtx(e.clientX, e.clientY, [
    ['▶ Play now', () => playItem(it, { fadeOut: 1 })],
    ['Play next (playback queue)', () => { sel.forEach(u => { if (!PL.pq.includes(u)) PL.pq.push(u); }); afterChange(); }],
    PL.pq.includes(uid) ? ['Remove from playback queue', () => { PL.pq = PL.pq.filter(u => !sel.includes(u)); afterChange(); }] : null,
    ['Move ▸', null, [['▲ Move up  (Ctrl+↑)', () => moveSel('up')], ['▼ Move down  (Ctrl+↓)', () => moveSel('down')], ['⤒ Move to next (after the playing song)', () => moveSel('top')], ['⤓ Move to the end', () => moveSel('bottom')]]],
    ['🎧 Prelisten', () => prelisten(it)], ['Edit…', () => editItem(it)], it.kind === 'track' ? ['Track editor (cue / intro / mix)…', () => openTrackEditor(it)] : null, ['Record voice track after this…', () => openVT(it)],
    ['File type ▸', null, FT.map(x => [x.name, () => { sel.forEach(u => { const g = findItem(u); if (g) g.item.ftype = x.name; }); afterChange(); }]).concat([['Auto (by rules)', () => { sel.forEach(u => { const g = findItem(u); if (g) delete g.item.ftype; }); afterChange(); }]])],
    ['Insert "stop" after', () => { viewTab().items.splice(f.i + 1, 0, { uid: uidGen(), kind: 'cmd', cmd: 'stop', title: 'stop' }); afterChange(); }],
    ['Reset played state', () => { sel.forEach(u => { const g = findItem(u); if (g) g.item.played = false; }); afterChange(); }], '-',
    ['Cut', () => doAct('cut')], ['Copy', () => doAct('copy')], ['Paste', () => doAct('paste')], ['Remove', () => removeUids(sel)]].filter(Boolean));
});
// move the selected rows: 'up' | 'down' | 'top' (right after the playing track) | 'bottom'
function moveSel(dir){
  const tab = viewTab(), items = tab.items; const sel = items.filter(x => PL.sel.has(x.uid)); if (!sel.length) return toast('Select a song first');
  const idx = sel.map(x => items.indexOf(x));
  if (dir === 'up') { if (idx[0] === 0) return; idx.forEach(i => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; }); }
  else if (dir === 'down') { if (idx[idx.length - 1] === items.length - 1) return; idx.slice().reverse().forEach(i => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; }); }
  else { const rest = items.filter(x => !PL.sel.has(x.uid));
    if (dir === 'bottom') tab.items = rest.concat(sel);
    else { const ci = rest.findIndex(x => x.uid === PL.cur); tab.items = rest.slice(0, ci + 1).concat(sel, rest.slice(ci + 1)); } }
  PL.shufflePick = null; afterChange();
  const el = $(`.plr[data-uid="${sel[0].uid}"]`); if (el) el.scrollIntoView({ block: 'nearest' });
}
function removeUids(uids){
  if (uids.includes(PL.cur)) { toast('The playing item can\'t be removed'); uids = uids.filter(u => u !== PL.cur); }
  PL.tabs.forEach(t => t.items = t.items.filter(x => !uids.includes(x.uid))); PL.pq = PL.pq.filter(u => !uids.includes(u)); uids.forEach(u => PL.sel.delete(u)); afterChange();
}
// drag & drop
let dragUids = null;
$('#plBody').addEventListener('dragstart', e => { const row = e.target.closest('.plr'); if (!row) return; const uid = row.dataset.uid; if (!PL.sel.has(uid)) PL.sel = new Set([uid]); dragUids = [...PL.sel]; e.dataTransfer.setData('text/pl', '1'); e.dataTransfer.effectAllowed = 'move'; });
$('#plWrap').addEventListener('dragover', e => { e.preventDefault(); $$('.plr.drop').forEach(x => x.classList.remove('drop')); const row = e.target.closest('.plr'); if (row) row.classList.add('drop'); });
$('#plWrap').addEventListener('dragleave', () => $$('.plr.drop').forEach(x => x.classList.remove('drop')));
$('#plWrap').addEventListener('drop', e => {
  e.preventDefault(); $$('.plr.drop').forEach(x => x.classList.remove('drop'));
  const tab = viewTab(); const row = e.target.closest('.plr'); let at = row ? tab.items.findIndex(x => x.uid === row.dataset.uid) : tab.items.length;
  const lib = e.dataTransfer.getData('text/lib');
  if (lib) { const it = libById.get(lib); if (it) addToView([fromLib(it)], at); return; }
  if (e.dataTransfer.files && e.dataTransfer.files.length) { const its = localFiles(e.dataTransfer.files); addToView(its, at); return; }
  if (dragUids) { const moving = tab.items.filter(x => dragUids.includes(x.uid)); if (!moving.length) return; const before = row ? row.dataset.uid : null;
    tab.items = tab.items.filter(x => !dragUids.includes(x.uid)); at = before ? tab.items.findIndex(x => x.uid === before) : tab.items.length; if (at < 0) at = tab.items.length; tab.items.splice(at, 0, ...moving); dragUids = null; afterChange(); }
});
// context menu helper
function showCtx(x, y, items){
  const m = $('#ctx'); m.innerHTML = '';
  items.forEach(i => { if (i === '-') { m.insertAdjacentHTML('beforeend', '<hr>'); return; } const d = document.createElement('div'); d.textContent = i[0];
    if (i[2]) { d.onclick = ev => { ev.stopPropagation(); showCtx(x + 200, y, i[2]); }; } else d.onclick = () => { m.style.display = 'none'; i[1] && i[1](); }; m.appendChild(d); });
  m.style.display = 'block'; const r = m.getBoundingClientRect(); const Z = window.UIZ || 1; m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 8)) / Z + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 8)) / Z + 'px';
}
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) $('#ctx').style.display = 'none'; if (!e.target.closest('.menubar')) $$('.menubar .m').forEach(m => m.classList.remove('open')); });

// ---------------- info panel & edit ----------------
function renderInfo(){
  const el = $('#info'); el.style.display = VIEW.info ? '' : 'none'; if (!VIEW.info) return;
  const f = [...PL.sel].map(u => findItem(u)).filter(Boolean)[0]; const it = f ? f.item : curItem();
  if (!it) { el.innerHTML = '<div></div><div class="sub" style="grid-column:2/-1">Select a track to see its details.</div>'; return; }
  const a = it.kind === 'track' && anCache.get(it.id || it.uid); const ft = ftOf(it); const img = it.cover || it.image;
  el.innerHTML = `<div class="art" style="width:58px;height:58px;font-size:18px;${img ? `background-image:url('${esc(img)}')` : 'background:' + colorFor(it.artist || it.title)}">${img ? '' : esc(initials(it.artist || it.title))}</div>
  <div class="kv"><div class="ell"><b>Title</b>${esc(it.title || it.cmd || '')}</div><div class="ell"><b>Artist</b>${esc(it.artist || '—')}</div><div class="ell"><b>Source</b>${esc(it.kind === 'stream' ? it.url : it.path || (it.file ? 'local file' : it.kind))}</div></div>
  <div class="kv"><div><b>Type</b>${esc(ft.name)}</div><div><b>Length</b>${fmtL(itemDur(it))}</div><div><b>Status</b>${it.uid === PL.cur ? 'playing' : it.played ? 'played' : 'not played'}${it.listeners != null && it.played ? ' · ' + it.listeners + ' listeners' : ''}</div></div>
  <div class="kv"><div><b>Mix at</b>${isFinite(mixStart(it, null)) ? fmtL(mixStart(it, null)) : '—'}</div><div><b>Fades</b>in ${ft.fadeIn}s · out ${ft.fadeOut}s</div><div><b>Level</b>${a ? (a.lastLoud ? (a.firstLoud ? 'intro ' + a.firstLoud.toFixed(1) + 's · ' : '') + 'end ' + fmtL(a.lastLoud) : 'below trigger') : (it.kind === 'track' ? 'analysing…' : '—')}</div></div>
  <div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm" id="infEdit">Edit…</button><button class="btn sm" id="infPfl">🎧 Prelisten</button></div>`;
  $('#infEdit').onclick = () => editItem(it); $('#infPfl').onclick = () => prelisten(it);
}
let edCb = null;
function openModal(id){ $('#' + id).classList.add('on'); }
function closeModal(id){ $('#' + id).classList.remove('on'); }
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('on'); }));
function form(title, fields, cb, note){
  $('#edH').textContent = title; $('#edNote').textContent = note || '';
  $('#edFrm').innerHTML = fields.map(f => `<label for="ed_${f.k}">${esc(f.l)}</label>` + (f.opts ? `<select class="inp" id="ed_${f.k}">${f.opts.map(o => `<option value="${esc(o[0])}" ${o[0] == f.v ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : `<input class="inp" id="ed_${f.k}" value="${esc(f.v == null ? '' : f.v)}" placeholder="${esc(f.ph || '')}">`)).join('');
  edCb = () => { const o = {}; fields.forEach(f => o[f.k] = $('#ed_' + f.k).value); cb(o); closeModal('mEdit'); };
  openModal('mEdit'); setTimeout(() => { const first = $('#edFrm input,#edFrm select'); if (first) first.focus(); }, 30);
}
$('#edOk').onclick = () => edCb && edCb();
$('#edFrm').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edCb && edCb(); } });
const parseDur = s => { s = String(s || '').trim(); if (!s) return 0; const p = s.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : +p[0] || 0; };
const ftOpts = () => [['', 'Auto (by rules)']].concat(FT.map(f => [f.name, f.name]));
function editItem(it){
  const fields = [];
  if (it.kind === 'comment') fields.push({ k: 'title', l: 'Comment', v: it.title });
  else if (it.kind === 'cmd') fields.push({ k: 'cmd', l: 'Command', v: it.cmd, ph: 'stop · setvol 80 · golive · stoplive · rec on/off · shuffle on/off · repeat on/off' });
  else { fields.push({ k: 'title', l: 'Title', v: it.title }, { k: 'artist', l: 'Artist', v: it.artist }); if (it.kind === 'track') fields.push({ k: 'ftype', l: 'File type', v: it.ftype || '', opts: ftOpts() }); }
  if (it.kind === 'stream') fields.push({ k: 'url', l: 'URL', v: it.url });
  if (['stream', 'line', 'pause'].includes(it.kind)) fields.push({ k: 'dur', l: 'Duration (m:ss, 0 = until Next)', v: fmtL(it.dur) === '—' ? '0' : fmtL(it.dur) });
  form('Edit item', fields, o => { Object.keys(o).forEach(k => { if (k === 'dur') it.dur = parseDur(o.dur); else if (k === 'ftype') { if (o.ftype) it.ftype = o.ftype; else delete it.ftype; } else it[k] = o[k]; });
    if (it.id && (o.title || o.artist)) { const ov = JSON.parse(store.get('tagEdits', '{}')); ov[it.id] = { title: it.title, artist: it.artist }; store.set('tagEdits', JSON.stringify(ov)); TAGOV = ov; }
    afterChange(); if (it.uid === PL.cur) { updatePlayerUI(true); sendMeta(it); } }, it.kind === 'track' ? 'Title/artist edits are kept by the studio (the file itself is not changed).' : '');
}

// ---------------- prelisten (PFL) ----------------
const pfl = new Audio(); pfl.preload = 'auto';
async function prelisten(it){
  if (!it) return; window.pflCur = { uid: it.uid || '', url: it.url || '' }; const dev = store.get('devPfl', '');
  if (dev && pfl.setSinkId) { try { await pfl.setSinkId(dev); } catch(e){} }
  pfl.src = it.kind === 'stream' ? srcUrl(it) : (it.file ? URL.createObjectURL(it.file) : it.url); pfl.currentTime = 0;
  try { await pfl.play(); $('#pflName').textContent = (it.artist ? it.artist + ' – ' : '') + (it.title || ''); $('#pflName').title = $('#pflName').textContent; } catch(e){ toast('Cannot prelisten this item'); }
}

// ---------------- local files / M3U ----------------
function localFiles(files){ return [...files].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(f.name)).map(f => { const base = f.name.replace(/\.[^.]+$/, ''), p = base.split(' - ');
  return { uid: uidGen(), kind: 'track', file: f, title: p.length > 1 ? p.slice(1).join(' - ') : base, artist: p.length > 1 ? p[0] : '', dur: 0 }; }); }
$('#fFiles').onchange = e => { const its = localFiles(e.target.files); e.target.value = ''; if (its.length) addToView(its); toast('Local files play in the studio but are not kept after closing. Put them in the music folder to keep them.'); };
$('#fFolder').onchange = e => { const its = localFiles(e.target.files); e.target.value = ''; if (its.length) addToView(its); };
function exportM3u(tab){
  const lines = ['#EXTM3U'].concat(...tab.items.filter(i => !i.file && !skipK(i)).map(i => [`#EXTINF:${Math.round(itemDur(i)) || -1},${i.artist ? i.artist + ' - ' : ''}${i.title || i.cmd || ''}`, i.kind === 'stream' ? i.url : i.kind === 'line' ? 'line.in' : i.kind === 'cmd' ? '.command ' + i.cmd : i.kind === 'pause' ? '.pause ' + (i.dur || 0) : (i.path || location.origin + i.url)]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'audio/x-mpegurl' })); a.download = (tab.name || 'playlist') + '.m3u'; a.click();
}
$('#fM3u').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const txt = await f.text(); const tab = newTab(f.name.replace(/\.[^.]+$/, '')); let ext = null;
  const byPath = new Map(library.map(i => [String(i.path).toLowerCase().replace(/\\/g, '/'), i]));
  txt.split(/\r?\n/).forEach(l => { l = l.trim(); if (!l) return; if (l.startsWith('#EXTINF:')) { ext = l.slice(8); return; } if (l.startsWith('#')) return;
    const m = ext && /^(-?\d+),(.*)$/.exec(ext); const dur = m ? Math.max(0, +m[1]) : 0; const name = m ? m[2] : ''; ext = null;
    if (/^https?:\/\//i.test(l)) { const mm = /\/media\/([a-z0-9]+)$/i.exec(l); const li = mm && libById.get(mm[1]); tab.items.push(li ? fromLib(li) : { uid: uidGen(), kind: 'stream', url: l, title: name || l, artist: '', dur }); return; }
    if (l === 'line.in') { tab.items.push({ uid: uidGen(), kind: 'line', title: name || 'Line input', dur }); return; }
    if (l.startsWith('.command ')) { tab.items.push({ uid: uidGen(), kind: 'cmd', cmd: l.slice(9), title: l.slice(9) }); return; }
    if (l.startsWith('.pause ')) { tab.items.push({ uid: uidGen(), kind: 'pause', title: 'Timed pause', dur: +l.slice(7) || 0 }); return; }
    const key = l.toLowerCase().replace(/\\/g, '/'); let li = byPath.get(key); if (!li) { const fn = key.split('/').pop(); li = library.find(i => String(i.path).toLowerCase().replace(/\\/g, '/').endsWith('/' + fn)); }
    if (li) tab.items.push(fromLib(li)); });
  PL.tabs.push(tab); PL.view = PL.tabs.length - 1; renderTabs(); afterChange(); toast(tab.items.length + ' items loaded' + (tab.items.length ? '' : ' – tracks must be inside your music folder'));
};

// ---------------- cart wall (5×5) ----------------
let CART = (() => { try { return JSON.parse(store.get('cart5', '')) || null; } catch(e){ return null; } })() || Array.from({ length: 25 }, () => ({}));
const cartBufs = new Map(), cartPlaying = new Map(); const CART_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const CART_COLORS = [['Purple', '#2A1430', '#E9A8FF'], ['Amber', '#2A1F0B', '#F5C46B'], ['Green', '#122A22', '#7FE0B5'], ['Blue', '#13233A', '#8CC2FF'], ['Red', '#3A1416', '#FF9A9A'], ['Gray', '#23262E', '#C9CDD6']];
function saveCart(){ store.set('cart5', JSON.stringify(CART)); }
function renderCart(){
  const g = $('#cartGrid'); g.style.gridTemplateColumns = 'repeat(5,minmax(0,1fr))'; g.style.gridTemplateRows = 'repeat(5,minmax(0,1fr))';
  g.innerHTML = CART.map((c, i) => { const p = cartPlaying.get(i); const col = CART_COLORS.find(x => x[0] === c.color) || (c.kind === 'stopall' ? CART_COLORS[4] : c.kind === 'line' ? CART_COLORS[3] : CART_COLORS[0]);
    return `<button class="cell ${p ? 'playing' : ''}" data-i="${i}" style="${c.kind ? `background:${col[1]};color:${col[2]}` : ''}" title="${c.kind ? 'Click play/stop · Shift+click restart · right-click edit' : 'Right-click or drop a song to assign'}"><span class="ell" style="white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${c.kind ? esc(c.name) : '+'}</span><small>${cartKeyLabel(i)}${p ? '▶ ' + fmt(p.left) : c.kind === 'track' ? fmtL(c.dur) + (c.loop ? ' ⟲' : '') : c.kind === 'line' ? 'line.in' : c.kind === 'stopall' ? 'stopall' : ''}</small></button>`; }).join('');
}
async function cartBuf(c){ const k = c.url; if (cartBufs.has(k)) return cartBufs.get(k); const b = await ctx.decodeAudioData(await (await fetch(c.url)).arrayBuffer()); cartBufs.set(k, b); return b; }
async function playCart(i, restart){
  const c = CART[i]; if (!c.kind || !ctx) return;
  if (c.kind === 'stopall') { stopCarts(); return; }
  if (c.kind === 'line') { setInput(inputs[2], !inputs[2].on); return; }
  const p = cartPlaying.get(i); if (p) { p.src.onended = null; p.src.stop(); cartPlaying.delete(i); if (!restart) { renderCart(); return; } }
  try { const buf = await cartBuf(c); const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!c.loop; s.connect(cartBus); const st = { src: s, start: ctx.currentTime, dur: buf.duration, left: buf.duration };
    s.onended = () => { cartPlaying.delete(i); renderCart(); }; cartPlaying.set(i, st); s.start(); renderCart(); } catch(e){ toast('Cannot play ' + c.name); }
}
function stopCarts(){ cartPlaying.forEach(p => { p.src.onended = null; try { p.src.stop(); } catch(e){} }); cartPlaying.clear(); renderCart(); }
setInterval(() => { if (!cartPlaying.size) return; cartPlaying.forEach(p => p.left = p.src.loop ? p.dur - ((ctx.currentTime - p.start) % p.dur) : Math.max(0, p.dur - (ctx.currentTime - p.start))); renderCart(); }, 250);
$('#cartGrid').addEventListener('click', e => { const b = e.target.closest('.cell'); if (!b) return; const i = +b.dataset.i; if (!CART[i].kind) { cartMenu(i, e.clientX, e.clientY); return; } playCart(i, e.shiftKey); });
$('#cartGrid').addEventListener('contextmenu', e => { const b = e.target.closest('.cell'); if (!b) return; e.preventDefault(); cartMenu(+b.dataset.i, e.clientX, e.clientY); });
function cartMenu(i, x, y){
  const c = CART[i]; const selIt = [...PL.sel].map(u => findItem(u)).filter(Boolean).map(f => f.item).find(it => it.kind === 'track' && it.url);
  showCtx(x, y, [selIt ? ['Assign selected playlist track', () => { CART[i] = { kind: 'track', name: selIt.title, url: selIt.url, dur: itemDur(selIt), color: c.color || 'Purple' }; saveCart(); renderCart(); }] : null,
    lastLibId && libById.get(lastLibId) ? ['Assign last library song', () => { const it = libById.get(lastLibId); CART[i] = { kind: 'track', name: it.title, url: it.url, dur: it.dur, color: c.color || 'Purple' }; saveCart(); renderCart(); }] : null,
    ['Line input (line.in)', () => { CART[i] = { kind: 'line', name: 'LINE IN', color: 'Blue' }; saveCart(); renderCart(); }],
    ['Stop all (stopall)', () => { CART[i] = { kind: 'stopall', name: 'Stop all', color: 'Red' }; saveCart(); renderCart(); }],
    c.kind ? ['Rename…', () => { const n = prompt('Name', c.name); if (n) { c.name = n; saveCart(); renderCart(); } }] : null,
    c.kind === 'track' ? [(c.loop ? '✓ ' : '') + 'Loop', () => { c.loop = !c.loop; saveCart(); renderCart(); }] : null,
    c.kind ? ['Color ▸', null, CART_COLORS.map(col => [col[0], () => { c.color = col[0]; saveCart(); renderCart(); }])] : null,
    c.kind ? ['Clear', () => { CART[i] = {}; saveCart(); renderCart(); }] : null].filter(Boolean));
}
$('#cartGrid').addEventListener('dragover', e => { const b = e.target.closest('.cell'); if (b) { e.preventDefault(); $$('.cell.drop').forEach(x => x.classList.remove('drop')); b.classList.add('drop'); } });
$('#cartGrid').addEventListener('drop', e => { e.preventDefault(); $$('.cell.drop').forEach(x => x.classList.remove('drop')); const b = e.target.closest('.cell'); if (!b) return; const i = +b.dataset.i;
  const lib = e.dataTransfer.getData('text/lib'); let it = lib ? libById.get(lib) : null;
  if (!it && dragUids) { const f = findItem(dragUids[0]); it = f && f.item.kind === 'track' && f.item.url ? f.item : null; dragUids = null; }
  if (it) { CART[i] = { kind: 'track', name: it.title, url: it.url, dur: itemDur(it) || it.dur, color: CART[i].color || 'Purple' }; saveCart(); renderCart(); } });
async function loadServerCarts(){
  if (store.get('cartFilled', '') === '1') return;
  try { const d = await (await fetch('/api/library?kind=carts', { cache: 'no-store' })).json(); let slot = 0;
    for (const x of d.items) { while (slot < 25 && CART[slot].kind) slot++; if (slot >= 25) break; CART[slot] = { kind: 'track', name: x.title, url: x.url, dur: x.dur, color: 'Purple' }; slot++; }
    if (d.items.length) { store.set('cartFilled', '1'); saveCart(); } renderCart(); } catch(e){}
}

/*@@INPUTS@@*/
async function listOutputs(){
  try { const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    [['#devOut', 'devOut'], ['#devPfl', 'devPfl']].forEach(([sel, k]) => { const cur = store.get(k, ''); $(sel).innerHTML = '<option value="">Default output</option>' + devs.filter(d => d.deviceId && d.deviceId !== 'default').map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Output ' + (i + 1))}</option>`).join(''); $(sel).value = cur; if ($(sel).value !== cur) $(sel).value = ''; });
  } catch(e){}
}
$('#devOut').onchange = () => { store.set('devOut', $('#devOut').value); if (ctx && ctx.setSinkId) ctx.setSinkId($('#devOut').value || '').then(() => toast('Main output changed'), () => toast('This browser cannot switch the output device')); };
$('#devPfl').onchange = () => { store.set('devPfl', $('#devPfl').value); if (pfl.setSinkId) pfl.setSinkId($('#devPfl').value || '').catch(() => {}); };

const QUALS = [128, 160, 192, 256, 320];
const KBPS = () => { const v = +store.get('streamKbps', '256'); return QUALS.includes(v) ? v : 256; };
function showQual(){ const sr = ctx ? ctx.sampleRate : 48000; const l = $('#qualLbl'); if (l) l.textContent = `MP3 ${KBPS()}k · ${(sr / 1000).toFixed(sr % 1000 ? 1 : 0)} kHz`; const q = $('#sQual'); if (q) q.value = String(KBPS()); }
$('#sQual').onchange = () => { store.set('streamKbps', $('#sQual').value); if (live && window.lamejs && ctx) enc = new lamejs.Mp3Encoder(2, ctx.sampleRate, KBPS()); showQual(); toast('Stream quality: ' + KBPS() + ' kbps' + (live ? ' (applied now)' : '')); };
setTimeout(showQual, 0); setInterval(showQual, 5000);
/*@@ENCODER@@*/
async function goLive(on){
  if (on) {
    try { const r = await fetch('/api/check', { method: 'POST', headers: { 'X-Radio-Key': KEY() } }); if (r.status === 401) { toast('Wrong broadcast password (Settings → Options)'); return; } }
    catch(e){ toast('Server not running. Start start-radio.bat'); return; }
    if (!window.lamejs) { toast('MP3 encoder missing (web/lib/lame.min.js)'); return; }
    enc = new lamejs.Mp3Encoder(2, ctx.sampleRate, KBPS()); live = true; const it = curItem(); if (it) sendMeta(it);
  } else { live = false; enc = null; outBuf = []; }
  store.set('wasLive', live ? '1' : '0');
  $('#golive').classList.toggle('live', live); $('#golive').textContent = live ? 'STOP BROADCAST' : 'GO LIVE';
  $('#onair').classList.toggle('live', live); $('#onair').title = live ? 'On air – broadcasting' : 'Broadcast: off'; $('#onair').setAttribute('aria-label', live ? 'On air' : 'Not broadcasting');
}
$('#golive').onclick = () => goLive(!live);
function sendMeta(it){
  if (!it || !live) return; const ft = ftOf(it); let title = it.title, artist = it.artist || '', kind = 'MUSIC';
  if (ft.name === 'Commercial') { title = 'Commercial break'; artist = ''; kind = 'AD'; }
  else if (ft !== FT[0] || it.kind !== 'track') { if (it.kind === 'cmd' || it.kind === 'pause' || it.kind === 'comment') return; kind = 'OTHER'; }
  fetch('/api/meta', { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify({ title, artist, kind }) }).catch(() => {});
}
/*@@REC@@*/
// ---------------- status from server ----------------
const lisHist = [];
function setSrv(ok){ $('#srvState').innerHTML = `<span class="dot" style="background:${ok ? '#22C55E' : '#F04444'}"></span> Server ${ok ? 'connected' : 'offline'}`; }
async function poll(){
  try {
    const s = await (await fetch('/api/status', { cache: 'no-store', headers: { 'X-Radio-Key': KEY() } })).json(); setSrv(true); renderAudience(s);
    PL.lastListeners = s.listeners;
    $('#lisBig').textContent = s.listeners; $('#lisTopN').textContent = s.listeners; $('#lisTop').classList.toggle('live', !!s.onAir); $('#lisTop').title = `Listeners right now · peak ${s.peak} · uptime ${s.uptime > 3600 ? Math.floor(s.uptime / 3600) + 'h' : Math.floor(s.uptime / 60) + 'm'}`; $('#lisBig2').textContent = s.listeners; $('#peak').textContent = s.peak;
    $('#uptime').textContent = s.uptime > 3600 ? Math.floor(s.uptime / 3600) + 'h' : Math.floor(s.uptime / 60) + 'm';
    $('#lisLive').textContent = s.onAir ? '● On air' : '● Off air'; $('#lisLive').style.color = s.onAir ? '#22C55E' : '';
    lisHist.push(s.listeners); if (lisHist.length > 30) lisHist.shift();
    const mx = Math.max(1, ...lisHist), bars = lisHist.map(v => `<span style="height:${Math.round(v / mx * 100)}%"></span>`).join(''); $('#spark2').innerHTML = bars; $('#spark3').innerHTML = bars;
    $('#statLine').textContent = `Peak ${s.peak} · source ${s.source || 'none'} · AutoDJ ${s.autodj ? 'on' : 'off'} · library ${s.library ? s.library.music : 0} songs`;
    $('#reqN').textContent = s.requests.length; { const n = s.requests.length, b = $('#reqTop'); if (b) { $('#reqTopN').textContent = n; b.classList.toggle('has', n > 0); } } checkRequests(s.requests);
    $('#reqList').innerHTML = s.requests.length ? s.requests.map(r => `<div class="it"><div style="min-width:0"><div class="ell" style="font-weight:600">${esc(r.song)}</div><div class="sub" style="font-size:11px">${esc(r.name || 'Listener')} · ${r.time}</div></div><button class="btn sm" data-song="${esc(r.song)}">Find</button></div>`).join('') : '<div class="sub" style="padding:8px 0">No requests yet.</div>';
    recOn = s.recording; $('#rec').classList.toggle('on', recOn); $('#recTime').textContent = hms(s.recSeconds);
    $('#recList').innerHTML = s.recordings.length ? s.recordings.slice(0, 8).map(r => `<div class="it"><span class="ell">${esc(r.name.replace('.mp3', ''))}</span><a href="/recordings/${encodeURIComponent(r.name)}" class="btn sm" style="text-decoration:none;color:#E8EAEF">${(r.size / 1048576).toFixed(1)} MB ↓</a></div>`).join('') : '<div class="sub">No recordings yet.</div>';
    if (s.public) showPub(s.public);
    showLinks(s);
    remoteTick();
    $('#srcName').textContent = s.onAir ? (s.source || 'on air') : 'idle';
    $('#adjInfo').textContent = 'AutoDJ ' + (!s.autodj ? 'off' : s.source === 'AutoDJ' ? 'playing' : 'standby');
    $('#fSrv').textContent = 'Listeners: ' + (s.public && s.public.state === 'on' && s.public.url ? s.public.url + '/' : (s.lan || location.origin + '/'));
  } catch(e){ setSrv(false); }
}
$('#reqList').onclick = e => { const b = e.target.closest('[data-song]'); if (b) { $('#stabs button[data-t="lib"]').click(); $('#search').value = b.dataset.song; renderLib(); leftTab('lSearch'); } };
$('#reqClear').onclick = () => fetch('/api/requests/clear', { method: 'POST', headers: { 'X-Radio-Key': KEY() } }).then(poll);

// ---------------- options (server + devices) ----------------
let cfgAutodj = true;
$('#cAutodj').onclick = () => { cfgAutodj = !cfgAutodj; $('#cAutodj').classList.toggle('on', cfgAutodj); };
async function openOptions(sec){
  openModal('mOptions'); if (typeof optShow === 'function') optShow(typeof sec === 'string' ? sec : store.get('optSec', 'general')); listDevices(true).then(listOutputs, listOutputs);
  try { const r = await fetch('/api/config', { headers: { 'X-Radio-Key': KEY() } }); if (r.status === 401) { $('#cMsg').textContent = 'Enter the right password, then Save.'; return; }
    const c = await r.json(); $('#cMusic').value = c.musicDir || ''; $('#cAds').value = c.adsDir || ''; $('#cCarts').value = c.cartsDir || '';
    $('#cYt').value = c.youtubeKey || ''; $('#cGoogle').value = c.googleClientId || ''; $('#cSpId').value = c.spotifyId || ''; $('#cSpSec').value = c.spotifySecret || '';
    cfgAutodj = !!c.autodj; $('#cAutodj').classList.toggle('on', cfgAutodj); $('#cMsg').textContent = ''; $('#cCity').value = c.city || ''; loadVoices(c.ttsVoice || ''); } catch(err){ $('#cMsg').textContent = 'Server not running.'; }
}
$('#pw').onchange = () => store.set('radioKey', $('#pw').value);
$('#cSave').onclick = async () => {
  store.set('radioKey', $('#pw').value);
  const body = { musicDir: $('#cMusic').value, adsDir: $('#cAds').value, cartsDir: $('#cCarts').value, autodj: cfgAutodj, youtubeKey: $('#cYt').value, spotifyId: $('#cSpId').value, spotifySecret: $('#cSpSec').value, googleClientId: $('#cGoogle').value, city: $('#cCity').value, ttsVoice: $('#cVoice').value };
  store.set('timeTpl', $('#cTimeTpl').value); store.set('weatherTpl', $('#cWeatherTpl').value); CFG.city = $('#cCity').value; CFG.voice = $('#cVoice').value;
  try { const r = await fetch('/api/config', { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 401) { $('#cMsg').textContent = 'Wrong password.'; return; }
    const d = await r.json(); $('#cMsg').textContent = d.missing && d.missing.length ? 'Folder not found: ' + d.missing.join(', ') : 'Saved. Scanning folders…';
    setTimeout(() => { loadServerLib(); loadServerAds(); store.set('cartFilled', ''); if (ctx) loadServerCarts(); explore(exKind, ''); }, 1500);
  } catch(err){ $('#cMsg').textContent = 'Server not running.'; }
};
/*@@PUB@@*/
/*@@REQPOP@@*/

// ---------------- menus & actions ----------------
function leftTab(id){ if (typeof setLibCol === 'function' && !VIEW.lib) setLibCol(true); $$('#leftTabs span').forEach(s => s.classList.toggle('on', s.dataset.p === id)); $$('#lExplorer,#lSearch,#lScheduler,#lFx').forEach(p => p.classList.toggle('on', p.id === id)); if (id === 'lExplorer' && !$('#exList').innerHTML) explore('music', ''); }
function rightTab(id){ $$('#rightTabs span').forEach(s => s.classList.toggle('on', s.dataset.p === id)); $$('#rReq').forEach(p => p.classList.toggle('on', p.id === id)); }
$('#leftTabs').onclick = e => { const s = e.target.closest('[data-p]'); if (s) leftTab(s.dataset.p); };
$('#rightTabs').onclick = e => { const s = e.target.closest('[data-p]'); if (s) rightTab(s.dataset.p); };
const soon = (what, phase) => toast(what + ' – coming in phase ' + phase);
function selItems(){ const items = viewTab().items; return items.filter(x => PL.sel.has(x.uid)); }
const ACT = {
  newPl: () => { PL.tabs.push(newTab()); PL.view = PL.tabs.length - 1; renderTabs(); afterChange(); },
  openM3u: () => $('#fM3u').click(), savePl: () => savePlaylists(true), exportM3u: () => exportM3u(viewTab()),
  settingsBackup: () => { const data = { playlists: serial(), fileTypes: FT, xf: XF, cart: CART, duck: store.get('duckDb', '14') }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = 'radio-studio-backup.json'; a.click(); },
  copy: () => { PL.clip = selItems().map(x => Object.assign({}, x)); toast(PL.clip.length + ' copied'); },
  cut: () => { const s = selItems(); PL.clip = s.map(x => Object.assign({}, x)); removeUids(s.map(x => x.uid)); },
  paste: () => { if (!PL.clip.length) return; const items = viewTab().items; const last = selItems().pop(); const at = last ? items.indexOf(last) + 1 : items.length; addToView(PL.clip.map(x => Object.assign({}, x, { uid: uidGen(), played: false, startedAt: null })), at); },
  selAll: () => { PL.sel = new Set(viewTab().items.map(x => x.uid)); renderPlaylist(); },
  crop: () => { const keep = new Set(PL.sel); removeUids(viewTab().items.filter(x => !keep.has(x.uid)).map(x => x.uid)); },
  del: () => removeUids([...PL.sel]), delAll: () => { if (confirm('Delete all items in "' + viewTab().name + '"?')) removeUids(viewTab().items.map(x => x.uid)); },
  tabSearch: () => leftTab('lSearch'), tabExplorer: () => leftTab('lExplorer'), tabScheduler: () => leftTab('lScheduler'), tabFx: () => leftTab('lFx'),
  tReq: () => setReqCol(!VIEW.req), tLib: () => setLibCol(!VIEW.lib),
  tInfo: () => { VIEW.info = !VIEW.info; store.set('vInfo', VIEW.info ? '1' : '0'); renderInfo(); syncChecks(); },
  tAutoscroll: () => { VIEW.autoscroll = !VIEW.autoscroll; store.set('vAuto', VIEW.autoscroll ? '1' : '0'); syncChecks(); },
  tFollow: () => { VIEW.follow = !VIEW.follow; store.set('vFollow', VIEW.follow ? '1' : '0'); syncChecks(); },
  tAutoMix: () => $('#autoMix').onclick(),
  tHourMarks: () => { VIEW.hours = !VIEW.hours; store.set('vHours', VIEW.hours ? '1' : '0'); syncChecks(); renderPlaylist(); },
  
  addFiles: () => $('#fFiles').click(), addFolder: () => $('#fFolder').click(),
  addUrl: () => form('Add URL (stream / podcast)', [{ k: 'url', l: 'URL', ph: 'https://…/stream.mp3' }, { k: 'title', l: 'Title', ph: 'e.g. News stream' }, { k: 'dur', l: 'Duration (m:ss, 0 = until Next)', v: '0' }], o => { if (!/^https?:\/\//i.test(o.url)) return toast('Enter a full http(s) address'); addToView([{ uid: uidGen(), kind: 'stream', url: o.url.trim(), title: o.title || o.url, artist: '', dur: parseDur(o.dur) }]); }),
  addLine: () => form('Add Line Input', [{ k: 'title', l: 'Title', v: 'Line input' }, { k: 'dur', l: 'Duration (m:ss, 0 = until Next)', v: '0' }], o => addToView([{ uid: uidGen(), kind: 'line', title: o.title || 'Line input', artist: '', dur: parseDur(o.dur) }]), 'Uses the LINE IN input set in Options.'),
  addCmd: () => form('Add command', [{ k: 'cmd', l: 'Command', v: 'stop', opts: [['stop', 'stop – stop playback'], ['setvol 80', 'setvol 80 – playlist volume %'], ['golive', 'golive – start broadcasting'], ['stoplive', 'stoplive – stop broadcasting'], ['rec on', 'rec on – start recording'], ['rec off', 'rec off – stop recording'], ['shuffle on', 'shuffle on'], ['shuffle off', 'shuffle off'], ['repeat on', 'repeat on (repeat playlist)'], ['repeat off', 'repeat off']] }], o => addToView([{ uid: uidGen(), kind: 'cmd', cmd: o.cmd, title: o.cmd }])),
  addPause: () => form('Add timed pause', [{ k: 'dur', l: 'Pause length (m:ss)', v: '0:10' }], o => addToView([{ uid: uidGen(), kind: 'pause', title: 'Timed pause', dur: parseDur(o.dur) || 1 }])),
  addComment: () => form('Add comment', [{ k: 'title', l: 'Comment (not played)', ph: 'e.g. Talk about tonight\'s concert' }], o => o.title && addToView([{ uid: uidGen(), kind: 'comment', title: o.title }])),
  shuffleList: () => { const t = viewTab(); const fixed = t.items.filter(x => x.played || x.uid === PL.cur); const rest = t.items.filter(x => !(x.played || x.uid === PL.cur)); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; } t.items = fixed.concat(rest); afterChange(); },
  resetPlayed: () => { viewTab().items.forEach(x => { if (x.uid !== PL.cur) x.played = false; }); afterChange(); },
  showDup: () => { const seen = new Map(); const dup = []; viewTab().items.forEach(x => { const k = x.id || x.url || x.title; if (seen.has(k)) dup.push(x.uid); else seen.set(k, 1); }); PL.sel = new Set(dup); renderPlaylist(); toast(dup.length ? dup.length + ' duplicates selected' : 'No duplicates'); },
  find: () => { const q = prompt('Find in playlist'); if (!q) return; const it = viewTab().items.find(x => ((x.title || '') + ' ' + (x.artist || '')).toLowerCase().includes(q.toLowerCase())); if (it) { PL.sel = new Set([it.uid]); renderPlaylist(); const el = $(`.plr[data-uid="${it.uid}"]`); el && el.scrollIntoView({ block: 'center' }); } else toast('Not found'); },
  library: () => { leftTab('lSearch'); $('#stabs button[data-t="lib"]').click(); $('#search').focus(); },
  rescan: () => api('/api/rescan', {}).then(() => { toast('Rescanning music folders…'); setTimeout(loadServerLib, 2000); }),
  stats: () => rightTab('rStats'), requests: () => rightTab('rReq'), recordings: () => rightTab('rStats'), public: () => rightTab('rStats'),
  pbQueue: () => { const items = PL.pq.map(u => findItem(u)).filter(Boolean).map(f => f.item); $('#miH').textContent = 'Playback queue'; $('#miBody').innerHTML = items.length ? items.map((x, i) => `<div>${i + 1}. ${esc(x.title)} <span class="sub">${esc(x.artist || '')}</span></div>`).join('') + '<div style="margin-top:10px"><button class="btn sm" id="pqClear">Clear queue</button></div>' : '<div class="sub">Empty. Right-click a track → "Play next".</div>'; openModal('mInfo'); const b = $('#pqClear'); if (b) b.onclick = () => { PL.pq = []; afterChange(); closeModal('mInfo'); }; },
  castTitle: () => form('Set cast title', [{ k: 'title', l: 'Title' }, { k: 'artist', l: 'Artist' }], o => { if (!live) return toast('Go live first'); fetch('/api/meta', { method: 'POST', headers: { 'X-Radio-Key': KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: o.title, artist: o.artist, kind: 'OTHER' }) }); toast('Cast title sent'); }),
  jingles: () => { rightTab('rCart'); toast('Keys 1–0 play the first 10 cart wall cells · − stops all'); }, stopCarts: () => stopCarts(),
  options: () => openOptions(), lightSettings: async () => { await openOptions(); const q = $('#optLight'); if (q) q.scrollIntoView({ block: 'start' }); }, hotSettings: async () => { await openOptions(); const q = $('#optHot'); if (q) q.scrollIntoView({ block: 'start' }); }, streamQual: async () => { await openOptions(); const q = $('#sQual'); if (q) { q.scrollIntoView({ block: 'center' }); q.focus(); } }, crossfades: () => { renderFt(); openModal('mXf'); },
  hotkeys: () => { $('#miH').textContent = 'Hot keys'; $('#miBody').innerHTML = [['Space / Shift+Space', 'MIC 1 / MIC 2 (both when linked)'], ['Enter', 'Play selected'], ['Ctrl+E', 'Start / stop broadcasting'], ['1 … 0', 'Cart wall cells 1–10'], ['−', 'Stop all jingles'], ['Insert', 'Insert last library song after the playing track'], ['Num −', 'Add last library song to the end'], ['Delete', 'Remove selected'], ['Ctrl+↑ / Ctrl+↓', 'Move selected'], ['Ctrl+A / C / X / V', 'Select all / copy / cut / paste'], ['Ctrl+, / Ctrl+.', 'Seek −10 s / +10 s'], ['Ctrl+N / O / S / F / P', 'New / open / save / find / options'], ['Alt+click', 'Prelisten']].map(r => `<div style="display:flex;gap:12px"><span class="mono" style="min-width:170px;color:#8CC2FF">${r[0]}</span><span>${r[1]}</span></div>`).join(''); openModal('mInfo'); },
  help: () => { $('#miH').textContent = 'Guide'; $('#miBody').innerHTML = 'The full Hebrew guide is in <b>README-HE.txt</b> in the Radio folder.'; openModal('mInfo'); },
  about: () => { $('#miH').textContent = 'OAB Studio 1.0.15'; $('#miBody').innerHTML = '<img src="/oab-logo.png" alt="" style="width:96px;height:96px;display:block;margin:0 auto 8px">OAB – On Air Broadcast · radio automation studio · version 1.0.15<br>Playlist engine, scheduler, generator, ads scheduler, voice tracking, announcements, reports, DSP, AUX players.<br>AD SOUND &amp; SERVICE'; openModal('mInfo'); },
};
function doAct(a){ $$('.menubar .m').forEach(m => m.classList.remove('open')); if (ACT[a]) ACT[a](); }
document.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a && (a.closest('.dd') || a.closest('.tool') || a.closest('.transport'))) doAct(a.dataset.a); });
$$('.menubar .m').forEach(m => { m.querySelector('span').onclick = e => { e.stopPropagation(); const open = m.classList.contains('open'); $$('.menubar .m').forEach(x => x.classList.remove('open')); if (!open) m.classList.add('open'); };
  m.onmouseenter = () => { if ($$('.menubar .m.open').length && !m.classList.contains('open')) { $$('.menubar .m').forEach(x => x.classList.remove('open')); m.classList.add('open'); } }; });
function syncChecks(){ const map = { tLight: document.documentElement.classList.contains('light'), tGlass: document.documentElement.classList.contains('glass'), tLib: VIEW.lib, tReq: VIEW.req, tInfo: VIEW.info, tAutoscroll: VIEW.autoscroll, tFollow: VIEW.follow, tHourMarks: VIEW.hours, tAutoMix: $('#autoMix').classList.contains('on') }; Object.keys(map).forEach(k => { const el = document.querySelector(`.dd [data-a="${k}"]`); if (el) el.classList.toggle('on', map[k]); }); }
syncChecks();

// keys (customisable – see Settings → Hot keys)
document.addEventListener('keydown', e => {
  if (window.HK_CAPTURE) return;
  if (e.target.matches('input,select,textarea') || $('.modal.on')) { if (e.key === 'Escape') $$('.modal.on').forEach(m => m.classList.remove('on')); return; }
  handleHotkey(e);
});

// ---------------- silence guard + timers ----------------
let idleSince = Date.now();
function guard(){
  if (isPlaying() || cartPlaying.size || micOn || inputs[2].on) { idleSince = Date.now(); return; }
  if (live && $('#autoMix').classList.contains('on') && Date.now() - idleSince > 15000) { idleSince = Date.now(); const nx = peekNext() || viewTab().items.find(x => !x.played && !skipK(x)); if (nx) { toast('Silence guard: starting the next item'); playItem(nx); } }
}
setInterval(() => { $('#clock').textContent = new Date().toTimeString().slice(0, 8); adTick(); guard(); }, 1000);
setInterval(engineTick, 100);
setInterval(() => { if (PL.cur) renderPlaylist(); }, 15000);
setInterval(poll, 2000);

$('#startBtn').onclick = async () => { initAudio(); await ctx.resume(); $('#start').remove(); loadServerCarts(); renderAll(true); };
renderInputs(); renderCart(); loadServerLib(); loadServerAds(); loadPlaylists(); poll();

$('#clock').textContent = new Date().toTimeString().slice(0, 8);
