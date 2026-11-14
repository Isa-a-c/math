'use strict';
/* 요약, 예제의 소문항(자동 문장·자동 풀이). 글은 $…$ 수식 표기입니다. */
/* ── 요약 ─────────────────────────────────────────── */
const m = s => `<span class="m">${s}</span>`;
const symHtml = model => model.sym === 'odd' ? '기함수이므로 aₙ = 0인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 bₙ = 0인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
/** 화면 아래 '요약' 탭의 줄입니다. 시간이 있는 개념은 현재 시간의 값을 씁니다. */
function summary(cfg, R) {
  const out = [], model = R.series, J = model.jumps[0];
  out.push(['Fourier 급수', `${symHtml(model)} ${m(`<i>f</i>(<i>x</i>) ≈ ${termsText(seriesTerms(model))}`)}, 항 ${cfg.N}개의 제곱오차 ${m(`<i>E</i>* = ${errText(squareError(model, cfg.N))}`)}`]);
  if (cfg.on.coef) { const v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v); out.push(['계수의 의미', `곱한 곡선의 넓이 ${m(fmt(v * model.L, 4))}를 ${m('<i>L</i>')}로 나누면 ${m(`<i>${cfg.coefKind}</i><sub>${cfg.coefN}</sub> ${e.sure ? '=' : '≈'} ${e.text}`)}입니다.${Math.abs(v) < 1e-6 * Math.max(model.span, 1e-9) ? ' 넓이가 상쇄되어 이 파동은 함수에 없습니다.' : ''}`]); }
  if (cfg.on.spectrum) { const p = decayPower(model); out.push(['계수 크기', p === null ? decayWords(p) : `계수가 약 ${m(`1/<i>n</i><sup>${fmt(p, 1)}</sup>`)}로 줄어듭니다. ${decayWords(p)}`]); }
  if (cfg.on.gibbs) out.push(['수렴과 도약', J ? `${m(`<i>x</i> = ${piLabel(J.x, model.L)}`)}에서 합은 평균 ${m(fmt((J.left + J.right) / 2, 3))}, ${m(`<i>S</i><sub>${cfg.N}</sub> = ${fmt(partialSum(model, cfg.N, J.x), 4)}`)}입니다. 봉우리 초과량은 도약의 ${m(`${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%`)}입니다.` : '도약이 없어 모든 점에서 f(x)로 수렴합니다.']);
  if (cfg.on.half) out.push(['반구간 전개', `(0, L)의 함수를 ${cfg.halfMode === 'cosine' ? '우함수로 확장해 코사인' : '기함수로 확장해 사인'} 항만 남겼습니다.${needsHalf(cfg) ? ' 현·막대의 해가 이 전개를 씁니다.' : ''}`]);
  if (cfg.on.transform) {
    const T = R.transform; let iMax = 0; T.A.forEach((v, i) => { if (Math.abs(v) + Math.abs(T.B[i]) > Math.abs(T.A[iMax]) + Math.abs(T.B[iMax])) iMax = i; });
    out.push(['Fourier 적분', `${model.sym === 'even' ? '우함수라 B(w) = 0인 코사인 적분입니다. ' : model.sym === 'odd' ? '기함수라 A(w) = 0인 사인 적분입니다. ' : ''}위끝 ${m(`<i>a</i> = ${fmt(T.wMax, 3)}`)}까지 적분해 f를 다시 만들었습니다. 계수가 가장 큰 진동수는 ${m(`<i>w</i> ≈ ${fmt(T.ws[iMax], 3)}`)}입니다.${T.edge > .01 * Math.max(T.span, 1e-9) ? ' 범위 X의 끝에서 f가 0이 아니어서, 범위 밖을 0으로 본 근사입니다.' : ''}`]);
  }
  if (cfg.on.wave) {
    const W = R.wave, t = timeOf(W, cfg);
    if (cfg.waveDomain === 'finite') {
      const ends = Math.max(Math.abs(R.f(0)), Math.abs(R.f(R.L)));
      out.push(['현의 진동', `주기 ${m(`2<i>L</i>/<i>c</i> = ${fmt(W.T, 4)}`)}, 기본 각진동수 ${m(`<i>λ</i><sub>1</sub> = ${coefText(W.omega(1))}`)}. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.${ends > 1e-6 ? ' 초기 변위가 양 끝에서 0이 아니어서 끝점 부근에서 급수가 함수와 다릅니다.' : ''}`]);
    } else out.push(['무한히 긴 현', `초기 모양이 절반씩 나뉘어 속도 ${m(fmt(W.speed, 3))}로 양쪽으로 갑니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]);
  }
  if (cfg.on.wave && R.wave.damping > 0) out.push(['감쇠', `모드마다 ${m('<i>e</i><sup>−<i>kt</i></sup>')}로 줄어듭니다(k = ${fmt(R.wave.damping, 3)}). ${R.wave.damping < R.wave.omega(1) ? '진동하면서 줄어듭니다.' : '첫 모드부터 진동하지 않고 줄어듭니다(과감쇠).'}`]);
  if (cfg.on.wave && R.wave.free) out.push(['자유 끝', '양 끝이 자유로워 모드가 cos(nπx/L)이고, 평균 높이(0번 모드)는 그대로 유지됩니다.']);
  if (cfg.on.membrane) {
    const Mb = R.membrane, t = timeOf(Mb, cfg);
    out.push(['막의 진동', `가장 낮은 각진동수 ${m(`<i>λ</i><sub>11</sub> = ${fmt(Mb.base, 4)}`)}, 모드 ${Mb.M}×${Mb.M}개를 더했습니다. ${m('<i>λ</i><sub><i>mn</i></sub>')}이 정수배가 아니어서 처음 모양으로 정확히 돌아오지 않습니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]);
  }
  if (cfg.on.heat) {
    const H = R.heat, t = timeOf(H, cfg);
    if (cfg.heatDomain === 'finite') out.push(['막대의 열전도', `${cfg.bc === 'fixed' ? (H.left === H.right ? `막대 전체가 ${m(fmt(H.left, 3))}으로 고르게 됩니다.` : `양 끝 ${m(fmt(H.left, 3))}, ${m(fmt(H.right, 3))}을 잇는 직선으로 갑니다.`) : `평균 온도 ${m(fmt(H.mean, 4))}로 고르게 됩니다.`} 첫 모드 감쇠율 ${m(`<i>λ</i><sub>1</sub>² = ${fmt(H.rate(1), 4)}`)}, 가운데 온도 ${m(fmt(H.u(H.L / 2, t), 4))} (${m(`<i>t</i> = ${fmt(t, 3)}`)}).`]);
    else { let peak = -Infinity; for (let i = 0; i <= 200; i++) peak = Math.max(peak, H.u(-H.X + i / 100 * H.X, t)); out.push(['무한 막대', `퍼짐의 표준편차 ${m(`√(2<i>c</i>²<i>t</i>) = ${fmt(Math.sqrt(2 * H.alpha * t), 3)}`)}, 최고 온도 ${m(fmt(peak, 4))}, 전체 열량 ${m(fmt(H.total, 4))}은 그대로입니다.`]); }
  }
  return out;
}

/* ── 예제: 소문항의 종류, 자동 문장, 자동 풀이 (글은 $…$ 수식 표기) ── */
const KINDS = {
  series: { label: '급수 구하기', concept: 'series' },
  inverse: { label: '역문제 (급수 → 함수)', concept: 'series' },
  graph: { label: '그래프 읽기', concept: 'series' },
  coef: { label: '계수의 값과 의미', concept: 'coef' },
  spectrum: { label: '계수 크기', concept: 'spectrum' },
  gibbs: { label: '도약점과 Gibbs 현상', concept: 'gibbs' },
  wave: { label: '현의 해', concept: 'wave' },
  heat: { label: '막대의 해', concept: 'heat' },
  transform: { label: 'Fourier 적분', concept: 'transform' },
  membrane: { label: '막의 진동', concept: 'membrane' },
  free: { label: '자유 문항', concept: null },
};
const newItem = kind => ({ kind, text: '', edited: false, auto: kind !== 'free', note: '', points: '' });
const autoItems = cfg => ['series', ...['coef', 'spectrum', 'gibbs', 'transform', 'wave', 'membrane', 'heat'].filter(k => cfg.on[k])].map(newItem);
const missing = kind => { const c = KINDS[kind].concept; return `(이 소문항에 필요한 개념 '${conceptOf(c).title}'이 꺼져 있습니다. 문제나 전개 단계의 그래프를 바꾸거나 문장을 직접 쓰십시오.)`; };
const symMarkup = model => model.sym === 'odd' ? '기함수이므로 $a_n = 0$인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 $b_n = 0$인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
const firstNonzero = (get, count, tol) => { const out = []; for (let n = 1; n <= NMAX && out.length < count; n++) if (Math.abs(get(n)) >= tol) out.push(n); return out; };
const valueEq = (name, pairs) => `$$${pairs.map(([n, v]) => { const e = exact(v); return `${name}_{${n}} ${rel(e)} ${e.text}`; }).join(',\\quad ')},\\ \\ldots$$`;
const EXACT_NOTE = '= 로 적은 값은 수치 적분 결과와 맞는 정확한 꼴이고, ≈ 로 적은 값은 근삿값입니다. 출제 전에 확인하십시오.';
/** 소문항의 자동 문장입니다. */
function problemText(kind, cfg, R) {
  const c = KINDS[kind].concept;
  if (c && c !== 'series' && !cfg.on[c]) return missing(kind);
  const model = R.series, Ls = lengthText(cfg), half = cfg.on.half, J = model.jumps[0];
  switch (kind) {
    case 'series': return half ? `${fMarkup(cfg)}를 반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 급수로 전개하시오. (길이 $L = ${Ls}$)` : `주기가 $2L$ ($L = ${Ls}$)인 함수 ${fMarkup(cfg)}의 Fourier 급수를 구하시오.`;
    case 'inverse': return `어떤 함수의 Fourier 급수가 $${termsText(seriesTerms(model, 4))}$일 때, 이 함수 $f(x)$를 구간 $${half ? '0' : '−L'} < x < L$에서 구하고 그래프를 그리시오. ($L = ${Ls}$)`;
    case 'graph': return `그림은 함수 $f(x)$와 Fourier 급수의 부분합 $S_N(x)$의 그래프이다. 그림에서 $N$의 값을 구하고, ${J ? '도약점에서 부분합이 지나는 값을 읽으시오.' : '부분합이 함수와 가장 크게 다른 곳을 찾으시오.'}`;
    case 'coef': return half
      ? `${fMarkup(cfg)}를 반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 급수로 전개할 때 계수 $${cfg.coefKind}_{${cfg.coefN}} = \\frac{2}{L}\\int_{0}^{L} f(x)${cfg.coefKind === 'b' ? '\\sin' : '\\cos'}\\frac{${cfg.coefN}\\pi x}{L}\\,dx$를 함수와 파동을 곱한 곡선의 넓이로 해석하고 그 값을 구하시오. ($L = ${Ls}$)`
      : `계수 $${cfg.coefKind}_{${cfg.coefN}}$을 함수와 파동을 곱한 곡선의 넓이로 해석하고 그 값을 구하시오.`;
    case 'spectrum': return `${half ? `반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 전개에서 ` : ''}계수의 크기가 $n$에 따라 줄어드는 빠르기를 구하고, ${half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수의 ` : '함수의 '}매끄러움과 연결하여 설명하시오.`;
    case 'gibbs': return J ? `${half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수의 ` : ''}도약점 $x = ${piLabel(J.x, model.L)}$에서 급수의 합을 구하고, $N = ${cfg.N}$일 때 도약점 옆 봉우리의 초과량을 구하시오.` : '이 함수의 급수가 모든 점에서 $f(x)$로 수렴하는 이유를 설명하시오.';
    case 'transform': return `${fMarkup(cfg)}의 Fourier 적분 표현을 구하시오. $A(w)$, $B(w)$를 구하고, 적분의 위끝을 $a = ${prettyExpr(cfg.wMax)}$로 끊었을 때의 근사를 설명하시오.`;
    case 'membrane': return `가로 $a = ${Ls}$, 세로 $b = ${prettyExpr(cfg.b)}$인 직사각형 막의 가장자리가 고정되어 있다. 처음 모양이 $f(x)h(y)$ ($h(y) = ${prettyExpr(cfg.h, cfg.params)}$), 처음 속도가 0이고 $c = ${prettyExpr(cfg.c)}$일 때 $u(x,y,t)$를 구하시오.`;
    case 'wave': {
      const g = prettyExpr(cfg.g, cfg.params), cs = prettyExpr(cfg.c);
      const extra = `${cfg.waveEnds === 'free' ? ' 양 끝은 자유롭게 움직인다($u_x = 0$).' : ''}${+cfg.damping > 0 ? ` 감쇠 계수는 $k = ${prettyExpr(cfg.damping)}$이다($u_{tt} + 2ku_t = c^2u_{xx}$).` : ''}`;
      return cfg.waveDomain === 'finite' ? `길이 $L = ${Ls}$, 파동 속도 $c = ${cs}$인 현${cfg.waveEnds === 'free' ? '' : '의 양 끝이 고정되어 있다'}.${extra} 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 변위 $u(x,t)$를 구하시오.`
        : `무한히 긴 현($c = ${cs}$)의 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 $u(x,t)$를 구하시오.`;
    }
    case 'heat': {
      const a = prettyExpr(cfg.alpha);
      if (cfg.heatDomain === 'infinite') return `무한히 긴 막대($c^2 = ${a}$)의 초기 온도가 $f(x)$일 때 $u(x,t)$를 적분 꼴로 쓰고, 시간에 따른 변화를 설명하시오.`;
      if (cfg.bc === 'fixed') return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝 온도를 $U_1 = ${prettyExpr(cfg.left)}$, $U_2 = ${prettyExpr(cfg.right)}$로 유지한다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 정상 상태를 구하시오.`;
      return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝이 단열되어 있다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 도달하는 온도를 구하시오.`;
    }
    default: return '';
  }
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
/** 소문항의 자동 풀이입니다. 계수는 촘촘한 적분으로 구한 값이며, 닫힌 꼴이 있으면 그 꼴로 씁니다. */
function solutionText(kind, cfg, R) {
  const c = KINDS[kind].concept;
  if (c && c !== 'series' && !cfg.on[c]) return missing(kind);
  const model = R.series, tol = 1e-6 * Math.max(model.span, 1e-9), Ls = lengthText(cfg), out = [], J = model.jumps[0], half = cfg.on.half;
  const coefLines = () => {
    if (Math.abs(model.a0) >= tol) { const e = exact(fineCoef(model, 'a0')); out.push(`$$a_0 ${rel(e)} ${e.text}$$`); }
    const an = firstNonzero(n => model.a[n], 5, tol), bn = firstNonzero(n => model.b[n], 5, tol);
    if (an.length) out.push(valueEq('a', an.map(n => [n, fineCoef(model, 'a', n)])));
    if (bn.length) out.push(valueEq('b', bn.map(n => [n, fineCoef(model, 'b', n)])));
    out.push(EXACT_NOTE);
  };
  switch (kind) {
    case 'series':
      out.push(symMarkup(model));
      if (cfg.on.half) out.push(cfg.halfMode === 'cosine' ? String.raw`$$a_0 = \frac{1}{L}\int_{0}^{L} f(x)\,dx,\quad a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$$` : String.raw`$$b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
      else out.push(String.raw`$$a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx,\quad a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx,\quad b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
      { const sym = symbolicFor(cfg, R); if (sym) out.push(symbolicSteps(sym, cfg.on.half ? cfg.halfMode : 'full')); }
      out.push(`$L = ${Ls}$을 넣어 계산하면 다음과 같습니다.`);
      coefLines();
      out.push(`$$f(x) \\approx ${termsText(seriesTerms(model, 5))}$$`);
      out.push(`항 ${cfg.N}개까지의 제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`);
      break;
    case 'inverse':
      out.push(`주어진 계수는 ${fMarkup(cfg)}의 Fourier 계수입니다. ${symMarkup(model)}`);
      { const sym = symbolicFor(cfg, R); if (sym) out.push(symbolicSteps(sym, cfg.on.half ? cfg.halfMode : 'full')); }
      coefLines();
      break;
    case 'graph':
      out.push(`그림의 부분합은 $N = ${cfg.N}$입니다.`);
      out.push(J ? `도약점 $x = ${piLabel(J.x, model.L)}$에서 부분합은 두 극한 ${fmt(J.left, 4)}, ${fmt(J.right, 4)}의 평균인 ${fmt((J.left + J.right) / 2, 4)}을 지납니다.` : `제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`);
      break;
    case 'coef': { const v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v); if (half) out.push(`${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수에서 $(-L, L)$의 곱한 넓이는 $(0, L)$의 넓이의 2배이므로 $\\frac{1}{L}\\int_{-L}^{L}$과 $\\frac{2}{L}\\int_{0}^{L}$은 같은 값입니다.`); out.push(`곱한 곡선의 넓이는 ${fmt(v * model.L, 4)}이고, 이를 $L$로 나누면 $${cfg.coefKind}_{${cfg.coefN}} ${rel(e)} ${e.text}$입니다. ${Math.abs(v) < tol ? '넓이가 상쇄되어 이 파동은 함수에 들어 있지 않습니다.' : '넓이가 한쪽으로 쌓일수록 이 파동의 비중이 큽니다.'}`); break; }
    case 'spectrum': { const p = decayPower(model); out.push(p === null ? decayWords(p) : `계수의 포락선이 $1/n^{${fmt(p, 1)}}$처럼 줄어듭니다. ${decayWords(p)}`); break; }
    case 'gibbs':
      out.push(J ? `$x = ${piLabel(J.x, model.L)}$에서 왼쪽 극한 ${fmt(J.left, 4)}, 오른쪽 극한 ${fmt(J.right, 4)}이므로 급수의 합은 평균 ${fmt((J.left + J.right) / 2, 4)}입니다. $N = ${cfg.N}$일 때 봉우리 초과량은 도약 크기의 ${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%이며, $N$을 늘려도 약 9%로 남습니다(Gibbs 현상).` : '함수가 연속이고 구분적으로 매끄러워 모든 점에서 $f(x)$로 수렴합니다.');
      break;
    case 'wave': {
      const W = R.wave;
      if (cfg.waveDomain !== 'finite') { out.push(String.raw`D’Alembert 해 $u = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$` + `에 $c = ${fmt(W.speed, 3)}$을 넣습니다. 초기 모양의 절반이 속도 ${fmt(W.speed, 3)}로 오른쪽과 왼쪽으로 이동하며, 모양은 변하지 않습니다.`); break; }
      if (W.free || W.damping > 0) {
        const cos = W.free, Bn = firstNonzero(n => fineHalf(R.f, R.L, n, cos), 4, tol);
        out.push(`변수분리로 $\\lambda_n = cn\\pi/L = ${coefText(W.omega(1))}n$입니다. ${cos ? '양 끝이 자유로워($u_x = 0$) 모드가 $\\cos\\frac{n\\pi x}{L}$이고, 계수는 초기 변위의 반구간 코사인 계수입니다. 평균 높이 $A_0$은 그대로 남습니다.' : '계수는 초기 변위의 반구간 사인 계수입니다.'}`);
        if (cos) { const e0 = exact(fineHalf(R.f, R.L, 0, true)); out.push(`$$A_0 ${rel(e0)} ${e0.text}$$`); }
        if (Bn.length) out.push(valueEq(cos ? 'A' : 'B', Bn.map(n => [n, fineHalf(R.f, R.L, n, cos)])));
        if (W.damping > 0) out.push(`감쇠가 있으면 각 모드의 시간 부분이 $q_n'' + 2kq_n' + \\lambda_n^2 q_n = 0$을 따릅니다. $k = ${fmt(W.damping, 4)}$${W.damping < W.omega(1) ? `이 $\\lambda_1$보다 작으므로 $q_n = e^{-kt}(B_n\\cos\\mu_n t + \\frac{kB_n}{\\mu_n}\\sin\\mu_n t)$, $\\mu_n = \\sqrt{\\lambda_n^2 - k^2}$입니다(처음 속도 0일 때).` : '이 $\\lambda_1$ 이상이어서 낮은 모드는 진동하지 않고 줄어듭니다(과감쇠).'}`);
        out.push(EXACT_NOTE);
        break;
      }
      const Bn = firstNonzero(n => fineHalf(R.f, R.L, n, false), 4, tol), Vn = firstNonzero(n => fineHalf(W.g, R.L, n, false), 4, tol);
      out.push(`변수분리로 $\\lambda_n = cn\\pi/L = ${coefText(W.omega(1))}n$이고, 계수는 초기 변위와 초기 속도의 반구간 사인 계수에서 나옵니다.`);
      { const sym = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, 'sine'); if (sym) out.push(symbolicSteps(sym, 'sine', { a0: 'A_0', a: 'A_n', b: 'B_n' })); }
      if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineHalf(R.f, R.L, n, false)])));
      if (Vn.length) out.push(valueEq('B^*', Vn.map(n => [n, fineHalf(W.g, R.L, n, false) / W.omega(n)])));
      out.push(EXACT_NOTE);
      const terms = Bn.slice(0, 3).map(n => [fineHalf(R.f, R.L, n, false), `cos ${coefText(W.omega(n))}t · sin ${argOf(n, R.L)}`]);
      if (terms.length) out.push(`$$u(x,t) \\approx ${termsText(terms)}$$`);
      out.push(`현은 주기 $2L/c = ${fmt(W.T, 4)}$로 처음 모양으로 돌아옵니다.`);
      break;
    }
    case 'heat': {
      const H = R.heat;
      if (cfg.heatDomain !== 'finite') { out.push(String.raw`열핵과의 합성곱 $u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp(-\frac{(x-v)^2}{4c^2 t})\,dv$` + `에 $c^2 = ${fmt(H.alpha, 4)}$를 넣습니다. 열은 표준편차 $\\sqrt{2c^2 t}$로 퍼지고, 전체 열량 ${fmt(H.total, 4)}은 변하지 않습니다.`); break; }
      if (cfg.bc === 'fixed') {
        const v = x => R.f(x) - H.steady(x), Bn = firstNonzero(n => fineHalf(v, R.L, n, false), 4, tol);
        out.push(`정상 상태는 $U(x) = ${fmt(H.left, 4)} + ${fmt(H.right - H.left, 4)}x/L$이고, $f - U$의 반구간 사인 계수가 $B_n$입니다. 감쇠율은 $\\lambda_n^2 = c^2(n\\pi/L)^2 = ${fmt(H.rate(1), 4)}n^2$입니다.`);
        { const sym = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, 'sine', [H.left, H.right - H.left], v); if (sym) out.push(symbolicSteps(sym, 'sine', { a0: 'A_0', a: 'A_n', b: 'B_n' })); }
        if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineHalf(v, R.L, n, false)])));
        out.push(`첫 모드가 절반으로 줄어드는 시간은 $\\ln 2/\\lambda_1^2 = ${fmt(Math.LN2 / H.rate(1), 4)}$입니다.`);
      } else {
        const An = firstNonzero(n => fineHalf(R.f, R.L, n, true), 4, tol);
        const e0 = exact(fineHalf(R.f, R.L, 0, true));
        out.push(`단열 조건에서는 코사인 급수가 나오고, 온도는 평균 $A_0 ${rel(e0)} ${e0.text}$으로 갑니다.`);
        { const sym = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, 'cosine'); if (sym) out.push(symbolicSteps(sym, 'cosine', { a0: 'A_0', a: 'A_n', b: 'B_n' })); }
        if (An.length) out.push(valueEq('A', An.map(n => [n, fineHalf(R.f, R.L, n, true)])));
      }
      break;
    }
    case 'transform': {
      const T = R.transform, pick = [1, 2, 3].map(w0 => [w0, T.ws.findIndex(w => w >= w0 - 1e-9)]).filter(([, i]) => i >= 0);
      out.push(`${model.sym === 'even' ? '우함수이므로 $B(w) = 0$이고 Fourier 코사인 적분이 됩니다.' : model.sym === 'odd' ? '기함수이므로 $A(w) = 0$이고 Fourier 사인 적분이 됩니다.' : '대칭이 없어 $A(w)$, $B(w)$가 모두 나옵니다.'}`);
      out.push(String.raw`$$A(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\cos wv\,dv,\quad B(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\sin wv\,dv$$`);
      out.push(`수치 적분으로 구한 값: ${pick.map(([w0, i]) => `$A(${w0}) \\approx ${fmt(T.A[i], 4)}$, $B(${w0}) \\approx ${fmt(T.B[i], 4)}$`).join(', ')}.`);
      out.push(`위끝 $a = ${fmt(T.wMax, 3)}$까지의 적분은 $f$의 매끄러운 근사이며, $a$를 키우면 $f$에 가까워지고 도약점에서는 평균으로 갑니다.`);
      break;
    }
    case 'membrane': {
      const Mb = R.membrane, top = Mb.terms.slice().sort((p, q) => Math.abs(q[2]) - Math.abs(p[2])).slice(0, 4);
      out.push(`가장자리 고정 조건으로 모드는 $\\sin\\frac{m\\pi x}{a}\\sin\\frac{n\\pi y}{b}$이고 $\\lambda_{mn} = c\\pi\\sqrt{m^2/a^2 + n^2/b^2}$입니다. 처음 모양이 $f(x)h(y)$이므로 $B_{mn} = B_m B_n$(각각 반구간 사인 계수)입니다.`);
      out.push(`$$${top.map(([m0, n0, B, l]) => `B_{${m0}${n0}} \\approx ${fmt(B, 4)}\\ (\\lambda_{${m0}${n0}} \\approx ${fmt(l, 3)})`).join(',\\quad ')}$$`);
      out.push('처음 속도가 0이므로 $B_{mn}^* = 0$이고 $u = \\sum\\sum B_{mn}\\cos\\lambda_{mn}t\\,\\sin\\frac{m\\pi x}{a}\\sin\\frac{n\\pi y}{b}$입니다.');
      break;
    }
    default: break;
  }
  return out.join('\n\n');
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
