'use strict';
/* 개념 모듈: 반구간 전개. 주제: (0, L) 위 함수의 전개(방정식 없음). 현·막대·막도 이 모듈을 씁니다. */
defineConcept({
  id: 'half', ch: '11장', title: '반구간 전개',
  markup: String.raw`함수가 $(0, L)$에서만 주어지면 왼쪽을 정해 주기 $2L$인 함수로 **확장**합니다. 우함수로 확장하면 코사인 항만, 기함수로 확장하면 사인 항만 남습니다.

$$\text{코사인:}\quad a_0 = \frac{1}{L}\int_{0}^{L} f(x)\,dx,\quad a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$$

$$\text{사인:}\quad b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$

양 끝이 고정된 현과 막대의 해가 사인 급수로 나오는 이유가 여기에 있습니다. 현과 막대는 이 전개 위에 만들어집니다.`,
  summary: cfg => [['반구간 전개', `(0, L)의 함수를 ${cfg.halfMode === 'cosine' ? '우함수로 확장해 코사인' : '기함수로 확장해 사인'} 항만 남겼습니다.${needsHalf(cfg) ? ' 현·막대의 해가 이 전개를 씁니다.' : ''}`]],
});
defineTopic({
  id: 'halfRange', eq: 'none', domain: 'interval', look: true,
  ends: [['fixed', '값 0 → 사인 급수'], ['free', '기울기 0 → 코사인 급수']],
  name: p => ['11장', `반구간 전개 (${p.left === 'fixed' ? '사인' : '코사인'} 급수)`],
  uses: () => ['series', 'half'], params: p => ({ halfMode: p.left === 'fixed' ? 'sine' : 'cosine' }),
  stages: cfg => {
    const fixed = cfg.prob.left === 'fixed';
    return [
      { id: 'basis', title: '고유함수 (양 끝 조건이 정함)', panel: 'eigen', md: fixed
        ? String.raw`$x = 0$과 $x = L$에서 $0$이 되는 $\sin\frac{n\pi x}{L}$로 전개합니다. $(-L, 0)$으로 기함수 확장한 함수의 Fourier 급수와 같습니다.`
        : String.raw`$x = 0$과 $x = L$에서 기울기가 $0$인 $1$, $\cos\frac{n\pi x}{L}$로 전개합니다. $(-L, 0)$으로 우함수 확장한 함수의 Fourier 급수와 같습니다.` },
      { id: 'expand', title: '반구간 전개', panel: lookPanel(cfg), look: true, md: fixed
        ? String.raw`$f(x) = \sum_{n=1}^{\infty} b_n\sin\frac{n\pi x}{L}$, $b_n = \frac{2}{L}\int_0^L f(x)\sin\frac{n\pi x}{L}\,dx$`
        : String.raw`$f(x) = a_0 + \sum_{n=1}^{\infty} a_n\cos\frac{n\pi x}{L}$, $a_0 = \frac{1}{L}\int_0^L f(x)\,dx$, $a_n = \frac{2}{L}\int_0^L f(x)\cos\frac{n\pi x}{L}\,dx$` },
    ];
  },
});
