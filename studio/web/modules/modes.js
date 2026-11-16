'use strict';
/* 개념 모듈: 고유함수 전개(일반화된 Fourier 급수). 양 끝 조건이 다를 때(혼합 경계) 전개 단계가 이 모듈을 씁니다.
   고유함수 종류는 eigen.js의 FAMILIES에서 오므로, 새 종류를 더해도 이 파일은 그대로입니다. */
defineConcept({
  id: 'modes', ch: '11장', title: '고유함수 전개 (일반화된 Fourier 급수)',
  markup: String.raw`양 끝 조건이 다르면(한쪽은 값이 $0$, 다른 쪽은 기울기가 $0$) 고유값 문제 $F'' + k^2F = 0$의 해가 $\sin\frac{(2n-1)\pi x}{2L}$ 또는 $\cos\frac{(2n-1)\pi x}{2L}$가 됩니다. 이 고유함수들도 $(0, L)$에서 서로 직교하므로 Fourier 급수와 같은 방법으로 계수를 구합니다(Sturm–Liouville 문제, 일반화된 Fourier 급수).

$$f(x) = \sum_{n=1}^{\infty} c_n\varphi_n(x),\quad c_n = \frac{\int_0^L f\varphi_n\,dx}{\int_0^L \varphi_n^2\,dx} = \frac{2}{L}\int_0^L f(x)\varphi_n(x)\,dx$$

끝이 주위로 열을 내보내면($x = L$에서 $u_x + hu = 0$, $x = 0$에서 $u_x - hu = 0$) $k_n$은 $\tan kL = -k/h$ 같은 방정식의 근이 되고, 원판(반지름 방향)에서는 Bessel 함수 $J_m(\alpha_n r/R)$가 가중치 $r$로 직교합니다. 계수는 언제나 $c_n = \int w f\varphi_n / \int w\varphi_n^2$입니다.

> 경계조건이 고유함수를 정하고, 고유함수가 전개의 모양을 정합니다. 반구간 사인·코사인 전개는 양 끝 조건이 같은 경우입니다.`,
  compute(cfg, R, { L, f, N }) {
    const fam = familyOf(cfg);
    if (fam.h) positive(cfg, 'hRobin', '열 방출 계수 h', L);
    const c = eigenCoefficients(fam, f, L, Math.max(N, 30));
    const span = spanOf(fam, L); let err = 0; const q = 800, h = (span[1] - span[0]) / q;
    for (let i = 0; i < q; i++) { const x = span[0] + (i + .5) * h; err += (f(x) - eigenSum(fam, c, L, N, x)) ** 2 * h; }
    R.modes = { fam, c, L, span, err, partial: x => eigenSum(fam, c, L, N, x) };
  },
  panels: {
    modes(ctx, w, h, C, cfg, R) {
      const Md = R.modes, fam = Md.fam, L = Md.L, [s0, s1] = Md.span, [p, q] = stacked(w, h, C, .62), xr = rangeX(Md.span, R);
      let lo = 0, hi = 0; for (let i = 0; i <= 200; i++) { const x = s0 + i / 200 * (s1 - s0), a = R.f(x), b = Md.partial(x); lo = Math.min(lo, a, b); hi = Math.max(hi, a, b); }
      const pad = Math.max(.1, .15 * (hi - lo)), yr = rangeY([lo - pad, hi + pad], R), M = axes(ctx, p, xr, yr, C, fam.span ? {} : { xTicks: piTicks(xr, L, L / 4) });
      curve(ctx, R.f, p, xr, M, C.ink, 2.5);
      curve(ctx, Md.partial, p, xr, M, C.blue, 3);
      bars(ctx, q, C, [[C.blue, n => Md.c[n]]], cfg.N);
      panelText(ctx, '아래: 계수 cₙ', q.l + q.w - 6, q.t + 2, C, 'right');
      return { title: `고유함수 ${fam.plain}로 전개 (${fam.title})`, frame: { b: p, xr, yr },
        legend: [['--ink', '<i>f</i>(<i>x</i>)'], ['--blue', `<i>S</i><sub>${cfg.N}</sub> = Σ <i>c<sub>n</sub></i>φ<sub><i>n</i></sub>`]],
        probe: x => [['f', R.f(x)], [`S${cfg.N}`, Md.partial(x)]] };
    },
  },
  summary(cfg, R) {
    const Md = R.modes, first = [Md.fam.n0, Md.fam.n0 + 1, Md.fam.n0 + 2].map(n => `${Md.fam.span ? "A" : "c"}${n} ≈ ${fmt(Md.c[n], 4)}`).join(', ');
    return [['고유함수 전개', `고유함수 ${m(Md.fam.plain)}(${Md.fam.title})로 전개했습니다. ${m(first)}, 항 ${cfg.N}개의 제곱오차 ${m(`∫(<i>f</i> − <i>S<sub>N</sub></i>)² = ${errText(Md.err)}`)}`]];
  },
  items: {
    modes: { label: '고유함수 전개', auto: true,
      problem(cfg, R, { Ls }) {
        const fam = familyOf(cfg);
        if (fam.span) return `${fMarkup(cfg)}를 $-1 < x < 1$에서 Legendre 다항식 $P_n(x)$ ($n = 0, 1, 2, \\ldots$)로 전개하시오(Fourier–Legendre 급수).`;
        return fam.radial ? `${fMarkup(cfg)}를 $0 \\le r < R$ ($R = ${Ls}$)에서 고유함수 $${fam.tex}$로 전개하시오(Fourier–Bessel 급수${fam.m ? `, 처음 모양 $f(r)\\cos ${fam.m}\\theta$의 반지름 방향` : ''}).`
          : `${fMarkup(cfg)}를 $0 < x < L$ ($L = ${Ls}$)에서 고유함수 $${fam.tex}$ ($n = ${fam.n0}, ${fam.n0 + 1}, \\ldots$)로 전개하시오.${fam.h ? ` (고유함수는 ${fam.ends.map((e, i) => e === 'robin' ? `$x = ${i ? 'L' : '0'}$에서 $f' ${i ? '+' : '-'} hf = 0$` : '').filter(Boolean).join(', ')}, $h = ${prettyExpr(cfg.hRobin)}$인 조건에서 나온다.)` : ''}`;
      },
      solution: (cfg, R, { tol }) => { const fam = familyOf(cfg); return eigenSteps(cfg, R, { fam, tol, fnTex: fam.radial ? 'f(r)' : 'f(x)', name: fam.span ? 'A' : 'c' }); } },
  },
});
