'use strict';
/* 문제 만들기: 문제·풀이·그래프를 만들어 PDF로 내보냅니다. 개념 설명은 Word 문서(concept_fourier.docx)로 내보냅니다. */
const $ = id => document.getElementById(id);
const cache = {};
function seriesOf(expr, L = PI, mode = 'full', params = {}) {
  const key = `${expr}|${L}|${mode}|${JSON.stringify(params)}`;
  if (!cache[key]) { const c = compile(expr), P = { ...params, L }; cache[key] = buildSeries(x => c.fn(x, P), L, mode, 0); }
  return cache[key];
}
const S = { ex: { fam: 'sign', k: 1, Lk: 'pi', N: 9, shown: 1 }, sheet: [], dirty: true };

/* ── 그래프 ───────────────────────────────────────── */
const box = (w, h, C) => { const l = 42 * C.scale; return { l, t: 8, w: w - l - 22, h: h - 14 - 16 * C.scale }; };
const piTicks = (xr, L = PI, step = L / 2) => { const out = []; for (let k = Math.ceil(xr[0] / step); k * step <= xr[1] + 1e-9; k++) out.push([k * step, piLabel(k * step, L)]); return out; };

/* ── 문제 만들기 ───────────────────────────────────── */
const currentExample = () => exampleOf(S.ex.fam, S.ex.k, S.ex.Lk);
function renderMake() {
  const ex = currentExample();
  $('famSel').innerHTML = FAMILIES.map(f => `<option value="${f.id}" ${f.id === S.ex.fam ? 'selected' : ''}>${f.title}</option>`).join('');
  $('kSel').innerHTML = K_VALUES.map(([k, q]) => `<option value="${k}" ${k === S.ex.k ? 'selected' : ''}>${q}</option>`).join('');
  $('lSel').innerHTML = L_VALUES.map(([key, , , t]) => `<option value="${key}" ${key === S.ex.Lk ? 'selected' : ''}>${t}</option>`).join('');
  $('exProblem').innerHTML = ex.problem;
  $('exSteps').innerHTML = ex.steps.slice(0, S.ex.shown).map(([t, html], i) => `<div class="step ${i === S.ex.shown - 1 ? 'now' : ''}"><h4>${i + 1}. ${t}</h4><div>${html}</div></div>`).join('');
  $('stepNext').disabled = S.ex.shown >= ex.steps.length;
  $('stepNext').textContent = S.ex.shown >= ex.steps.length ? '풀이 끝' : `다음 단계 (${S.ex.shown}/${ex.steps.length})`;
  $('stepAll').disabled = S.ex.shown >= ex.steps.length;
  $('exN').value = S.ex.N; $('exNOut').textContent = S.ex.N;
  renderSheet(); S.dirty = true;
}
function exampleModel() { const ex = currentExample(); return { ex, model: seriesOf(ex.source.expr, ex.L, ex.fam.mode, ex.source.params) }; }
function drawExample(canvas = $('exGraph'), N = S.ex.N, fixedEx = null) {
  const ex = fixedEx ?? currentExample(), model = seriesOf(ex.source.expr, ex.L, ex.fam.mode, ex.source.params), { ctx, w, h } = prepare(canvas), C = themeColors();
  ctx.clearRect(0, 0, w, h);
  if (w < 40 || h < 40) return;
  const b = box(w, h, C), L = ex.L, xr = [-1.5 * L, 1.5 * L], pad = Math.max(.25, .2 * model.span), M = axes(ctx, b, xr, [model.lo - pad, model.hi + pad], C, { band: [-L, L], xTicks: piTicks(xr, Math.abs(L - PI) < 1e-9 ? PI : L + 1, L / 2) });
  curve(ctx, x => partialSum(model, N, x), b, xr, M, C.blue, 3);
  curve(ctx, model.f, b, xr, M, C.ink, 2.5, SeriesConcept.breaks(model, xr));
}
function renderSheet() {
  $('sheetList').innerHTML = S.sheet.length ? S.sheet.map((e, i) => `<li><span>${e.problem}</span><button type="button" class="x" data-remove="${i}" aria-label="${i + 1}번 빼기">×</button></li>`).join('') : '<li class="hint">아직 담은 문제가 없습니다.</li>';
  $('sheetCount').textContent = `${S.sheet.length}문제`;
  for (const id of ['pdfQ', 'pdfA']) $(id).disabled = !S.sheet.length;
}
/** 인쇄용 문서를 만듭니다. kind는 'q'(문제지) 또는 'a'(해설지)입니다. */
function buildPrint(kind) {
  const title = $('sheetTitle').value.trim() || '공업수학 연습문제';
  const off = document.createElement('canvas');
  off.style.cssText = 'position:fixed;left:-9999px;top:0;width:620px;height:230px;';
  document.body.appendChild(off);
  const items = S.sheet.map((ex, i) => {
    drawExample(off, 15, ex);
    const image = off.toDataURL('image/png');
    return `<section class="pitem"><p class="pq"><b>${i + 1}.</b> ${ex.problem}</p>${kind === 'q' ? '<div class="blank"></div>' : `<img alt="함수와 15차 부분합의 그래프" src="${image}">${ex.steps.map(([t, html], j) => `<div class="pstep"><b>(${j + 1}) ${t}.</b> ${html}</div>`).join('')}`}</section>`;
  }).join('');
  off.remove();
  $('printArea').innerHTML = `<header class="phead"><h1>${title.replace(/</g, '&lt;')}</h1><p>${kind === 'q' ? '문제지' : '해설지'} · 11장 Fourier 해석${kind === 'q' ? ' &nbsp;&nbsp; 학번: __________ 이름: __________' : ''}</p></header>${items}`;
  return `${title} ${kind === 'q' ? '문제지' : '해설지'}`;
}
function printDoc(kind) {
  const theme = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = 'light';
  document.title = buildPrint(kind);
  S.themeBeforePrint = theme;
  window.print();
}
/* 프로그램에서는 PDF 저장이 끝난 뒤 app.py가 이 함수를 부릅니다. */
window.studioPrintDone = () => { if (S.themeBeforePrint) document.documentElement.dataset.theme = S.themeBeforePrint; S.themeBeforePrint = null; document.title = '공업수학 문제 만들기'; S.dirty = true; };

/* ── 입력 ─────────────────────────────────────────── */
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.remove !== undefined) { S.sheet.splice(+d.remove, 1); return renderSheet(); }
  switch (t.id) {
    case 'stepNext': S.ex.shown++; return renderMake();
    case 'stepAll': S.ex.shown = currentExample().steps.length; return renderMake();
    case 'stepHide': S.ex.shown = 1; return renderMake();
    case 'newNumbers': { const others = K_VALUES.map(v0 => v0[0]).filter(k => k !== S.ex.k); S.ex.k = others[Math.floor(Math.random() * others.length)]; S.ex.Lk = L_VALUES[Math.floor(Math.random() * L_VALUES.length)][0]; S.ex.shown = 1; return renderMake(); }
    case 'addSheet': S.sheet.push(currentExample()); return renderSheet();
    case 'pdfQ': return printDoc('q');
    case 'pdfA': return printDoc('a');
    case 'themeBtn': document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; t.textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게'; S.dirty = true; return undefined;
    case 'bigger': return setSize(.1);
    case 'smaller': return setSize(-.1);
    case 'presentBtn': document.body.classList.toggle('present'); t.textContent = document.body.classList.contains('present') ? '발표 끝내기 (F)' : '발표 모드 (F)'; try { if (document.body.classList.contains('present')) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 선택 사항 */ } S.dirty = true; return undefined;
    default: return undefined;
  }
});
let size = 1.15;
function setSize(d) { size = Math.max(.9, Math.min(1.8, +(size + d).toFixed(2))); document.documentElement.style.fontSize = `${16 * size}px`; S.dirty = true; }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'exN') { S.ex.N = +t.value; $('exNOut').textContent = t.value; S.dirty = true; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'famSel') { S.ex.fam = t.value; S.ex.shown = 1; renderMake(); }
  if (t.id === 'kSel') { S.ex.k = +t.value; S.ex.shown = 1; renderMake(); }
  if (t.id === 'lSel') { S.ex.Lk = t.value; S.ex.shown = 1; renderMake(); }
});
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'range') return;
  if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') $('presentBtn').click();
  else if (e.key === 'Escape' && document.body.classList.contains('present')) $('presentBtn').click();
  else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); $('stepNext').click(); }
});
new ResizeObserver(() => { S.dirty = true; }).observe(document.body);
function frame() {
  if (S.dirty) { S.dirty = false; drawExample(); }
  requestAnimationFrame(frame);
}

/* ── 자체 검사 ─────────────────────────────────────── */
window.NOTE_SELFTEST = () => {
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  check($('conceptDoc').hasAttribute('download') && $('conceptDoc').getAttribute('href') === 'concept_fourier.docx', '개념 설명 출력 단추');
  // 유도의 정확한 계수와 수치 적분 대조: 모든 유형 × k × L
  let worst = 0, count = 0;
  for (const fam of FAMILIES) for (const [k] of K_VALUES) for (const [Lk] of L_VALUES) {
    const ex = exampleOf(fam.id, k, Lk), model = seriesOf(ex.source.expr, ex.L, fam.mode, ex.source.params);
    let err = Math.abs(fam.a0(k, Lk).value - model.a0);
    for (let n = 1; n <= 8; n++) err = Math.max(err, Math.abs(coefExact(fam.a, k, Lk, n).value - model.a[n]), Math.abs(coefExact(fam.b, k, Lk, n).value - model.b[n]));
    worst = Math.max(worst, err / Math.max(1, model.span)); count++;
    if (ex.steps.length < 2 || /undefined|NaN/.test(ex.problem + ex.steps.flat().join(''))) check(false, `풀이 글자 ${fam.id}`);
  }
  check(worst < 2e-3, `정확한 계수와 수치 적분 일치 ${count}조합 (최대 상대 차이 ${worst.toExponential(1)})`);
  check(new Q(4, 1).over(new Q(3, 1, 1)).toString() === '4/(3π)' && new Q(-2, 3, 0).toString() === '−2/3' && new Q(1, 3, 2).toString() === 'π²/3' && new Q(1, 1, 1).toString() === 'π', '정확한 값 표기');
  // 문제 화면과 인쇄 문서
  S.ex = { fam: 'linear', k: 2, Lk: 'pi', N: 9, shown: 1 }; renderMake(); drawExample();
  check(!$('makeView').hidden && $('exSteps').querySelectorAll('.step').length === 1, '풀이 첫 단계');
  $('stepAll').click(); check($('exSteps').querySelectorAll('.step').length === currentExample().steps.length, '풀이 전체 보기');
  check($('exSteps').textContent.includes('4'), `일차함수 결과 표시`);
  $('addSheet').click(); S.ex.fam = 'abs'; S.ex.shown = 1; renderMake(); $('addSheet').click();
  const name = buildPrint('a');
  check(S.sheet.length === 2 && $('printArea').querySelectorAll('img').length === 2 && $('printArea').querySelectorAll('.pstep').length > 4 && name.includes('해설지'), '해설지 문서');
  buildPrint('q'); check($('printArea').querySelectorAll('img').length === 0 && $('printArea').querySelectorAll('.blank').length === 2, '문제지에는 풀이가 없음');
  buildPrint('a');
  return report;
};

/* ── 시작 ─────────────────────────────────────────── */
document.documentElement.style.fontSize = `${16 * size}px`;
renderMake();
requestAnimationFrame(frame);