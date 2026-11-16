'use strict';
/* 개념 모듈: 원판(반지름 방향). Fourier–Bessel 급수, 원형 막의 진동, 원판의 열전도.
   고유함수 J₀(αₙr/R)는 eigen.js의 종류 표에서 오고(가중치 r), 계산은 고유함수 전개(modes)·현(wave)·막대(heat) 모듈의 공통 엔진이 합니다.
   이 모듈은 원판을 위에서 본 모양과 반지름 방향 단면을 그리고, 원판 주제를 선언합니다. 입력의 x는 반지름 r로 읽습니다(r로 써도 됩니다). */
defineConcept({
  id: 'bessel', ch: '12장', title: '원판: Fourier–Bessel 급수와 원형 막',
  markup: String.raw`원판에서 중심으로부터의 거리 $r$에만 따르는 해를 찾으면, 변수분리의 공간 쪽이 **Bessel 방정식**이 됩니다.

$$F'' + \frac{1}{r}F' + k^2F = 0 \quad\Rightarrow\quad F = J_0(kr)$$

가장자리 $r = R$에서 $u = 0$이면 $J_0(kR) = 0$이므로 $k_n = \alpha_n/R$ ($\alpha_n$은 $J_0$의 근: $2.405, 5.520, 8.654, \ldots$)입니다. 고유함수 $J_0(\alpha_n r/R)$는 **가중치 $r$**로 서로 직교하므로, 함수를 이들의 합으로 쓸 수 있습니다(Fourier–Bessel 급수).

$$f(r) = \sum_{n=1}^{\infty} a_nJ_0\left(\frac{\alpha_n r}{R}\right),\quad a_n = \frac{2}{R^2J_1(\alpha_n)^2}\int_0^R r f(r)J_0\left(\frac{\alpha_n r}{R}\right)dr$$

가장자리가 고정된 원형 막의 반지름 방향 진동은 다음과 같습니다.

$$u(r,t) = \sum_{n=1}^{\infty}(a_n\cos\lambda_n t + b_n\sin\lambda_n t)J_0\left(\frac{\alpha_n r}{R}\right),\quad \lambda_n = \frac{c\alpha_n}{R}$$

> $\alpha_n$이 일정한 간격이 아니어서 $\lambda_n$이 $\lambda_1$의 정수배가 아닙니다. 그래서 북은 현처럼 맑은 음(배음)을 내지 않고, 막은 처음 모양으로 정확히 돌아오지 않습니다.`,
  panels: {
    bessel(ctx, w, h, C, cfg, R, ref) {
      const wave = cfg.on.wave, Mo = wave ? R.wave : R.heat, t = timeOf(Mo, cfg), L = R.L, u = r => Mo.u(r, t), b = box(w, h, C);
      const s = Math.min(b.h, b.w * .38), disk = { l: b.l, t: b.t + (b.h - s) / 2, w: s, h: s }, gap = 30 + 30 * C.scale;
      const prof = { l: b.l + s + gap, t: b.t, w: b.w - s - gap, h: b.h }, zmax = Math.max(1e-9, ...Mo.yr.map(Math.abs));
      // 위에서 본 원판: 반지름 방향 값을 표로 만들어 칠합니다(주황 위·높음, 파랑 아래·낮음).
      const G = 96, mA = familyOf(cfg).m ?? 0, rs = Float64Array.from({ length: 201 }, (_, i) => u(i / 200 * L)), off = document.createElement('canvas'); off.width = G; off.height = G;
      const c2 = off.getContext('2d'), img = c2.createImageData(G, G);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const dx = (i + .5) / G * 2 - 1, dy = (j + .5) / G * 2 - 1, q = Math.hypot(dx, dy), k = 4 * (j * G + i);
        if (q > 1) continue;
        const pos = q * 200, i0 = Math.min(199, Math.floor(pos)), v = (rs[i0] + (rs[i0 + 1] - rs[i0]) * (pos - i0)) * (mA ? Math.cos(mA * Math.atan2(-dy, dx)) : 1), z = Math.max(-1, Math.min(1, (wave ? v : v - (Mo.yr[0] + Mo.yr[1]) / 2) / (wave ? zmax : (Mo.yr[1] - Mo.yr[0]) / 2 || 1)));
        const rgb = z < 0 ? mix([246, 246, 246], [31, 95, 208], -z) : mix([246, 246, 246], [207, 74, 18], z);
        img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255;
      }
      c2.putImageData(img, 0, 0); ctx.drawImage(off, disk.l, disk.t, s, s);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(disk.l + s / 2, disk.t + s / 2, s / 2, 0, 2 * PI); ctx.stroke();
      const xr = rangeX([0, L], R), yr = rangeY(Mo.yr, R), M = axes(ctx, prof, xr, yr, C, { xTicks: piTicks(xr, L, L / 4) });
      curve(ctx, R.f, prof, xr, M, C.muted, 1.5, [], [6, 5]);
      if (!wave) curve(ctx, Mo.limit, prof, xr, M, C.green, 2, [], [3, 4]);
      const refM = ref ? (wave ? ref.R.wave : ref.R.heat) : null;
      if (refM) curve(ctx, r => refM.u(r, timeOf(refM, cfg)), prof, xr, M, C.green, 2.5, [], [7, 5]);
      curve(ctx, u, prof, xr, M, wave ? C.blue : C.hot, 3);
      const urt = '<i>u</i>(<i>r</i>, <i>t</i>)';
      return { title: `${wave ? '원형 막의 진동' : '원판의 온도'}${mA ? ` (cos ${mA}θ 모드)` : ''}  t = ${fmt(t, 3)} (왼쪽: 위에서 본 모양, 오른쪽: ${mA ? 'θ = 0 방향' : '반지름 r 방향'} 단면)`, frame: { b: prof, xr, yr },
        legend: [[wave ? '--blue' : '--hot', urt], ['--muted', '처음', true], ...(wave ? [] : [['--green', Mo.limitName, true]]), ...(refM ? [pinLabel(urt)] : [])],
        probe: r => [['u', u(r)], ['처음', R.f(r)], ...(wave ? [] : [[Mo.limitName, Mo.limit(r)]])] };
    },
  },
  summary(cfg, R) {
    const fam = familyOf(cfg), a = [1, 2, 3].map(n => fmt(fam.k(n, 1), 4));
    return [['원판', `${fam.m ? `각 방향 차수 ${m(`m = ${fam.m}`)}: 처음 모양 ${m(`f(r)cos ${fam.m}θ`)}는 지름 ${fam.m}개가 마디선(움직이지 않는 선)입니다. ` : ''}고유함수 ${m(fam.plain)}의 ${m('kₙR')} = ${m(a.join(', '))}, …는 같은 간격이 아니어서${cfg.on.wave ? ' 진동이 주기적이지 않습니다(배음이 아님).' : ' 모드마다 줄어드는 빠르기가 정수배로 늘지 않습니다.'}`]];
  },
});
const DISK_ROLE = what => () => `${what}, 0 ≤ r < R (R = L)`;
/** 각 방향 차수 m: 처음 모양 f(r)cos mθ. m = 0이면 반지름 방향만(교재), 1 이상은 응용입니다. */
const ANG_FIELD = { k: 'mAng', type: 'range', label: '각 방향 차수 m (처음 모양 f(r)·cos mθ, 0이면 반지름 방향만)', min: 0, max: 5 };
const angOf = cfg => besselOrder({ ...cfg, angular: true });
defineTopic({
  id: 'besselSeries', eq: 'none', domain: 'disk',
  ends: { right: [['fixed', '값 0'], ['free', '기울기 0']] },
  role: DISK_ROLE('함수 f(r)'),
  name: (p, cfg) => { const mA = angOf(cfg ?? {}); return p.right === 'fixed' && !mA ? ['11장', 'Fourier–Bessel 급수'] : [null, `Fourier–Bessel 급수 (${[p.right === 'fixed' ? '' : '가장자리 기울기 0', mA ? `J${subDigits(mA)}, cos ${mA}θ` : ''].filter(Boolean).join(', ')})`]; },
  uses: () => ['modes', 'bessel'], params: p => ({ family: familyFor('center', p.right).id, angular: true }), fields: () => [ANG_FIELD],
  stages: cfg => {
    const fam = familyOf(cfg);
    return [
      { id: 'basis', title: '고유함수 (Bessel 함수)', panel: 'eigen', md: String.raw`$${fam.ode}$의 해 중 중심에서 유한한 것은 $J_{${fam.m}}(kr)$입니다${fam.m ? ` (각 방향 $\cos ${fam.m}\theta$를 나눈 나머지)` : ''}. ${fam.kMd()} 고유함수는 가중치 $r$로 직교합니다.` },
      { id: 'expand', title: 'Fourier–Bessel 전개', panel: 'modes', md: String.raw`$f(r) = \sum_{n} c_{n}${fam.tex}$, $${coefTexOf(fam, 'c', 'f(r)')}$` },
    ];
  },
});
defineTopic({
  id: 'drum', eq: 'wave', domain: 'disk', note: () => '가장자리 r = R: 고정',
  role: DISK_ROLE('처음 변위 f(r) = u(r, 0)'),
  name: (p, cfg) => { const mA = angOf(cfg ?? {}); return mA ? [null, `원형 막의 진동 (cos ${mA}θ 모드)`] : ['12장', '원형 막의 진동']; },
  uses: () => ['modes', 'wave', 'bessel'], params: () => ({ family: 'bessel', waveDomain: 'finite', waveEnds: 'fixed', angular: true }),
  fields: p => [...WAVE_FIELDS(p).map(f => f.k === 'g' ? { ...f, label: '처음 속도 g(r) = uₜ(r, 0)' } : f), ANG_FIELD],
  stages: cfg => eigenStages(cfg, false),
});
defineTopic({
  id: 'diskHeat', eq: 'heat', domain: 'disk',
  ends: { right: [['fixed', '온도 고정'], ['free', '단열']] },
  role: DISK_ROLE('초기 온도 f(r) = u(r, 0)'),
  name: p => [null, `원판의 열전도 (가장자리 ${p.right === 'fixed' ? '온도 고정' : '단열'})`],
  uses: () => ['modes', 'heat', 'bessel'], params: p => ({ family: familyFor('center', p.right).id, heatDomain: 'finite', bc: p.right === 'fixed' ? 'fixed' : 'insulated', angular: false }),
  fields: p => [{ k: 'alpha', type: 'text', label: '열확산계수 c²' }, ...(p.right === 'fixed' ? [{ k: 'right', type: 'text', label: '가장자리 온도 U' }] : [])],
  stages: cfg => eigenStages(cfg, true),
});
