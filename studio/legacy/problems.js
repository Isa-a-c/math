'use strict';
/* 연습문제 생성기. 각 문제는 정답 공식(coef, exact)을 함께 가지며 test.js가 수치 계산과 대조합니다. */
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const sgn = n => n % 2 ? -1 : 1;                 // (−1)ⁿ
const num = v => Number.isInteger(v) ? String(v) : String(+v.toFixed(3));
const lenText = L => Math.abs(L - PI) < 1e-9 ? 'π' : num(L);
const lenExpr = L => Math.abs(L - PI) < 1e-9 ? 'pi' : num(L);

const SERIES_FAMILIES = [
  { id: 'sign', title: '사각파', mode: 'full',
    text: (k, L) => `f(x) = −${num(k)} (−${lenText(L)} &lt; x &lt; 0), ${num(k)} (0 &lt; x &lt; ${lenText(L)})`,
    expr: 'k*sign(x)', a0: () => 0, a: () => 0, b: (n, k) => 2 * k * (1 - sgn(n)) / (n * PI),
    formula: k => `a₀ = 0, aₙ = 0, bₙ = ${num(2 * k)}(1 − (−1)ⁿ)/(nπ)` },
  { id: 'step', title: '한쪽만 켜진 펄스', mode: 'full',
    text: (k, L) => `f(x) = 0 (−${lenText(L)} &lt; x &lt; 0), ${num(k)} (0 &lt; x &lt; ${lenText(L)})`,
    expr: 'x>0 ? k : 0', a0: k => k / 2, a: () => 0, b: (n, k) => k * (1 - sgn(n)) / (n * PI),
    formula: k => `a₀ = ${num(k / 2)}, aₙ = 0, bₙ = ${num(k)}(1 − (−1)ⁿ)/(nπ)` },
  { id: 'linear', title: '일차함수', mode: 'full',
    text: (k, L) => `f(x) = ${num(k)}x (−${lenText(L)} &lt; x &lt; ${lenText(L)})`,
    expr: 'k*x', a0: () => 0, a: () => 0, b: (n, k, L) => -2 * k * L * sgn(n) / (n * PI),
    formula: (k, L) => `a₀ = 0, aₙ = 0, bₙ = −2·${num(k)}·${lenText(L)}(−1)ⁿ/(nπ)` },
  { id: 'abs', title: '절댓값', mode: 'full',
    text: (k, L) => `f(x) = ${num(k)}|x| (−${lenText(L)} &lt; x &lt; ${lenText(L)})`,
    expr: 'k*abs(x)', a0: (k, L) => k * L / 2, a: (n, k, L) => 2 * k * L * (sgn(n) - 1) / (n * n * PI * PI), b: () => 0,
    formula: (k, L) => `a₀ = ${num(k)}·${lenText(L)}/2, aₙ = 2·${num(k)}·${lenText(L)}((−1)ⁿ − 1)/(n²π²), bₙ = 0` },
  { id: 'square', title: '이차함수', mode: 'full',
    text: (k, L) => `f(x) = ${num(k)}x² (−${lenText(L)} &lt; x &lt; ${lenText(L)})`,
    expr: 'k*x^2', a0: (k, L) => k * L * L / 3, a: (n, k, L) => 4 * k * L * L * sgn(n) / (n * n * PI * PI), b: () => 0,
    formula: (k, L) => `a₀ = ${num(k)}·${lenText(L)}²/3, aₙ = 4·${num(k)}·${lenText(L)}²(−1)ⁿ/(n²π²), bₙ = 0` },
  { id: 'halfsine', title: '반구간 사인 전개', mode: 'sine',
    text: (k, L) => `f(x) = ${num(k)} (0 &lt; x &lt; ${lenText(L)})를 사인 급수로 전개`,
    expr: 'k', a0: () => 0, a: () => 0, b: (n, k) => 2 * k * (1 - sgn(n)) / (n * PI),
    formula: k => `bₙ = ${num(2 * k)}(1 − (−1)ⁿ)/(nπ)` },
  { id: 'halfcos', title: '반구간 코사인 전개', mode: 'cosine',
    text: (k, L) => `f(x) = ${num(k)}x (0 &lt; x &lt; ${lenText(L)})를 코사인 급수로 전개`,
    expr: 'k*x', a0: (k, L) => k * L / 2, a: (n, k, L) => 2 * k * L * (sgn(n) - 1) / (n * n * PI * PI), b: () => 0,
    formula: (k, L) => `a₀ = ${num(k)}·${lenText(L)}/2, aₙ = 2·${num(k)}·${lenText(L)}((−1)ⁿ − 1)/(n²π²)` },
];

function seriesProblem(rand = Math.random, family = null) {
  const fam = family ?? pick(SERIES_FAMILIES, rand);
  const k = pick([1, 2, 3, .5], rand), L = pick([PI, PI, 1, 2], rand);
  const a0 = fam.a0(k, L), a = n => fam.a(n, k, L), b = n => fam.b(n, k, L);
  const values = [];
  if (fam.mode !== 'sine') values.push(`a₀ = ${num(+a0.toFixed(4))}`);
  for (let n = 1; n <= 3; n++) {
    if (Math.abs(a(n)) > 1e-12) values.push(`a${'₀₁₂₃'[n]} = ${num(+a(n).toFixed(4))}`);
    if (Math.abs(b(n)) > 1e-12) values.push(`b${'₀₁₂₃'[n]} = ${num(+b(n).toFixed(4))}`);
  }
  return {
    kind: fam.title,
    html: `${fam.mode === 'full' ? `주기 ${Math.abs(L - PI) < 1e-9 ? '2π' : num(2 * L)}인 함수 ` : ''}${fam.text(k, L)}의 Fourier 계수를 구하십시오.`,
    answer: [fam.formula(k, L), `값: ${values.join(', ') || '모든 계수가 0'}`],
    apply: { expr: fam.expr, params: fam.expr.includes('k') ? { k } : {}, L: lenExpr(L), mode: fam.mode },
    check: { a0, a, b, k, L, mode: fam.mode, expr: fam.expr },
  };
}

const PDE_FAMILIES = [
  { id: 'wave-mode', make(rand) {
    const L = pick([1, 2, PI], rand), c = pick([1, 2], rand), k = pick([1, .5, 2], rand), m = pick([1, 2, 3], rand);
    const om = c * m * PI / L;
    return { kind: '파동 · 정규진동',
      html: `길이 ${lenText(L)}인 현(c = ${c})의 양 끝이 고정되어 있습니다. 초기 변위 f(x) = ${num(k)} sin(${m}πx/L), 초기 속도 0일 때 u(x, t)와 진동수를 구하십시오.`,
      answer: [`u(x, t) = ${num(k)} sin(${m}πx/L) cos(${num(+om.toFixed(4))} t)`, `진동수 = c·n/(2L) = ${num(+(c * m / (2 * L)).toFixed(4))}`],
      apply: { eq: 'wave', bc: 'fixed', L: lenExpr(L), speed: c, expr: `k*sin(${m}*pi*x/L)`, params: { k }, vel: '0', tEnd: +(4 * PI / om).toFixed(3) },
      exact: (x, t) => k * Math.sin(m * PI * x / L) * Math.cos(om * t), L, c };
  } },
  { id: 'wave-velocity', make(rand) {
    const L = pick([1, 2, PI], rand), c = pick([1, 2], rand), v = pick([1, 2], rand), m = pick([1, 2], rand);
    const om = c * m * PI / L;
    return { kind: '파동 · 초기 속도',
      html: `길이 ${lenText(L)}인 현(c = ${c})의 양 끝이 고정되어 있습니다. 초기 변위 0, 초기 속도 g(x) = ${num(v)} sin(${m}πx/L)일 때 u(x, t)를 구하십시오.`,
      answer: [`Bₙ* = Vₙ/λₙ, λ${m} = c·${m}π/L = ${num(+om.toFixed(4))}`, `u(x, t) = ${num(+(v / om).toFixed(4))} sin(${m}πx/L) sin(${num(+om.toFixed(4))} t)`],
      apply: { eq: 'wave', bc: 'fixed', L: lenExpr(L), speed: c, expr: '0', params: {}, vel: `${v}*sin(${m}*pi*x/L)`, tEnd: +(4 * PI / om).toFixed(3) },
      exact: (x, t) => v / om * Math.sin(m * PI * x / L) * Math.sin(om * t), L, c };
  } },
  { id: 'heat-half', make(rand) {
    const L = pick([1, 2, 80], rand), alpha = L === 80 ? 1.158 : pick([.1, .5, 1], rand), U = pick([100, 50, 10], rand), m = pick([1, 2, 3], rand);
    const rate = alpha * (m * PI / L) ** 2, half = Math.LN2 / rate;
    return { kind: '열 · 반감 시간',
      html: `길이 ${num(L)}인 막대(α = c² = ${alpha})의 양 끝을 0으로 유지합니다. 초기 온도가 f(x) = ${U} sin(${m}πx/L)일 때 u(x, t)와 최고 온도가 절반이 되는 시간을 구하십시오.`,
      answer: [`u(x, t) = ${U} sin(${m}πx/L) exp(−${num(+rate.toFixed(5))} t)`, `t = ln 2 / ${num(+rate.toFixed(5))} = ${num(+half.toFixed(3))}`],
      apply: { eq: 'heat', bc: 'fixed', L: num(L), alpha, expr: `U*sin(${m}*pi*x/L)`, params: { U }, tEnd: +(3 * half).toFixed(3) },
      exact: (x, t) => U * Math.sin(m * PI * x / L) * Math.exp(-rate * t), L, alpha, half };
  } },
  { id: 'heat-two', make(rand) {
    const L = pick([1, 2], rand), alpha = pick([.1, .5], rand), A = pick([2, 4], rand), B = pick([1, 3], rand);
    const r1 = alpha * (PI / L) ** 2, r3 = 9 * r1;
    return { kind: '열 · 두 모드',
      html: `길이 ${L}인 막대(α = ${alpha}), 양 끝 온도 0, 초기 온도 f(x) = ${A} sin(πx/L) + ${B} sin(3πx/L)입니다. u(x, t)를 쓰고, 어느 모드가 얼마나 더 빨리 줄어드는지 답하십시오.`,
      answer: [`u(x, t) = ${A} sin(πx/L) exp(−${num(+r1.toFixed(4))} t) + ${B} sin(3πx/L) exp(−${num(+r3.toFixed(4))} t)`, 'n = 3 모드의 감쇠 지수가 n = 1의 9배입니다.'],
      apply: { eq: 'heat', bc: 'fixed', L: num(L), alpha, expr: `${A}*sin(pi*x/L)+${B}*sin(3*pi*x/L)`, params: {}, tEnd: +(2 / r1).toFixed(3) },
      exact: (x, t) => A * Math.sin(PI * x / L) * Math.exp(-r1 * t) + B * Math.sin(3 * PI * x / L) * Math.exp(-r3 * t), L, alpha };
  } },
  { id: 'heat-insulated', make(rand) {
    const L = pick([1, 2], rand), alpha = pick([.1, .5], rand), A = pick([1, 3], rand), B = pick([1, 2], rand), m = pick([1, 2], rand);
    const rate = alpha * (m * PI / L) ** 2;
    return { kind: '열 · 단열 막대',
      html: `길이 ${L}인 막대(α = ${alpha})의 양 끝이 단열되어 있습니다. 초기 온도 f(x) = ${A} + ${B} cos(${m}πx/L)일 때 u(x, t)와 t → ∞의 온도를 구하십시오.`,
      answer: [`u(x, t) = ${A} + ${B} cos(${m}πx/L) exp(−${num(+rate.toFixed(4))} t)`, `t → ∞이면 온도는 평균값 ${A}로 수렴합니다.`],
      apply: { eq: 'heat', bc: 'insulated', L: num(L), alpha, expr: `${A}+${B}*cos(${m}*pi*x/L)`, params: {}, tEnd: +(3 / rate).toFixed(3) },
      exact: (x, t) => A + B * Math.cos(m * PI * x / L) * Math.exp(-rate * t), L, alpha };
  } },
];

function pdeProblem(rand = Math.random, family = null) {
  return (family ?? pick(PDE_FAMILIES, rand)).make(rand);
}
