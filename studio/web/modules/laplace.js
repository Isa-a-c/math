'use strict';
/* 개념 모듈: 정상 상태 온도(라플라스 방정식). 주제: 직사각형 판(세 변의 조건 + 위쪽 변의 온도 f(x)).
   x 방향 고유함수는 eigen.js의 종류 표(x = 0 변, x = a 변의 조건)에서 오고, y 방향은 아래 변의 조건이 정합니다. */
/** y 방향 해 Gₙ(y)/Gₙ(b): 아래 변 온도 0이면 sinh, 단열이면 cosh(k = 0이면 y/b 또는 1). 큰 k에서도 넘치지 않게 씁니다. */
const laplaceY = (k, y, b, bottom) => k === 0 ? (bottom === 'fixed' ? y / b : 1)
  : Math.exp(k * (y - b)) * (bottom === 'fixed' ? (1 - Math.exp(-2 * k * y)) / (1 - Math.exp(-2 * k * b)) : (1 + Math.exp(-2 * k * y)) / (1 + Math.exp(-2 * k * b)));
const SIDE_HEAT = { fixed: ['온도가 0이고', '온도가 0이다'], free: ['단열되어 있고', '단열되어 있다'] };
defineConcept({
  id: 'laplace', ch: '12장', title: '정상 상태 온도 (라플라스 방정식)',
  markup: String.raw`시간이 오래 지나 온도가 더 변하지 않으면 열방정식의 $u_t$가 $0$이 되어 **라플라스 방정식**이 남습니다.

$$u_{xx} + u_{yy} = 0$$

가로 $a$, 세로 $b$인 판의 세 변이 온도 $0$이고 위쪽 변 $y = b$의 온도가 $f(x)$이면, $u = F(x)G(y)$로 변수분리해 $F_n = \sin\frac{n\pi x}{a}$, $G_n = \sinh\frac{n\pi y}{a}$를 얻습니다(Dirichlet 문제).

$$u(x,y) = \sum_{n=1}^{\infty} A_n\sin\frac{n\pi x}{a}\sinh\frac{n\pi y}{a},\quad A_n = \frac{2}{a\sinh(n\pi b/a)}\int_0^a f(x)\sin\frac{n\pi x}{a}\,dx$$

> 위쪽 변의 온도를 $x$ 방향 고유함수로 전개하고, 각 항이 아래로 갈수록 $\sinh$ 꼴로 줄어듭니다. 높은 차수일수록 빨리 줄어들어 판 안쪽의 온도는 매끈합니다. 옆 변이 단열이면 $x$ 방향 고유함수가 코사인 등으로, 아래 변이 단열이면 $\sinh$가 $\cosh$로 바뀝니다.`,
  compute(cfg, R, { L, f, N }) {
    const b = positive(cfg, 'b', '세로 길이 b', L), fam = familyOf(cfg), bottom = cfg.prob.bottom, c = eigenCoefficients(fam, f, L, N);
    const u = (x, y) => { let s = 0; for (let n = fam.n0; n <= N; n++) s += c[n] * fam.phi(n, x, L) * laplaceY(fam.k(n, L), y, b, bottom); return s; };
    let zmax = 1e-9; for (let i = 0; i <= 200; i++) zmax = Math.max(zmax, Math.abs(u(i / 200 * L, b)), Math.abs(R.f(i / 200 * L)));
    R.laplace = { fam, c, a: L, b, bottom, u, zmax, top: x => eigenSum(fam, c, L, N, x) };
  },
  panels: {
    laplace(ctx, w, h, C, cfg, R) {
      const P = R.laplace, [p, q] = stacked(w, h, C, .58), xr = [0, P.a], yb = [0, P.b];
      axes(ctx, p, xr, yb, C, { xTicks: piTicks(xr, P.a, P.a / 4), noXLabels: true });
      if (!P.map) {   // 판의 온도: 위에서 본 모양(주황 높음, 파랑 낮음). 시간이 없으므로 한 번만 그립니다.
        const W = 120, H = 80, off = document.createElement('canvas'); off.width = W; off.height = H;
        const c2 = off.getContext('2d'), img = c2.createImageData(W, H);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const v = P.u((i + .5) / W * P.a, (1 - (j + .5) / H) * P.b), s = Math.max(-1, Math.min(1, v / P.zmax)), k = 4 * (j * W + i);
          const rgb = s < 0 ? mix([246, 246, 246], [31, 95, 208], -s) : mix([246, 246, 246], [207, 74, 18], s);
          img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255;
        }
        c2.putImageData(img, 0, 0); P.map = off;
      }
      ctx.drawImage(P.map, p.l, p.t, p.w, p.h);
      const cuts = [[1, C.ink, '<i>y</i> = <i>b</i>'], [.75, C.hot, '<i>y</i> = 3<i>b</i>/4'], [.5, C.green, '<i>y</i> = <i>b</i>/2'], [.25, C.blue, '<i>y</i> = <i>b</i>/4']];
      const yr = rangeY([-P.zmax * 1.15, P.zmax * 1.15], R), M = axes(ctx, q, rangeX(xr, R), yr, C, { xTicks: piTicks(xr, P.a, P.a / 4) });
      curve(ctx, R.f, q, xr, M, C.muted, 1.5, [], [6, 5]);
      for (const [s, col] of cuts) curve(ctx, x => P.u(x, s * P.b), q, xr, M, col, s === 1 ? 2.5 : 2);
      panelText(ctx, '아래: 가로줄마다의 온도', q.l + q.w - 6, q.t + 2, C, 'right');
      return { title: `정상 상태 온도 u(x, y) (위: 판을 위에서 본 모양, 주황 높음·파랑 낮음)`, frame: { b: q, xr, yr },
        legend: [...cuts.map(([, , t], i) => [['--ink', '--hot', '--green', '--blue'][i], `<i>u</i>(<i>x</i>, ${t.replace(/<i>y<\/i> = /, '')})`]), ['--muted', '위쪽 변 f(x)', true]],
        probe: x => [['f', R.f(x)], ...cuts.map(([s]) => [`u(x, ${s === 1 ? 'b' : s === .5 ? 'b/2' : s === .75 ? '3b/4' : 'b/4'})`, P.u(x, s * P.b)])] };
    },
  },
  summary(cfg, R) {
    const P = R.laplace;
    return [['정상 상태 온도', `판 가운데 온도 ${m(`<i>u</i>(<i>a</i>/2, <i>b</i>/2) = ${fmt(P.u(P.a / 2, P.b / 2), 4)}`)}. 고유함수 ${m(P.fam.plain)}의 ${m('n')}번째 항은 아래로 갈수록 ${m(P.bottom === 'fixed' ? 'sinh(kₙy)/sinh(kₙb)' : 'cosh(kₙy)/cosh(kₙb)')}배로 줄어들어, 높은 차수가 먼저 사라집니다.`]];
  },
  items: {
    laplace: { label: '정상 상태 온도', auto: true,
      problem(cfg, R, { Ls }) {
        const p = cfg.prob, sides = [['x = 0', p.left], ['x = a', p.right], ['y = 0', p.bottom]];
        const cond = sides.every(([, v]) => v === sides[0][1]) ? `나머지 세 변은 ${SIDE_HEAT[p.left][1]}` : sides.map(([s, v], i) => `$${s}$ 변은 ${SIDE_HEAT[v][i < 2 ? 0 : 1]}`).join(', ');
        return `가로 $a = ${Ls}$, 세로 $b = ${prettyExpr(cfg.b)}$인 직사각형 판의 위쪽 변 $y = b$의 온도가 ${fMarkup(cfg)}이고, ${cond}. 정상 상태 온도 $u(x,y)$를 구하시오.`;
      },
      solution(cfg, R, { tol }) {
        const P = R.laplace, fam = P.fam, G = P.bottom === 'fixed' ? '\\sinh' : '\\cosh';
        return [`$u = F(x)G(y)$로 놓으면 $F'' + k^2F = 0$, $G'' - k^2G = 0$입니다. $x$ 방향 경계조건(${fam.title.replace(/x = L/g, 'x = a')})에서 고유함수와 고유값이 정해지고, 아래 변 조건 ${P.bottom === 'fixed' ? '$u(x,0) = 0$' : '$u_y(x,0) = 0$'}에서 $G_n = ${G} k_{n}y$입니다.`,
          ...eigenSteps(cfg, R, { fam, what: '위쪽 변의 온도 $f(x)$', tol }),
          `$$u(x,y) = \\sum_{n} c_n${fam.tex}\\,\\frac{${G} k_{n}y}{${G} k_{n}b}$$`,
          `판 가운데 온도는 $u(a/2, b/2) \\approx ${fmt(P.u(P.a / 2, P.b / 2), 4)}$입니다.`];
      } },
  },
});
const HEAT_SIDES = [['fixed', '온도 0'], ['free', '단열']];
defineTopic({
  id: 'plate', eq: 'laplace', domain: 'rect', look: p => p.left === p.right, mixed: true,
  ends: { left: HEAT_SIDES, right: HEAT_SIDES, bottom: HEAT_SIDES },
  note: () => '위쪽 변 y = b: 온도 f(x)',
  role: () => '위쪽 변의 온도 f(x) = u(x, b), 0 < x < a (a = L)',
  name: p => p.left === 'fixed' && p.right === 'fixed' && p.bottom === 'fixed' ? ['12장', '직사각형 판의 정상 상태 온도 (Dirichlet 문제)'] : [null, '직사각형 판의 정상 상태 온도 (단열된 변)'],
  uses: p => p.left === p.right ? ['series', 'half', 'laplace'] : ['modes', 'laplace'],
  params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine', family: familyFor(p.left, p.right).id }),
  fields: () => [{ k: 'b', type: 'text', label: '세로 길이 b', hint: '가로 길이 a는 L입니다.' }],
  stages: cfg => {
    const p = cfg.prob, fam = familyOf(cfg), mixed = p.left !== p.right, G = p.bottom === 'fixed' ? '\\sinh' : '\\cosh';
    const side = (x, s) => s === 'fixed' ? `u(${x},y) = 0` : `u_x(${x},y) = 0`;
    return [
      { id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = F(x)G(y)$로 놓으면 $F'' + k^2F = 0$, $G'' - k^2G = 0$입니다. 옆 변 조건 $${side('0', p.left)},\ ${side('a', p.right)}$에서 $k_n = ${fam.kTex.replace(/L/g, 'a')}$, $F_n = ${fam.tex.replace(/L/g, 'a')}$이고, 아래 변 조건 $${p.bottom === 'fixed' ? 'u(x,0) = 0' : 'u_y(x,0) = 0'}$에서 $G_n = ${G} k_{n}y$입니다.` },
      { id: 'expand', title: '위쪽 변 온도의 전개', panel: mixed ? 'modes' : lookPanel(cfg), look: !mixed, md: String.raw`$f(x) = u(x, b) = \sum_{n} c_n${fam.tex.replace(/L/g, 'a')}$, $c_n = \frac{2}{a}\int_0^a f(x)${fam.tex.replace(/L/g, 'a')}\,dx$` },
      { id: 'solve', title: '해', panel: 'laplace', md: String.raw`$u(x,y) = \sum_{n} c_n${fam.tex.replace(/L/g, 'a')}\,\frac{${G} k_{n}y}{${G} k_{n}b}$. 높은 차수일수록 아래로 빨리 줄어듭니다.` },
    ];
  },
});
