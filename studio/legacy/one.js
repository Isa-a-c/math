'use strict';
/* 한 곡선: 그린 곡선 → 계수 막대 → 소리 · 현의 진동 · 막대의 냉각. 모두 같은 계수 bₙ을 씁니다.
   f(x) = Σ bₙ sin nπx,  현 u = Σ bₙ cos(nπct) sin nπx,  열 u = Σ bₙ exp(−α(nπ)²t) sin nπx  (L = 1). */
const NODES = 512, N_MAX = 60, T_END = 8, SPEED = .75, ALPHA = .04, BASE_HZ = 196, VOICES = 30;
const ONE = {
  drawn: new Float64Array(NODES + 1), b: new Float64Array(N_MAX + 1), muted: new Set(), N: 24, edited: false,
  t: 0, playing: false, rate: 1, sel: null, hold: false, soundOn: true,
  show: { drawn: true, sum: true, wave: true, heat: true },
  q: null, qAnswer: null, last: 0, dirty: true, stroke: null, bar: null, plots: {}, barScale: 1,
};
const el = id => document.getElementById(id);

/* ── 계산 ─────────────────────────────────────────── */
const sampleFn = s => x => { const t = x * NODES; if (t <= 0) return s[0]; if (t >= NODES) return s[NODES]; const i = Math.floor(t); return s[i] + (s[i + 1] - s[i]) * (t - i); };
function analyse() { ONE.b = halfCoefficients(sampleFn(ONE.drawn), 1, N_MAX, false).c; ONE.muted.clear(); ONE.edited = false; rescale(); changed(); }
function rescale() { let m = 1e-6; for (let n = 1; n <= N_MAX; n++) m = Math.max(m, Math.abs(ONE.b[n])); ONE.barScale = m; }
const eff = n => n <= ONE.N && !ONE.muted.has(n) ? ONE.b[n] : 0;
const mode = (n, x) => Math.sin(n * PI * x);
const waveAmp = (n, t) => eff(n) * Math.cos(n * PI * SPEED * t);
const heatAmp = (n, t) => eff(n) * Math.exp(-ALPHA * (n * PI) ** 2 * t);
function sum(amp, x, t) { let s = 0; for (let n = 1; n <= ONE.N; n++) s += amp(n, t) * mode(n, x); return s; }
function setCurve(fn) { for (let i = 0; i <= NODES; i++) ONE.drawn[i] = Math.max(-1.25, Math.min(1.25, fn(i / NODES))); ONE.t = 0; analyse(); }
/** 도약점 x₀ 주변에서 부분합이 위쪽 값을 넘는 정도입니다(도약 크기 대비). */
function bump(x0, upper, jump) { let top = -Infinity; for (let i = 0; i <= 2000; i++) { const x = x0 - .2 + .4 * i / 2000; top = Math.max(top, sum((n) => eff(n), x, 0)); } return (top - upper) / jump; }

/* ── 소리: 각 차수 n을 진동수 n·f₁의 사인파로 합성합니다 ─ */
const Sound = {
  ctx: null, gains: [], master: null,
  amplitudes() {
    let total = 1e-9;
    for (let n = 1; n <= VOICES; n++) total += Math.abs(eff(n));
    return Array.from({ length: VOICES }, (_, i) => .5 * eff(i + 1) / Math.max(total, .6));
  },
  build(ctx) {
    const master = ctx.createGain(), gains = [];
    master.connect(ctx.destination);
    for (let n = 1; n <= VOICES; n++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = BASE_HZ * n; g.gain.value = 0;
      o.connect(g); g.connect(master); o.start();
      gains.push(g);
    }
    return { master, gains };
  },
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext; this.ctx = new AC(); Object.assign(this, this.build(this.ctx)); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.value = ONE.soundOn ? 1 : 0;
  },
  /* 튕기기: 높은 차수일수록 소리가 빨리 줄어드는 실제 현의 느낌을 줍니다. */
  schedule(gains, now) { this.amplitudes().forEach((a, i) => { const g = gains[i].gain; g.cancelScheduledValues(now); g.setValueAtTime(a, now); g.setTargetAtTime(0, now + .01, 1.6 / (1 + .22 * i)); }); },
  pluck() { this.ensure(); this.schedule(this.gains, this.ctx.currentTime); },
  sustain() { if (!this.ctx) return; const now = this.ctx.currentTime; this.amplitudes().forEach((a, i) => { const g = this.gains[i].gain; g.cancelScheduledValues(now); g.setTargetAtTime(ONE.hold ? a : 0, now, .02); }); },
};

/* ── 그리기 ───────────────────────────────────────── */
function frameBox(w, h, C, reserve = 0) { const l = 40 * C.scale; return { l, t: 6, w: w - l - 12, h: h - 10 - 18 * C.scale - reserve }; }
const X_TICKS = [[0, '0'], [.25, '¼'], [.5, '½'], [.75, '¾'], [1, '1']];
function drawDraw(ctx, w, h, C) {
  const b = frameBox(w, h, C), xr = [0, 1], yr = [-1.35, 1.35], m = axes(ctx, b, xr, yr, C, { xTicks: X_TICKS });
  ONE.plots.draw = { b, xr, yr };
  if (ONE.sel && ONE.sel <= ONE.N) curve(ctx, x => eff(ONE.sel) * mode(ONE.sel, x), b, xr, m, C.hot, 2.5);
  if (ONE.show.drawn) curve(ctx, sampleFn(ONE.drawn), b, xr, m, C.ink, 2.5);
  if (ONE.show.sum) curve(ctx, x => sum(n => eff(n), x, 0), b, xr, m, C.blue, 3);
  if (!ONE.touched) panelText(ctx, '여기에 마우스로 곡선을 그리세요', b.l + b.w / 2, b.t + 6, C, 'center');
}
function drawBars(ctx, w, h, C) {
  if (ONE.hideBars) { panelText(ctx, '답을 고르면 막대가 나타납니다', w / 2, h / 2 - 8, C, 'center'); ONE.plots.bars = { l: 0, slot: w, count: 0, zero: h / 2, unit: 1 }; return; }
  const l = 40 * C.scale, count = Math.min(ONE.N, N_MAX), slot = (w - l - 12) / count, t = 6, H = h - 10 - 18 * C.scale, zero = t + H / 2, unit = (H / 2 - 4) / ONE.barScale;
  ONE.plots.bars = { l, slot, count, zero, unit };
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l, zero); ctx.lineTo(w - 12, zero); ctx.stroke();
  ctx.font = `${C.fs}px ${C.font}`; ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(fmt(ONE.barScale, 2), l - 6, t + H / 2 - ONE.barScale * unit); ctx.fillText('0', l - 6, zero);
  const bw = Math.max(3, Math.min(26, slot - 3));
  for (let n = 1; n <= count; n++) {
    const x = l + (n - .5) * slot, v = ONE.b[n], len = Math.max(1.5, Math.abs(v) * unit), y = v > 0 ? zero - len : zero, r = Math.min(4, bw / 2);
    if (ONE.sel === n) { ctx.fillStyle = C.hot; ctx.globalAlpha = .14; ctx.fillRect(x - slot / 2, t, slot, H); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.roundRect(x - bw / 2, y, bw, len, v > 0 ? [r, r, 0, 0] : [0, 0, r, r]);
    if (ONE.muted.has(n)) { ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillStyle = ONE.sel === n ? C.hot : C.blue; ctx.fill(); }
    if (count <= 16 || n === 1 || n % 5 === 0 || ONE.sel === n) { ctx.fillStyle = ONE.sel === n ? C.ink : C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(n, x, t + H + 3); }
  }
}
function drawEvolution(ctx, w, h, C, amp, color) {
  const reserve = Math.min(70, h * .27), b = frameBox(w, h, C, reserve), xr = [0, 1], yr = [-1.35, 1.35], m = axes(ctx, b, xr, yr, C, { xTicks: X_TICKS, noXLabels: true });
  curve(ctx, sampleFn(ONE.drawn), b, xr, m, C.muted, 1.5, [], [5, 5]);
  if (ONE.sel && ONE.sel <= ONE.N) curve(ctx, x => amp(ONE.sel, ONE.t) * mode(ONE.sel, x), b, xr, m, C.hot, 2);
  curve(ctx, x => sum(amp, x, ONE.t), b, xr, m, color, 3);
  // 같은 계수가 이 방정식에서 어떻게 변하는지 작은 막대로 보여 줍니다.
  if (ONE.hideBars) return;
  const count = Math.min(ONE.N, 24), top = b.t + b.h + 6, H = reserve - 4, zero = top + H / 2, slot = b.w / count, unit = (H / 2 - 1) / ONE.barScale;
  ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(b.l, zero); ctx.lineTo(b.l + b.w, zero); ctx.stroke();
  for (let n = 1; n <= count; n++) {
    const v = amp(n, ONE.t), len = Math.abs(v) * unit, bw = Math.max(2, Math.min(16, slot - 2));
    ctx.fillStyle = ONE.sel === n ? C.hot : color;
    ctx.fillRect(b.l + (n - .5) * slot - bw / 2, v > 0 ? zero - len : zero, bw, Math.max(1, len));
  }
}
const PANELS = [['drawPanel', 'cDraw', drawDraw], ['barsPanel', 'cBars', drawBars]];
function render() {
  const C = themeColors();
  for (const [, id, fn] of PANELS) { const c = el(id), { ctx, w, h } = prepare(c); ctx.clearRect(0, 0, w, h); if (w > 30 && h > 30) fn(ctx, w, h, C); }
  if (ONE.show.wave) { const { ctx, w, h } = prepare(el('cWave')); ctx.clearRect(0, 0, w, h); if (w > 30 && h > 30) drawEvolution(ctx, w, h, C, waveAmp, C.blue); }
  if (ONE.show.heat) { const { ctx, w, h } = prepare(el('cHeat')); ctx.clearRect(0, 0, w, h); if (w > 30 && h > 30) drawEvolution(ctx, w, h, C, heatAmp, C.hot); }
}
function changed() { syncControls(); if (ONE.hold) Sound.sustain(); ONE.dirty = true; }
function syncControls() {
  el('tSlider').value = ONE.t; el('tOut').textContent = fmt(ONE.t, 2);
  el('nSlider').value = ONE.N; el('nOut').textContent = ONE.N;
  el('playBtn').textContent = ONE.playing ? '■ 멈추기' : '▶ 튕기기';
  el('undo').disabled = !ONE.edited;
  el('holdBtn').setAttribute('aria-pressed', ONE.hold); el('muteBtn').setAttribute('aria-pressed', !ONE.soundOn);
  el('muteBtn').textContent = ONE.soundOn ? '소리 켜짐' : '소리 꺼짐';
  el('readout').textContent = ONE.sel ? `n = ${ONE.sel}: 계수 ${fmt(ONE.b[ONE.sel], 3)}${ONE.muted.has(ONE.sel) ? ' (꺼짐)' : ''} · 소리 ${BASE_HZ * ONE.sel} Hz · 현의 진동수 ${fmt(ONE.sel * SPEED / 2, 3)} · 열의 감쇠율 ${fmt(ALPHA * (ONE.sel * PI) ** 2, 2)}` : '막대를 끌면 크기가 바뀌고, 누르면 꺼집니다.';
  el('board').dataset.right = (ONE.show.wave ? 1 : 0) + (ONE.show.heat ? 1 : 0);
  el('wavePanel').hidden = !ONE.show.wave; el('heatPanel').hidden = !ONE.show.heat;
}
function frame(now) {
  if (ONE.playing) {
    ONE.t = Math.min(T_END, ONE.t + Math.min(.1, (now - ONE.last) / 1000) * ONE.rate);
    if (ONE.stopAt && ONE.t >= ONE.stopAt) { ONE.t = ONE.stopAt; ONE.playing = false; ONE.stopAt = null; }
    if (ONE.t >= T_END) ONE.playing = false;
    syncControls(); ONE.dirty = true;
  }
  ONE.last = now;
  if (ONE.dirty) { ONE.dirty = false; render(); }
  requestAnimationFrame(frame);
}
function play() { ONE.t = 0; ONE.playing = true; Sound.pluck(); changed(); }

/* ── 예측 질문 ─────────────────────────────────────── */
const SHAPES = {
  pluck: x => x < .3 ? x / .3 : (1 - x) / .7,
  tri: x => 1 - Math.abs(2 * x - 1),
  step: x => x < .5 ? 1 : x > .5 ? 0 : .5,   // 도약점 값을 평균으로 두어 표본에서도 도약이 정확히 ½에 놓입니다.
  trap: x => Math.min(1, Math.min(x, 1 - x) / .2),
  saw: x => x < .85 ? x / .85 : (1 - x) / .15,
};
const QUESTIONS = [
  { text: '끊어진 곡선입니다. 항을 8개에서 60개로 늘리면 끊어진 곳 옆의 튀어나온 봉우리는 사라질까요?',
    setup() { setCurve(SHAPES.step); ONE.N = 8; }, options: ['완전히 사라진다', '좁아지지만 높이는 남는다', '더 높아진다'], answer: 1,
    run() { ONE.N = 60; }, explain: () => `봉우리는 좁아지지만 높이는 도약 크기의 ${(bump(.5, 1, 1) * 100).toFixed(1)}%로 남습니다(Gibbs 현상). 합은 끊어진 점 자체에서 두 값의 평균 0.5로 갑니다.` },
  { text: '좌우 대칭인 삼각형입니다. 짝수 차수(2, 4, 6…)의 막대는 어떻게 될까요?',
    setup() { setCurve(SHAPES.tri); ONE.N = 16; ONE.hideBars = true; }, options: ['모두 0이다', '홀수 차수와 비슷하다', '홀수 차수보다 크다'], answer: 0,
    run() { ONE.hideBars = false; }, explain: () => '짝수 차수의 sin nπx는 가운데를 기준으로 좌우가 반대 부호입니다. 대칭인 곡선과 곱해 적분하면 넓이가 상쇄되어 0입니다.' },
  { text: '현을 튕겼습니다. 한 주기가 지나면 현의 모양은 어떻게 될까요?',
    setup() { setCurve(SHAPES.pluck); ONE.N = 40; ONE.show.wave = true; }, options: ['처음 모양으로 돌아온다', '납작해진다', '좌우가 뒤집힌다'], answer: 0,
    run() { play(); ONE.stopAt = 2 / SPEED; }, explain: () => `모든 차수의 주기가 첫 주기 ${fmt(2 / SPEED, 2)}의 정수분의 1이라, 이 시간에 모두 함께 처음 위치로 돌아옵니다. 이 모형에는 감쇠가 없습니다.` },
  { text: '같은 사다리꼴을 현과 열에 넣습니다. 꺾인 모서리가 먼저 사라지는 쪽은 어디일까요?',
    setup() { setCurve(SHAPES.trap); ONE.N = 60; ONE.show.wave = true; ONE.show.heat = true; }, options: ['현', '열', '똑같다'], answer: 1,
    run() { play(); }, explain: () => '열에서는 높은 차수가 exp(−α(nπ)²t)로 바로 사라져 모서리가 곧 둥글어집니다. 현에서는 계수의 크기가 줄지 않아 모서리가 그대로 움직입니다.' },
  { text: '4번 이후의 막대를 전부 끄고 다시 튕기면 소리는 어떻게 바뀔까요?',
    setup() { setCurve(SHAPES.saw); ONE.N = 30; }, options: ['음이 높아진다', '음 높이는 같고 부드러워진다', '소리가 나지 않는다'], answer: 1,
    run() { for (let n = 4; n <= N_MAX; n++) ONE.muted.add(n); play(); }, explain: () => `음 높이는 n = 1(${BASE_HZ} Hz)이 정합니다. 높은 배음을 끄면 음색만 부드러워집니다. 먼저 튕겨서 비교해 보십시오.` },
  { text: '열이 식을 때 가장 빨리 사라지는 막대는 어느 것일까요?',
    setup() { setCurve(SHAPES.pluck); ONE.N = 16; ONE.show.heat = true; }, options: ['n = 1', '차수가 가장 높은 막대', '모두 같은 속도'], answer: 1,
    run() { play(); }, explain: () => `감쇠율이 α(nπ)²라 차수의 제곱에 비례합니다. n = 3은 n = 1보다 9배 빨리 줄어듭니다. 그래서 곡선은 곧 n = 1 모양만 남습니다.` },
];
function renderQuestion() {
  const box = el('question');
  if (ONE.q === null) { box.innerHTML = '<button type="button" class="btn primary" data-q="start">예측 질문 시작</button><span class="hint">답을 먼저 고른 뒤 화면으로 확인합니다.</span>'; return; }
  const q = QUESTIONS[ONE.q], a = ONE.qAnswer;
  box.innerHTML = `<span class="qno">질문 ${ONE.q + 1}/${QUESTIONS.length}</span><p class="qtext">${q.text}</p>
    <div class="qopts">${q.options.map((o, i) => `<button type="button" class="btn ${a !== null && i === q.answer ? 'right-ans' : ''}" data-opt="${i}" ${a !== null ? 'disabled' : ''}>${o}</button>`).join('')}</div>
    ${a !== null ? `<p class="qexp"><b>${a === q.answer ? '맞습니다.' : `정답은 “${q.options[q.answer]}”입니다.`}</b> ${q.explain()}</p>` : ''}
    <div class="qnav">${a !== null ? `<button type="button" class="btn primary" data-q="next">${ONE.q + 1 < QUESTIONS.length ? '다음 질문' : '처음으로'}</button>` : ''}<button type="button" class="btn" data-q="close">질문 닫기</button></div>`;
}
function askQuestion(i) { const q = QUESTIONS[i]; ONE.q = i; ONE.qAnswer = null; ONE.playing = false; ONE.t = 0; ONE.sel = null; ONE.hideBars = false; ONE.stopAt = null; q.setup(); ONE.touched = true; renderQuestion(); changed(); }
function answerQuestion(i) { ONE.qAnswer = i; const q = QUESTIONS[ONE.q]; q.run(); renderQuestion(); changed(); }

/* ── 입력 ─────────────────────────────────────────── */
const local = (c, e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function paintStroke(e) {
  const [px, py] = local(el('cDraw'), e), { b, xr, yr } = ONE.plots.draw;
  const x = Math.max(0, Math.min(1, xr[0] + (px - b.l) / b.w)), y = Math.max(-1.25, Math.min(1.25, yr[1] - (py - b.t) / b.h * (yr[1] - yr[0])));
  const i1 = Math.round(x * NODES), prev = ONE.stroke ?? { i: i1, y }, dir = Math.sign(i1 - prev.i) || 1;
  for (let i = prev.i; i !== i1 + dir; i += dir) { const f = i1 === prev.i ? 1 : (i - prev.i) / (i1 - prev.i); ONE.drawn[i] = prev.y + (y - prev.y) * f; }
  ONE.stroke = { i: i1, y }; ONE.touched = true; ONE.playing = false; ONE.t = 0;
  analyse();
}
el('cDraw').addEventListener('pointerdown', e => { if (!ONE.plots.draw) return; el('cDraw').setPointerCapture(e.pointerId); ONE.stroke = null; ONE.pressing = true; paintStroke(e); });
el('cDraw').addEventListener('pointermove', e => { if (ONE.pressing) paintStroke(e); });
el('cDraw').addEventListener('pointerup', () => { ONE.pressing = false; ONE.stroke = null; });
const barAt = e => { const p = ONE.plots.bars, [px] = local(el('cBars'), e), n = Math.floor((px - p.l) / p.slot) + 1; return n >= 1 && n <= p.count ? n : null; };
el('cBars').addEventListener('pointerdown', e => { const n = barAt(e); if (!n) return; el('cBars').setPointerCapture(e.pointerId); ONE.bar = { n, startY: e.clientY, moved: false }; });
el('cBars').addEventListener('pointermove', e => {
  if (!ONE.bar) { const n = barAt(e); if (n !== ONE.sel) { ONE.sel = n; changed(); } return; }
  if (!ONE.bar.moved && Math.abs(e.clientY - ONE.bar.startY) < 4) return;
  ONE.bar.moved = true;
  const p = ONE.plots.bars, [, py] = local(el('cBars'), e);
  ONE.b[ONE.bar.n] = Math.max(-1.5 * ONE.barScale, Math.min(1.5 * ONE.barScale, (p.zero - py) / p.unit));
  ONE.muted.delete(ONE.bar.n); ONE.edited = true; changed();
});
el('cBars').addEventListener('pointerup', () => { if (ONE.bar && !ONE.bar.moved) { const n = ONE.bar.n; if (ONE.muted.has(n)) ONE.muted.delete(n); else ONE.muted.add(n); ONE.edited = true; changed(); } ONE.bar = null; });
el('cBars').addEventListener('pointerleave', () => { if (!ONE.bar && ONE.sel) { ONE.sel = null; changed(); } });

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.opt !== undefined) return answerQuestion(+t.dataset.opt);
  if (t.dataset.q === 'start') return askQuestion(0);
  if (t.dataset.q === 'next') return ONE.q + 1 < QUESTIONS.length ? askQuestion(ONE.q + 1) : askQuestion(0);
  if (t.dataset.q === 'close') { ONE.q = null; return renderQuestion(); }
  if (t.dataset.show) { ONE.show[t.dataset.show] = !ONE.show[t.dataset.show]; t.setAttribute('aria-pressed', ONE.show[t.dataset.show]); return changed(); }
  switch (t.id) {
    case 'playBtn': if (ONE.playing) { ONE.playing = false; changed(); } else play(); break;
    case 'holdBtn': ONE.hold = !ONE.hold; Sound.ensure(); Sound.sustain(); changed(); break;
    case 'muteBtn': ONE.soundOn = !ONE.soundOn; if (Sound.ctx) Sound.master.gain.value = ONE.soundOn ? 1 : 0; changed(); break;
    case 'undo': analyse(); break;
    case 'clear': ONE.drawn.fill(0); ONE.touched = false; ONE.playing = false; ONE.t = 0; analyse(); break;
    case 'themeBtn': document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; t.textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게'; saveLook(); ONE.dirty = true; break;
    case 'bigger': setScale(+0.1); break;
    case 'smaller': setScale(-0.1); break;
    case 'presentBtn': document.body.classList.toggle('present'); t.textContent = document.body.classList.contains('present') ? '발표 끝내기 (F)' : '발표 모드 (F)'; togglePresent(); break;
    default:
  }
});
function togglePresent() { try { if (document.body.classList.contains('present')) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 전체 화면은 선택 사항입니다 */ } ONE.dirty = true; }
el('nSlider').addEventListener('input', e => { ONE.N = +e.target.value; changed(); });
el('tSlider').addEventListener('input', e => { ONE.playing = false; ONE.t = +e.target.value; changed(); });
el('rate').addEventListener('change', e => { ONE.rate = +e.target.value; });
let typing = 0;
el('formula').addEventListener('input', e => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    const err = el('formulaErr'), text = e.target.value.trim();
    err.textContent = '';
    if (!text) return;
    try {
      const c = compile(text);
      if (c.params.length) throw new Error(`${c.params[0]}: 여기서는 x, pi만 쓸 수 있습니다.`);
      const fn = x => c.fn(x, { L: 1 });
      for (let i = 0; i <= 50; i++) if (!isFinite(fn(i / 50 * .999 + .0005))) throw new Error('구간 (0, 1)에서 값이 정의되지 않는 점이 있습니다.');
      ONE.touched = true; setCurve(fn);
    } catch (ex) { err.textContent = ex.message; }
  }, 200);
});
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === ' ') { e.preventDefault(); el('playBtn').click(); }
  else if (['f', 'F', 'ㄹ'].includes(e.key)) el('presentBtn').click();
  else if (e.key === 'Escape' && document.body.classList.contains('present')) el('presentBtn').click();
});
function setScale(d) { LOOK.scale = Math.max(.9, Math.min(1.8, +(LOOK.scale + d).toFixed(2))); document.documentElement.style.fontSize = `${16 * LOOK.scale}px`; saveLook(); ONE.dirty = true; }
const LOOK = { scale: 1.15 };
function saveLook() { try { localStorage.setItem('one-look', JSON.stringify({ scale: LOOK.scale, theme: document.documentElement.dataset.theme })); } catch { /* 이번 실행에서만 유지합니다 */ } }
new ResizeObserver(() => { ONE.dirty = true; }).observe(document.body);

/* ── 자체 검사: 실제 포인터 이벤트로 조작하고, 소리는 파일 없이 렌더링해 진동수를 확인합니다 ─ */
window.ONE_SELFTEST = async () => {
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  const fire = (c, type, x, y) => { const r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y, buttons: 1 })); };
  const safeCapture = HTMLCanvasElement.prototype.setPointerCapture;
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
  render();
  // 삼각형: bₙ = 8 sin(nπ/2)/(nπ)²
  setCurve(SHAPES.tri);
  check(Math.abs(ONE.b[1] - 8 / (PI * PI)) < 1e-4 && Math.abs(ONE.b[2]) < 1e-6 && Math.abs(ONE.b[3] + 8 / (9 * PI * PI)) < 1e-4, '삼각형 계수');
  ONE.N = 60;
  check(Math.abs(sum(n => eff(n), .25, 0) - .5) < 2e-3, '합성 곡선이 그린 곡선과 일치');
  check(Math.abs(sum(waveAmp, .3, 2 / SPEED) - sum(waveAmp, .3, 0)) < 1e-9, '현은 한 주기 뒤 처음 모양');
  check(Math.abs(heatAmp(3, 1) / heatAmp(3, 0) - Math.exp(-ALPHA * 9 * PI * PI)) < 1e-12, '열 감쇠율');
  setCurve(SHAPES.step); ONE.N = 60;
  check(Math.abs(bump(.5, 1, 1) - .0895) < .006, `Gibbs 약 9% (${(bump(.5, 1, 1) * 100).toFixed(1)}%)`);
  // 사인 급수의 확장은 x = 0에도 도약이 있어 유한 항에서는 그 진동이 남습니다. N이 커지면 평균으로 갑니다.
  const mid = N => { ONE.N = N; return Math.abs(sum(n => eff(n), .5, 0) - .5); };
  check(mid(60) < .02 && mid(59) < .02, `도약점의 합은 평균으로 수렴 (N=60 차이 ${mid(60).toFixed(4)})`); ONE.N = 60;
  // 그리기
  ONE.drawn.fill(0); analyse(); render();
  const cd = el('cDraw'), { b, yr } = ONE.plots.draw;
  const px = x => b.l + x * b.w, py = y => b.t + (yr[1] - y) / (yr[1] - yr[0]) * b.h;
  fire(cd, 'pointerdown', px(.2), py(.8)); fire(cd, 'pointermove', px(.6), py(.8)); fire(cd, 'pointerup', px(.6), py(.8));
  check(Math.abs(ONE.drawn[Math.round(.4 * NODES)] - .8) < .02 && Math.abs(ONE.drawn[Math.round(.8 * NODES)]) < 1e-9 && ONE.b[1] !== 0, '마우스로 곡선 그리기');
  // 막대 끌기·끄기
  render();
  const cb = el('cBars'), p = ONE.plots.bars, bx = n => p.l + (n - .5) * p.slot, before = ONE.b[2];
  fire(cb, 'pointerdown', bx(2), p.zero); cb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  check(ONE.muted.has(2) && eff(2) === 0 && ONE.edited, '막대를 눌러 끄기');
  fire(cb, 'pointerdown', bx(3), p.zero); fire(cb, 'pointermove', bx(3), p.zero - 30); cb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  check(Math.abs(ONE.b[3] - 30 / p.unit) < 1e-6 && !ONE.muted.has(3), '막대를 끌어 계수 바꾸기');
  el('undo').click();
  check(!ONE.edited && Math.abs(ONE.b[2] - before) < 1e-12 && !ONE.muted.size, '그린 곡선으로 되돌리기');
  // 질문 전부
  for (let i = 0; i < QUESTIONS.length; i++) {
    askQuestion(i); render();
    answerQuestion(QUESTIONS[i].answer); render();
    check(el('question').textContent.includes('맞습니다') && !ONE.b.some(v => !isFinite(v)), `질문 ${i + 1}`);
    ONE.playing = false;
  }
  // 소리: 오프라인 렌더링으로 진동수 비를 확인합니다.
  ONE.muted.clear(); setCurve(SHAPES.tri); ONE.N = 24;
  const rate = 44100, off = new OfflineAudioContext(1, rate, rate), graph = Sound.build(off);
  graph.master.gain.value = 1; Sound.schedule(graph.gains, 0);
  const data = (await off.startRendering()).getChannelData(0);
  const goertzel = hz => { let re = 0, im = 0; const n = 8000; for (let i = 0; i < n; i++) { const a = 2 * PI * hz * i / rate; re += data[i] * Math.cos(a); im += data[i] * Math.sin(a); } return Math.hypot(re, im); };
  const f1 = goertzel(BASE_HZ), f2 = goertzel(BASE_HZ * 2), f3 = goertzel(BASE_HZ * 3);
  check(f1 > 1 && f2 < .02 * f1 && Math.abs(f3 / f1 - 1 / 9) < .03, `소리의 배음 비가 계수와 일치 (3배음/기음 ${(f3 / f1).toFixed(3)}, 2배음/기음 ${(f2 / f1).toFixed(3)})`);
  Sound.ensure();
  check(!!Sound.ctx, `실제 오디오 장치 연결 (상태 ${Sound.ctx.state})`);
  HTMLCanvasElement.prototype.setPointerCapture = safeCapture;
  ONE.q = null; renderQuestion(); setCurve(SHAPES.pluck); ONE.N = 24; ONE.touched = false; changed();
  return report;
};

/* ── 시작: 현을 튕기기 직전의 모양으로 엽니다 ──────── */
try { const look = JSON.parse(localStorage.getItem('one-look') || '{}'); if (look.scale) LOOK.scale = look.scale; if (look.theme) document.documentElement.dataset.theme = look.theme; } catch { /* 기본값 */ }
document.documentElement.style.fontSize = `${16 * LOOK.scale}px`;
el('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게';
setCurve(SHAPES.pluck);
renderQuestion();
requestAnimationFrame(frame);
