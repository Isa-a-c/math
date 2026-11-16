'use strict';
/* 요약과 예제의 소문항. 내용은 개념 모듈(modules/*.js)에 있고, 여기서는 모아서 부르고 공통 도우미를 둡니다. 글은 $…$ 수식 표기입니다. */
/* ── 요약 ─────────────────────────────────────────── */
const m = s => `<span class="m">${s}</span>`;
const symHtml = model => model.sym === 'odd' ? '기함수이므로 aₙ = 0인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 bₙ = 0인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
/** 화면 아래 '요약' 탭의 줄입니다. 쓰는 개념 모듈의 summary를 차례로 모읍니다. 시간이 있는 개념은 현재 시간의 값을 씁니다. */
const summary = (cfg, R) => MODULES.filter(mod => cfg.on[mod.id] && mod.summary).flatMap(mod => mod.summary(cfg, R));

/* ── 예제: 소문항의 종류, 자동 문장, 자동 풀이 (글은 $…$ 수식 표기) ── */
/** 소문항 종류는 개념 모듈의 items에서 모읍니다. auto인 종류는 그 개념을 쓰면 자동으로 들어갑니다. */
const KINDS = {};
for (const mod of MODULES) for (const [kind, it] of Object.entries(mod.items ?? {})) KINDS[kind] = { label: it.label, concept: mod.id, auto: !!it.auto, item: it };
KINDS.free = { label: '자유 문항', concept: null };
const newItem = kind => ({ kind, text: '', edited: false, auto: kind !== 'free', note: '', points: '' });
const autoItems = cfg => Object.entries(KINDS).filter(([, v]) => v.auto && cfg.on[v.concept]).map(([kind]) => newItem(kind));
const missing = kind => { const c = KINDS[kind].concept; return `(이 소문항에 필요한 개념 '${conceptOf(c).title}'이 꺼져 있습니다. 문제나 전개 단계의 그래프를 바꾸거나 문장을 직접 쓰십시오.)`; };
const symMarkup = model => model.sym === 'odd' ? '기함수이므로 $a_n = 0$인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 $b_n = 0$인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
const firstNonzero = (get, count, tol) => { const out = []; for (let n = 1; n <= NMAX && out.length < count; n++) if (Math.abs(get(n)) >= tol) out.push(n); return out; };
const valueEq = (name, pairs) => `$$${pairs.map(([n, v]) => { const e = exact(v); return `${name}_{${n}} ${rel(e)} ${e.text}`; }).join(',\\quad ')},\\ \\ldots$$`;
const EXACT_NOTE = '= 로 적은 값은 수치 적분 결과와 맞는 정확한 꼴이고, ≈ 로 적은 값은 근삿값입니다. 출제 전에 확인하십시오.';
/** 고유함수 전개의 풀이 줄: 고유함수와 고유값 → 계수 식 → (닫힌 꼴) → 계수 값. 모든 고유함수 종류에 같은 틀을 씁니다.
    fn: 전개할 함수(기본 f), sym: 닫힌 꼴 계산에 넘길 [빼는 직선, 뺀 함수](f − U를 전개할 때). */
function eigenSteps(cfg, R, { fam, fn = R.f, what = '$f(x)$', name = 'c', fnTex = 'f(x)', tol, sym }) {
  const L = R.L, out = [], tx = fam.tex;
  out.push(`${what}를 고유함수 $\\varphi_n = ${tx}$로 전개합니다. ${fam.kMd ? fam.kMd(L) : `$k_n = ${fam.kTex}$입니다.`}`);
  out.push(fam.coefTex ? `$$${fam.coefTex(name, fnTex)}$$` : `$$${name}_n = \\frac{2}{L}\\int_0^L ${fnTex}${tx}\\,dx${fam.n0 === 0 ? `,\\quad ${name}_0 = \\frac{1}{L}\\int_0^L ${fnTex}\\,dx` : ''}$$`);
  if ((fam.id === 'sine' || fam.id === 'cosine') && (fn === R.f || sym)) { const s = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, fam.id, ...(sym ?? [])); if (s) out.push(symbolicSteps(s, fam.id, { a0: `${name}_0`, a: `${name}_n`, b: `${name}_n` })); }
  if (fam.n0 === 0) { const e0 = exact(fineEigen(fam, fn, L, 0)); out.push(`$$${name}_0 ${rel(e0)} ${e0.text}$$`); }
  const ns = firstNonzero(n => fineEigen(fam, fn, L, n), 4, tol);
  if (ns.length) out.push(valueEq(name, ns.map(n => [n, fineEigen(fam, fn, L, n)])));
  out.push(EXACT_NOTE);
  return out;
}
/** 급수 계수 a₀, aₙ, bₙ의 값 줄입니다. */
function coefLines(model, tol) {
  const out = [];
  if (Math.abs(model.a0) >= tol) { const e = exact(fineCoef(model, 'a0')); out.push(`$$a_0 ${rel(e)} ${e.text}$$`); }
  const an = firstNonzero(n => model.a[n], 5, tol), bn = firstNonzero(n => model.b[n], 5, tol);
  if (an.length) out.push(valueEq('a', an.map(n => [n, fineCoef(model, 'a', n)])));
  if (bn.length) out.push(valueEq('b', bn.map(n => [n, fineCoef(model, 'b', n)])));
  out.push(EXACT_NOTE);
  return out;
}
/** 소문항 글이 함께 쓰는 값입니다. */
const itemContext = (cfg, R) => ({ model: R.series, Ls: lengthText(cfg), half: cfg.on.half, J: R.series.jumps[0], tol: 1e-6 * Math.max(R.series.span, 1e-9) });
/** 소문항의 자동 문장입니다(개념 모듈의 items[kind].problem). */
function problemText(kind, cfg, R) {
  const k = KINDS[kind];
  if (k.concept && k.concept !== 'series' && !cfg.on[k.concept]) return missing(kind);
  return k.item?.problem(cfg, R, itemContext(cfg, R)) ?? '';
}
/** 설정의 함수로 기호 계산한 일반항입니다. 맞지 않거나 지원하지 않는 함수면 null입니다. 모델에 남겨 다시 계산하지 않습니다. */
function symbolicFor(cfg, R, modeOverride, shift = null, shifted = null) {
  const mode = modeOverride ?? (cfg.on.half ? cfg.halfMode : 'full'), model = R.series, key = `sym|${mode}|${JSON.stringify(shift)}`;
  model.symCache ??= {};
  if (key in model.symCache) return model.symCache[key];
  const numeric = mode === 'full' && !modeOverride
    ? (kind, n) => fineCoef(model, kind, n)
    : (kind, n) => { const fn = shifted ?? R.f; if (kind === 'a0') return mode === 'cosine' ? fineHalf(fn, R.L, 0, true) : 0; return fineHalf(fn, R.L, n, kind === 'a'); };
  return (model.symCache[key] = symbolicCoefficients(cfg, mode, numeric, shift));
}
/** 소문항의 자동 풀이입니다(개념 모듈의 items[kind].solution). 계수는 촘촘한 적분으로 구한 값이며, 닫힌 꼴이 있으면 그 꼴로 씁니다. */
function solutionText(kind, cfg, R) {
  const k = KINDS[kind];
  if (k.concept && k.concept !== 'series' && !cfg.on[k.concept]) return missing(kind);
  return (k.item?.solution(cfg, R, itemContext(cfg, R)) ?? []).join('\n\n');
}
const solutionOf = (it, cfg, R) => [it.auto && it.kind !== 'free' ? solutionText(it.kind, cfg, R) : '', it.note].filter(x => String(x ?? '').trim()).join('\n\n');
/** 소문항 글을 문서 조각으로 바꾸고 번호와 배점을 붙입니다. */
function itemBlocks(markup, k, points = '') {
  const blocks = markupBlocks(markup), label = B(`(${k + 1}) `), tail = String(points).trim() ? [` (${String(points).trim()}점)`] : [];
  if (blocks[0]?.k === 'p') blocks[0] = DOC.p(label, ...blocks[0].seg, ...tail);
  else blocks.unshift(DOC.p(label, ...tail));
  return blocks;
}
/** 자동 문장을 지금 설정에 맞춥니다. 사용자가 고친 문장은 그대로 둡니다. 소문항 구성을 바꾸지 않았으면 켠 개념에 맞춰 다시 짭니다. */
function syncDraft() {
  if (!S.good || !S.R) return;
  if (!S.draft.custom) {
    const kinds = autoItems(S.good).map(it => it.kind), old = S.draft.items;
    S.draft.items = kinds.map(kind => old.find(it => it.kind === kind) ?? newItem(kind));
  }
  for (const it of S.draft.items) if (!it.edited && it.kind !== 'free') it.text = problemText(it.kind, S.good, S.R);
}
