'use strict';
/* 개념 모듈: 계수의 의미(직교성). 전개 단계에서 '계수의 의미'를 고르면 씁니다. */
defineConcept({
  id: 'coef', ch: '11장', title: '계수의 의미 (직교성)',
  markup: String.raw`계수를 구하는 열쇠는 **직교성**입니다. 서로 다른 두 삼각함수를 곱해 한 주기 적분하면 0입니다.

$$\int_{-L}^{L}\cos\frac{n\pi x}{L}\cos\frac{m\pi x}{L}\,dx = 0\ (n \ne m),\quad \int_{-L}^{L}\sin\frac{n\pi x}{L}\cos\frac{m\pi x}{L}\,dx = 0$$

급수의 양변에 $\cos\frac{m\pi x}{L}$를 곱해 적분하면 직교성 때문에 $n = m$인 항 하나만 남고, 이것이 Euler 공식이 됩니다.

$$\int_{-L}^{L} f(x)\cos\frac{m\pi x}{L}\,dx = a_m L$$

> **그림의 뜻.** 계수는 함수와 그 파동을 곱한 곡선의 넓이를 $L$로 나눈 값입니다. 넓이가 상쇄되면 그 파동은 함수에 들어 있지 않습니다.`,
  panels: {
  coef(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, L = model.L, n = cfg.coefN, xr = rangeX([-L, L], R), trig = k => k === 'b' ? Math.sin : Math.cos, basis = x => trig(cfg.coefKind)(n * PI / L * x), breaks = breaksOf(model, xr), [p, q] = stacked(w, h, C), pad = Math.max(.25, .15 * model.span);
    const yr = rangeY([Math.min(model.lo, -1) - pad, Math.max(model.hi, 1) + pad], R), M = axes(ctx, p, xr, yr, C, { xTicks: piTicks(xr, L), noXLabels: true });
    curve(ctx, basis, p, xr, M, C.blue, 2, [], [8, 5]); curve(ctx, model.f, p, xr, M, C.ink, 2.5, breaks);
    const Mq = drawArea(ctx, q, C, xr, L, x => model.f(x) * basis(x), breaks);
    if (ref) { const rb = x => trig(ref.cfg.coefKind)(ref.cfg.coefN * PI / ref.R.L * x); curve(ctx, x => ref.R.series.f(x) * rb(x), q, xr, Mq, C.green, 2, [], [7, 5]); }
    return { title: `계수 ${cfg.coefKind}${n}: 곱한 곡선의 넓이`, frame: { b: p, xr, yr },
      legend: [['--ink', fx], ['--blue', `${cfg.coefKind === 'b' ? 'sin' : 'cos'} ${argOf(n, L).replace('x', '<i>x</i>')}`, true], ['--pos-fill', '더하는 넓이', 'fill'], ['--neg-fill', '빼는 넓이', 'fill'], ...(ref ? [pinLabel(`${ref.cfg.coefKind}${ref.cfg.coefN}의 곱`)] : [])],
      probe: x => [['f', model.f(x)], ['파동', basis(x)], ['곱', model.f(x) * basis(x)]], pick: x => [['f', model.f(x)], ['파동', basis(x)]] };
  },
  },
  summary(cfg, R) {
    const model = R.series, v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v);
    return [['계수의 의미', `곱한 곡선의 넓이 ${m(fmt(v * model.L, 4))}를 ${m('<i>L</i>')}로 나누면 ${m(`<i>${cfg.coefKind}</i><sub>${cfg.coefN}</sub> ${e.sure ? '=' : '≈'} ${e.text}`)}입니다.${Math.abs(v) < 1e-6 * Math.max(model.span, 1e-9) ? ' 넓이가 상쇄되어 이 파동은 함수에 없습니다.' : ''}`]];
  },
  items: {
    coef: { label: '계수의 값과 의미', auto: true,
      problem: (cfg, R, { Ls, half }) => half
        ? `${fMarkup(cfg)}를 반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 급수로 전개할 때 계수 $${cfg.coefKind}_{${cfg.coefN}} = \\frac{2}{L}\\int_{0}^{L} f(x)${cfg.coefKind === 'b' ? '\\sin' : '\\cos'}\\frac{${cfg.coefN}\\pi x}{L}\\,dx$를 함수와 파동을 곱한 곡선의 넓이로 해석하고 그 값을 구하시오. ($L = ${Ls}$)`
        : `계수 $${cfg.coefKind}_{${cfg.coefN}}$을 함수와 파동을 곱한 곡선의 넓이로 해석하고 그 값을 구하시오.`,
      solution(cfg, R, { model, half, tol }) {
        const out = [], v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v);
        if (half) out.push(`${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수에서 $(-L, L)$의 곱한 넓이는 $(0, L)$의 넓이의 2배이므로 $\\frac{1}{L}\\int_{-L}^{L}$과 $\\frac{2}{L}\\int_{0}^{L}$은 같은 값입니다.`);
        out.push(`곱한 곡선의 넓이는 ${fmt(v * model.L, 4)}이고, 이를 $L$로 나누면 $${cfg.coefKind}_{${cfg.coefN}} ${rel(e)} ${e.text}$입니다. ${Math.abs(v) < tol ? '넓이가 상쇄되어 이 파동은 함수에 들어 있지 않습니다.' : '넓이가 한쪽으로 쌓일수록 이 파동의 비중이 큽니다.'}`);
        return out;
      } },
  },
});
