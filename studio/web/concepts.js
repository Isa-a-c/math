'use strict';
/* 개념 나무와 설명. parent는 바로 위 개념이고, 목록 순서가 수업 순서(다음 개념 →)입니다.
   유한한 현·막대는 반구간 전개 위에, 무한히 긴 현·막대는 Fourier 급수 바로 위에 놓입니다(studio.js의 parentOf).
   설명은 고칠 수 있는 글입니다. 문단은 빈 줄로 나누고, $…$는 수식, $$…$$ 문단은 가운데 수식, '> '는 강조 상자입니다.
   화면의 '개념' 탭에서 고친 내용이 이 기본값보다 먼저 쓰입니다. */
const CONCEPTS = [
  { id: 'series', ch: '11장', title: 'Fourier 급수' },
  { id: 'coef', ch: '11장', title: '계수의 의미 (직교성)', parent: 'series' },
  { id: 'spectrum', ch: '11장', title: '계수 크기', parent: 'coef' },
  { id: 'gibbs', ch: '11장', title: '수렴과 도약', parent: 'series' },
  { id: 'half', ch: '11장', title: '반구간 전개', parent: 'series' },
  { id: 'wave', ch: '12장', title: '현의 진동 (파동방정식)', parent: 'half' },
  { id: 'heat', ch: '12장', title: '막대의 열전도 (열방정식)', parent: 'half' },
];

const CONCEPT_MARKUP = {
  series: String.raw`주기 $2L$인 함수를 삼각함수의 합으로 나타낸 것이 **Fourier 급수**입니다. 주기가 $2\pi$이면 $L = \pi$입니다.

$$f(x) = a_0 + \sum_{n=1}^{\infty}(a_n\cos\frac{n\pi x}{L} + b_n\sin\frac{n\pi x}{L})$$

계수는 **Euler 공식**으로 구합니다.

$$a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx$$

$$a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx,\quad b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$

실제로는 $N$차까지 더한 부분합 $S_N$을 봅니다. 우함수이면 $b_n = 0$(코사인 급수), 기함수이면 $a_n = 0$(사인 급수)이므로 계산 전에 대칭을 먼저 확인합니다.`,

  coef: String.raw`계수를 구하는 열쇠는 **직교성**입니다. 서로 다른 두 삼각함수를 곱해 한 주기 적분하면 0입니다.

$$\int_{-L}^{L}\cos\frac{n\pi x}{L}\cos\frac{m\pi x}{L}\,dx = 0\ (n \ne m),\quad \int_{-L}^{L}\sin\frac{n\pi x}{L}\cos\frac{m\pi x}{L}\,dx = 0$$

급수의 양변에 $\cos\frac{m\pi x}{L}$를 곱해 적분하면 직교성 때문에 $n = m$인 항 하나만 남고, 이것이 Euler 공식이 됩니다.

$$\int_{-L}^{L} f(x)\cos\frac{m\pi x}{L}\,dx = a_m L$$

> **그림의 뜻.** 계수는 함수와 그 파동을 곱한 곡선의 넓이를 $L$로 나눈 값입니다. 넓이가 상쇄되면 그 파동은 함수에 들어 있지 않습니다.`,

  spectrum: String.raw`계수의 크기는 그 진동수가 함수에 들어 있는 비중입니다. 계수가 줄어드는 빠르기는 함수가 얼마나 매끄러운지에 달려 있습니다.

도약이 있으면 계수가 $1/n$처럼 느리게, 연속이고 꺾인 점만 있으면 $1/n^2$처럼 빠르게 줄어듭니다. 빨리 줄어들수록 적은 항으로도 함수에 가까워집니다.

$N$항까지의 제곱오차는 다음과 같고, $N$이 커지면 0으로 갑니다.

$$E^* = \int_{-L}^{L} f^2\,dx - L\left[2a_0^2 + \sum_{n=1}^{N}(a_n^2 + b_n^2)\right]$$`,

  gibbs: String.raw`> **정리.** 구분연속이고 각 점에서 한쪽 도함수를 갖는 주기함수의 Fourier 급수는 수렴합니다. 연속인 점에서 합은 $f(x)$입니다.

도약이 있는 점에서는 왼쪽·오른쪽 극한의 평균으로 수렴합니다.

$$\text{합} = \frac{f(x_0 - 0) + f(x_0 + 0)}{2}$$

도약 옆의 봉우리는 항을 늘려도 사라지지 않습니다. 폭은 좁아지지만 높이는 도약 크기의 약 9%로 남습니다. 이것이 **Gibbs 현상**입니다.`,

  half: String.raw`함수가 $(0, L)$에서만 주어지면 왼쪽을 정해 주기 $2L$인 함수로 **확장**합니다. 우함수로 확장하면 코사인 항만, 기함수로 확장하면 사인 항만 남습니다.

$$\text{코사인:}\quad a_0 = \frac{1}{L}\int_{0}^{L} f(x)\,dx,\quad a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$$

$$\text{사인:}\quad b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$

양 끝이 고정된 현과 막대의 해가 사인 급수로 나오는 이유가 여기에 있습니다. 현과 막대는 이 전개 위에 만들어집니다.`,

  wave: String.raw`양 끝이 고정된 현의 작은 진동은 **파동방정식**을 따릅니다. $c^2$은 장력을 선밀도로 나눈 값입니다.

$$u_{tt} = c^2 u_{xx}$$

$u = F(x)G(t)$로 놓는 **변수분리**를 하면, 고정 조건 때문에 $F_n = \sin\frac{n\pi x}{L}$이고 시간 쪽은 각진동수 $\lambda_n = cn\pi/L$로 진동합니다.

$$u(x,t) = \sum_{n=1}^{\infty}(B_n\cos\lambda_n t + B_n^*\sin\lambda_n t)\sin\frac{n\pi x}{L}$$

$$B_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx,\quad B_n^* = \frac{2}{cn\pi}\int_{0}^{L} g(x)\sin\frac{n\pi x}{L}\,dx$$

$B_n$은 초기 변위의 반구간 사인 계수와 같습니다. 모든 $\lambda_n$이 $\lambda_1$의 정수배이므로 현은 주기 $2L/c$로 처음 모양으로 돌아옵니다.

현이 무한히 길면 경계가 없어 **D’Alembert 해**를 씁니다. 초기 모양이 절반씩 나뉘어 속도 $c$로 양쪽으로 갑니다.

$$u(x,t) = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$$`,

  heat: String.raw`막대의 온도는 **열방정식**을 따릅니다. $c^2$은 열확산계수입니다.

$$u_t = c^2 u_{xx}$$

양 끝 온도가 0이면 공간 쪽은 현과 같고 시간 쪽은 지수 감쇠입니다. 감쇠율 $\lambda_n^2$이 $n^2$에 비례하므로 고주파가 먼저 사라집니다.

$$u(x,t) = \sum_{n=1}^{\infty} B_n\sin\frac{n\pi x}{L}\,e^{-\lambda_n^2 t},\quad \lambda_n = \frac{cn\pi}{L}$$

> **양 끝 온도가 고정일 때.** 양 끝 온도가 $U_1$, $U_2$이면 정상 상태 $U(x) = U_1 + (U_2 - U_1)x/L$을 먼저 구하고, 나머지 $u - U$는 초기 온도 $f - U$로 같은 식을 씁니다.

양 끝이 단열이면 코사인 급수가 나오고, 온도는 처음의 평균 $A_0$으로 갑니다.

$$u(x,t) = A_0 + \sum_{n=1}^{\infty} A_n\cos\frac{n\pi x}{L}\,e^{-\lambda_n^2 t}$$

막대가 무한히 길면 해는 초기 온도와 **열핵**의 합성곱입니다. 열은 시간의 제곱근에 비례해 퍼지고 전체 열량은 그대로입니다.

$$u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp\left(-\frac{(x-v)^2}{4c^2 t}\right)dv$$`,
};
