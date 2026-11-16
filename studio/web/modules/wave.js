'use strict';
/* 개념 모듈: 현의 진동(파동방정식). 주제: 구간의 현(고정·자유 끝, 감쇠), 무한히 긴 현(D'Alembert). */
defineConcept({
  id: 'wave', ch: '12장', title: '현의 진동 (파동방정식)',
  markup: String.raw`양 끝이 고정된 현의 작은 진동은 **파동방정식**을 따릅니다. $c^2$은 장력을 선밀도로 나눈 값입니다.

$$u_{tt} = c^2 u_{xx}$$

$u = F(x)G(t)$로 놓는 **변수분리**를 하면, 고정 조건 때문에 $F_n = \sin\frac{n\pi x}{L}$이고 시간 쪽은 각진동수 $\lambda_n = cn\pi/L$로 진동합니다.

$$u(x,t) = \sum_{n=1}^{\infty}(B_n\cos\lambda_n t + B_n^*\sin\lambda_n t)\sin\frac{n\pi x}{L}$$

$$B_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx,\quad B_n^* = \frac{2}{cn\pi}\int_{0}^{L} g(x)\sin\frac{n\pi x}{L}\,dx$$

$B_n$은 초기 변위의 반구간 사인 계수와 같습니다. 모든 $\lambda_n$이 $\lambda_1$의 정수배이므로 현은 주기 $2L/c$로 처음 모양으로 돌아옵니다.

현이 무한히 길면 경계가 없어 **D’Alembert 해**를 씁니다. 초기 모양이 절반씩 나뉘어 속도 $c$로 양쪽으로 갑니다.

$$u(x,t) = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$$

> **감쇠와 자유 끝.** 감쇠가 있으면 $u_{tt} + 2ku_t = c^2 u_{xx}$이고 모드마다 $e^{-kt}$로 줄어듭니다($k < \lambda_n$이면 각진동수는 $\sqrt{\lambda_n^2 - k^2}$). 양 끝이 자유로우면($u_x = 0$) 모드가 $\cos\frac{n\pi x}{L}$이 되고 계수는 반구간 코사인 계수입니다.`,
  compute(cfg, R, { L, f, N, X }) {
    const speed = positive(cfg, 'c', '파동 속도 c', L), g = fnOf(cfg, 'g', '초기 속도 g(x)', L), tSet = optionalPositive(cfg, 'tEndWave', '현 끝 시간', L);
    const k = real(cfg, 'damping', '감쇠 k', L);
    if (k < 0) throw new Error('감쇠 k: 0 이상이어야 합니다.');
    if (cfg.waveDomain === 'finite') boundedOn(g, 0, L, '초기 속도 g(x)'); else boundedOn(g, -X, X, '초기 속도 g(x)');
    if (cfg.waveDomain === 'finite') {
      const fam = familyOf(cfg), model = modalWave(fam, f, g, L, N, speed, k), T = 2 * PI / model.omega(1), free = fam.ends.includes('free'), times = [];
      const tEnd = tSet ?? 2 * T;
      for (let i = 0; i <= 40; i++) times.push(i / 40 * tEnd);
      R.wave = { ...model, L, speed, T, g, tEnd, damping: k, free, yr: scanRange(model.u, [0, L], times) };
    } else {
      const tEnd = tSet ?? X / speed, model = buildPde('wave', 'infinite', f, g, { speed, X, tEnd, alpha: 1 });
      R.wave = { ...model, X, speed, g, tEnd, restWave: String(cfg.g).trim() === '0', yr: scanRange(model.u, [-X, X], [0, tEnd / 4, tEnd / 2, tEnd]) };
    }
  },
  panels: {
  wave(ctx, w, h, C, cfg, R, ref) {
    const W = R.wave, t = timeOf(W, cfg), b = box(w, h, C), finite = cfg.waveDomain === 'finite', xr = rangeX(finite ? [0, W.L] : [-W.X, W.X], R), yr = rangeY(W.yr, R);
    const M = axes(ctx, b, xr, yr, C, finite ? { xTicks: piTicks(xr, W.L, W.L / 4) } : {});
    curve(ctx, R.f, b, xr, M, C.muted, 1.5, [], [6, 5]);
    if (!finite && W.restWave) { curve(ctx, x => W.right(x, t), b, xr, M, C.hot, 1.5, [], [3, 4]); curve(ctx, x => W.leftw(x, t), b, xr, M, C.green, 1.5, [], [3, 4]); }
    const refW = ref?.R.wave;
    if (refW) curve(ctx, x => refW.u(x, timeOf(refW, cfg)), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => W.u(x, t), b, xr, M, C.blue, 3, [], null, finite ? 1 : 2);
    return { title: finite ? `${W.family.radial ? '원형 막 (반지름 방향 단면)' : '현의 진동'}${W.family.id === 'sine' || W.family.radial ? '' : ` (${W.family.title})`}${W.damping > 0 ? `(감쇠 k = ${fmt(W.damping, 3)})` : ''}  t = ${fmt(t, 3)}` : `무한히 긴 현  t = ${fmt(t, 3)}`, frame: { b, xr, yr },
      legend: [['--blue', uxt], ['--muted', '처음 모양', true], ...(!finite && W.restWave ? [['--hot', '오른쪽 파동', true], ['--green', '왼쪽 파동', true]] : []), ...(refW ? [pinLabel(uxt)] : [])],
      probe: x => [['u', W.u(x, t)], ['처음', R.f(x)]] };
  },
  },
  summary(cfg, R) {
    const out = [], W = R.wave, t = timeOf(W, cfg);
    if (cfg.waveDomain === 'finite') {
      const fam = W.family, ends = Math.max(W.family.ends[0] === 'fixed' ? Math.abs(R.f(0)) : 0, W.family.ends[1] === 'fixed' ? Math.abs(R.f(R.L)) : 0);
      out.push([fam.radial ? '원형 막' : '현의 진동', `${fam.harmonic ? `주기 ${m(`<i>T</i> = 2π/<i>λ</i><sub>1</sub> = ${fmt(W.T, 4)}`)}, ` : ''}기본 각진동수 ${m(`<i>λ</i><sub>1</sub> = ${coefText(W.omega(1))}`)}.${fam.harmonic ? '' : ` ${m('<i>λ</i><sub><i>n</i></sub>')}이 정수배가 아니어서 주기적이지 않습니다.`} 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.${ends > 1e-6 ? ' 초기 변위가 양 끝에서 0이 아니어서 끝점 부근에서 급수가 함수와 다릅니다.' : ''}`]);
    } else out.push(['무한히 긴 현', `초기 모양이 절반씩 나뉘어 속도 ${m(fmt(W.speed, 3))}로 양쪽으로 갑니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]);
    if (W.damping > 0) out.push(['감쇠', `모드마다 ${m('<i>e</i><sup>−<i>kt</i></sup>')}로 줄어듭니다(k = ${fmt(W.damping, 3)}). ${W.damping < W.omega(1) ? '진동하면서 줄어듭니다.' : '첫 모드부터 진동하지 않고 줄어듭니다(과감쇠).'}`]);
    if (W.free && W.family.harmonic) out.push(['자유 끝', W.family.id === 'cosine' ? '양 끝이 자유로워 모드가 cos(nπx/L)이고, 평균 높이(0번 모드)는 그대로 유지됩니다.' : `한쪽 끝이 자유로워 모드가 ${W.family.plain}이고, 기본 진동수가 양 끝 고정일 때의 절반(주기 4L/c)입니다.`]);
    return out;
  },
  items: {
    wave: { label: '현의 해', auto: true,
      problem(cfg, R, { Ls }) {
        const g = prettyExpr(cfg.g, cfg.params), cs = prettyExpr(cfg.c), extra = `${+cfg.damping > 0 ? ` 감쇠 계수는 $k = ${prettyExpr(cfg.damping)}$이다($u_{tt} + 2ku_t = c^2u_{xx}$).` : ''}`;
        if (cfg.waveDomain !== 'finite') return `무한히 긴 현($c = ${cs}$)의 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 $u(x,t)$를 구하시오.`;
        const fam = familyOf(cfg);
        if (fam.radial) return `반지름 $R = ${Ls}$, 파동 속도 $c = ${cs}$인 원형 막의 가장자리가 고정되어 있다.${extra} ${fam.m ? `처음 변위가 $f(r)\\cos ${fam.m}\\theta$이고 처음 속도가 $g(r)\\cos ${fam.m}\\theta$ ($g(r) = ${g}$)일 때 $u(r,\\theta,t)$를 구하시오.` : `처음 변위가 중심으로부터의 거리 $r$에만 따르는 $f(r)$이고 처음 속도가 $g(r) = ${g}$일 때 $u(r,t)$를 구하시오.`}`;
        const say = { fixed: ['고정되어 있고', '고정되어 있다'], free: ['자유롭게 움직이고($u_x = 0$)', '자유롭게 움직인다($u_x = 0$)'] }, [a, b] = fam.ends;
        const ends = a === b ? `의 양 끝이 ${say[a][1]}` : `의 $x = 0$ 끝은 ${say[a][0]} $x = L$ 끝은 ${say[b][1]}`;
        return `길이 $L = ${Ls}$, 파동 속도 $c = ${cs}$인 현${ends}.${extra} 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 변위 $u(x,t)$를 구하시오.`;
      },
      solution(cfg, R, { tol }) {
        const W = R.wave;
        if (cfg.waveDomain !== 'finite') return [String.raw`D’Alembert 해 $u = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$` + `에 $c = ${fmt(W.speed, 3)}$을 넣습니다. 초기 모양의 절반이 속도 ${fmt(W.speed, 3)}로 오른쪽과 왼쪽으로 이동하며, 모양은 변하지 않습니다.`];
        const fam = W.family, v = fam.radial ? 'r' : 'x', A = fam.n0 === 0 ? 'A' : 'B', out = [];
        out.push(`변수분리 $u = F(${v})G(t)$로 $${fam.ode ?? "F'' + k^2F = 0"}$, $G'' + c^2k^2G = 0$을 얻고, 모드마다 각진동수 $\\lambda_n = ck_n$으로 진동합니다($\\lambda_1 = ${coefText(W.omega(1))}$).`);
        out.push(...eigenSteps(cfg, R, { fam, what: '초기 변위 $f$', name: A, fnTex: `f(${v})`, tol }));
        // 처음 속도가 0이면(격자에서 모두 0) 계수를 찾지 않습니다. 0인 계수를 차수 끝까지 정밀 적분하면 오래 걸립니다.
        let gMax = 0; for (let i = 0; i <= 400; i++) gMax = Math.max(gMax, Math.abs(W.g(i / 400 * R.L)));
        const Vn = gMax > 0 ? firstNonzero(n => fineEigen(fam, W.g, R.L, n), 4, tol) : [];
        if (Vn.length) out.push(`초기 속도도 같은 고유함수로 전개해 $\\lambda_n$으로 나누면 $${A}_n^*$입니다.`, valueEq(`${A}^*`, Vn.map(n => [n, fineEigen(fam, W.g, R.L, n) / W.omega(n)])));
        out.push(`$$u(${fam.m ? 'r,\\theta' : v},t) = ${fam.n0 === 0 ? `${A}_0 + ` : ''}\\sum_{n=1}^{\\infty}(${A}_n\\cos\\lambda_n t + ${A}_n^*\\sin\\lambda_n t)${fam.tex}${fam.m ? `\\cos ${fam.m}\\theta` : ''}$$`);
        if (fam.n0 === 0) out.push(`양 끝이 자유로워 평균 높이 $${A}_0$은 그대로 남습니다.`);
        if (W.damping > 0) out.push(`감쇠가 있으면 각 모드의 시간 부분이 $q_n'' + 2kq_n' + \\lambda_n^2 q_n = 0$을 따릅니다. $k = ${fmt(W.damping, 4)}$${W.damping < W.omega(1) ? `이 $\\lambda_1$보다 작으므로 $q_n = e^{-kt}(B_n\\cos\\mu_n t + \\frac{kB_n}{\\mu_n}\\sin\\mu_n t)$, $\\mu_n = \\sqrt{\\lambda_n^2 - k^2}$입니다(처음 속도 0일 때).` : '이 $\\lambda_1$ 이상이어서 낮은 모드는 진동하지 않고 줄어듭니다(과감쇠).'}`);
        else out.push(fam.harmonic ? `모든 $\\lambda_n$이 $\\lambda_1$의 정수배이므로 주기 $2\\pi/\\lambda_1 = ${fmt(W.T, 4)}$마다 처음 모양으로 돌아옵니다.` : `$\\lambda_n$이 $\\lambda_1$의 정수배가 아니어서 처음 모양으로 정확히 돌아오지 않습니다.`);
        return out;
      } },
  },
});
const WAVE_FIELDS = p => [{ k: 'c', type: 'text', label: '파동 속도 c' }, ...(p.damp ? [{ k: 'kDamp', type: 'text', label: '감쇠 계수 k', hint: 'u_tt + 2k u_t = c² u_xx' }] : []), { k: 'g', type: 'text', label: '초기 속도 g(x) = uₜ(x, 0)', hint: '0이면 정지 상태에서 시작합니다.' }];
defineTopic({
  id: 'string', eq: 'wave', domain: 'interval', look: p => p.left === p.right, damp: true, mixed: true,
  ends: [['fixed', '고정'], ['free', '자유']],
  name: p => p.left === 'fixed' && p.right === 'fixed' && !p.damp ? ['12장', '현의 진동'] : [null, `현의 진동 (${[p.left !== p.right ? '한쪽 끝 자유' : p.left === 'free' ? '양 끝 자유' : '', p.damp ? '감쇠' : ''].filter(Boolean).join(', ')})`],
  uses: p => p.left === p.right ? ['series', 'half', 'wave'] : ['modes', 'wave'],
  params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine', family: familyFor(p.left, p.right).id, waveDomain: 'finite', waveEnds: p.left === p.right ? p.left : 'mixed' }),
  fields: WAVE_FIELDS,
  stages: cfg => eigenStages(cfg, false),
});
defineTopic({
  id: 'dalembert', eq: 'wave', domain: 'line',
  name: () => ['12장', "D'Alembert 해 (무한히 긴 현)"],
  uses: () => ['series', 'wave'], params: () => ({ waveDomain: 'infinite', waveEnds: 'fixed' }),
  fields: WAVE_FIELDS,
  stages: () => [{ id: 'solve', title: "해 (D'Alembert)", panel: 'wave', md: String.raw`$u(x,t) = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$. 처음 모양의 절반씩이 속도 $c$로 양쪽으로 갑니다.` }],
});
