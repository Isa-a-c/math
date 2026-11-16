'use strict';
/* 개념 모듈: 계수 크기. 전개 단계에서 '계수 크기'를 고르면 씁니다. */
defineConcept({
  id: 'spectrum', ch: '11장', title: '계수 크기',
  markup: String.raw`계수의 크기는 그 진동수가 함수에 들어 있는 비중입니다. 계수가 줄어드는 빠르기는 함수가 얼마나 매끄러운지에 달려 있습니다.

도약이 있으면 계수가 $1/n$처럼 느리게, 연속이고 꺾인 점만 있으면 $1/n^2$처럼 빠르게 줄어듭니다. 빨리 줄어들수록 적은 항으로도 함수에 가까워집니다.

$N$항까지의 제곱오차는 다음과 같고, $N$이 커지면 0으로 갑니다.

$$E^* = \int_{-L}^{L} f^2\,dx - L\left[2a_0^2 + \sum_{n=1}^{N}(a_n^2 + b_n^2)\right]$$`,
  panels: {
  spectrum(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, b = box(w, h, C);
    const fr = bars(ctx, b, C, [[C.hot, n => model.a[n]], [C.blue, n => model.b[n]]], cfg.N, ref ? [[C.green, n => ref.R.series.a[n]], [C.green, n => ref.R.series.b[n]]] : []);
    const at = x => Math.max(1, Math.min(NMAX, Math.round(x)));
    return { title: '차수별 계수', frame: { b, xr: fr.xr, yr: fr.yr }, snap: at, pick: x => [[`a${at(x)}`, model.a[at(x)], -fr.width / 2], [`b${at(x)}`, model.b[at(x)], fr.width / 2]], legend: [['--hot', '<i>a<sub>n</sub></i>', 'fill'], ['--blue', '<i>b<sub>n</sub></i>', 'fill'], ...(ref ? [pinLabel('계수')] : [])],
      probe: x => [['n', at(x)], [`a${at(x)}`, model.a[at(x)]], [`b${at(x)}`, model.b[at(x)]]] };
  },
  },
  summary(cfg, R) { const p = decayPower(R.series); return [['계수 크기', p === null ? decayWords(p) : `계수가 약 ${m(`1/<i>n</i><sup>${fmt(p, 1)}</sup>`)}로 줄어듭니다. ${decayWords(p)}`]]; },
  items: {
    spectrum: { label: '계수 크기', auto: true,
      problem: (cfg, R, { half }) => `${half ? `반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 전개에서 ` : ''}계수의 크기가 $n$에 따라 줄어드는 빠르기를 구하고, ${half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'}로 확장한 함수의 ` : '함수의 '}매끄러움과 연결하여 설명하시오.`,
      solution: (cfg, R, { model }) => { const p = decayPower(model); return [p === null ? decayWords(p) : `계수의 포락선이 $1/n^{${fmt(p, 1)}}$처럼 줄어듭니다. ${decayWords(p)}`]; } },
  },
});
