'use strict';
/* 개념 모듈: 구(Legendre 다항식). 주제: Fourier–Legendre 급수(11장), 구 안·밖의 전위(12장, 라플라스 방정식).
   고유함수 Pₙ(x)는 eigen.js의 종류 표에서 옵니다(구간 −1 < x < 1). 구에서는 x = cos φ(φ는 z축에서 잰 각)이고, 입력에 phi를 써도 됩니다. */
/** 반지름 방향 인자: 구 안이면 (r/R)ⁿ, 구 밖이면 (R/r)ⁿ⁺¹ (ρ = r/R). */
const sphereRadial = (n, rho, outside) => outside ? rho ** -(n + 1) : rho ** n;
defineConcept({
  id: 'sphere', ch: '12장', title: '구의 전위 (Legendre 다항식)',
  markup: String.raw`구면 좌표에서 $z$축을 중심으로 돌려도 같은(각 $\theta$에 따르지 않는) 해를 찾으면, 라플라스 방정식이 반지름 $r$과 $z$축에서 잰 각 $\phi$로 나뉩니다. $u = G(r)H(\phi)$, $x = \cos\phi$로 놓으면

$$r^2G'' + 2rG' - n(n+1)G = 0,\qquad (1 - x^2)H'' - 2xH' + n(n+1)H = 0$$

둘째 식이 **Legendre 방정식**이고, $x = \pm 1$(극)에서 유한한 해는 Legendre 다항식 $P_n(x)$입니다. 첫째 식의 해는 $r^n$과 $r^{-n-1}$입니다.

$$P_0 = 1,\quad P_1 = x,\quad P_2 = \tfrac{1}{2}(3x^2 - 1),\quad P_3 = \tfrac{1}{2}(5x^3 - 3x),\ \ldots$$

$P_n$은 $(-1, 1)$에서 서로 직교하므로 함수를 이들의 합으로 쓸 수 있습니다(Fourier–Legendre 급수).

$$f(x) = \sum_{n=0}^{\infty} A_nP_n(x),\quad A_n = \frac{2n+1}{2}\int_{-1}^{1} f(x)P_n(x)\,dx$$

반지름 $R$인 구면의 전위가 $f(\phi)$이면 구 안과 밖의 전위는 다음과 같습니다.

$$u(r,\phi) = \sum_{n=0}^{\infty} A_n\left(\frac{r}{R}\right)^{n}P_n(\cos\phi)\ \ (r < R),\qquad u(r,\phi) = \sum_{n=0}^{\infty} A_n\left(\frac{R}{r}\right)^{n+1}P_n(\cos\phi)\ \ (r > R)$$

> 구 중심의 전위 $A_0$은 구면 전위의 평균입니다. 구 밖에서는 높은 차수가 $(R/r)^{n+1}$로 빨리 줄어들어, 멀리서는 점전하처럼 $A_0R/r$만 남습니다.`,
  compute(cfg, R, { f, N }) {
    const fam = familyOf(cfg), outside = cfg.prob?.right === 'outside', c = eigenCoefficients(fam, f, 1, N);
    const u = (rho, w) => { let s = 0; for (let n = 0; n <= N; n++) s += c[n] * sphereRadial(n, rho, outside) * legendreP(n, w); return s; };
    let zmax = 1e-9; for (let i = 0; i <= 200; i++) { const w = -1 + i / 100; zmax = Math.max(zmax, Math.abs(u(1, w)), Math.abs(R.f(w))); }
    R.sphere = { fam, c, outside, u, zmax, rhos: outside ? [1, 1.25, 1.6, 2.5] : [1, .75, .5, .25] };
  },
  panels: {
    sphere(ctx, w, h, C, cfg, R) {
      const P = R.sphere, b = box(w, h, C), s = Math.min(b.h, b.w * .4), sq = { l: b.l, t: b.t + (b.h - s) / 2, w: s, h: s }, gap = 30 + 30 * C.scale;
      const prof = { l: b.l + s + gap, t: b.t, w: b.w - s - gap, h: b.h }, span = P.outside ? 2.6 : 1.05;
      if (!P.map) {   // z축을 지나는 단면: 가로 X = r sin φ, 세로 Z = r cos φ, x = cos φ = Z/r. 시간이 없으므로 한 번만 그립니다.
        const G = 110, off = document.createElement('canvas'); off.width = G; off.height = G;
        const c2 = off.getContext('2d'), img = c2.createImageData(G, G);
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
          const X = ((i + .5) / G * 2 - 1) * span, Z = (1 - (j + .5) / G * 2) * span, rho = Math.hypot(X, Z), k = 4 * (j * G + i);
          if (P.outside ? rho < 1 : rho > 1) { img.data[k] = img.data[k + 1] = img.data[k + 2] = 225; img.data[k + 3] = 255; continue; }
          const v = P.u(Math.max(rho, 1e-9), rho ? Z / rho : 1), z = Math.max(-1, Math.min(1, v / P.zmax));
          const rgb = z < 0 ? mix([246, 246, 246], [31, 95, 208], -z) : mix([246, 246, 246], [207, 74, 18], z);
          img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255;
        }
        c2.putImageData(img, 0, 0); P.map = off;
      }
      ctx.drawImage(P.map, sq.l, sq.t, s, s);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sq.l + s / 2, sq.t + s / 2, s / 2 / span, 0, 2 * PI); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sq.l + s / 2, sq.t); ctx.lineTo(sq.l + s / 2, sq.t + s); ctx.stroke(); ctx.setLineDash([]);
      panelText(ctx, 'z', sq.l + s / 2 + 6, sq.t + 2, C, 'left');
      const xr = rangeX([-1, 1], R), yr = rangeY([-P.zmax * 1.15, P.zmax * 1.15], R), M = axes(ctx, prof, xr, yr, C, {});
      const cols = [C.ink, C.hot, C.green, C.blue], vars = ['--ink', '--hot', '--green', '--blue'], rname = rho => rho === 1 ? '<i>R</i>' : `${fmt(rho, 3)}<i>R</i>`;
      curve(ctx, R.f, prof, xr, M, C.muted, 1.5, [], [6, 5]);
      P.rhos.forEach((rho, i) => curve(ctx, x => P.u(rho, x), prof, xr, M, cols[i], i ? 2 : 2.5));
      panelText(ctx, '오른쪽: 가로축 x = cos φ', prof.l + prof.w - 6, prof.t + 2, C, 'right');
      return { title: `구 ${P.outside ? '밖' : '안'}의 전위 u(r, φ) (왼쪽: z축을 지나는 단면, 주황 높음·파랑 낮음)`, frame: { b: prof, xr, yr },
        legend: [...P.rhos.map((rho, i) => [vars[i], `<i>r</i> = ${rname(rho)}`]), ['--muted', '구면 전위 f', true]],
        probe: x => [['f', R.f(x)], ...P.rhos.map(rho => [`u(${fmt(rho, 3)}R)`, P.u(rho, x)])] };
    },
  },
  summary(cfg, R) {
    const P = R.sphere, A0 = fmt(P.c[0], 4);
    return [['구의 전위', P.outside ? `멀리서는 높은 차수가 ${m('(<i>R</i>/<i>r</i>)<sup><i>n</i>+1</sup>')}로 먼저 사라져 ${m(`<i>u</i> ≈ <i>A</i><sub>0</sub><i>R</i>/<i>r</i>`)} (${m(`<i>A</i><sub>0</sub> = ${A0}`)})만 남습니다.`
      : `구 중심의 전위는 구면 전위의 평균 ${m(`<i>u</i>(0) = <i>A</i><sub>0</sub> = ${A0}`)}입니다. 안쪽으로 갈수록 ${m('(<i>r</i>/<i>R</i>)<sup><i>n</i></sup>')}로 높은 차수가 먼저 사라집니다.`]];
  },
  items: {
    sphere: { label: '구의 전위', auto: true,
      problem(cfg) {
        const out = cfg.prob?.right === 'outside';
        return `반지름 $R$인 구면의 전위가 $z$축에서 잰 각 $\\phi$에만 따르고, $x = \\cos\\phi$로 쓰면 ${fMarkup(cfg)}이다. 구 ${out ? '밖($r > R$)' : '안($r < R$)'}의 전위 $u(r,\\phi)$를 구하시오.`;
      },
      solution(cfg, R, { tol }) {
        const P = R.sphere, rad = P.outside ? String.raw`\left(\frac{R}{r}\right)^{n+1}` : String.raw`\left(\frac{r}{R}\right)^{n}`;
        return [String.raw`$u = G(r)H(\phi)$, $x = \cos\phi$로 놓으면 $H$는 Legendre 방정식 $(1 - x^2)H'' - 2xH' + n(n+1)H = 0$을 따르고 극에서 유한한 해는 $P_n(x)$입니다. $G$는 $r^2G'' + 2rG' - n(n+1)G = 0$에서 $r^n$, $r^{-n-1}$이고, ${P.outside ? '구 밖에서 유한하려면 $r^{-n-1}$' : '중심에서 유한하려면 $r^n$'}을 씁니다.`,
          ...eigenSteps(cfg, R, { fam: P.fam, what: '구면의 전위 $f$', name: 'A', tol }),
          `$$u(r,\\phi) = \\sum_{n=0}^{\\infty} A_n${rad}P_n(\\cos\\phi)$$`,
          P.outside ? `멀리서는 $u \\approx A_0R/r$ ($A_0 \\approx ${fmt(P.c[0], 4)}$)입니다.` : `구 중심의 전위는 $u(0) = A_0 \\approx ${fmt(P.c[0], 4)}$(구면 전위의 평균)입니다.`];
      } },
  },
});
const SPHERE_ROLE = '−1 < x < 1 (구에서는 x = cos φ, phi로 써도 됨)';
defineTopic({
  id: 'legendreSeries', eq: 'none', domain: 'sphere',
  role: () => `함수 f(x), ${SPHERE_ROLE}`,
  name: () => ['11장', 'Fourier–Legendre 급수'],
  uses: () => ['modes'], params: () => ({ family: 'legendre' }),
  stages: cfg => {
    const fam = familyOf(cfg);
    return [
      { id: 'basis', title: '고유함수 (Legendre 다항식)', panel: 'eigen', md: String.raw`Legendre 방정식 $${fam.ode}$의 해 중 $x = \pm 1$에서 유한한 것은 Legendre 다항식입니다. ${fam.kMd()} $(-1, 1)$에서 서로 직교합니다.` },
      { id: 'expand', title: 'Fourier–Legendre 전개', panel: 'modes', md: String.raw`$f(x) = \sum_{n=0}^{\infty} A_nP_n(x)$, $${coefTexOf(fam, 'A', 'f(x)')}$` },
    ];
  },
});
defineTopic({
  id: 'spherePotential', eq: 'laplace', domain: 'sphere', eqTex: String.raw`\nabla^2 u = 0`,
  ends: { right: [['inside', '구 안 (r < R)'], ['outside', '구 밖 (r > R)']] },
  note: () => '구면 r = R의 전위가 f (x = cos φ)',
  role: () => `구면의 전위 f(x), ${SPHERE_ROLE}`,
  name: p => ['12장', `구 ${p.right === 'outside' ? '밖' : '안'}의 전위 (Legendre 다항식)`],
  uses: () => ['modes', 'sphere'], params: () => ({ family: 'legendre' }),
  stages: cfg => {
    const fam = familyOf(cfg), out = cfg.prob.right === 'outside', rad = out ? String.raw`\left(\frac{R}{r}\right)^{n+1}` : String.raw`\left(\frac{r}{R}\right)^{n}`;
    return [
      { id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = G(r)H(\phi)$, $x = \cos\phi$로 놓으면 $r^2G'' + 2rG' - n(n+1)G = 0$, $${fam.ode.replace(/F/g, 'H')}$입니다. 극에서 유한한 $H_n = P_n(\cos\phi)$이고, ${out ? '구 밖에서 유한한' : '중심에서 유한한'} $G_n = ${out ? 'r^{-n-1}' : 'r^n'}$입니다.` },
      { id: 'expand', title: '구면 전위의 전개', panel: 'modes', md: String.raw`$f = \sum_{n=0}^{\infty} A_nP_n(x)$, $${coefTexOf(fam, 'A', 'f(x)')}$` },
      { id: 'solve', title: '해', panel: 'sphere', md: String.raw`$u(r,\phi) = \sum_{n=0}^{\infty} A_n${rad}P_n(\cos\phi)$. ${out ? '멀리서는 $A_0R/r$만 남습니다.' : '중심의 전위는 평균 $A_0$입니다.'}` },
    ];
  },
});
