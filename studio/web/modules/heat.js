'use strict';
/* 개념 모듈: 막대의 열전도(열방정식). 주제: 구간의 막대(온도 고정·단열), 무한히 긴 막대(열핵). */
defineConcept({
  id: 'heat', ch: '12장', title: '막대의 열전도 (열방정식)',
  markup: String.raw`막대의 온도는 **열방정식**을 따릅니다. $c^2$은 열확산계수입니다.

$$u_t = c^2 u_{xx}$$

양 끝 온도가 0이면 공간 쪽은 현과 같고 시간 쪽은 지수 감쇠입니다. 감쇠율 $\lambda_n^2$이 $n^2$에 비례하므로 고주파가 먼저 사라집니다.

$$u(x,t) = \sum_{n=1}^{\infty} B_n\sin\frac{n\pi x}{L}\,e^{-\lambda_n^2 t},\quad \lambda_n = \frac{cn\pi}{L}$$

> **양 끝 온도가 고정일 때.** 양 끝 온도가 $U_1$, $U_2$이면 정상 상태 $U(x) = U_1 + (U_2 - U_1)x/L$을 먼저 구하고, 나머지 $u - U$는 초기 온도 $f - U$로 같은 식을 씁니다.

양 끝이 단열이면 코사인 급수가 나오고, 온도는 처음의 평균 $A_0$으로 갑니다.

$$u(x,t) = A_0 + \sum_{n=1}^{\infty} A_n\cos\frac{n\pi x}{L}\,e^{-\lambda_n^2 t}$$

막대가 무한히 길면 해는 초기 온도와 **열핵**의 합성곱입니다. 열은 시간의 제곱근에 비례해 퍼지고 전체 열량은 그대로입니다.

$$u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp\left(-\frac{(x-v)^2}{4c^2 t}\right)dv$$`,
  compute(cfg, R, { L, f, N, X }) {
    const alpha = positive(cfg, 'alpha', '열확산계수 c²', L), tSet = optionalPositive(cfg, 'tEndHeat', '막대 끝 시간', L);
    if (cfg.heatDomain === 'finite') {
      const fam = familyOf(cfg);
      if (fam.h) positive(cfg, 'hRobin', '열 방출 계수 h', L);
      const left = fam.ends[0] === 'fixed' ? real(cfg, 'left', '왼쪽 끝 온도') : 0, right = fam.ends[1] === 'fixed' ? real(cfg, 'right', '오른쪽 끝 온도') : 0;
      const model = modalHeat(fam, f, L, N, alpha, left, right), tEnd = tSet ?? 3 / model.rate(1);
      R.heat = { ...model, L, alpha, left, right, tEnd, range: [0, L], yr: scanRange(model.u, [0, L], [0, tEnd / 20, tEnd]) };
    } else {
      const tEnd = tSet ?? X * X / (18 * alpha), model = buildPde('heat', 'infinite', f, () => 0, { alpha, X, tEnd, speed: 1 });
      let total = 0; const q = 4000, span = X + 6 * Math.sqrt(alpha * tEnd), h = 2 * span / q;
      for (let i = 0; i < q; i++) total += f(-span + (i + .5) * h) * h;
      R.heat = { ...model, X, alpha, tEnd, total, yr: scanRange(model.u, [-X, X], [0]) };
    }
  },
  panels: {
  heat(ctx, w, h, C, cfg, R, ref) {
    const H = R.heat, t = timeOf(H, cfg), finite = cfg.heatDomain === 'finite', refH = ref?.R.heat;
    if (!finite) {
      const b = box(w, h, C), xr = rangeX([-H.X, H.X], R), yr = rangeY(H.yr, R), M = axes(ctx, b, xr, yr, C, {});
      curve(ctx, R.f, b, xr, M, C.muted, 1.5, [], [6, 5]);
      if (refH) curve(ctx, x => refH.u(x, timeOf(refH, cfg)), b, xr, M, C.green, 2.5, [], [7, 5], 2);
      curve(ctx, x => H.u(x, t), b, xr, M, C.hot, 3, [], null, S.playing ? 4 : 2);
      return { title: `무한 막대  t = ${fmt(t, 3)}`, frame: { b, xr, yr }, legend: [['--hot', uxt], ['--muted', '처음 온도', true], ...(refH ? [pinLabel(uxt)] : [])], probe: x => [['u', H.u(x, t)], ['처음', R.f(x)]] };
    }
    const [p, q] = stacked(w, h, C, .55), xr = rangeX([0, H.L], R), yr = rangeY(H.yr, R), M = axes(ctx, p, xr, yr, C, { xTicks: piTicks(xr, H.L, H.L / 4), noXLabels: true });
    curve(ctx, R.f, p, xr, M, C.muted, 1.5, [], [6, 5]);
    const end = H.limit;
    curve(ctx, end, p, xr, M, C.green, 2, [], [3, 4]);
    if (refH) curve(ctx, x => refH.u(x, timeOf(refH, cfg)), p, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => H.u(x, t), p, xr, M, C.hot, 3);
    spacetime(ctx, q, C, H, t);
    return { title: `${H.family.radial ? '원판의 온도 (반지름 방향)' : '막대의 온도'}  t = ${fmt(t, 3)} (아래: 위치·시간별 온도)`, frame: { b: p, xr, yr },
      legend: [['--hot', uxt], ['--muted', '처음 온도', true], ['--green', H.limitName, true], ...(refH ? [pinLabel(uxt)] : [])],
      probe: x => [['u', H.u(x, t)], [H.limitName, end(x)]] };
  },
  },
  summary(cfg, R) {
    const H = R.heat, t = timeOf(H, cfg);
    if (cfg.heatDomain === 'finite') {
      const [A, B] = H.steadyAB, radial = H.family.radial;
      const goal = H.mean !== undefined ? `평균 온도 ${m(fmt(H.mean, 4))}로 고르게 됩니다.` : Math.abs(B) < 1e-12 ? `${radial ? '원판' : '막대'} 전체가 ${m(fmt(A, 3))}으로 고르게 됩니다.` : `정상 상태 ${m(`<i>U</i>(<i>x</i>) = ${fmt(A, 4)} ${B < 0 ? '−' : '+'} ${fmt(Math.abs(B), 4)}<i>x</i>`)}로 갑니다.`;
      return [[radial ? '원판의 열전도' : '막대의 열전도', `${goal} 첫 모드 감쇠율 ${m(`<i>λ</i><sub>1</sub>² = ${fmt(H.rate(1), 4)}`)}, ${radial ? '중심' : '가운데'} 온도 ${m(fmt(H.u(radial ? 0 : H.L / 2, t), 4))} (${m(`<i>t</i> = ${fmt(t, 3)}`)}).`]];
    }
    let peak = -Infinity; for (let i = 0; i <= 200; i++) peak = Math.max(peak, H.u(-H.X + i / 100 * H.X, t));
    return [['무한 막대', `퍼짐의 표준편차 ${m(`√(2<i>c</i>²<i>t</i>) = ${fmt(Math.sqrt(2 * H.alpha * t), 3)}`)}, 최고 온도 ${m(fmt(peak, 4))}, 전체 열량 ${m(fmt(H.total, 4))}은 그대로입니다.`]];
  },
  items: {
    heat: { label: '막대의 해', auto: true,
      problem(cfg, R, { Ls }) {
        const a = prettyExpr(cfg.alpha);
        if (cfg.heatDomain === 'infinite') return `무한히 긴 막대($c^2 = ${a}$)의 초기 온도가 $f(x)$일 때 $u(x,t)$를 적분 꼴로 쓰고, 시간에 따른 변화를 설명하시오.`;
        const fam = familyOf(cfg), h = prettyExpr(cfg.hRobin), U = i => prettyExpr(i ? cfg.right : cfg.left), goal = fam.n0 === 0 ? '도달하는 온도' : '정상 상태';
        if (fam.radial) return `반지름 $R = ${Ls}$, $c^2 = ${a}$인 원판의 가장자리가 ${fam.ends[1] === 'fixed' ? `온도 $U = ${U(1)}$로 유지된다` : '단열되어 있다'}. 초기 온도가 중심으로부터의 거리 $r$에만 따르는 $f(r)$일 때 $u(r,t)$와 ${goal}를 구하시오.`;
        const say = (e, i, end) => ({ fixed: [`온도를 $U_${i + 1} = ${U(i)}$로 유지하고`, `온도를 $U_${i + 1} = ${U(i)}$로 유지한다`], free: ['단열되어 있고', '단열되어 있다'],
          robin: [`주위(온도 0)로 열을 내보내고($u_x + hu = 0$, $h = ${h}$)`, `주위(온도 0)로 열을 내보낸다($u_x + hu = 0$, $h = ${h}$)`] })[e][end ? 1 : 0];
        const [l, r] = fam.ends, cond = l === r ? (l === 'fixed' ? `양 끝 온도를 $U_1 = ${U(0)}$, $U_2 = ${U(1)}$로 유지한다` : '양 끝이 단열되어 있다') : `$x = 0$ 끝은 ${say(l, 0)} $x = L$ 끝은 ${say(r, 1, true)}`;
        return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 ${cond}. 초기 온도가 $f(x)$일 때 $u(x,t)$와 ${goal}를 구하시오.`;
      },
      solution(cfg, R, { tol }) {
        const H = R.heat;
        if (cfg.heatDomain !== 'finite') return [String.raw`열핵과의 합성곱 $u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp(-\frac{(x-v)^2}{4c^2 t})\,dv$` + `에 $c^2 = ${fmt(H.alpha, 4)}$를 넣습니다. 열은 표준편차 $\\sqrt{2c^2 t}$로 퍼지고, 전체 열량 ${fmt(H.total, 4)}은 변하지 않습니다.`];
        const fam = H.family, v = fam.radial ? 'r' : 'x', [A0, B0] = H.steadyAB, name = fam.n0 === 0 ? 'A' : 'B', shifted = Math.abs(A0) + Math.abs(B0) > 0, out = [];
        const Ut = Math.abs(B0) < 1e-12 ? fmt(A0, 4) : `${fmt(A0, 4)} ${B0 < 0 ? '-' : '+'} ${fmt(Math.abs(B0), 4)}${v}`, fv = x => R.f(x) - H.steady(x);
        out.push(`변수분리 $u = F(${v})G(t)$로 $${fam.ode ?? "F'' + k^2F = 0"}$, $G' + c^2k^2G = 0$을 얻습니다. 모드마다 $e^{-\\lambda_n^2 t}$ ($\\lambda_n^2 = c^2k_n^2$, $\\lambda_1^2 = ${fmt(H.rate(1), 4)}$)로 줄어들어 높은 모드가 먼저 사라집니다.`);
        if (shifted) out.push(`끝 조건을 만족하는 정상 상태는 $U(${v}) = ${Ut}$입니다. $u - U$는 끝 조건이 0인 같은 문제이므로 $f - U$를 전개합니다.`);
        out.push(...eigenSteps(cfg, R, { fam, fn: shifted ? fv : R.f, what: shifted ? '$f - U$' : '초기 온도 $f$', name, fnTex: shifted ? `[f(${v}) - U(${v})]` : `f(${v})`, tol, sym: shifted ? [[A0, B0 * R.L], fv] : undefined }));
        out.push(H.mean !== undefined ? `온도는 평균 $A_0$으로 고르게 됩니다.` : `시간이 지나면 온도는 정상 상태 $U(${v})${shifted ? '' : ' = 0'}$로 갑니다. 첫 모드가 절반으로 줄어드는 시간은 $\\ln 2/\\lambda_1^2 = ${fmt(Math.LN2 / H.rate(1), 4)}$입니다.`);
        return out;
      } },
  },
});
const ROD_ENDS = [['fixed', '온도 고정'], ['free', '단열']];
defineTopic({
  id: 'rod', eq: 'heat', domain: 'interval', look: p => p.left === p.right, mixed: true,
  ends: { left: ROD_ENDS, right: [...ROD_ENDS, ['robin', '열 방출']] },
  name: p => p.right === 'robin' ? [null, '막대의 열전도 (끝에서 열 방출)'] : p.left !== p.right ? [null, '막대의 열전도 (한쪽 끝 단열)'] : ['12장', p.left === 'fixed' ? '막대의 열전도' : '양 끝이 단열된 막대의 열전도'],
  uses: p => p.left === p.right ? ['series', 'half', 'heat'] : ['modes', 'heat'],
  params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine', family: familyFor(p.left, p.right).id, heatDomain: 'finite', bc: p.left !== p.right ? 'mixed' : p.left === 'free' ? 'insulated' : 'fixed' }),
  fields: p => [{ k: 'alpha', type: 'text', label: '열확산계수 c²' }, ...(p.left === 'fixed' ? [{ k: 'left', type: 'text', label: '왼쪽 끝 온도 U₁' }] : []), ...(p.right === 'fixed' ? [{ k: 'right', type: 'text', label: '오른쪽 끝 온도 U₂' }] : []), ...(p.right === 'robin' ? [{ k: 'hRobin', type: 'text', label: '열 방출 계수 h', hint: 'x = L 끝에서 u_x + hu = 0 (주위 온도 0)' }] : [])],
  stages: cfg => eigenStages(cfg, true),
});
defineTopic({
  id: 'infiniteRod', eq: 'heat', domain: 'line',
  name: () => ['12장', '무한히 긴 막대의 열전도 (열핵)'],
  uses: () => ['series', 'transform', 'heat'], params: () => ({ heatDomain: 'infinite', bc: 'fixed' }),
  fields: () => [{ k: 'alpha', type: 'text', label: '열확산계수 c²' }],
  stages: () => [
    { id: 'expand', title: '초기 온도의 Fourier 적분', panel: 'transform', fields: ['wMax'], md: INTEGRAL_MD },
    { id: 'solve', title: '해', panel: 'heat', md: String.raw`$u(x,t) = \int_0^{\infty}[A(w)\cos wx + B(w)\sin wx]\,e^{-c^2w^2t}\,dw$. 열핵과의 합성곱과 같습니다.` },
  ],
});
