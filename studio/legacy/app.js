'use strict';
/* 화면 틀: 개념 선택 → 설정 + 강의 무대. 개념별 내용은 series.js, pde.js가 선언합니다. */
const CONCEPTS = { series: SeriesConcept, pde: PdeConcept };
const LATER = [
  { title: '적분 변환', sections: '11.7 ~ 11.10절', blurb: 'Fourier 적분, 사인·코사인 변환, Fourier 변환, DFT·FFT, 변환표' },
  { title: '고유값과 직교 함수', sections: '11.5 · 11.6절', blurb: 'Sturm–Liouville 문제, Legendre·Bessel 급수' },
  { title: '강제진동', sections: '11.3절', blurb: '주기 외력과 공진에 가까운 차수' },
  { title: '막의 진동', sections: '12.8 ~ 12.10절', blurb: '직사각형 막, 원형 막, 절선' },
  { title: '정상 상태와 퍼텐셜', sections: '12.6 · 12.11절', blurb: '직사각형 Dirichlet 문제, 구 퍼텐셜' },
  { title: 'Laplace 변환 풀이', sections: '12.12절', blurb: '반무한 현과 반무한 막대' },
];
const DRAW_NODES = 512;
const UI = { hx: null, drawing: false, drawRange: null, plot: null, pressed: false, lastDraw: null };
const App = { concept: null, cfg: {}, model: null, error: '', playing: false, last: 0, clock: { acc: 0 }, dirty: true,
  problem: {}, reveal: {}, saved: {}, theme: 'light', scale: 1.15, settings: true, present: false, panelKey: '' };
const $ = id => document.getElementById(id);

/* ── 저장 ─────────────────────────────────────────── */
function loadStore() {
  try {
    const data = JSON.parse(localStorage.getItem('studio') || '{}');
    App.saved = data.saved ?? {}; App.theme = data.theme ?? 'light'; App.scale = data.scale ?? 1.15;
    for (const id of Object.keys(CONCEPTS)) if (data.last?.[id]) App.cfg[id] = mergeConfig(CONCEPTS[id].defaults(), data.last[id]);
  } catch { /* 저장소를 쓸 수 없으면 기본값으로 시작합니다 */ }
}
let storeTimer = 0;
function store() {
  clearTimeout(storeTimer);
  storeTimer = setTimeout(() => {
    try { localStorage.setItem('studio', JSON.stringify({ saved: App.saved, theme: App.theme, scale: App.scale, last: App.cfg })); } catch { /* 이번 실행에서만 유지합니다 */ }
  }, 300);
}
function mergeConfig(base, over) { return { ...base, ...over, show: { ...base.show, ...(over.show ?? {}) }, src: { ...base.src, ...(over.src ?? {}) } }; }

/* ── 개념 선택 ─────────────────────────────────────── */
function renderHome() {
  $('homeGrid').innerHTML = Object.values(CONCEPTS).map(c => `<button type="button" class="card" data-open="${c.id}"><span class="sec">${c.sections}</span><strong>${c.title}</strong><span>${c.blurb}</span></button>`).join('')
    + LATER.map(c => `<div class="card later" aria-disabled="true"><span class="sec">${c.sections} · 준비 중</span><strong>${c.title}</strong><span>${c.blurb}</span></div>`).join('');
}
function showHome() { stopPlay(); stopDrawing(false); App.concept = null; setPresent(false); $('home').hidden = false; $('stage').hidden = true; }
function openConcept(id) {
  App.concept = CONCEPTS[id];
  App.cfg[id] = App.cfg[id] ?? App.concept.defaults();
  $('home').hidden = true; $('stage').hidden = false;
  $('conceptName').textContent = App.concept.title; $('conceptSec').textContent = App.concept.sections;
  App.panelKey = ''; App.model = null;
  rebuild(); renderAll();
}
const cfg = () => App.cfg[App.concept.id];

/* ── 계산 ─────────────────────────────────────────── */
function rebuild() {
  try { App.model = App.concept.build(cfg()); App.error = ''; return true; }
  catch (err) { App.error = err.message; return false; }
}
function renderAll() { renderPresets(); renderSettings(); renderTransport(); refreshBoard(); }

/* ── 설정 패널 ─────────────────────────────────────── */
const getPath = (o, path) => path.split('.').reduce((a, k) => a[k], o);
function setPath(o, path, v) { const keys = path.split('.'), last = keys.pop(); keys.reduce((a, k) => a[k], o)[last] = v; }
const value = (v, c) => typeof v === 'function' ? v(c) : v;
function itemHTML(item, c) {
  if (item.when && !item.when(c)) return '';
  const id = item.key ? `k_${item.key}` : `p_${item.path?.replace('.', '_')}`;
  if (item.type === 'toggle') return `<label class="switch"><input type="checkbox" id="${id}" data-path="${item.path}" ${getPath(c, item.path) ? 'checked' : ''}><span>${value(item.label, c)}</span></label>`;
  if (item.type === 'seg') return `<div class="seg" role="group" aria-label="${item.label || item.key}">${item.options.map(([v, t]) => `<button type="button" data-seg="${item.key}" data-val="${v}" aria-pressed="${c[item.key] === v}">${t}</button>`).join('')}</div>`;
  if (item.type === 'slider') return `<div class="field slider"><label for="${id}">${item.label}</label><input id="${id}" type="range" data-key="${item.key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${c[item.key]}"><output>${fmt(+c[item.key], 2)}</output></div>`;
  if (item.type === 'number') return `<div class="field"><label for="${id}">${item.label}</label><input id="${id}" type="number" step="any" data-num="${item.key}" value="${c[item.key]}"></div>`;
  if (item.type === 'text') return `<div class="field"><label for="${id}">${item.label}</label><input id="${id}" type="text" spellcheck="false" data-text="${item.key}" value="${escapeHTML(c[item.key])}" placeholder="${item.hint ?? ''}"></div>`;
  if (item.type === 'source') return sourceHTML(c);
  return '';
}
function sourceHTML(c) {
  const chips = App.concept.examples.map(e => `<button type="button" class="chip" data-example="${e.id}" aria-pressed="${c.example === e.id}">${e.label}<small>${e.note}</small></button>`).join('');
  const names = c.src.samples ? [] : (App.model?.params ?? []);
  const sliders = names.map(p => `<div class="field slider"><label for="q_${p}"><i>${p}</i></label><input id="q_${p}" type="range" data-param="${p}" min="-5" max="5" step="0.1" value="${c.src.params[p] ?? 1}"><output>${fmt(c.src.params[p] ?? 1, 2)}</output></div>`).join('');
  return `<div class="chips">${chips}</div>
    <div class="field expr"><label for="expr"><i>f</i>(<i>x</i>) =</label><input id="expr" type="text" spellcheck="false" autocomplete="off" data-expr value="${escapeHTML(c.src.samples ? '' : c.src.expr)}" placeholder="${c.src.samples ? '직접 그린 함수입니다' : '예: k*x^2'}"></div>
    ${App.error ? `<p class="err" role="alert">${escapeHTML(App.error)}</p>` : ''}
    <div class="row"><button type="button" class="btn" data-act="draw" aria-pressed="${UI.drawing}">${UI.drawing ? '그리기 끝내기' : '직접 그리기'}</button>${UI.drawing ? '<button type="button" class="btn" data-act="clear">지우기</button>' : ''}</div>
    ${sliders}`;
}
function renderSettings() {
  const active = document.activeElement, focusId = active?.id, caret = active?.selectionStart;
  const c = cfg();
  $('settingsBody').innerHTML = App.concept.schema(c).map(g => {
    const body = g.items.map(i => itemHTML(i, c)).join('');
    return body.trim() ? `<section><h3>${g.title}</h3>${body}</section>` : '';
  }).join('');
  if (focusId && $(focusId) && $(focusId) !== active) { const el = $(focusId); el.focus(); if (caret != null && el.setSelectionRange && el.type === 'text') el.setSelectionRange(caret, caret); }
}
function renderPresets() {
  const list = [...App.concept.presets.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${p.label}</button>`),
    ...(App.saved[App.concept.id] ?? []).map((p, i) => `<span class="saved"><button type="button" class="chip mine" data-mine="${i}">${escapeHTML(p.name)}</button><button type="button" class="x" data-del="${i}" aria-label="${escapeHTML(p.name)} 삭제">×</button></span>`)];
  $('presets').innerHTML = list.join('');
}

/* ── 무대 ─────────────────────────────────────────── */
function setReadout(html) { const r = $('readout'); if (r && r.dataset.v !== html) { r.dataset.v = html; r.innerHTML = html; } }
function problemPanel(type) {
  const p = App.problem[type] ?? (App.problem[type] = App.concept.newProblem());
  return `<p class="tag">${p.kind}</p><p class="prob">${p.html}</p>
    <div class="row"><button type="button" class="btn primary" data-act="newProblem">새 문제</button><button type="button" class="btn" data-act="reveal" aria-pressed="${!!App.reveal[type]}">${App.reveal[type] ? '정답 가리기' : '정답 보기'}</button><button type="button" class="btn" data-act="applyProblem">그래프로 보기</button></div>
    ${App.reveal[type] ? `<div class="ans">${p.answer.map(a => `<p>${a}</p>`).join('')}</div>` : ''}`;
}
function refreshBoard() {
  const c = cfg(), model = App.model, board = $('panels');
  if (!model) { board.innerHTML = `<div class="panel"><p class="err">${escapeHTML(App.error)}</p></div>`; App.panels = []; return; }
  $('mathStrip').hidden = !c.show.formula; if (c.show.formula) { const h = App.concept.math(c, model); if ($('mathStrip').dataset.v !== h) { $('mathStrip').dataset.v = h; $('mathStrip').innerHTML = h; } }
  $('noteStrip').hidden = !c.show.note; if (c.show.note) $('noteStrip').textContent = App.concept.note(c, model);
  const panels = App.concept.panels(c, model), key = panels.map(p => p.id).join(',');
  if (key !== App.panelKey) {
    App.panelKey = key;
    board.innerHTML = panels.map(p => `<section class="panel ${p.id === 'main' ? 'main' : ''} ${p.html ? 'text' : ''}" data-panel="${p.id}"><header><h4></h4><div class="legend"></div></header>${p.html ? '<div class="content"></div>' : `<div class="cwrap"><canvas role="img"></canvas></div>`}</section>`).join('');
    const extra = panels.length - 1;
    board.dataset.layout = extra === 0 ? 'one' : extra <= 2 ? 'two' : 'three';
    const rows = extra === 0 ? 1 : extra <= 2 ? extra : Math.ceil(extra / 2);
    board.style.setProperty('--rows', rows);
  }
  for (const p of panels) {
    const el = board.querySelector(`[data-panel="${p.id}"]`);
    el.querySelector('h4').textContent = p.title;
    const legendHTML = (p.legend ?? []).map(([tone, text]) => `<span><i style="background:var(${tone})"></i>${text}</span>`).join('');
    const legend = el.querySelector('.legend');
    if (legend.dataset.v !== legendHTML) { legend.dataset.v = legendHTML; legend.innerHTML = legendHTML; }
    if (p.html) { const html = p.html(), box = el.querySelector('.content'); if (box.dataset.v !== html) { box.dataset.v = html; box.innerHTML = html; } }
    else el.querySelector('canvas').setAttribute('aria-label', p.title);
  }
  App.panels = panels;
  syncTransport();
  App.dirty = true;
}
function renderTransport() {
  const t = App.concept.transport(cfg()), c = cfg();
  $('transport').innerHTML = `<button type="button" class="btn primary big" id="playBtn" data-act="play">▶ ${t.play}</button>
    <label for="tSlider">${t.label}</label><input id="tSlider" type="range" min="${t.min}" max="${t.max ?? c.tEnd}" step="${t.step ?? c.tEnd / 600}" value="${c[t.key]}"><output id="tOut">${t.text(c)}</output>
    ${t.rate ? `<label for="rate">속도</label><select id="rate">${[.25, .5, 1, 2, 4].map(v => `<option value="${v}" ${c.rate === v ? 'selected' : ''}>${v}×</option>`).join('')}</select>` : ''}`;
  syncPlay();
}
function syncTransport() {
  const t = App.concept.transport(cfg()), c = cfg(), s = $('tSlider');
  if (!s) return;
  const max = t.max ?? c.tEnd;
  if (+s.max !== max) { s.max = max; s.step = t.step ?? max / 600; }
  if (document.activeElement !== s || App.playing) s.value = c[t.key];
  $('tOut').textContent = t.text(c);
}
function syncPlay() { const t = App.concept.transport(cfg()), b = $('playBtn'); if (b) b.textContent = App.playing ? '■ 멈추기' : `▶ ${t.play}`; }
function stopPlay() { App.playing = false; if (App.concept) syncPlay(); }

function drawAll() {
  const C = themeColors();
  for (const p of App.panels ?? []) {
    if (p.html) continue;
    const c = $('panels').querySelector(`[data-panel="${p.id}"] canvas`);
    if (!c) continue;
    const { ctx, w, h } = prepare(c);
    ctx.clearRect(0, 0, w, h);
    if (w > 30 && h > 30) p.draw(ctx, w, h, C);
  }
}
function frame(now) {
  if (App.concept && App.playing) {
    const dt = Math.min(.1, (now - App.last) / 1000);
    if (App.concept.tick(cfg(), dt, App.clock)) { refreshBoard(); store(); }
    App.dirty = true;
  }
  App.last = now;
  if (App.concept && App.dirty) { App.dirty = false; drawAll(); }
  requestAnimationFrame(frame);
}

/* ── 직접 그리기 ───────────────────────────────────── */
function startDrawing() {
  stopPlay();
  const c = cfg(), [a, b] = App.concept.domain(c), raw = App.model.raw ?? App.model.f;
  const s = [];
  for (let i = 0; i <= DRAW_NODES; i++) { const x = a + (b - a) * i / DRAW_NODES, safe = Math.min(b - (b - a) * 1e-9, Math.max(a + (b - a) * 1e-9, x)); s.push(raw(safe)); }
  const lo = Math.min(...s), hi = Math.max(...s), pad = Math.max(1, .35 * (hi - lo));
  UI.drawRange = [lo - pad, hi + pad];
  c.src = { ...c.src, samples: s }; c.example = null;
  UI.drawing = true;
  $('panels').classList.add('drawing');
  rebuild(); renderAll();
}
function stopDrawing(render = true) {
  UI.drawing = false; UI.drawRange = null; UI.pressed = false;
  $('panels')?.classList.remove('drawing');
  if (render && App.concept) { renderSettings(); refreshBoard(); }
}
function paint(e, canvas) {
  const c = cfg(), [a, b0] = App.concept.domain(c), r = canvas.getBoundingClientRect(), { b, xr, yr } = UI.plot;
  const x = Math.max(a, Math.min(b0, xr[0] + (e.clientX - r.left - b.l) / b.w * (xr[1] - xr[0])));
  const y = Math.max(yr[0], Math.min(yr[1], yr[1] - (e.clientY - r.top - b.t) / b.h * (yr[1] - yr[0])));
  const idx = v => Math.round((v - a) / (b0 - a) * DRAW_NODES), s = c.src.samples, prev = UI.lastDraw ?? { x, y };
  const i0 = idx(prev.x), i1 = idx(x), dir = Math.sign(i1 - i0) || 1;
  for (let i = i0; i !== i1 + dir; i += dir) { const t = i1 === i0 ? 1 : (i - i0) / (i1 - i0); s[i] = prev.y + (y - prev.y) * t; }
  UI.lastDraw = { x, y };
  if (rebuild()) refreshBoard();
}

/* ── 발표 모드, 테마 ───────────────────────────────── */
function setPresent(on) {
  App.present = on;
  document.body.classList.toggle('present', on);
  $('presentBtn').textContent = on ? '발표 끝내기 (F)' : '발표 모드 (F)';
  try { if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 전체 화면은 선택 사항입니다 */ }
  App.dirty = true;
}
function setSettings(on) { App.settings = on; document.body.classList.toggle('no-settings', !on); App.dirty = true; }
function applyLook() {
  document.documentElement.dataset.theme = App.theme;
  document.documentElement.style.fontSize = `${16 * App.scale}px`;
  $('themeBtn').textContent = App.theme === 'dark' ? '밝게' : '어둡게';
  App.dirty = true;
}

/* ── 입력 ─────────────────────────────────────────── */
function changed(render = false) { if (rebuild() || render) { if (render) renderSettings(); refreshBoard(); } else renderSettings(); store(); }
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-open]');
  if (!t) return;
  const d = t.dataset, c = App.concept ? cfg() : null;
  if (d.open) return openConcept(d.open);
  if (d.seg) { c[d.seg] = d.val; if (d.seg === 'eq' && c.eq === 'wave' && c.bc === 'insulated') c.bc = 'fixed'; c.example = null; stopDrawing(false); rebuild(); renderSettings(); refreshBoard(); renderTransport(); return store(); }
  if (d.example) { const ex = App.concept.examples.find(x => x.id === d.example); stopDrawing(false); Object.assign(c, ex.apply); c.src = { samples: null, ...ex.apply.src, params: { ...ex.apply.src.params } }; c.example = ex.id; rebuild(); renderAll(); return store(); }
  if (d.preset !== undefined) { const p = App.concept.presets[+d.preset].patch; stopDrawing(false); Object.assign(c, p, { show: { ...c.show, ...p.show } }); rebuild(); renderAll(); return store(); }
  if (d.mine !== undefined) { stopDrawing(false); App.cfg[App.concept.id] = mergeConfig(App.concept.defaults(), JSON.parse(JSON.stringify(App.saved[App.concept.id][+d.mine].cfg))); rebuild(); renderAll(); return store(); }
  if (d.del !== undefined) { App.saved[App.concept.id].splice(+d.del, 1); renderPresets(); return store(); }
  switch (d.act) {
    case 'draw': return UI.drawing ? stopDrawing() : startDrawing();
    case 'clear': c.src.samples.fill(0); rebuild(); return refreshBoard();
    case 'play': App.playing = !App.playing; App.clock.acc = 0; return syncPlay();
    case 'newProblem': App.problem[App.concept.id] = App.concept.newProblem(); App.reveal[App.concept.id] = false; return refreshBoard();
    case 'reveal': App.reveal[App.concept.id] = !App.reveal[App.concept.id]; return refreshBoard();
    case 'applyProblem': stopDrawing(false); App.concept.applyProblem(c, App.problem[App.concept.id]); rebuild(); renderAll(); return store();
    default:
  }
  if (t.id === 'homeBtn') showHome();
  if (t.id === 'presentBtn') setPresent(!App.present);
  if (t.id === 'settingsBtn') setSettings(!App.settings);
  if (t.id === 'themeBtn') { App.theme = App.theme === 'dark' ? 'light' : 'dark'; applyLook(); store(); }
  if (t.id === 'bigger') { App.scale = Math.min(1.8, +(App.scale + .1).toFixed(2)); applyLook(); store(); }
  if (t.id === 'smaller') { App.scale = Math.max(.9, +(App.scale - .1).toFixed(2)); applyLook(); store(); }
  if (t.id === 'saveCfg') {
    const list = App.saved[App.concept.id] ?? (App.saved[App.concept.id] = []);
    list.push({ name: `내 구성 ${list.length + 1}`, cfg: JSON.parse(JSON.stringify(c)) });
    renderPresets(); store();
  }
});
let typing = 0;
document.addEventListener('input', e => {
  const t = e.target, c = App.concept ? cfg() : null;
  if (!c) return;
  const d = t.dataset;
  if (d.path) { setPath(c, d.path, t.checked); rebuild(); renderSettings(); refreshBoard(); return store(); }
  if (d.key) { c[d.key] = +t.value; t.nextElementSibling.textContent = fmt(+t.value, 2); rebuild(); refreshBoard(); return store(); }
  if (d.param) { c.src.params[d.param] = +t.value; t.nextElementSibling.textContent = fmt(+t.value, 2); c.example = null; rebuild(); refreshBoard(); return store(); }
  if (d.num) { if (t.value === '' || !isFinite(+t.value)) return; c[d.num] = +t.value; if (d.num === 'tEnd') { c.tEnd = Math.max(1e-6, c.tEnd); renderTransport(); } rebuild(); refreshBoard(); return store(); }
  if (d.expr !== undefined || d.text) {
    clearTimeout(typing);
    typing = setTimeout(() => {
      if (d.expr !== undefined) { if (!t.value.trim()) return; stopDrawing(false); c.src = { ...c.src, expr: t.value, samples: null }; c.example = null; }
      else c[d.text] = t.value;
      rebuild(); renderSettings(); refreshBoard(); store();
    }, 180);
    return;
  }
  if (t.id === 'tSlider') { stopPlay(); const key = App.concept.transport(c).key; c[key] = +t.value; refreshBoard(); return store(); }
  if (t.id === 'rate') { c.rate = +t.value; store(); }
});
const mainCanvas = e => e.target.closest?.('[data-panel="main"] canvas');
document.addEventListener('pointerdown', e => { const m = mainCanvas(e); if (m && UI.drawing && UI.plot) { UI.pressed = true; UI.lastDraw = null; m.setPointerCapture(e.pointerId); paint(e, m); } });
document.addEventListener('pointermove', e => {
  const m = mainCanvas(e);
  if (UI.drawing) { if (UI.pressed && m) paint(e, m); return; }
  const next = m && UI.plot ? (() => { const r = m.getBoundingClientRect(), { b, xr } = UI.plot, px = e.clientX - r.left; return px >= b.l && px <= b.l + b.w ? xr[0] + (px - b.l) / b.w * (xr[1] - xr[0]) : null; })() : null;
  if (next !== UI.hx) { UI.hx = next; App.dirty = true; }
});
document.addEventListener('pointerup', () => { UI.pressed = false; UI.lastDraw = null; });
document.addEventListener('keydown', e => {
  if (!App.concept) return;
  const tag = e.target.tagName, typingNow = (tag === 'INPUT' && !['range', 'checkbox'].includes(e.target.type)) || tag === 'SELECT';
  if (e.key === 'Escape') { if (App.present) setPresent(false); e.target.blur?.(); return; }
  if (typingNow) return;
  const c = cfg(), t = App.concept.transport(c);
  if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') setPresent(!App.present);
  else if (e.key === 's' || e.key === 'S' || e.key === 'ㄴ') setSettings(!App.settings);
  else if (e.key === ' ') { e.preventDefault(); App.playing = !App.playing; syncPlay(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault(); stopPlay();
    const max = t.max ?? c.tEnd, step = t.step ?? max / 50, dir = e.key === 'ArrowRight' ? 1 : -1;
    c[t.key] = Math.max(t.min, Math.min(max, +(c[t.key] + dir * step).toFixed(6)));
    refreshBoard(); store();
  }
});
new ResizeObserver(() => { App.dirty = true; }).observe(document.body);

/* ── 자체 검사: 모든 개념·구성·예제를 실제 화면으로 열어 봅니다 ─ */
window.STUDIO_SELFTEST = () => {
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  const painted = () => App.panels.filter(p => !p.html).every(p => { const c = $('panels').querySelector(`[data-panel="${p.id}"] canvas`); const { ctx, w, h } = prepare(c); p.draw(ctx, w, h, themeColors()); return w > 30 && h > 30; });
  for (const id of Object.keys(CONCEPTS)) {
    openConcept(id);
    const concept = App.concept;
    check(!App.error && painted(), `${concept.title}: 기본 화면`);
    concept.presets.forEach(p => { Object.assign(cfg(), p.patch, { show: { ...cfg().show, ...p.patch.show } }); rebuild(); renderAll(); check(!App.error && painted(), `${concept.title}: 구성 ${p.label}`); });
    concept.examples.forEach(ex => { const c = cfg(); Object.assign(c, ex.apply); c.src = { samples: null, ...ex.apply.src, params: { ...ex.apply.src.params } }; rebuild(); renderAll(); check(!App.error && painted(), `${concept.title}: 예제 ${ex.label}`); });
    for (const key of Object.keys(cfg().show)) cfg().show[key] = true;
    rebuild(); renderAll(); check(!App.error && painted(), `${concept.title}: 모든 패널 켜기`);
    App.concept.applyProblem(cfg(), concept.newProblem()); rebuild(); renderAll(); check(!App.error && painted(), `${concept.title}: 연습문제를 그래프로`);
    startDrawing(); check(UI.drawing && !App.error && painted(), `${concept.title}: 직접 그리기`); stopDrawing();
    App.cfg[id] = concept.defaults();
  }
  showHome();
  return report;
};

/* ── 시작 ─────────────────────────────────────────── */
loadStore(); renderHome(); applyLook();
requestAnimationFrame(frame);
