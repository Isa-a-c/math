'use strict';
/* 개념 모듈: Fourier 급수. 그래프(부분합), 요약, 소문항(급수 구하기·역문제·그래프 읽기), 설명, 주제(주기 함수의 전개). */
defineConcept({
  id: 'series', ch: '11장', title: 'Fourier 급수',
  markup: String.raw`주기 $2L$인 함수를 삼각함수의 합으로 나타낸 것이 **Fourier 급수**입니다. 주기가 $2\pi$이면 $L = \pi$입니다.

$$f(x) = a_0 + \sum_{n=1}^{\infty}(a_n\cos\frac{n\pi x}{L} + b_n\sin\frac{n\pi x}{L})$$

계수는 **Euler 공식**으로 구합니다.

$$a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx$$

$$a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx,\quad b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$

실제로는 $N$차까지 더한 부분합 $S_N$을 봅니다. 우함수이면 $b_n = 0$(코사인 급수), 기함수이면 $a_n = 0$(사인 급수)이므로 계산 전에 대칭을 먼저 확인합니다.`,
  panels: {
  series(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, L = model.L, half = cfg.on.half, xr = rangeX([-1.5 * L, 1.5 * L], R), pad = Math.max(.25, .2 * model.span), yr = rangeY([model.lo - pad, model.hi + pad], R), b = box(w, h, C);
    const M = axes(ctx, b, xr, yr, C, { band: half ? [0, L] : [-L, L], xTicks: piTicks(xr, L) });
    curve(ctx, model.f, b, xr, M, C.ink, 2.5, breaksOf(model, xr));
    if (ref) curve(ctx, x => partialSum(ref.R.series, ref.cfg.N, x), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => partialSum(model, cfg.N, x), b, xr, M, C.blue, 3);
    return { title: half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'} 확장과 부분합` : 'Fourier 급수의 부분합', frame: { b, xr, yr },
      legend: [['--ink', half ? `${fx}의 확장` : fx], ['--blue', `<i>S</i><sub>${cfg.N}</sub>`], ['--band', half ? '주어진 구간 (0, <i>L</i>)' : '한 주기', 'fill'], ...(ref ? [pinLabel(`<i>S</i><sub>${ref.cfg.N}</sub>`)] : [])],
      probe: x => [['f', model.f(x)], [`S${cfg.N}`, partialSum(model, cfg.N, x)], ...(ref ? [[`고정 S${ref.cfg.N}`, partialSum(ref.R.series, ref.cfg.N, x)]] : [])] };
  },
  },
  summary(cfg, R) {
    const model = R.series;
    return [['Fourier 급수', `${symHtml(model)} ${m(`<i>f</i>(<i>x</i>) ≈ ${termsText(seriesTerms(model))}`)}, 항 ${cfg.N}개의 제곱오차 ${m(`<i>E</i>* = ${errText(squareError(model, cfg.N))}`)}`]];
  },
  items: {
    series: { label: '급수 구하기', auto: true,
      problem: (cfg, R, { Ls, half }) => half ? `${fMarkup(cfg)}를 반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 급수로 전개하시오. (길이 $L = ${Ls}$)` : `주기가 $2L$ ($L = ${Ls}$)인 함수 ${fMarkup(cfg)}의 Fourier 급수를 구하시오.`,
      solution(cfg, R, { model, Ls, tol }) {
        const out = [symMarkup(model)];
        if (cfg.on.half) out.push(cfg.halfMode === 'cosine' ? String.raw`$$a_0 = \frac{1}{L}\int_{0}^{L} f(x)\,dx,\quad a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$$` : String.raw`$$b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
        else out.push(String.raw`$$a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx,\quad a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx,\quad b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
        { const sym = symbolicFor(cfg, R); if (sym) out.push(symbolicSteps(sym, cfg.on.half ? cfg.halfMode : 'full')); }
        out.push(`$L = ${Ls}$을 넣어 계산하면 다음과 같습니다.`);
        out.push(...coefLines(model, tol));
        out.push(`$$f(x) \\approx ${termsText(seriesTerms(model, 5))}$$`);
        out.push(`항 ${cfg.N}개까지의 제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`);
        return out;
      } },
    inverse: { label: '역문제 (급수 → 함수)',
      problem: (cfg, R, { model, Ls, half }) => `어떤 함수의 Fourier 급수가 $${termsText(seriesTerms(model, 4))}$일 때, 이 함수 $f(x)$를 구간 $${half ? '0' : '−L'} < x < L$에서 구하고 그래프를 그리시오. ($L = ${Ls}$)`,
      solution(cfg, R, { model, tol }) {
        const out = [`주어진 계수는 ${fMarkup(cfg)}의 Fourier 계수입니다. ${symMarkup(model)}`];
        { const sym = symbolicFor(cfg, R); if (sym) out.push(symbolicSteps(sym, cfg.on.half ? cfg.halfMode : 'full')); }
        out.push(...coefLines(model, tol));
        return out;
      } },
    graph: { label: '그래프 읽기',
      problem: (cfg, R, { J }) => `그림은 함수 $f(x)$와 Fourier 급수의 부분합 $S_N(x)$의 그래프이다. 그림에서 $N$의 값을 구하고, ${J ? '도약점에서 부분합이 지나는 값을 읽으시오.' : '부분합이 함수와 가장 크게 다른 곳을 찾으시오.'}`,
      solution: (cfg, R, { model, J }) => [`그림의 부분합은 $N = ${cfg.N}$입니다.`, J ? `도약점 $x = ${piLabel(J.x, model.L)}$에서 부분합은 두 극한 ${fmt(J.left, 4)}, ${fmt(J.right, 4)}의 평균인 ${fmt((J.left + J.right) / 2, 4)}을 지납니다.` : `제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`] },
  },
});
defineTopic({
  id: 'fourier', eq: 'none', domain: 'periodic', look: true,
  name: () => ['11장', 'Fourier 급수'],
  uses: () => ['series'], params: () => ({}),
  stages: cfg => [
    { id: 'basis', title: '기저 함수 (직교)', panel: 'eigen', md: String.raw`주기 $2L$인 함수는 $1$, $\cos\frac{n\pi x}{L}$, $\sin\frac{n\pi x}{L}$ ($n = 1, 2, \ldots$)의 합으로 나타냅니다. 이 함수들은 한 주기에서 서로 직교합니다.` },
    { id: 'expand', title: 'Fourier 급수 전개', panel: lookPanel(cfg), look: true, md: String.raw`$f(x) = a_0 + \sum_{n=1}^{\infty}(a_n\cos\frac{n\pi x}{L} + b_n\sin\frac{n\pi x}{L})$, $a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$, $b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$` },
  ],
});
