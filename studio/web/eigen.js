'use strict';
/* 고유함수 엔진. 고유값 문제(구간 (0, L)의 F'' + k²F = 0, 원판의 Bessel 방정식)의 해를 종류 표(FAMILIES) 한 줄씩으로 두고,
   계수 계산(전개)과 시간 변화(파동·감쇠·열)는 종류와 상관없이 같은 코드가 합니다.
   한 줄에 담는 것: 양 끝 조건(ends), 고유값 kₙ, 고유함수 φₙ, 그리고 필요하면 가중치 w(x), 노름 ∫wφₙ², 수치로 구한 고유값,
   값이 있는 종류(열 방출 계수 h처럼)는 make(cfg). 새 경계조건이나 새 고유함수는 이 표에 한 줄을 더합니다. */
const qk = n => 2 * n - 1;
const SUBS = '₀₁₂₃₄₅₆₇₈₉', subDigits = n => String(n).split('').map(d => SUBS[d]).join('');

/* ── Bessel 함수 J₀, J₁(유리 근사, 오차 약 1e-8)과 근 ─────────── */
function besselJ0(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    return (57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456)))))
      / (57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y)))));
  }
  const z = 8 / ax, y = z * z, xx = ax - .785398164;
  const p = 1 + y * (-.1098628627e-2 + y * (.2734510407e-4 + y * (-.2073370639e-5 + y * .2093887211e-6)));
  const q = -.1562499995e-1 + y * (.1430488765e-3 + y * (-.6911147651e-5 + y * (.7621095161e-6 - y * .934935152e-7)));
  return Math.sqrt(.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
}
function besselJ1(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    return x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))))
      / (144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y)))));
  }
  const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
  const p = 1 + y * (.183105e-2 + y * (-.3516396496e-4 + y * (.2457520174e-5 + y * -.240337019e-6)));
  const q = .04687499995 + y * (-.2002690873e-3 + y * (.8449199096e-5 + y * (-.88228987e-6 + y * .105787412e-6)));
  return Math.sqrt(.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q) * Math.sign(x);
}
const BESSEL_ZEROS = { 0: [], 1: [] };
/** Jₒ(x) = 0의 n번째 양의 근(o = 0, 1). McMahon 근삿값에서 Newton 법으로 구하고 저장해 둡니다. */
function besselZero(order, n) {
  const z = BESSEL_ZEROS[order];
  while (z.length < n) {
    let x = (z.length + 1 + (order ? .25 : -.25)) * PI;
    for (let i = 0; i < 60; i++) { const f = order ? besselJ1(x) : besselJ0(x), d = order ? besselJ0(x) - besselJ1(x) / x : -besselJ1(x), dx = f / d; x -= dx; if (Math.abs(dx) < 1e-15 * x) break; }
    z.push(x);
  }
  return z[n - 1];
}

/* ── 열 방출(Robin) 끝: kₙ은 방정식의 근 ─────────────── */
const ROBIN_ROOTS = new Map();
/** x = L 끝이 u_x + hu = 0일 때의 kₙ. sin이면 tan kL = −k/h, cos면 k tan kL = h의 n번째 양의 근(이분법). */
function robinRoot(kind, L, h, n) {
  const key = `${kind}|${L}|${h}`, list = ROBIN_ROOTS.get(key) ?? [];
  ROBIN_ROOTS.set(key, list);
  while (list.length < n) {
    const m = list.length + 1, g = kind === 'sin' ? k => k * Math.cos(k * L) + h * Math.sin(k * L) : k => h * Math.cos(k * L) - k * Math.sin(k * L);
    let lo = (kind === 'sin' ? m - .5 : m - 1) * PI / L, hi = (kind === 'sin' ? m : m - .5) * PI / L;
    const sLo = Math.sign(g(lo));
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (Math.sign(g(mid)) === sLo) lo = mid; else hi = mid; }
    list.push((lo + hi) / 2);
  }
  return list[n - 1];
}
/** 열 방출 계수 h(cfg.hRobin). 계산 단계에서 positive로 따로 검사하므로 여기서는 틀리면 1로 둡니다. */
const robinH = cfg => { try { const h = constant(cfg?.hRobin ?? '1', 1); return h > 0 ? h : 1; } catch { return 1; } };
function robinFamily(kind, h = 1) {
  const sin = kind === 'sin', k = (n, L) => robinRoot(kind, L, h, n), fn = sin ? Math.sin : Math.cos, name = sin ? 'sin' : 'cos';
  return { id: sin ? 'rsine' : 'rcosine', ends: [sin ? 'fixed' : 'free', 'robin'], n0: 1, h, key: `${sin ? 'rsine' : 'rcosine'}:${h}`,
    make: cfg => robinFamily(kind, robinH(cfg)), k, phi: (n, x, L) => fn(k(n, L) * x),
    norm: (n, L) => { const q = k(n, L); return L / 2 + (sin ? -1 : 1) * Math.sin(2 * q * L) / (4 * q); },
    tex: `\\${name} k_{n}x`, kTex: 'k_n', plain: `${name}(kₙx)`, title: `x = 0에서 ${sin ? '값 0' : '기울기 0'}, x = L에서 u′ + hu = 0`,
    kMd: L => `$k_n$은 $${sin ? String.raw`\tan kL = -k/h` : String.raw`k\tan kL = h`}$의 양의 근입니다${isFinite(L) ? `($h = ${fmt(h, 3)}$: ${[1, 2, 3].map(n => `$k_${n} \\approx ${fmt(k(n, L), 4)}$`).join(', ')})` : ''}.`,
    label: n => `${name}(<i>k</i>${subDigits(n)}<i>x</i>)` };
}
const FAMILIES = [
  { id: 'sine', ends: ['fixed', 'fixed'], n0: 1, harmonic: true, k: (n, L) => n * PI / L, phi: (n, x, L) => Math.sin(n * PI * x / L),
    tex: String.raw`\sin\frac{n\pi x}{L}`, kTex: String.raw`\frac{n\pi}{L}`, plain: 'sin(nπx/L)', title: '양 끝에서 값이 0 (고정)',
    label: n => `sin(${n > 1 ? n : ''}π<i>x</i>/<i>L</i>)` },
  { id: 'cosine', ends: ['free', 'free'], n0: 0, harmonic: true, k: (n, L) => n * PI / L, phi: (n, x, L) => Math.cos(n * PI * x / L),
    tex: String.raw`\cos\frac{n\pi x}{L}`, kTex: String.raw`\frac{n\pi}{L}`, plain: 'cos(nπx/L)', title: '양 끝에서 기울기 0 (자유·단열)',
    label: n => n ? `cos(${n > 1 ? n : ''}π<i>x</i>/<i>L</i>)` : '1' },
  { id: 'qsine', ends: ['fixed', 'free'], n0: 1, harmonic: true, k: (n, L) => qk(n) * PI / (2 * L), phi: (n, x, L) => Math.sin(qk(n) * PI * x / (2 * L)),
    tex: String.raw`\sin\frac{(2n-1)\pi x}{2L}`, kTex: String.raw`\frac{(2n-1)\pi}{2L}`, plain: 'sin((2n−1)πx/2L)', title: 'x = 0에서 값 0, x = L에서 기울기 0',
    label: n => `sin(${qk(n) > 1 ? qk(n) : ''}π<i>x</i>/2<i>L</i>)` },
  { id: 'qcosine', ends: ['free', 'fixed'], n0: 1, harmonic: true, k: (n, L) => qk(n) * PI / (2 * L), phi: (n, x, L) => Math.cos(qk(n) * PI * x / (2 * L)),
    tex: String.raw`\cos\frac{(2n-1)\pi x}{2L}`, kTex: String.raw`\frac{(2n-1)\pi}{2L}`, plain: 'cos((2n−1)πx/2L)', title: 'x = 0에서 기울기 0, x = L에서 값 0',
    label: n => `cos(${qk(n) > 1 ? qk(n) : ''}π<i>x</i>/2<i>L</i>)` },
  robinFamily('sin'),
  robinFamily('cos'),
  // 원판(반지름 방향, 가중치 r). x 자리가 반지름 r, L이 반지름 R입니다.
  { id: 'bessel', ends: ['center', 'fixed'], n0: 1, radial: true, k: (n, L) => besselZero(0, n) / L, phi: (n, x, L) => besselJ0(besselZero(0, n) * x / L),
    w: x => x, norm: (n, L) => L * L * besselJ1(besselZero(0, n)) ** 2 / 2, ode: String.raw`F'' + \frac{1}{r}F' + k^2F = 0`,
    tex: String.raw`J_0\left(\frac{\alpha_n r}{R}\right)`, kTex: String.raw`\frac{\alpha_n}{R}`, plain: 'J₀(αₙr/R)', title: '가장자리 r = R에서 값 0',
    kMd: () => String.raw`$k_n = \alpha_n/R$, $\alpha_n$은 $J_0(\alpha) = 0$의 양의 근($\alpha_1 \approx 2.405$, $\alpha_2 \approx 5.520$, $\alpha_3 \approx 8.654$)입니다.`,
    coefTex: (c, f) => String.raw`${c}_n = \frac{2}{R^2J_1(\alpha_n)^2}\int_0^R r\,${f}J_0\left(\frac{\alpha_n r}{R}\right)dr`,
    label: n => `J₀(α${subDigits(n)}<i>r</i>/<i>R</i>)` },
  { id: 'besselFree', ends: ['center', 'free'], n0: 0, radial: true, k: (n, L) => n ? besselZero(1, n) / L : 0, phi: (n, x, L) => n ? besselJ0(besselZero(1, n) * x / L) : 1,
    w: x => x, norm: (n, L) => L * L * (n ? besselJ0(besselZero(1, n)) ** 2 : 1) / 2, ode: String.raw`F'' + \frac{1}{r}F' + k^2F = 0`,
    tex: String.raw`J_0\left(\frac{\beta_n r}{R}\right)`, kTex: String.raw`\frac{\beta_n}{R}`, plain: 'J₀(βₙr/R)', title: '가장자리 r = R에서 기울기 0',
    kMd: () => String.raw`$k_n = \beta_n/R$, $\beta_n$은 $J_0'(\beta) = -J_1(\beta) = 0$의 근($\beta_0 = 0$, $\beta_1 \approx 3.832$, $\beta_2 \approx 7.016$)입니다.`,
    coefTex: (c, f) => String.raw`${c}_n = \frac{2}{R^2J_0(\beta_n)^2}\int_0^R r\,${f}J_0\left(\frac{\beta_n r}{R}\right)dr,\quad ${c}_0 = \frac{2}{R^2}\int_0^R r\,${f}\,dr`,
    label: n => n ? `J₀(β${subDigits(n)}<i>r</i>/<i>R</i>)` : '1' },
];
/** 양 끝 조건에 맞는 고유함수 종류입니다(값을 넣지 않은 표의 줄). 원판은 ('center', 가장자리)입니다. */
const familyFor = (left, right) => FAMILIES.find(f => f.ends[0] === left && f.ends[1] === right) ?? FAMILIES[0];
/** ∫ w φₙ² (기본: 상수 고유함수면 L, 아니면 L/2) */
const normOf = (fam, n, L) => fam.norm ? fam.norm(n, L) : n === 0 ? L : L / 2;
/** 설정의 고유함수 종류(열 방출 계수 같은 값을 넣은 것)입니다. */
const familyOf = cfg => { const f = FAMILIES.find(f => f.id === cfg.family) ?? FAMILIES[0]; return f.make ? f.make(cfg) : f; };
/** 계수 식(교재 표기). 노름이 L/2가 아니면 ∫fφ/∫φ² 꼴로 씁니다. */
const coefTexOf = (fam, c = 'c', f = 'f(x)') => fam.coefTex ? fam.coefTex(c, f)
  : fam.norm ? String.raw`${c}_n = \frac{\int_0^L ${f}\,${fam.tex}\,dx}{\int_0^L (${fam.tex})^2\,dx}`
    : String.raw`${c}_n = \frac{2}{L}\int_0^L ${f}${fam.tex}\,dx${fam.n0 === 0 ? String.raw`,\quad ${c}_0 = \frac{1}{L}\int_0^L ${f}\,dx` : ''}`;
/** 계수 cₙ = ∫ w f φₙ / ∫ w φₙ². 화면용 중점 적분입니다. */
function eigenCoefficients(fam, fn, L, N) {
  const m = QUAD, h = L / m, xs = new Float64Array(m), v = new Float64Array(m), c = new Float64Array(N + 1), w = fam.w;
  for (let j = 0; j < m; j++) { xs[j] = (j + .5) * h; v[j] = fn(xs[j]) * (w ? w(xs[j]) : 1); if (!isFinite(v[j])) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.'); }
  for (let n = fam.n0; n <= N; n++) { let s = 0; for (let j = 0; j < m; j++) s += v[j] * fam.phi(n, xs[j], L); c[n] = s * h / normOf(fam, n, L); }
  return c;
}
const eigenCache = new WeakMap();
/** 풀이용 촘촘한 계수입니다(core.js의 integrate). */
function fineEigen(fam, fn, L, n) {
  const memo = eigenCache.get(fn) ?? new Map(), key = `${fam.key ?? fam.id}|${L}|${n}`, w = fam.w;
  eigenCache.set(fn, memo);
  if (!memo.has(key)) memo.set(key, integrate(x => fn(x) * (w ? w(x) : 1) * fam.phi(n, x, L), 0, L) / normOf(fam, n, L));
  return memo.get(key);
}
/** 부분합 Σ cₙφₙ(x) (n0부터 N까지)입니다. */
function eigenSum(fam, c, L, N, x) { let s = 0; for (let n = fam.n0; n <= N; n++) s += c[n] * fam.phi(n, x, L); return s; }
/** 파동(감쇠 k 포함): 모드마다 q'' + 2kq' + (ckₙ)²q = 0, q(0) = Bₙ, q'(0) = Vₙ. */
function modalWave(fam, f, g, L, N, speed, k) {
  const B = eigenCoefficients(fam, f, L, N), V = eigenCoefficients(fam, g, L, N), om = n => speed * fam.k(n, L), q = [];
  for (let n = fam.n0; n <= N; n++) q[n] = om(n) === 0 ? (k > 0 ? t => B[n] + V[n] * (1 - Math.exp(-2 * k * t)) / (2 * k) : t => B[n] + V[n] * t) : dampedMode(B[n], V[n], om(n), k);
  const u = (x, t) => { let s = 0; for (let n = fam.n0; n <= N; n++) s += q[n](t) * fam.phi(n, x, L); return s; };
  return { family: fam, coef: B, velocity: V, mean: fam.n0 === 0 ? B[0] : 0, omega: om, damping: k, range: [0, L],
    amp: (n, t) => q[n](t), mode: (n, x, t) => q[n](t) * fam.phi(n, x, L), u };
}
/** 정상 상태 U(x) = A + Bx: 끝마다 고정(U = 끝 온도), 단열·중심(U′ = 0), 열 방출(U′ + hU = 0, 주위 온도 0). 양 끝 단열이면 [0, 0]입니다. */
function steadyLine(fam, L, left, right) {
  const [[a1, b1, c1], [a2, b2, c2]] = fam.ends.map((e, i) => { const x = i ? L : 0; return e === 'fixed' ? [1, x, i ? right : left] : e === 'robin' ? [fam.h, 1 + fam.h * x, 0] : [0, 1, 0]; });
  const det = a1 * b2 - a2 * b1;
  return Math.abs(det) < 1e-12 ? [0, 0] : [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
}
/** 열: 정상 상태 U(x)를 빼고 모드마다 e^(−c²kₙ²t)로 줄어듭니다. 양 끝 단열이면 평균(0번 모드)으로 갑니다. */
function modalHeat(fam, f, L, N, alpha, left, right) {
  const [A, B] = steadyLine(fam, L, left, right), steady = x => A + B * x;
  const c = eigenCoefficients(fam, x => f(x) - steady(x), L, N), rate = n => alpha * fam.k(n, L) ** 2;
  const mean = fam.n0 === 0 ? c[0] : undefined, limit = x => steady(x) + (mean ?? 0);
  return { family: fam, range: [0, L], coef: c, rate, steady, steadyAB: [A, B], mean, limit, limitName: mean === undefined ? '정상 상태' : '평균 온도',
    u: (x, t) => { let s = steady(x); for (let n = fam.n0; n <= N; n++) s += c[n] * fam.phi(n, x, L) * Math.exp(-rate(n) * t); return s; },
    mode: (n, x, t) => c[n] * fam.phi(n, x, L) * Math.exp(-rate(n) * t), amp: (n, t) => c[n] * Math.exp(-rate(n) * t) };
}
