'use strict';
/* 개념 모듈: Fourier 적분. 주제: 직선 위 함수의 전개(방정식 없음). 무한 막대도 이 모듈을 씁니다. */
defineConcept({
  id: 'transform', ch: '11장', title: 'Fourier 적분',
  markup: String.raw`주기가 없는 함수는 급수 대신 **Fourier 적분**으로 나타냅니다. 주기 $2L$을 한없이 키운 극한입니다.

$$f(x) = \int_{0}^{\infty}[A(w)\cos wx + B(w)\sin wx]\,dw$$

$$A(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\cos wv\,dv,\quad B(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\sin wv\,dv$$

계수 $a_n$, $b_n$ 대신 연속된 진동수 $w$의 함수 $A(w)$, $B(w)$가 나옵니다. 우함수이면 $B(w) = 0$(Fourier 코사인 적분), 기함수이면 $A(w) = 0$(Fourier 사인 적분)입니다.

적분의 위끝을 $a$로 끊으면 $a$가 커질수록 $f$에 가까워지고, 도약점에서는 두 극한의 평균으로 갑니다. 복소수로 쓰면 **Fourier 변환** $\hat f(w) = \frac{1}{\sqrt{2\pi}}\int_{-\infty}^{\infty} f(x)e^{-iwx}\,dx$가 됩니다.`,
  compute(cfg, R, { L, f }) { R.transform = integralModel(f, positive(cfg, 'X', '범위 X', L), positive(cfg, 'wMax', '적분의 위끝 a', L)); },
  panels: {
  transform(ctx, w, h, C, cfg, R, ref) {
    const T = R.transform, [p, q] = stacked(w, h, C, .55), xr = rangeX([-T.X, T.X], R), yr = rangeY(T.yr, R);
    const M = axes(ctx, p, xr, yr, C, {});
    curve(ctx, T.f, p, xr, M, C.ink, 2.5);
    const refT = ref?.R.transform;
    if (refT) curve(ctx, refT.recon, p, xr, M, C.green, 2.5, [], [7, 5], 2);
    curve(ctx, T.recon, p, xr, M, C.blue, 3, [], null, 2);
    let peak = 1e-9;
    for (const v of [...T.A, ...T.B]) peak = Math.max(peak, Math.abs(v));
    const wr = [0, T.wMax], M2 = axes(ctx, q, wr, [-peak * 1.15, peak * 1.15], C, {}), at = arr => w0 => arr[Math.max(0, Math.min(arr.length - 1, Math.round(w0 / T.wMax * (arr.length - 1))))];
    curve(ctx, at(T.A), q, wr, M2, C.hot, 2); curve(ctx, at(T.B), q, wr, M2, C.blue, 2, [], [6, 4]);
    panelText(ctx, '아래: 진동수 w에 따른 A(w), B(w)', q.l + q.w - 6, q.t + 2, C, 'right');
    return { title: `Fourier 적분 (위끝 a = ${fmt(T.wMax, 3)})`, frame: { b: p, xr, yr },
      legend: [['--ink', fx], ['--blue', '적분으로 다시 만든 f'], ['--hot', '<i>A</i>(<i>w</i>)'], ['--blue', '<i>B</i>(<i>w</i>)', true], ...(refT ? [pinLabel(`a = ${fmt(ref.R.transform.wMax, 3)}`)] : [])],
      probe: x => [['f', T.f(x)], ['적분', T.recon(x)]] };
  },
  },
  summary(cfg, R) {
    const T = R.transform, model = R.series; let iMax = 0; T.A.forEach((v, i) => { if (Math.abs(v) + Math.abs(T.B[i]) > Math.abs(T.A[iMax]) + Math.abs(T.B[iMax])) iMax = i; });
    return [['Fourier 적분', `${model.sym === 'even' ? '우함수라 B(w) = 0인 코사인 적분입니다. ' : model.sym === 'odd' ? '기함수라 A(w) = 0인 사인 적분입니다. ' : ''}위끝 ${m(`<i>a</i> = ${fmt(T.wMax, 3)}`)}까지 적분해 f를 다시 만들었습니다. 계수가 가장 큰 진동수는 ${m(`<i>w</i> ≈ ${fmt(T.ws[iMax], 3)}`)}입니다.${T.edge > .01 * Math.max(T.span, 1e-9) ? ' 범위 X의 끝에서 f가 0이 아니어서, 범위 밖을 0으로 본 근사입니다.' : ''}`]];
  },
  items: {
    transform: { label: 'Fourier 적분', auto: true,
      problem: cfg => `${fMarkup(cfg)}의 Fourier 적분 표현을 구하시오. $A(w)$, $B(w)$를 구하고, 적분의 위끝을 $a = ${prettyExpr(cfg.wMax)}$로 끊었을 때의 근사를 설명하시오.`,
      solution(cfg, R, { model }) {
        const T = R.transform, pick = [1, 2, 3].map(w0 => [w0, T.ws.findIndex(w => w >= w0 - 1e-9)]).filter(([, i]) => i >= 0);
        return [`${model.sym === 'even' ? '우함수이므로 $B(w) = 0$이고 Fourier 코사인 적분이 됩니다.' : model.sym === 'odd' ? '기함수이므로 $A(w) = 0$이고 Fourier 사인 적분이 됩니다.' : '대칭이 없어 $A(w)$, $B(w)$가 모두 나옵니다.'}`,
          String.raw`$$A(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\cos wv\,dv,\quad B(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\sin wv\,dv$$`,
          `수치 적분으로 구한 값: ${pick.map(([w0, i]) => `$A(${w0}) \\approx ${fmt(T.A[i], 4)}$, $B(${w0}) \\approx ${fmt(T.B[i], 4)}$`).join(', ')}.`,
          `위끝 $a = ${fmt(T.wMax, 3)}$까지의 적분은 $f$의 매끄러운 근사이며, $a$를 키우면 $f$에 가까워지고 도약점에서는 평균으로 갑니다.`];
      } },
  },
});
defineTopic({
  id: 'integral', eq: 'none', domain: 'line',
  name: () => ['11장', 'Fourier 적분'],
  uses: () => ['series', 'transform'], params: () => ({}),
  stages: () => [{ id: 'expand', title: 'Fourier 적분', panel: 'transform', fields: ['wMax'], md: INTEGRAL_MD }],
});
