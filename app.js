/* HYROX Dashboard · Renderer + Log
   Daten:  data.json  (Plan, Benchmarks, Analysen — von Claude gepflegt)
           log.json   (Trainings-Einträge — von Marc im Dashboard erfasst)
*/
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

let DATA = null, LOG = { entries: [] }, LOGSHA = null;

/* ---------------- Zeit-Helfer ---------------- */
function sec(t){
  if(t==null) return NaN;
  const s = String(t).trim().replace(',', '.');
  if(!s) return NaN;
  if(s.indexOf(':') < 0) return parseFloat(s);
  const p = s.split(':').map(Number);
  return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1];
}
function fmt(v){
  if(!isFinite(v)) return '–';
  const m = Math.floor(v/60), r = v - m*60;
  return m + ':' + (r<10?'0':'') + (Math.round(r*10)/10).toString().replace(/\.0$/,'');
}
function fmtMetric(def, val){
  if(def.u === 'num') return String(val);
  return def.u === 'pace' ? fmt(sec(val)) + '/km' : fmt(sec(val));
}
const toNum = (def, val) => def.u === 'num' ? parseFloat(val) : sec(val);
const deDate = d => { const p = String(d).split('-'); return p[2]+'.'+p[1]+'.'+p[0].slice(2); };

/* ---------------- Laden ---------------- */
async function loadJSON(file){
  const r = await fetch(file + '?t=' + Date.now(), {cache:'no-store'});
  if(!r.ok) throw new Error(file + ' ' + r.status);
  return r.json();
}

/* ---------------- Header ---------------- */
function renderHeader(){
  const m = DATA.meta;
  $('kicker').textContent = m.kicker;
  $('h1').innerHTML = m.title + '<br><span>' + m.subtitle + '</span>';
  $('facts').innerHTML = m.facts.map(f => '<span>'+f+'</span>').join('<span class="dot"></span>');
  $('tiles').innerHTML = m.tiles.map(t => '<div class="cd"><b>'+esc(t.v)+'</b><small>'+esc(t.l)+'</small></div>').join('');
  const tick = () => {
    const d = Math.max(0, Math.ceil((new Date(m.raceDate) - new Date())/86400000));
    $('cdd').textContent = d; $('cdw').textContent = Math.floor(d/7);
  };
  tick(); setInterval(tick, 3600000);
}

/* ---------------- Plan ---------------- */
function renderPlan(){
  $('rhythm').innerHTML = DATA.rhythm.map(r =>
    '<div class="rd '+(r.fix?'fix':'')+'"><b>'+esc(r.d)+'</b><small>'+r.t+'</small></div>').join('');
  $('rhythmNote').innerHTML = DATA.rhythmNote;

  $('phases').innerHTML = DATA.phases.map((p,i) =>
    '<div class="phase '+(p.now?'now':'future')+'"><div class="rail"><div class="node"></div>'+
    (i < DATA.phases.length-1 ? '<div class="stem"></div>' : '')+'</div><div class="pcard">'+
    '<div class="ph-top"><h3>'+esc(p.h)+'</h3><span class="wk">'+esc(p.wk)+'</span></div>'+
    '<div class="focus">'+p.f+'</div>'+
    (p.tags||[]).map(t => '<span class="block-tag '+(p.now?'tag-now':'tag-block')+'">'+esc(t)+'</span>').join('')+
    '</div></div>').join('');

  const tr = DATA.testRace;
  $('testRace').innerHTML = '<div class="ch"><h3>'+esc(tr.h)+'</h3><span class="badge b-sim">'+esc(tr.badge)+'</span></div>'+
    '<p class="note">'+tr.note+'</p>';

  const st = DATA.status;
  $('statusCard').innerHTML = '<div class="ch"><h3>'+esc(st.h)+'</h3><span class="badge b-int">'+esc(st.badge)+'</span></div>'+
    st.notes.map((n,i) => '<p class="note"'+(i?' style="margin-top:8px"':'')+'>'+n+'</p>').join('');
  $('standLabel').textContent = 'Aktueller Stand · ' + DATA.meta.stand;
}


/* ---------------- Woche / Heute ---------------- */
const TODAY = new Date().toISOString().slice(0,10);
const WDN = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function allDays(blk){
  const out = [];
  blk.weeks.forEach((w,wi) => w.days.forEach(d => { if(d.date) out.push({...d, wi, wn:w.n, wt:w.t, wd:w.d}); }));
  return out.sort((a,b) => a.date.localeCompare(b.date));
}
function activeBlockIndex(){
  const bs = DATA.blocks;
  let i = bs.findIndex(b => b.from && b.to && TODAY >= b.from && TODAY <= b.to);
  if(i < 0) i = bs.findIndex(b => b.from && TODAY < b.from);   // nächster Block
  if(i < 0) i = bs.length - 1;
  return i;
}
function currentWeekIndex(blk){
  const idx = blk.weeks.findIndex(w => w.days.some(d => d.date && d.date >= TODAY));
  return idx < 0 ? blk.weeks.length-1 : idx;
}
function isDone(date){ return LOG.entries.some(e => e.date === date); }

function renderToday(){
  const bi = activeBlockIndex();
  const blk = DATA.blocks[bi];
  const days = allDays(blk);
  if(!days.length){ $('todayMain').innerHTML = '<div class="empty">Keine datierten Einheiten hinterlegt.</div>'; return; }

  const today = days.find(d => d.date === TODAY);
  const next  = days.find(d => d.date >= TODAY);
  const pick  = today || next || days[days.length-1];
  const label = pick.date === TODAY ? 'Heute' : (pick.date < TODAY ? 'Zuletzt geplant' : 'Als Nächstes');
  const dt    = new Date(pick.date);

  $('todayMain').innerHTML = `
    <div class="today">
      <div class="when"><span class="lbl">${label}</span>
        <span class="dt">${WDN[dt.getUTCDay()]} ${deDate(pick.date)} · Woche ${esc(pick.wn)}</span>
        ${isDone(pick.date) ? '<span class="rpepill">✓ erfasst</span>' : ''}</div>
      <h3>${esc(pick.ti)}</h3>
      <div class="dur2">${esc(pick.dur)}</div>
      <p>${esc(pick.p)}</p>
      <div class="acts">
        ${pick.prompt ? `<button class="p copy2" data-p="${encodeURIComponent(pick.prompt)}">⧉ Prompt kopieren</button>` : ''}
        <button class="s" id="jumpWeek">Woche ansehen</button>
      </div>
    </div>`;

  const wk = blk.weeks[pick.wi];
  $('wkLabel').textContent = 'Woche ' + wk.n + ' · ' + wk.t + ' · ' + wk.d;
  $('weekList').innerHTML = wk.days.map(d => {
    const dd = d.date ? new Date(d.date) : null;
    const done = d.date && isDone(d.date);
    return `<div class="upnext ${done?'done':''}">
      <span class="wd">${done ? '✓' : (dd ? WDN[dd.getUTCDay()] : esc(d.tag))}</span>
      <div class="ui"><b>${esc(d.ti)}</b><small>${esc(d.dur)}${d.date ? ' · ' + deDate(d.date) : ''}</small></div>
      ${d.prompt ? `<button class="go copy2" data-p="${encodeURIComponent(d.prompt)}">⧉</button>` : ''}
    </div>`;
  }).join('');

  document.querySelectorAll('.copy2').forEach(b => b.onclick = e => {
    e.stopPropagation(); doCopy(decodeURIComponent(b.getAttribute('data-p')), b);
  });
  const jw = $('jumpWeek');
  if(jw) jw.onclick = () => {
    goTab('plan'); goSub('segPlan','pl-'+bi);
    setTimeout(() => {
      const c = $('wk-' + bi + '-' + pick.wi);
      if(c){ c.classList.add('open'); c.scrollIntoView({behavior:'smooth', block:'start'}); }
    }, 120);
  };
}

/* ---------------- Sub-Navigation ---------------- */
function goSub(segId, sub){
  const seg = $(segId);
  seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === sub));
  seg.closest('.page').querySelectorAll('.subpage').forEach(s => s.classList.toggle('on', s.id === 's' + '-' + sub));
  window.scrollTo({top:0});
}
function initSegs(){
  ['segPlan','segData'].forEach(id => {
    const seg = $(id);
    if(!seg) return;
    seg.querySelectorAll('button').forEach(b => b.onclick = () => goSub(id, b.dataset.s));
    const first = seg.querySelector('button');
    if(first && !seg.querySelector('button.on')) goSub(id, first.dataset.s);
  });
}
function goTab(p){
  const b = document.querySelector(`nav button[data-p="${p}"]`);
  if(b) b.click();
}

/* ---------------- Blöcke (Wochen + Prompts) ---------------- */
function renderBlocks(){
  const act = activeBlockIndex();

  // Segmentleiste: aktive und künftige Blöcke zuerst, Archiv hinten
  const order = DATA.blocks.map((b,i) => i).sort((x,y) => {
    const ax = x >= act ? 0 : 1, ay = y >= act ? 0 : 1;
    return ax - ay || x - y;
  });
  $('segPlan').innerHTML =
    order.map(i => `<button data-s="pl-${i}">${esc(DATA.blocks[i].short || 'B'+(i+1))}</button>`).join('') +
    `<button data-s="pl-per">Zyklus</button>`;

  $('planSubs').innerHTML = DATA.blocks.map((blk,bi) => `
    <div class="subpage" id="s-pl-${bi}">
      <div class="draft">${esc(blk.label)}</div>
      <div id="blk-${bi}"></div>
    </div>`).join('');

  DATA.blocks.forEach((blk, bi) => {
    const cur = bi === act ? currentWeekIndex(blk) : -1;
    $('blk-'+bi).innerHTML = blk.weeks.map((w,i) => `
      <div class="wkcard ${i===cur?'open':''}" id="wk-${bi}-${i}">
        <div class="wkhead"><div class="l"><span class="wknum">${esc(w.n)}</span>
          <div class="wkmeta"><b>${esc(w.t)}</b><small>${esc(w.d)}</small></div></div><span class="chev">▶</span></div>
        <div class="wkbody">${w.days.map(d => `
          <div class="day">
            <div class="dtop"><span class="dtag ${d.cls}">${esc(d.tag)}</span>
              <div class="dcontent"><b>${esc(d.ti)}<span class="dur">${esc(d.dur)}</span></b><p>${esc(d.p)}</p></div></div>
            ${d.prompt ? `<button class="copy" data-p="${encodeURIComponent(d.prompt)}">⧉ Prompt kopieren</button>` : ''}
          </div>`).join('')}
        </div>
      </div>`).join('');
  });

  document.querySelectorAll('.wkhead').forEach(h => h.onclick = () => h.parentElement.classList.toggle('open'));
  document.querySelectorAll('.copy').forEach(b => b.onclick = e => {
    e.stopPropagation(); doCopy(decodeURIComponent(b.getAttribute('data-p')), b);
  });
}

/* ---------------- Kopieren ---------------- */
function flashOk(b){ const o=b.innerHTML; b.classList.add('done'); b.innerHTML='✓ kopiert';
  setTimeout(()=>{b.classList.remove('done'); b.innerHTML=o;},1400); }
async function doCopy(txt,b){
  let ok=false;
  try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); ok=true; } }catch(e){}
  if(!ok){ try{ const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed';
    ta.style.top='-9999px'; document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy');
    document.body.removeChild(ta);}catch(e){} }
  if(ok) flashOk(b); else { $('copyArea').value=txt; $('copyModal').style.display='flex'; }
}

/* ---------------- Daten-Seite: Gaps & Splits ---------------- */
function renderGaps(){
  const gmax = Math.max(...DATA.gaps.map(g => sec(g.is)));
  $('gaps').innerHTML = DATA.gaps.map(g => {
    const is=sec(g.is), tg=sec(g.tg);
    const fl = g.k==='weak' ? '<span class="flag f-weak">Hebel</span>'
             : g.k==='strong' ? '<span class="flag f-strong">stark</span>' : '';
    return `<div class="gap"><div class="gl"><span class="nm">${esc(g.n)} ${fl}</span>
      <span class="vals"><span class="is">${esc(g.is)}</span><span class="ar">→</span><span class="tg">${esc(g.tg)}</span></span></div>
      <div class="gbar"><span class="ok" style="width:${tg/gmax*100}%"></span><span class="ov" style="width:${(is-tg)/gmax*100}%"></span></div></div>`;
  }).join('');
}
function renderSplits(el, arr){
  const max = Math.max(...arr.map(d => sec(d.t)));
  $(el).innerHTML = arr.map(d => {
    const cls = d.run?'run' : d.k==='weak'?'weak' : d.k==='strong'?'strong' : '';
    const fl = d.k==='weak' ? '<span class="flag f-weak">Schwäche</span>'
             : d.k==='strong' ? '<span class="flag f-strong">stark</span>' : '';
    return `<div class="split"><div class="sl"><span class="nm ${d.run?'run':''}">${esc(d.n)} ${fl}</span>
      <span class="tm">${esc(d.t)}</span></div><div class="bar"><i class="${cls}" style="width:${(sec(d.t)/max*100).toFixed(1)}%"></i></div></div>`;
  }).join('');
}
function renderBenchmarks(){
  $('bms').innerHTML = DATA.benchmarks.map(b =>
    `<div class="bm ${b.next?'next':''}"><div class="bmnum">${esc(b.n)}</div>
     <div class="bminfo"><b>${esc(b.ti)}</b><small>${esc(b.s)}</small></div><div class="bmwhen">${b.w}</div></div>`).join('');
  $('runbm').innerHTML = DATA.runbm.map(r =>
    `<div class="gap" style="margin-bottom:13px"><div class="gl"><span class="nm">${esc(r.n)}</span>
     <span class="vals"><span class="is">${esc(r.is)}</span><span class="ar">→</span><span class="tg">${esc(r.tg)}</span></span></div>
     <div class="note" style="padding:2px 0 0;font-size:10.5px">${esc(r.note)}</div></div>`).join('');
}

/* ---------------- Fortschritts-Charts aus log.json ---------------- */
function seriesFor(key){
  return LOG.entries
    .filter(e => e.metrics && e.metrics[key] !== undefined && e.metrics[key] !== '')
    .map(e => ({ d: e.date, v: e.metrics[key] }))
    .sort((a,b) => a.d.localeCompare(b.d));
}
function sparkline(def, pts){
  const W=300, H=104, pl=6, pr=44, pt=12, pb=18;
  const vals = pts.map(p => toNum(def, p.v)).filter(isFinite);
  if(!vals.length) return '';
  let lo = Math.min(...vals, def.lo!=null ? toNum(def,def.lo) : Infinity);
  let hi = Math.max(...vals, def.hi!=null ? toNum(def,def.hi) : -Infinity);
  const goal = def.goal!=null ? toNum(def,def.goal) : null;
  if(goal!=null){ lo=Math.min(lo,goal); hi=Math.max(hi,goal); }
  if(hi-lo < 1e-6){ hi=lo+1; }
  const pad=(hi-lo)*0.12; lo-=pad; hi+=pad;
  const t0=new Date(pts[0].d), t1=new Date(pts[pts.length-1].d);
  const span=Math.max(1, t1-t0);
  const x = d => pl + ((new Date(d)-t0)/span) * (W-pl-pr);
  const yy = v => def.dir==='down'
      ? pt + ((v-lo)/(hi-lo))*(H-pt-pb)      // kleiner Wert = besser = oben
      : pt + ((hi-v)/(hi-lo))*(H-pt-pb);
  let s='';
  if(goal!=null){
    const gy=yy(goal);
    s += `<line x1="${pl}" y1="${gy}" x2="${W-pr}" y2="${gy}" stroke="#9bbf00" stroke-width="1.1" stroke-dasharray="4 3" opacity=".8"/>`;
    s += `<text x="${W-pr+5}" y="${gy+3}" fill="#9bbf00" font-size="8.5" font-family="JetBrains Mono">Ziel ${esc(def.goal)}</text>`;
  }
  const path = pts.map((p,i) => (i?'L':'M') + x(p.d).toFixed(1) + ' ' + yy(toNum(def,p.v)).toFixed(1)).join(' ');
  s += `<path d="${path}" fill="none" stroke="#54e36a" stroke-width="1.8" stroke-linejoin="round"/>`;
  const gy2 = goal!=null ? yy(goal) : null;
  pts.forEach((p,i) => {
    const px=x(p.d), py=yy(toNum(def,p.v)), last = i===pts.length-1;
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${last?4.5:3}" fill="${last?'#ccff00':'#54e36a'}"/>`;
    if(last){
      // Label über den Punkt, weg von der Ziellinie und vom rechten Rand
      let ly = py - 9;
      if(gy2!=null && Math.abs(ly - gy2) < 9) ly = py + 15;
      if(ly < pt + 8) ly = py + 15;
      s += `<text x="${px.toFixed(1)}" y="${ly.toFixed(1)}" fill="#ccff00" font-size="9.5" font-family="JetBrains Mono" text-anchor="middle">${esc(p.v)}</text>`;
    }
  });
  s += `<text x="${pl}" y="${H-4}" fill="#52564e" font-size="8" font-family="JetBrains Mono">${deDate(pts[0].d)}</text>`;
  if(pts.length>1)
    s += `<text x="${W-pr}" y="${H-4}" fill="#52564e" font-size="8" font-family="JetBrains Mono" text-anchor="end">${deDate(pts[pts.length-1].d)}</text>`;
  return s;
}
function renderMetrics(){
  const html = DATA.metrics.map(def => {
    const pts = seriesFor(def.k);
    if(!pts.length) return '';
    const last = pts[pts.length-1], prev = pts.length>1 ? pts[pts.length-2] : null;
    if(pts.length < 2){
      return `<div class="mone"><div class="mi"><b>${esc(def.n)}</b><small>${deDate(last.d)} · erste Messung</small></div>
        <div><span class="mv">${esc(fmtMetric(def,last.v))}</span>
        ${def.goal ? `<span class="mg">Ziel ${esc(def.goal)}</span>` : ''}</div></div>`;
    }
    let tr='';
    if(prev){
      const dv = toNum(def,last.v) - toNum(def,prev.v);
      const better = def.dir==='down' ? dv<0 : dv>0;
      if(Math.abs(dv) > 1e-6)
        tr = `<span class="trend ${better?'up':'dn'}">${dv>0?'+':'−'}${def.u==='num'?Math.abs(dv).toFixed(0):fmt(Math.abs(dv))}</span>`;
    }
    return `<div class="mchart">
      <div class="mh"><b>${esc(def.n)}</b><span class="cur">${esc(fmtMetric(def,last.v))}${tr}</span></div>
      <div class="sub2">${esc(def.hint||'')} · ${pts.length} Messung${pts.length>1?'en':''}</div>
      <svg viewBox="0 0 300 104" width="100%">${sparkline(def, pts)}</svg></div>`;
  }).join('');
  $('metrics').innerHTML = html || '<div class="empty">Noch keine Messwerte erfasst.<br>Trag im Reiter <b>Log</b> eine Session mit Kennzahlen ein — die Kurven bauen sich dann automatisch auf.</div>';
}

/* ---------------- Log-Liste ---------------- */
function typeOf(v){ return DATA.sessionTypes.find(t => t.v===v) || {n:v, cls:'d-opt'}; }
function renderLog(){
  const es = LOG.entries.slice().sort((a,b) => b.date.localeCompare(a.date));
  $('logList').innerHTML = es.length ? es.map(e => {
    const t = typeOf(e.type);
    const chips = Object.entries(e.metrics||{}).filter(([k,v]) => v!=='' && v!=null).map(([k,v]) => {
      const def = DATA.metrics.find(m => m.k===k);
      return def ? `<span class="chip"><i>${esc(def.n.split('·')[0].trim())}</i> ${esc(fmtMetric(def,v))}</span>` : '';
    }).join('');
    return `<div class="logitem">
      <button class="del" data-id="${esc(e.id)}">✕</button>
      <div class="lh"><span class="dtag ${t.cls}">${esc(t.n)}</span><span class="dt">${deDate(e.date)}</span>
        ${e.rpe ? `<span class="rpepill">RPE ${esc(e.rpe)}</span>` : ''}</div>
      <h4>${esc(e.title)}</h4>
      ${e.body ? `<p>${esc(e.body).replace(/\n/g,'<br>')}</p>` : ''}
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>`;
  }).join('') : '<div class="empty">Noch keine Einträge.</div>';

  document.querySelectorAll('.del').forEach(b => b.onclick = () => {
    if(!confirm('Eintrag löschen?')) return;
    LOG.entries = LOG.entries.filter(x => x.id !== b.dataset.id);
    renderLog(); renderMetrics(); renderToday(); persist('Eintrag gelöscht');
  });
}

/* ---------------- Formular ---------------- */
function openForm(){
  const today = new Date().toISOString().slice(0,10);
  $('f-date').value = today;
  $('f-type').innerHTML = DATA.sessionTypes.map(t => `<option value="${t.v}">${esc(t.n)}</option>`).join('');
  $('f-title').value=''; $('f-body').value=''; $('f-rpe').value='';
  $('f-metrics').innerHTML = DATA.metrics.map(m =>
    `<div class="mrow"><div class="mn"><b>${esc(m.n)}</b>${esc(m.hint||'')}</div>
     <input data-k="${m.k}" inputmode="${m.u==='num'?'numeric':'text'}" placeholder="${m.u==='num'?'–':'m:ss'}"></div>`).join('');
  $('formSheet').classList.add('on');
}
function saveForm(){
  const title = $('f-title').value.trim();
  if(!title){ alert('Titel fehlt.'); return; }
  const metrics = {};
  document.querySelectorAll('#f-metrics input').forEach(i => { if(i.value.trim()) metrics[i.dataset.k] = i.value.trim(); });
  LOG.entries.push({
    id: $('f-date').value + '-' + Math.random().toString(36).slice(2,7),
    date: $('f-date').value,
    type: $('f-type').value,
    title, rpe: $('f-rpe').value ? Number($('f-rpe').value) : null,
    body: $('f-body').value.trim(), metrics
  });
  $('formSheet').classList.remove('on');
  renderLog(); renderMetrics(); renderToday(); persist('Session ' + $('f-date').value);
}

/* ---------------- GitHub-Sync ---------------- */
function cfg(){
  const saved = JSON.parse(localStorage.getItem('hx_cfg') || '{}');
  if(!saved.repo){
    const host = location.hostname.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean)[0];
    if(location.hostname.endsWith('github.io') && seg) saved.repo = host + '/' + seg;
  }
  return saved;
}
function setCfg(o){ localStorage.setItem('hx_cfg', JSON.stringify(o)); }
function b64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000));
  return btoa(bin);
}
function syncState(cls, txt){
  const el = $('sync'); el.className = 'sync ' + cls;
  $('syncTxt').innerHTML = txt;
}
async function ghPut(path, text, msg){
  const c = cfg();
  if(!c.token || !c.repo) throw new Error('Kein Token oder Repo hinterlegt');
  const url = `https://api.github.com/repos/${c.repo}/contents/${path}`;
  const h = { 'Authorization':'Bearer '+c.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' };
  const branch = c.branch || 'main';
  let sha = null;
  const cur = await fetch(url + '?ref=' + branch, {headers:h, cache:'no-store'});
  if(cur.ok) sha = (await cur.json()).sha;
  const body = { message: msg, content: b64(text), branch };
  if(sha) body.sha = sha;
  const res = await fetch(url, { method:'PUT', headers:h, body: JSON.stringify(body) });
  const j = await res.json();
  if(!res.ok) throw new Error(j.message || ('HTTP ' + res.status));
  return j.content.sha;
}

async function persist(msg){
  localStorage.setItem('hx_log_backup', JSON.stringify(LOG));
  const c = cfg();
  if(!c.token || !c.repo){
    syncState('err', 'Lokal gespeichert, <b>nicht synchronisiert</b> — Token fehlt.');
    return;
  }
  syncState('busy', 'Speichere …');
  try{
    LOGSHA = await ghPut('log.json', JSON.stringify(LOG, null, 1), 'log: ' + msg);
    syncState('ok', 'Synchronisiert · ' + new Date().toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){
    syncState('err', 'Fehler: ' + esc(e.message) + ' — lokal gesichert.');
  }
}

/* ---------------- Import ---------------- */
let IMP = null;   // {kind, obj, text}

function validateImport(raw){
  let obj;
  try{ obj = JSON.parse(raw); }
  catch(e){ return { ok:false, msg:'Kein gültiges JSON: ' + e.message }; }
  if(!obj || typeof obj !== 'object') return { ok:false, msg:'Erwartet wird ein JSON-Objekt.' };

  if(Array.isArray(obj.entries)){
    const bad = obj.entries.filter(e => !e || !e.date || !e.title);
    if(bad.length) return { ok:false, msg:`${bad.length} Einträge ohne Datum oder Titel.` };
    const dates = obj.entries.map(e => e.date).sort();
    return { ok:true, kind:'log', obj,
      info:[`<b>log.json</b> · ${obj.entries.length} Einträge`,
            `Zeitraum ${dates.length ? deDate(dates[0]) + ' – ' + deDate(dates[dates.length-1]) : '–'}`,
            `Ersetzt aktuell ${LOG.entries.length} Einträge`],
      warn: obj.entries.length < LOG.entries.length
        ? `Die Datei hat ${LOG.entries.length - obj.entries.length} Einträge weniger als der aktuelle Stand.` : null };
  }

  if(Array.isArray(obj.blocks)){
    const miss = ['meta','metrics','sessionTypes','gaps','benchmarks'].filter(k => !obj[k]);
    if(miss.length) return { ok:false, msg:'Fehlende Abschnitte: ' + miss.join(', ') };
    if(!obj.meta.raceDate || isNaN(new Date(obj.meta.raceDate)))
      return { ok:false, msg:'meta.raceDate fehlt oder ist kein gültiges Datum.' };
    const badBlk = obj.blocks.find(b => !Array.isArray(b.weeks));
    if(badBlk) return { ok:false, msg:'Ein Block hat kein weeks-Array.' };
    const wk = obj.blocks.reduce((n,b) => n + b.weeks.length, 0);
    const dy = obj.blocks.reduce((n,b) => n + b.weeks.reduce((m,w) => m + (w.days||[]).length, 0), 0);
    const dated = obj.blocks.reduce((n,b) => n + b.weeks.reduce((m,w) => m + (w.days||[]).filter(d=>d.date).length, 0), 0);
    const keys = obj.metrics.map(m => m.k);
    const used = new Set(LOG.entries.flatMap(e => Object.keys(e.metrics||{})));
    const lost = [...used].filter(k => !keys.includes(k));
    return { ok:true, kind:'data', obj,
      info:[`<b>data.json</b> · ${obj.blocks.map(b=>b.short||b.id).join(' · ')}`,
            `${wk} Wochen · ${dy} Einheiten · ${dated} mit Datum`,
            `Zielrennen ${esc(obj.meta.subtitle||'?')} am ${deDate(String(obj.meta.raceDate).slice(0,10))}`,
            `${obj.metrics.length} Kennzahlen`],
      warn: lost.length ? `Kennzahl(en) ${lost.join(', ')} kommen in deinen Einträgen vor, fehlen aber in der neuen Datei — die Kurven dazu verschwinden.` : null };
  }
  return { ok:false, msg:'Weder blocks (data.json) noch entries (log.json) gefunden.' };
}

function showValidation(raw){
  const v = $('vout'); IMP = null; $('i-save').disabled = true;
  const r = validateImport(raw);
  v.className = 'vout on ' + (r.ok ? 'ok' : 'bad');
  if(!r.ok){ v.innerHTML = '✕ ' + esc(r.msg); return; }
  IMP = { kind:r.kind, obj:r.obj, text:raw };
  $('i-save').disabled = false;
  v.innerHTML = '✓ Geprüft' + r.info.map(t => '<span class="kv">' + t + '</span>').join('')
    + (r.warn ? '<span class="kv warn">⚠ ' + esc(r.warn) + '</span>' : '');
}

function openImport(){
  $('impText').value = ''; $('vout').className = 'vout';
  $('i-save').disabled = true; IMP = null;
  $('impSheet').classList.add('on');
}

async function doImport(){
  if(!IMP) return;
  const file = IMP.kind === 'data' ? 'data.json' : 'log.json';
  const v = $('vout');
  const c = cfg();
  if(!c.token || !c.repo){
    v.className = 'vout on bad';
    v.innerHTML = '✕ Kein Token hinterlegt — ohne Schreibzugriff kann die Datei nicht ins Repo geschrieben werden. Erst unter ⚙ einrichten.';
    return;
  }
  $('i-save').disabled = true;
  v.className = 'vout on ok'; v.innerHTML = 'Schreibe ' + file + ' …';
  try{
    const pretty = JSON.stringify(IMP.obj, null, 1);
    await ghPut(file, pretty, 'import: ' + file + ' aktualisiert');
    if(IMP.kind === 'log'){
      LOG = IMP.obj; LOGSHA = null;
      localStorage.setItem('hx_log_backup', JSON.stringify(LOG));
      renderLog(); renderMetrics(); renderToday();
      $('impSheet').classList.remove('on');
      syncState('ok', 'log.json importiert · ' + LOG.entries.length + ' Einträge');
    }else{
      v.innerHTML = '✓ data.json geschrieben. Seite wird neu geladen …';
      setTimeout(() => location.reload(), 900);
    }
  }catch(e){
    v.className = 'vout on bad';
    v.innerHTML = '✕ Schreiben fehlgeschlagen: ' + esc(e.message);
    $('i-save').disabled = false;
  }
}

function initImport(){
  const drop = $('drop'), fi = $('fileIn'), ta = $('impText');
  drop.onclick = () => fi.click();
  fi.onchange = () => { const f = fi.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = () => { ta.value = r.result; showValidation(r.result); }; r.readAsText(f); };
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('hot'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('hot'); }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = () => { ta.value = r.result; showValidation(r.result); }; r.readAsText(f);
  });
  $('i-check').onclick = () => showValidation(ta.value.trim());
  $('i-cancel').onclick = () => $('impSheet').classList.remove('on');
  $('i-save').onclick = doImport;
}

function openCfg(){
  const c = cfg();
  $('c-repo').value = c.repo || 'kueni08/hyrox';
  $('c-token').value = c.token || '';
  $('cfgSheet').classList.add('on');
}
function saveCfg(){
  setCfg({ repo: $('c-repo').value.trim(), token: $('c-token').value.trim(), branch:'main' });
  $('cfgSheet').classList.remove('on');
  syncState(cfg().token ? 'ok' : 'err', cfg().token ? 'Token gespeichert.' : 'Kein Token — nur lokal.');
}

/* ---------------- Statische Projektions-Charts ---------------- */
function renderProjection(){
  const W=320,H=165,pl=34,pr=10,pt=14,pb=24, yMin=3480, yMax=4560, MON=8;
  const x=m=>pl+(m/MON)*(W-pl-pr), y=v=>pt+((v-yMin)/(yMax-yMin))*(H-pt-pb);
  let s='';
  [3600,3900,4200,4500].forEach(v=>{const yy=y(v),lab=Math.floor(v/60)+':'+String(v%60).padStart(2,'0');
    s+=`<line x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}" stroke="#1c1e19"/>`;
    s+=`<text x="${pl-6}" y="${yy+3}" fill="#52564e" font-size="8" font-family="JetBrains Mono" text-anchor="end">${lab}</text>`;});
  s+=`<rect x="${pl}" y="${y(3780)}" width="${W-pl-pr}" height="${y(3960)-y(3780)}" fill="rgba(204,255,0,.10)"/>`;
  s+=`<line x1="${pl}" y1="${y(3600)}" x2="${W-pr}" y2="${y(3600)}" stroke="#52564e" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  s+=`<text x="${W-pr}" y="${y(3600)-4}" fill="#7d827a" font-size="8" font-family="JetBrains Mono" text-anchor="end">Stretch 60:00</text>`;
  s+=`<text x="${W-pr}" y="${y(3960)-4}" fill="#9bbf00" font-size="8" font-family="JetBrains Mono" text-anchor="end">Ziel 63–66</text>`;
  const x0=x(0),y0=y(4386),x1=x(MON),y1=y(3870);
  s+=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#9bbf00" stroke-width="1.4" stroke-dasharray="5 4" opacity=".55"/>`;
  [[1.4,'B1'],[4.2,'GEN'],[5.2,'B3'],[6.1,'MIL']].forEach(([m,l])=>{const px=x(m),py=y0+(y1-y0)*(m/MON);
    s+=`<circle cx="${px}" cy="${py}" r="3.5" fill="#080808" stroke="#52564e" stroke-width="1.5"/>`;
    s+=`<text x="${px}" y="${py-7}" fill="#7d827a" font-size="7.5" font-family="JetBrains Mono" text-anchor="middle">${l}</text>`;});
  s+=`<circle cx="${x0}" cy="${y0}" r="4.5" fill="#ff4533"/>`;
  s+=`<text x="${x0+2}" y="${y0+14}" fill="#ff4533" font-size="8" font-family="JetBrains Mono">73:06</text>`;
  s+=`<circle cx="${x1}" cy="${y1}" r="4.5" fill="#ccff00"/>`;
  [['Jun',0],['Aug',2],['Okt',4],['Dez',6],['Feb',8]].forEach(([l,m])=>{
    s+=`<text x="${x(m)}" y="${H-7}" fill="#52564e" font-size="8" font-family="JetBrains Mono" text-anchor="middle">${l}</text>`;});
  $('proj').innerHTML=s;
}

/* ---------------- Navigation ---------------- */
function initNav(){
  const btns=document.querySelectorAll('nav button'), pages=document.querySelectorAll('.page');
  const pos = {}; let cur = 'today';
  btns.forEach(b => b.onclick = () => {
    pos[cur] = window.scrollY; cur = b.dataset.p;
    btns.forEach(x=>x.classList.remove('on')); pages.forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); $('p-'+cur).classList.add('on');
    window.scrollTo({top: pos[cur] || 0});
  });
  const tt = $('totop');
  window.addEventListener('scroll', () => tt.classList.toggle('on', window.scrollY > 700), {passive:true});
  tt.onclick = () => window.scrollTo({top:0, behavior:'smooth'});
}

/* ---------------- Start ---------------- */
(async function init(){
  try{
    DATA = await loadJSON('data.json');
  }catch(e){
    document.body.innerHTML = '<div class="empty" style="padding:60px 20px">data.json konnte nicht geladen werden.<br>'+esc(e.message)+'</div>';
    return;
  }
  try{
    LOG = await loadJSON('log.json');
  }catch(e){
    const bk = localStorage.getItem('hx_log_backup');
    LOG = bk ? JSON.parse(bk) : { entries: [] };
  }
  if(!LOG.entries) LOG.entries = [];

  renderHeader(); renderPlan(); renderBlocks();
  renderGaps(); renderSplits('raceSplits', DATA.raceSplits); renderSplits('simSplits', DATA.simSplits);
  renderBenchmarks(); renderProjection(); renderMetrics(); renderLog(); renderToday();
  initNav(); initSegs();

  $('btnNew').onclick = openForm;
  $('btnNew2').onclick = openForm;
  $('btnCfg').onclick = openCfg;
  $('f-save').onclick = saveForm;
  $('f-cancel').onclick = () => $('formSheet').classList.remove('on');
  $('c-save').onclick = saveCfg;
  $('c-cancel').onclick = () => $('cfgSheet').classList.remove('on');
  $('copyClose').onclick = () => $('copyModal').style.display='none';
  $('btnExport').onclick = e => doCopy(JSON.stringify(LOG,null,1), e.target);
  $('btnImport').onclick = openImport;
  initImport();

  const c = cfg();
  syncState(c.token ? 'ok' : '', c.token
    ? 'Verbunden mit <b>'+esc(c.repo)+'</b>'
    : 'Kein Token hinterlegt — Einträge bleiben nur auf diesem Gerät. <button id="lnkCfg">einrichten</button>');
  if($('lnkCfg')) $('lnkCfg').onclick = openCfg;
})();
