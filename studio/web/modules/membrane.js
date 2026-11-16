'use strict';
/* 개념 모듈: 막의 진동(2차원 파동). 주제: 직사각형 막. */
defineConcept({
  id: 'membrane', ch: '12장', title: '막의 진동 (2차원 파동)',
  markup: String.raw`얇은 막의 작은 진동은 2차원 **파동방정식**을 따릅니다.

$$u_{tt} = c^2(u_{xx} + u_{yy})$$

가로 $a$, 세로 $b$인 직사각형 막의 가장자리가 고정되어 있으면 변수분리로 다음 모드를 얻습니다.

$$u_{mn} = (B_{mn}\cos\lambda_{mn}t + B_{mn}^*\sin\lambda_{mn}t)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b},\quad \lambda_{mn} = c\pi\sqrt{\frac{m^2}{a^2} + \frac{n^2}{b^2}}$$

$$B_{mn} = \frac{4}{ab}\int_{0}^{b}\int_{0}^{a} f(x,y)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}\,dx\,dy$$

현과 달리 $\lambda_{mn}$이 한 진동수의 정수배가 아니어서 막의 진동은 일반적으로 주기적이지 않습니다. 이 프로그램은 처음 모양을 $f(x)h(y)$로 두어 $B_{mn} = B_m B_n$으로 계산합니다(처음 속도 0).`,
  compute(cfg, R, { L, f }) {
    const b = positive(cfg, 'b', '막의 세로 길이 b', L), h = (() => { let c; try { c = compile(String(cfg.h).replace(/\by\b/g, 'x').replace(/\bb\b/g, 'L')); } catch (e) { throw new Error(`처음 모양 h(y): ${e.message}`); } const P = { ...cfg.params, L: b }; return y => c.fn(y, P); })();
    boundedOn(h, 0, b, '처음 모양 h(y)');
    R.membrane = { ...membraneModel(f, h, L, b, Math.max(1, Math.min(20, cfg.M)), R.wave.speed), h };
    R.membrane.tEnd = 4 * L / R.wave.speed;
  },
  panels: {
  membrane(ctx, w, h, C, cfg, R, ref) {
    const Mb = R.membrane, t = timeOf(Mb, cfg), [p, q] = stacked(w, h, C, .62), xr = [0, Mb.a], yb = [0, Mb.b];
    axes(ctx, p, xr, yb, C, { xTicks: piTicks(xr, Mb.a, Mb.a / 4), noXLabels: true });
    const W = 96, H = 64, off = document.createElement('canvas'); off.width = W; off.height = H;
    const c2 = off.getContext('2d'), img = c2.createImageData(W, H), field = new Float64Array(W * H);
    // 모드별 계수 C_mn(t)로 u(x, y) = Σ C_mn sin(mπx/a) sin(nπy/b)를 행렬처럼 계산합니다.
    Mb.sx ??= Array.from({ length: Mb.M + 1 }, (_, m) => Float64Array.from({ length: W }, (_, i) => Math.sin(m * PI * (i + .5) / W)));
    Mb.sy ??= Array.from({ length: Mb.M + 1 }, (_, n) => Float64Array.from({ length: H }, (_, j) => Math.sin(n * PI * (1 - (j + .5) / H))));
    for (const [m, n, B, l] of Mb.terms) { const cB = B * Math.cos(l * t), sx = Mb.sx[m], sy = Mb.sy[n]; for (let j = 0; j < H; j++) { const k = cB * sy[j]; for (let i = 0; i < W; i++) field[j * W + i] += k * sx[i]; } }
    for (let k = 0; k < W * H; k++) {
      const s = Math.max(-1, Math.min(1, field[k] / Mb.zmax)), rgb = s < 0 ? mix([246, 246, 246], [31, 95, 208], -s) : mix([246, 246, 246], [207, 74, 18], s);
      img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    ctx.drawImage(off, p.l, p.t, p.w, p.h);
    const cut = x => Mb.u(x, Mb.b / 2, t), cut0 = x => Mb.u(x, Mb.b / 2, 0);
    let top = 1e-9; for (let i = 0; i <= 60; i++) top = Math.max(top, Math.abs(cut0(i / 60 * Mb.a)));
    const yr2 = [-top * 1.3, top * 1.3], M2 = axes(ctx, q, xr, yr2, C, { xTicks: piTicks(xr, Mb.a, Mb.a / 4) });
    curve(ctx, cut0, q, xr, M2, C.muted, 1.5, [], [6, 5]); curve(ctx, cut, q, xr, M2, C.blue, 3);
    panelText(ctx, '아래: 가운데 줄(y = b/2)의 단면', q.l + q.w - 6, q.t + 2, C, 'right');
    return { title: `막의 진동  t = ${fmt(t, 3)} (위: 위에서 본 모양, 주황 위·파랑 아래)`, frame: { b: q, xr, yr: yr2 },
      legend: [['--blue', '<i>u</i>(<i>x</i>, <i>b</i>/2, <i>t</i>)'], ['--muted', '처음 단면', true]], probe: x => [['u(x, b/2)', cut(x)], ['처음', cut0(x)]] };
  },
  },
  summary(cfg, R) {
    const Mb = R.membrane, t = timeOf(Mb, cfg);
    return [['막의 진동', `가장 낮은 각진동수 ${m(`<i>λ</i><sub>11</sub> = ${fmt(Mb.base, 4)}`)}, 모드 ${Mb.M}×${Mb.M}개를 더했습니다. ${m('<i>λ</i><sub><i>mn</i></sub>')}이 정수배가 아니어서 처음 모양으로 정확히 돌아오지 않습니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]];
  },
  items: {
    membrane: { label: '막의 진동', auto: true,
      problem: (cfg, R, { Ls }) => `가로 $a = ${Ls}$, 세로 $b = ${prettyExpr(cfg.b)}$인 직사각형 막의 가장자리가 고정되어 있다. 처음 모양이 $f(x)h(y)$ ($h(y) = ${prettyExpr(cfg.h, cfg.params)}$), 처음 속도가 0이고 $c = ${prettyExpr(cfg.c)}$일 때 $u(x,y,t)$를 구하시오.`,
      solution(cfg, R) {
        const Mb = R.membrane, top = Mb.terms.slice().sort((p, q) => Math.abs(q[2]) - Math.abs(p[2])).slice(0, 4);
        return [`가장자리 고정 조건으로 모드는 $\\sin\\frac{m\\pi x}{a}\\sin\\frac{n\\pi y}{b}$이고 $\\lambda_{mn} = c\\pi\\sqrt{m^2/a^2 + n^2/b^2}$입니다. 처음 모양이 $f(x)h(y)$이므로 $B_{mn} = B_m B_n$(각각 반구간 사인 계수)입니다.`,
          `$$${top.map(([m0, n0, B, l]) => `B_{${m0}${n0}} \\approx ${fmt(B, 4)}\\ (\\lambda_{${m0}${n0}} \\approx ${fmt(l, 3)})`).join(',\\quad ')}$$`,
          '처음 속도가 0이므로 $B_{mn}^* = 0$이고 $u = \\sum\\sum B_{mn}\\cos\\lambda_{mn}t\\,\\sin\\frac{m\\pi x}{a}\\sin\\frac{n\\pi y}{b}$입니다.'];
      } },
  },
});
defineTopic({
  id: 'rectMembrane', eq: 'wave', domain: 'rect', look: true,
  role: () => '처음 모양의 x 방향 f(x), 0 < x < a (a = L)',
  name: () => ['12장', '직사각형 막의 진동'],
  uses: () => ['series', 'half', 'wave', 'membrane'], params: () => ({ halfMode: 'sine', family: 'sine', waveDomain: 'finite', waveEnds: 'fixed' }),
  fields: () => [{ k: 'c', type: 'text', label: '파동 속도 c' }, { k: 'b', type: 'text', label: '막의 세로 길이 b', hint: '가로 길이 a는 L입니다.' }, { k: 'h', type: 'text', label: '처음 모양의 y 방향 h(y), 0 < y < b', hint: '처음 모양은 f(x)·h(y)입니다. y와 b로 씁니다.' }],
  stages: cfg => [
    { id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = F(x)G(y)H(t)$로 놓고 가장자리 고정 조건을 쓰면 $F_m = \sin\frac{m\pi x}{a}$, $G_n = \sin\frac{n\pi y}{b}$, $\lambda_{mn} = c\pi\sqrt{\frac{m^2}{a^2} + \frac{n^2}{b^2}}$입니다 ($a = L$). 그래프는 $x$ 방향 고유함수입니다.` },
    { id: 'expand', title: '처음 모양의 전개', panel: lookPanel(cfg), look: true, md: String.raw`$f(x)h(y) = \sum_{m}\sum_{n} B_{mn}\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}$, $B_{mn}$은 $f$와 $h$의 사인 계수의 곱입니다. 그래프는 $x$ 방향 $f$의 전개입니다.` },
    { id: 'solve', title: '해', panel: 'membrane', fields: ['M'], md: String.raw`$u(x,y,t) = \sum_{m}\sum_{n} B_{mn}\cos(\lambda_{mn}t)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}$` },
  ],
});
