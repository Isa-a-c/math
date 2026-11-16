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
      const fam = familyOf(cfg), left = fam.ends[0] === 'fixed' ? real(cfg, 'left', '왼쪽 끝 온도') : 0, right = fam.ends[1] === 'fixed' ? real(cfg, 'right', '오른쪽 끝 온도') : 0;
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
    return { title: `막대의 온도  t = ${fmt(t, 3)} (아래: 위치·시간별 온도)`, frame: { b: p, xr, yr },
      legend: [['--hot', uxt], ['--muted', '처음 온도', true], ['--green', H.limitName, true], ...(refH ? [pinLabel(uxt)] : [])],
      probe: x => [['u', H.u(x, t)], [H.limitName, end(x)]] };
  },
  },
  summary(cfg, R) {
    const H = R.heat, t = timeOf(H, cfg);
    if (cfg.heatDomain === 'finite') return [['막대의 열전도', `${H.family.id === 'sine' ? (H.left === H.right ? `막대 전체가 ${m(fmt(H.left, 3))}으로 고르게 됩니다.` : `양 끝 ${m(fmt(H.left, 3))}, ${m(fmt(H.right, 3))}을 잇는 직선으로 갑니다.`) : H.family.id === 'cosine' ? `평균 온도 ${m(fmt(H.mean, 4))}로 고르게 됩니다.` : `고정된 끝의 온도 ${m(fmt(H.limit(0), 3))}으로 고르게 됩니다.`} 첫 모드 감쇠율 ${m(`<i>λ</i><sub>1</sub>² = ${fmt(H.rate(1), 4)}`)}, 가운데 온도 ${m(fmt(H.u(H.L / 2, t), 4))} (${m(`<i>t</i> = ${fmt(t, 3)}`)}).`]];
    let peak = -Infinity; for (let i = 0; i <= 200; i++) peak = Math.max(peak, H.u(-H.X + i / 100 * H.X, t));
    return [['무한 막대', `퍼짐의 표준편차 ${m(`√(2<i>c</i>²<i>t</i>) = ${fmt(Math.sqrt(2 * H.alpha * t), 3)}`)}, 최고 온도 ${m(fmt(peak, 4))}, 전체 열량 ${m(fmt(H.total, 4))}은 그대로입니다.`]];
  },
  items: {
    heat: { label: '막대의 해', auto: true,
      problem(cfg, R, { Ls }) {
        const a = prettyExpr(cfg.alpha);
        if (cfg.heatDomain === 'infinite') return `무한히 긴 막대($c^2 = ${a}$)의 초기 온도가 $f(x)$일 때 $u(x,t)$를 적분 꼴로 쓰고, 시간에 따른 변화를 설명하시오.`;
        const fam = familyOf(cfg);
        if (fam.id === 'qsine') return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 $x = 0$ 끝 온도를 $U_1 = ${prettyExpr(cfg.left)}$로 유지하고 $x = L$ 끝은 단열되어 있다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 도달하는 온도를 구하시오.`;
        if (fam.id === 'qcosine') return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 $x = 0$ 끝은 단열되어 있고 $x = L$ 끝 온도를 $U_2 = ${prettyExpr(cfg.right)}$로 유지한다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 도달하는 온도를 구하시오.`;
        if (cfg.bc === 'fixed') return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝 온도를 $U_1 = ${prettyExpr(cfg.left)}$, $U_2 = ${prettyExpr(cfg.right)}$로 유지한다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 정상 상태를 구하시오.`;
        return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝이 단열되어 있다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 도달하는 온도를 구하시오.`;
      },
      solution(cfg, R, { tol }) {
        const out = [], H = R.heat;
        if (cfg.heatDomain !== 'finite') { out.push(String.raw`열핵과의 합성곱 $u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp(-\frac{(x-v)^2}{4c^2 t})\,dv$` + `에 $c^2 = ${fmt(H.alpha, 4)}$를 넣습니다. 열은 표준편차 $\\sqrt{2c^2 t}$로 퍼지고, 전체 열량 ${fmt(H.total, 4)}은 변하지 않습니다.`); return out; }
        if (H.family.id === 'qsine' || H.family.id === 'qcosine') {
          const fam = H.family, v = x => R.f(x) - H.steady(x), Bn = firstNonzero(n => fineEigen(fam, v, R.L, n), 4, tol);
          out.push(`한쪽 끝이 단열이어서 고유함수가 $${fam.tex}$, $k_n = ${fam.kTex}$이고 감쇠율은 $\\lambda_n^2 = c^2k_n^2$입니다. 온도는 고정된 끝의 온도 $U = ${fmt(H.limit(0), 4)}$로 고르게 됩니다.`);
          out.push(`$$B_n = \\frac{2}{L}\\int_0^L [f(x) - U]${fam.tex}\\,dx$$`);
          if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineEigen(fam, v, R.L, n)])));
          out.push(`첫 모드가 절반으로 줄어드는 시간은 $\\ln 2/\\lambda_1^2 = ${fmt(Math.LN2 / H.rate(1), 4)}$입니다.`);
          out.push(EXACT_NOTE);
          return out;
        }
        if (cfg.bc === 'fixed') {
          const v = x => R.f(x) - H.steady(x), Bn = firstNonzero(n => fineHalf(v, R.L, n, false), 4, tol);
          out.push(`정상 상태는 $U(x) = ${fmt(H.left, 4)} + ${fmt(H.right - H.left, 4)}x/L$이고, $f - U$의 반구간 사인 계수가 $B_n$입니다. 감쇠율은 $\\lambda_n^2 = c^2(n\\pi/L)^2 = ${fmt(H.rate(1), 4)}n^2$입니다.`);
          { const sym = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, 'sine', [H.left, H.right - H.left], v); if (sym) out.push(symbolicSteps(sym, 'sine', { a0: 'A_0', a: 'A_n', b: 'B_n' })); }
          if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineHalf(v, R.L, n, false)])));
          out.push(`첫 모드가 절반으로 줄어드는 시간은 $\\ln 2/\\lambda_1^2 = ${fmt(Math.LN2 / H.rate(1), 4)}$입니다.`);
        } else {
          const An = firstNonzero(n => fineHalf(R.f, R.L, n, true), 4, tol), e0 = exact(fineHalf(R.f, R.L, 0, true));
          out.push(`단열 조건에서는 코사인 급수가 나오고, 온도는 평균 $A_0 ${rel(e0)} ${e0.text}$으로 갑니다.`);
          { const sym = symbolicFor({ ...cfg, on: { ...cfg.on, half: true } }, R, 'cosine'); if (sym) out.push(symbolicSteps(sym, 'cosine', { a0: 'A_0', a: 'A_n', b: 'B_n' })); }
          if (An.length) out.push(valueEq('A', An.map(n => [n, fineHalf(R.f, R.L, n, true)])));
        }
        return out;
      } },
  },
});
defineTopic({
  id: 'rod', eq: 'heat', domain: 'interval', look: p => p.left === p.right, mixed: true,
  ends: [['fixed', '온도 고정'], ['free', '단열']],
  name: p => p.left !== p.right ? [null, '막대의 열전도 (한쪽 끝 단열)'] : ['12장', p.left === 'fixed' ? '막대의 열전도' : '양 끝이 단열된 막대의 열전도'],
  uses: p => p.left === p.right ? ['series', 'half', 'heat'] : ['modes', 'heat'],
  params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine', family: familyFor(p.left, p.right).id, heatDomain: 'finite', bc: p.left !== p.right ? 'mixed' : p.left === 'free' ? 'insulated' : 'fixed' }),
  fields: p => [{ k: 'alpha', type: 'text', label: '열확산계수 c²' }, ...(p.left === 'fixed' ? [{ k: 'left', type: 'text', label: '왼쪽 끝 온도 U₁' }] : []), ...(p.right === 'fixed' ? [{ k: 'right', type: 'text', label: '오른쪽 끝 온도 U₂' }] : [])],
  stages: cfg => intervalStages(cfg, true),
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
