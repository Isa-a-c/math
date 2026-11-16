'use strict';
/* 개념 모듈: 수렴과 도약(Gibbs 현상). 전개 단계에서 '수렴과 도약'을 고르면 씁니다. */
defineConcept({
  id: 'gibbs', ch: '11장', title: '수렴과 도약',
  markup: String.raw`> **정리.** 구분연속이고 각 점에서 한쪽 도함수를 갖는 주기함수의 Fourier 급수는 수렴합니다. 연속인 점에서 합은 $f(x)$입니다.

도약이 있는 점에서는 왼쪽·오른쪽 극한의 평균으로 수렴합니다.

$$\text{합} = \frac{f(x_0 - 0) + f(x_0 + 0)}{2}$$

도약 옆의 봉우리는 항을 늘려도 사라지지 않습니다. 폭은 좁아지지만 높이는 도약 크기의 약 9%로 남습니다. 이것이 **Gibbs 현상**입니다.`,
  panels: {
  gibbs(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, J = model.jumps[(cfg.jumpIndex ?? 1) - 1] ?? model.jumps[0], b = box(w, h, C);
    if (!J) { axes(ctx, b, [-1, 1], [-1, 1], C, { noXLabels: true }); panelText(ctx, '이 함수에는 도약이 없습니다.', b.l + b.w / 2, b.t + b.h / 2 - 8, C, 'center'); return { title: '도약점 확대', legend: [], frame: { b, xr: [-1, 1], yr: [-1, 1] }, probe: () => [] }; }
    const reach = model.L / PI, xr = rangeX([J.x - reach, J.x + reach], R), size = Math.abs(J.right - J.left), yr = rangeY([Math.min(J.left, J.right) - .25 * size, Math.max(J.left, J.right) + .25 * size], R);
    const M = axes(ctx, b, xr, yr, C, {});
    curve(ctx, model.f, b, xr, M, C.ink, 2.5, breaksOf(model, xr));
    if (ref) curve(ctx, x => partialSum(ref.R.series, ref.cfg.N, x), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => partialSum(model, cfg.N, x), b, xr, M, C.blue, 3);
    vline(ctx, M.X(J.x), b, C.hot); dot(ctx, M.X(J.x), M.Y((J.left + J.right) / 2), C.hot, C, 6);
    return { title: `도약점 x = ${piLabel(J.x, model.L)} 확대`, frame: { b, xr, yr }, legend: [['--ink', fx], ['--blue', `<i>S</i><sub>${cfg.N}</sub>`], ['--hot', '두 극한의 평균'], ...(ref ? [pinLabel(`<i>S</i><sub>${ref.cfg.N}</sub>`)] : [])],
      probe: x => [['f', model.f(x)], [`S${cfg.N}`, partialSum(model, cfg.N, x)]] };
  },
  },
  summary(cfg, R) {
    const model = R.series, J = model.jumps[0];
    return [['수렴과 도약', J ? `${m(`<i>x</i> = ${piLabel(J.x, model.L)}`)}에서 합은 평균 ${m(fmt((J.left + J.right) / 2, 3))}, ${m(`<i>S</i><sub>${cfg.N}</sub> = ${fmt(partialSum(model, cfg.N, J.x), 4)}`)}입니다. 봉우리 초과량은 도약의 ${m(`${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%`)}입니다.` : '도약이 없어 모든 점에서 f(x)로 수렴합니다.']];
  },
  items: {
    gibbs: { label: '도약점과 Gibbs 현상', auto: true,
      problem: (cfg, R, { model, half, J }) => J ? `${half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수의 ` : ''}도약점 $x = ${piLabel(J.x, model.L)}$에서 급수의 합을 구하고, $N = ${cfg.N}$일 때 도약점 옆 봉우리의 초과량을 구하시오.` : '이 함수의 급수가 모든 점에서 $f(x)$로 수렴하는 이유를 설명하시오.',
      solution: (cfg, R, { model, J }) => [J ? `$x = ${piLabel(J.x, model.L)}$에서 왼쪽 극한 ${fmt(J.left, 4)}, 오른쪽 극한 ${fmt(J.right, 4)}이므로 급수의 합은 평균 ${fmt((J.left + J.right) / 2, 4)}입니다. $N = ${cfg.N}$일 때 봉우리 초과량은 도약 크기의 ${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%이며, $N$을 늘려도 약 9%로 남습니다(Gibbs 현상).` : '함수가 연속이고 구분적으로 매끄러워 모든 점에서 $f(x)$로 수렴합니다.'] },
  },
});
