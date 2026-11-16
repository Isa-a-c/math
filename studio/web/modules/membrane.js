'use strict';
/* 개념 모듈: 막의 진동(2차원 파동). 주제: 직사각형 막(네 변마다 고정·자유).
   x 방향 고유함수는 x = 0, x = a 변의 조건, y 방향은 y = 0, y = b 변의 조건으로 eigen.js의 종류 표에서 고릅니다. */
/** 고유함수 종류의 교재 수식을 다른 첨자·변수·길이로 바꿉니다(예: sin(nπx/L) → sin(nπy/b)). */
const texIn = (s, i, v, E) => s.replace(/n\\pi/g, `${i}\\pi`).replace(/2n-1/g, `2${i}-1`).replace(/ x\}/g, ` ${v}}`).replace(/L\}/g, `${E}}`).replace(/\{L\}/g, `{${E}}`);
/** 막의 x 방향·y 방향 고유함수 종류입니다. */
const membraneFamilies = p => [familyFor(p.left, p.right), familyFor(p.bottom, p.top)];
/** λₘₙ의 교재 수식입니다. 네 변이 모두 고정이면 cπ√(m²/a² + n²/b²)입니다. */
function membraneLamTex(fx, fy) {
  if (fx.id === 'sine' && fy.id === 'sine') return String.raw`c\pi\sqrt{\frac{m^2}{a^2} + \frac{n^2}{b^2}}`;
  return String.raw`c\sqrt{\left(${texIn(fx.kTex, 'm', 'x', 'a')}\right)^2 + \left(${texIn(fy.kTex, 'n', 'y', 'b')}\right)^2}`;
}
const membraneTex = (fx, fy) => [texIn(fx.tex, 'm', 'x', 'a'), texIn(fy.tex, 'n', 'y', 'b')];
defineConcept({
  id: 'membrane', ch: '12장', title: '막의 진동 (2차원 파동)',
  markup: String.raw`얇은 막의 작은 진동은 2차원 **파동방정식**을 따릅니다.

$$u_{tt} = c^2(u_{xx} + u_{yy})$$

가로 $a$, 세로 $b$인 직사각형 막의 가장자리가 고정되어 있으면 변수분리로 다음 모드를 얻습니다.

$$u_{mn} = (B_{mn}\cos\lambda_{mn}t + B_{mn}^*\sin\lambda_{mn}t)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b},\quad \lambda_{mn} = c\pi\sqrt{\frac{m^2}{a^2} + \frac{n^2}{b^2}}$$

$$B_{mn} = \frac{4}{ab}\int_{0}^{b}\int_{0}^{a} f(x,y)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}\,dx\,dy$$

현과 달리 $\lambda_{mn}$이 한 진동수의 정수배가 아니어서 막의 진동은 일반적으로 주기적이지 않습니다. 이 프로그램은 처음 모양을 $f(x)h(y)$로 두어 $B_{mn} = B_m B_n$으로 계산합니다(처음 속도 0).

> 어떤 변이 자유로우면(그 변에서 기울기 $0$) 그 방향의 고유함수가 코사인이나 $\sin\frac{(2n-1)\pi x}{2a}$ 등으로 바뀌고, $\lambda_{mn} = c\sqrt{k_m^2 + \tilde k_n^2}$입니다.`,
  compute(cfg, R, { L, f }) {
    const b = positive(cfg, 'b', '막의 세로 길이 b', L), h = (() => { let c; try { c = compile(String(cfg.h).replace(/\by\b/g, 'x').replace(/\bb\b/g, 'L')); } catch (e) { throw new Error(`처음 모양 h(y): ${e.message}`); } const P = { ...cfg.params, L: b }; return y => c.fn(y, P); })();
    boundedOn(h, 0, b, '처음 모양 h(y)');
    const [fx, fy] = membraneFamilies(cfg.prob ?? { left: 'fixed', right: 'fixed', bottom: 'fixed', top: 'fixed' });
    R.membrane = { ...membraneModel(fx, fy, f, h, L, b, Math.max(1, Math.min(20, cfg.M)), R.wave.speed), h };
    R.membrane.tEnd = 4 * L / R.wave.speed;
  },
  panels: {
  membrane(ctx, w, h, C, cfg, R) {
    const Mb = R.membrane, t = timeOf(Mb, cfg), [p, q] = stacked(w, h, C, .62), xr = [0, Mb.a], yb = [0, Mb.b];
    axes(ctx, p, xr, yb, C, { xTicks: piTicks(xr, Mb.a, Mb.a / 4), noXLabels: true });
    const W = 96, H = 64, off = document.createElement('canvas'); off.width = W; off.height = H;
    const c2 = off.getContext('2d'), img = c2.createImageData(W, H), field = new Float64Array(W * H);
    // 모드별 계수 C_mn(t)로 u(x, y) = Σ C_mn φₘ(x) ψₙ(y)를 행렬처럼 계산합니다(고유함수 값은 한 번만 표로 만듭니다).
    Mb.sx ??= Array.from({ length: Mb.M + 1 }, (_, m) => m < Mb.fx.n0 ? null : Float64Array.from({ length: W }, (_, i) => Mb.fx.phi(m, (i + .5) / W * Mb.a, Mb.a)));
    Mb.sy ??= Array.from({ length: Mb.M + 1 }, (_, n) => n < Mb.fy.n0 ? null : Float64Array.from({ length: H }, (_, j) => Mb.fy.phi(n, (1 - (j + .5) / H) * Mb.b, Mb.b)));
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
    const Mb = R.membrane, t = timeOf(Mb, cfg), [m0, n0] = Mb.baseMode;
    return [['막의 진동', `가장 낮은 각진동수 ${m(`<i>λ</i><sub>${m0}${n0}</sub> = ${fmt(Mb.base, 4)}`)}, 모드 ${Mb.M}×${Mb.M}개를 더했습니다. ${m('<i>λ</i><sub><i>mn</i></sub>')}이 정수배가 아니어서 처음 모양으로 정확히 돌아오지 않습니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]];
  },
  items: {
    membrane: { label: '막의 진동', auto: true,
      problem(cfg, R, { Ls }) {
        const p = cfg.prob ?? {}, sides = [['x = 0', p.left], ['x = a', p.right], ['y = 0', p.bottom], ['y = b', p.top]];
        const free = sides.filter(([, v]) => v === 'free').map(([s]) => `$${s}$`), cond = !free.length ? '가장자리가 고정되어 있다'
          : free.length === 4 ? '가장자리가 모두 자유롭게 움직인다(기울기 0)' : `${free.join(', ')} 변은 자유롭게 움직이고(기울기 0) 나머지 변은 고정되어 있다`;
        return `가로 $a = ${Ls}$, 세로 $b = ${prettyExpr(cfg.b)}$인 직사각형 막의 ${cond}. 처음 모양이 $f(x)h(y)$ ($h(y) = ${prettyExpr(cfg.h, cfg.params)}$), 처음 속도가 0이고 $c = ${prettyExpr(cfg.c)}$일 때 $u(x,y,t)$를 구하시오.`;
      },
      solution(cfg, R) {
        const Mb = R.membrane, top = Mb.terms.slice().sort((p, q) => Math.abs(q[2]) - Math.abs(p[2])).slice(0, 4), [tx, ty] = membraneTex(Mb.fx, Mb.fy), plain = Mb.fx.id === 'sine' && Mb.fy.id === 'sine';
        return [`변의 조건으로 모드는 $${tx}${ty}$이고 $\\lambda_{mn} = ${membraneLamTex(Mb.fx, Mb.fy)}$입니다. 처음 모양이 $f(x)h(y)$이므로 $B_{mn} = B_m B_n$(${plain ? '각각 반구간 사인 계수' : `$f$를 $x$ 방향 고유함수(${Mb.fx.title.replace(/x = L/g, 'x = a')})로, $h$를 $y$ 방향 고유함수로 전개한 계수`})입니다.`,
          `$$${top.map(([m0, n0, B, l]) => `B_{${m0}${n0}} \\approx ${fmt(B, 4)}\\ (\\lambda_{${m0}${n0}} \\approx ${fmt(l, 3)})`).join(',\\quad ')}$$`,
          `처음 속도가 0이므로 $B_{mn}^* = 0$이고 $u = \\sum_m\\sum_n B_{mn}\\cos\\lambda_{mn}t\\,${tx}${ty}$입니다.`];
      } },
  },
});
const MEMBRANE_SIDES = [['fixed', '고정'], ['free', '자유']];
defineTopic({
  id: 'rectMembrane', eq: 'wave', domain: 'rect', look: plainEnds, mixed: true,
  ends: { left: MEMBRANE_SIDES, right: MEMBRANE_SIDES, bottom: MEMBRANE_SIDES, top: MEMBRANE_SIDES },
  role: () => '처음 모양의 x 방향 f(x), 0 < x < a (a = L)',
  name: p => ['left', 'right', 'bottom', 'top'].every(k => p[k] === 'fixed') ? ['12장', '직사각형 막의 진동'] : [null, '직사각형 막의 진동 (자유로운 변)'],
  uses: p => plainEnds(p) ? ['series', 'half', 'wave', 'membrane'] : ['modes', 'wave', 'membrane'],
  params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine', family: familyFor(p.left, p.right).id, waveDomain: 'finite', waveEnds: plainEnds(p) ? p.left : 'mixed' }),
  fields: () => [{ k: 'c', type: 'text', label: '파동 속도 c' }, { k: 'b', type: 'text', label: '막의 세로 길이 b', hint: '가로 길이 a는 L입니다.' }, { k: 'h', type: 'text', label: '처음 모양의 y 방향 h(y), 0 < y < b', hint: '처음 모양은 f(x)·h(y)입니다. y와 b로 씁니다.' }],
  stages: cfg => {
    const p = cfg.prob, [fx, fy] = membraneFamilies(p), [tx, ty] = membraneTex(fx, fy), plain = plainEnds(p), allFixed = fx.id === 'sine' && fy.id === 'sine';
    return [
      { id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = F(x)G(y)H(t)$로 놓고 ${allFixed ? '가장자리 고정 조건' : '변의 조건'}을 쓰면 $F_m = ${tx}$, $G_n = ${ty}$, $\lambda_{mn} = ${membraneLamTex(fx, fy)}$입니다 ($a = L$). 그래프는 $x$ 방향 고유함수입니다.` },
      { id: 'expand', title: '처음 모양의 전개', panel: plain ? lookPanel(cfg) : 'modes', look: plain, md: String.raw`$f(x)h(y) = \sum_{m}\sum_{n} B_{mn}${tx}${ty}$, $B_{mn}$은 $f$와 $h$의 ${allFixed ? '사인 ' : ''}계수의 곱입니다. 그래프는 $x$ 방향 $f$의 전개입니다.` },
      { id: 'solve', title: '해', panel: 'membrane', fields: ['M'], md: String.raw`$u(x,y,t) = \sum_{m}\sum_{n} B_{mn}\cos(\lambda_{mn}t)${tx}${ty}$` },
    ];
  },
});
