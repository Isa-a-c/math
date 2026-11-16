'use strict';
/* 고유함수 엔진. 고유값 문제(구간 (0, L)의 F'' + k²F = 0, 원판의 Bessel 방정식, Legendre 방정식)의 해를 종류 표(FAMILIES) 한 줄씩으로 두고,
   계수 계산(전개)과 시간 변화(파동·감쇠·열)는 종류와 상관없이 같은 코드가 합니다.
   한 줄에 담는 것: 양 끝 조건(ends), 고유값 kₙ, 고유함수 φₙ, 그리고 필요하면 가중치 w(x), 노름 ∫wφₙ², 수치로 구한 고유값,
   값이 있는 종류(열 방출 계수 h처럼)는 make(cfg). 새 경계조건이나 새 고유함수는 이 표에 한 줄을 더합니다. */
const qk = n => 2 * n - 1;
const SUBS = '₀₁₂₃₄₅₆₇₈₉', subDigits = n => String(n).split('').map(d => SUBS[d]).join('');

/* ── Bessel 함수 Jₘ과 근 ─────────────────────────── */
/** 큰 x의 Jₘ(x): Hankel 점근 전개 √(2/πx)(P cos χ − Q sin χ), χ = x − (m/2 + 1/4)π. 항이 1e-17보다 작아지거나 커지기 시작하면 멈춥니다. */
function besselAsym(m, x) {
  const mu = 4 * m * m, z = 8 * x;
  let P = 0, Q = 0, term = 1, prev = Infinity;
  for (let k = 0; k < 80; k++) {
    const a = Math.abs(term);
    if (a > prev) break;
    if (k % 2 === 0) P += (k / 2) % 2 ? -term : term; else Q += ((k - 1) / 2) % 2 ? -term : term;
    if (a < 1e-17) break;
    prev = a; term *= (mu - (2 * k + 1) ** 2) / ((k + 1) * z);
  }
  const chi = x - (m / 2 + .25) * PI;
  return Math.sqrt(2 / (PI * x)) * (P * Math.cos(chi) - Q * Math.sin(chi));
}
/** Jₘ(x) (정수 m). x가 작으면 역방향 점화식 J_{k−1} = (2k/x)J_k − J_{k+1}과 1 = J₀ + 2(J₂ + J₄ + …)(Miller 방법), 크면 점근 전개. 오차 약 1e-15입니다. */
function besselJ(m, x) {
  if (m < 0) return (m % 2 ? -1 : 1) * besselJ(-m, x);
  const ax = Math.abs(x);
  if (ax < 1e-8) { let t = 1; for (let k = 1; k <= m; k++) t *= ax / 2 / k; return x < 0 && m % 2 ? -t : t; }
  if (ax >= 25 + m * m) { const v = besselAsym(m, ax); return x < 0 && m % 2 ? -v : v; }
  const top = Math.max(m, ax), M = 2 * Math.ceil((top + Math.sqrt(160 * top) + 12) / 2);
  let jp = 0, j = 1e-30, sum = 0, res = 0;
  for (let k = M; k > 0; k--) {
    const jm = 2 * k / ax * j - jp;   // J_{k−1} (아직 비율만 맞음)
    jp = j; j = jm;
    if (Math.abs(j) > 1e200) { j *= 1e-200; jp *= 1e-200; sum *= 1e-200; res *= 1e-200; }
    if (k - 1 === m) res = j;
    if (k - 1 > 0 && (k - 1) % 2 === 0) sum += j;
  }
  const v = res / (j + 2 * sum);
  return x < 0 && m % 2 ? -v : v;
}
const besselJ0 = x => besselJ(0, x), besselJ1 = x => besselJ(1, x);
/** Jₘ′(x) = (J_{m−1} − J_{m+1})/2 */
const besselJd = (m, x) => (besselJ(m - 1, x) - besselJ(m + 1, x)) / 2;
const BESSEL_ROOTS = new Map();
/** Jₘ(x) = 0(d = 0) 또는 Jₘ′(x) = 0(d = 1)의 n번째 양의 근. x = m(첫 근보다 앞)부터 0.1씩 부호가 바뀌는 곳을 찾고 이분법으로 좁힙니다. */
function besselRoot(m, n, d = 0) {
  const key = `${m}|${d}`, list = BESSEL_ROOTS.get(key) ?? [], g = d ? x => besselJd(m, x) : x => besselJ(m, x);
  BESSEL_ROOTS.set(key, list);
  while (list.length < n) {
    let lo = list.length ? list.at(-1) + 1e-6 : Math.max(m, .1), hi = lo + .1;
    const sLo = Math.sign(g(lo));
    while (Math.sign(g(hi)) === sLo) { lo = hi; hi += .1; }
    for (let i = 0; i < 200 && hi - lo > 4e-16 * hi; i++) { const mid = (lo + hi) / 2; if (Math.sign(g(mid)) === sLo) lo = mid; else hi = mid; }
    list.push((lo + hi) / 2);
  }
  return list[n - 1];
}
/** Jₒ(x) = 0의 n번째 양의 근(예전 이름). */
const besselZero = (order, n) => besselRoot(order, n, 0);
/** 원판의 각 방향 차수 m(처음 모양 f(r)cos mθ). 주제가 각 방향을 허락할 때(cfg.angular)만 씁니다. */
const besselOrder = cfg => cfg?.angular ? Math.max(0, Math.min(5, Math.round(Number(cfg.mAng) || 0))) : 0;
/** 원판의 고유함수 Jₘ(kr): 가장자리 r = R에서 값 0(rim 'fixed') 또는 기울기 0('free'). 가중치 r로 직교합니다. */
function besselFamily(rim, m = 0) {
  const fixed = rim === 'fixed', id = fixed ? 'bessel' : 'besselFree', z = n => besselRoot(m, n, fixed ? 0 : 1);
  const n0 = !fixed && m === 0 ? 0 : 1, a = fixed ? '\\alpha' : '\\beta', ap = fixed ? 'α' : 'β', Jm = `J_{${m}}`, k = (n, L) => n ? z(n) / L : 0;
  const rootEq = fixed ? `${Jm}(${a}) = 0` : m ? `${Jm}'(${a}) = 0` : String.raw`J_0'(\beta) = -J_1(\beta) = 0`;
  return { id, ends: ['center', rim], n0, radial: true, m, key: `${id}:${m}`, make: cfg => besselFamily(rim, besselOrder(cfg)),
    k, phi: (n, x, L) => n ? besselJ(m, z(n) * x / L) : 1, w: x => x,
    norm: (n, L) => n ? L * L / 2 * (fixed ? besselJ(m + 1, z(n)) ** 2 : (1 - m * m / z(n) ** 2) * besselJ(m, z(n)) ** 2) : L * L / 2,
    ode: m ? String.raw`F'' + \frac{1}{r}F' + \left(k^2 - \frac{${m * m}}{r^2}\right)F = 0` : String.raw`F'' + \frac{1}{r}F' + k^2F = 0`,
    tex: String.raw`${Jm}\left(\frac{${a}_n r}{R}\right)`, kTex: String.raw`\frac{${a}_n}{R}`, plain: `J${subDigits(m)}(${ap}ₙr/R)`,
    title: `가장자리 r = R에서 ${fixed ? '값 0' : '기울기 0'}`,
    kMd: () => `$k_n = ${a}_n/R$, $${a}_n$은 $${rootEq}$의 ${n0 ? '양의 근' : '근'}(${[...(n0 ? [] : ['$\\beta_0 = 0$']), ...[1, 2, 3].map(n => `$${a}_${n} \\approx ${fmt(z(n), 4)}$`)].join(', ')})입니다.`,
    coefTex: (c, f) => {
      const J = String.raw`${Jm}\left(\frac{${a}_n r}{R}\right)`, I = String.raw`\int_0^R r\,${f}${J}\,dr`;
      if (fixed) return String.raw`${c}_n = \frac{2}{R^2J_{${m + 1}}(\alpha_n)^2}${I}`;
      if (m) return String.raw`${c}_n = \frac{2\beta_n^2}{R^2(\beta_n^2 - ${m * m})${Jm}(\beta_n)^2}${I}`;
      return String.raw`${c}_n = \frac{2}{R^2J_0(\beta_n)^2}${I},\quad ${c}_0 = \frac{2}{R^2}\int_0^R r\,${f}\,dr`;
    },
    label: n => n ? `J${subDigits(m)}(${ap}${subDigits(n)}<i>r</i>/<i>R</i>)` : '1' };
}

/* ── 열 방출(Robin) 끝: kₙ은 방정식의 근 ─────────────── */
/** 열 방출 계수 h(cfg.hRobin). 계산 단계에서 positive로 따로 검사하므로 여기서는 틀리면 1로 둡니다. */
const robinH = cfg => { try { const h = constant(cfg?.hRobin ?? '1', 1); return h > 0 ? h : 1; } catch { return 1; } };
/** x = 0 끝 조건을 만족하는 해 ψ = A(kx)와 그 도함수 [ψ, ψ′] (k → 0에서도 나누지 않는 꼴). 열 방출은 x = 0에서 ψ′ = hψ입니다. */
const robinBasis = (left, h, k, x) => left === 'fixed' ? [Math.sin(k * x), k * Math.cos(k * x)] : left === 'free' ? [Math.cos(k * x), -k * Math.sin(k * x)]
  : [k * Math.cos(k * x) + h * Math.sin(k * x), -k * k * Math.sin(k * x) + h * k * Math.cos(k * x)];
const ROBIN_ROOTS = new Map();
/** 한쪽 이상이 열 방출인 끝 조건의 n번째 고유값 kₙ. ((n−1)π/L, nπ/L)에 근이 하나씩 있으므로 이분법으로 구합니다. */
function robinRoot(left, right, h, L, n) {
  const key = `${left}|${right}|${h}|${L}`, list = ROBIN_ROOTS.get(key) ?? [];
  ROBIN_ROOTS.set(key, list);
  const g = k => { const [v, d] = robinBasis(left, h, k, L); return right === 'fixed' ? v : right === 'free' ? d : d + h * v; };
  while (list.length < n) {
    const m = list.length + 1;
    let lo = ((m - 1) + 1e-9) * PI / L, hi = m * PI / L;
    const sLo = Math.sign(g(lo));
    for (let i = 0; i < 200 && hi - lo > 4e-16 * hi; i++) { const mid = (lo + hi) / 2; if (Math.sign(g(mid)) === sLo) lo = mid; else hi = mid; }
    list.push((lo + hi) / 2);
  }
  return list[n - 1];
}
const ROBIN_END = { fixed: ['값 0', '값 0'], free: ['기울기 0', '기울기 0'], robin: ['u′ − hu = 0', 'u′ + hu = 0'] };
/** 한쪽 이상이 열 방출(x = 0에서 u_x − hu = 0, x = L에서 u_x + hu = 0, 주위 온도 0)인 고유함수 종류입니다. */
function robinFamily(left, right, h = 1) {
  const id = left === 'fixed' && right === 'robin' ? 'rsine' : left === 'free' && right === 'robin' ? 'rcosine' : `robin-${left}-${right}`;
  const k = (n, L) => robinRoot(left, right, h, L, n);
  const phi = left === 'fixed' ? (n, x, L) => Math.sin(k(n, L) * x) : left === 'free' ? (n, x, L) => Math.cos(k(n, L) * x)
    : (n, x, L) => { const q = k(n, L); return Math.cos(q * x) + h / q * Math.sin(q * x); };
  const eq = left === 'robin' && right === 'robin' ? String.raw`\tan kL = \frac{2hk}{k^2 - h^2}` : [left, right].includes('fixed') ? String.raw`\tan kL = -k/h` : String.raw`k\tan kL = h`;
  const tex = { fixed: String.raw`\sin k_{n}x`, free: String.raw`\cos k_{n}x`, robin: String.raw`\left(\cos k_{n}x + \frac{h}{k_n}\sin k_{n}x\right)` }[left];
  const plain = { fixed: 'sin(kₙx)', free: 'cos(kₙx)', robin: 'cos kₙx + (h/kₙ)sin kₙx' }[left];
  return { id, ends: [left, right], n0: 1, h, key: `${id}:${h}`, make: cfg => robinFamily(left, right, robinH(cfg)), k, phi,
    norm: (n, L) => {   // ∫₀ᴸ φ² dx (닫힌 꼴)
      const q = k(n, L), c2 = L / 2 + Math.sin(2 * q * L) / (4 * q), s2 = L - c2;
      return left === 'fixed' ? s2 : left === 'free' ? c2 : c2 + 2 * h / q * Math.sin(q * L) ** 2 / (2 * q) + (h / q) ** 2 * s2;
    },
    tex, kTex: 'k_n', plain, title: `x = 0에서 ${ROBIN_END[left][0]}, x = L에서 ${ROBIN_END[right][1]}`,
    kMd: L => `$k_n$은 $${eq}$의 양의 근입니다${isFinite(L) ? `($h = ${fmt(h, 3)}$: ${[1, 2, 3].map(n => `$k_${n} \\approx ${fmt(k(n, L), 4)}$`).join(', ')})` : ''}.`,
    label: n => { const kn = `<i>k</i>${subDigits(n)}<i>x</i>`; return left === 'fixed' ? `sin(${kn})` : left === 'free' ? `cos(${kn})` : `cos(${kn}) + (<i>h</i>/<i>k</i>${subDigits(n)})sin(${kn})`; } };
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
  robinFamily('fixed', 'robin'),
  robinFamily('free', 'robin'),
  robinFamily('robin', 'fixed'),
  robinFamily('robin', 'free'),
  robinFamily('robin', 'robin'),
  // 원판(반지름 방향, 가중치 r). x 자리가 반지름 r, L이 반지름 R입니다. 각 방향 차수 m은 make(cfg)가 넣습니다.
  besselFamily('fixed'),
  besselFamily('free'),
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
/** 정상 상태 U(x) = A + Bx: 끝마다 고정(U = 끝 온도), 단열·중심(U′ = 0), 열 방출(x = 0에서 U′ − hU = 0, x = L에서 U′ + hU = 0, 주위 온도 0). 양 끝 단열이면 [0, 0]입니다. */
function steadyLine(fam, L, left, right) {
  const [[a1, b1, c1], [a2, b2, c2]] = fam.ends.map((e, i) => { const x = i ? L : 0; return e === 'fixed' ? [1, x, i ? right : left] : e === 'robin' ? [fam.h, (i ? 1 : -1) + fam.h * x, 0] : [0, 1, 0]; });
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
