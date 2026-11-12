'use strict';
/* 예제 제작: 유형과 숫자로 문제와 유도 과정이 담긴 풀이를 만듭니다. 계수는 모두 정확한 값(유리수 × π의 거듭제곱)입니다. */
const gcdInt = (a, b) => b ? gcdInt(b, a % b) : Math.abs(a);
class Q {
  /** n/d × π^p */
  constructor(n, d = 1, p = 0) { const g = gcdInt(n, d) || 1, s = d < 0 ? -1 : 1; this.n = s * n / g; this.d = s * d / g; this.p = p; }
  times(o) { return new Q(this.n * o.n, this.d * o.d, this.p + o.p); }
  over(o) { return new Q(this.n * o.d, this.d * o.n, this.p - o.p); }
  get value() { return this.n / this.d * PI ** this.p; }
  get zero() { return this.n === 0; }
  /** 4/(3π), −2/3, π²/3 꼴의 글자입니다. */
  toString() {
    if (!this.n) return '0';
    const sign = this.n < 0 ? '−' : '', a = Math.abs(this.n);
    const piText = q => q === 1 ? 'π' : `π²`.replace('²', q === 2 ? '²' : `^${q}`);
    const top = this.p > 0 ? `${a === 1 ? '' : a}${piText(this.p)}` : String(a);
    const bottomParts = (this.d !== 1 ? String(this.d) : '') + (this.p < 0 ? piText(-this.p) : '');
    if (!bottomParts) return sign + top;
    return `${sign}${top}/${bottomParts.length > 1 ? `(${bottomParts})` : bottomParts}`;
  }
}
const K_VALUES = [[1, new Q(1)], [2, new Q(2)], [3, new Q(3)], [.5, new Q(1, 2)]];
const L_VALUES = [['pi', PI, new Q(1, 1, 1), 'π'], ['1', 1, new Q(1), '1'], ['2', 2, new Q(2), '2']];
const kQ = k => K_VALUES.find(v => v[0] === k)[1];
const lEntry = key => L_VALUES.find(v => v[0] === key);
const kText = k => kQ(k).toString();

const mFrac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
const mInt = (a, b) => `<span class="int"><span class="ig">∫</span><span class="lim"><span>${b}</span><span>${a}</span></span></span>`;
const v = s => `<i>${s}</i>`;
const eq = s => `<div class="eq">${s}</div>`;
const argOf = (n, Lk) => Lk === 'pi' ? `${n}${v('x')}` : `${n}π${v('x')}/${lEntry(Lk)[3]}`;
const NX = Lk => argOf(v('n'), Lk);
const sgnN = '(−1)<sup><i>n</i></sup>';

/** 공통 유도 조각: 사인·코사인 적분 공식 */
const piece = {
  sinInt: Lk => eq(`${mInt('0', 'L')}sin ${NX(Lk)} ${v('dx')} = ${mFrac('L', v('n') + 'π')}(1 − cos ${v('n')}π) = ${mFrac('L', v('n') + 'π')}(1 − ${sgnN})`),
  cosInt: Lk => eq(`${mInt('0', 'L')}cos ${NX(Lk)} ${v('dx')} = ${mFrac('L', v('n') + 'π')} sin ${v('n')}π = 0`),
  xSin: Lk => eq(`${mInt('0', 'L')}${v('x')} sin ${NX(Lk)} ${v('dx')} = [−${mFrac('L', v('n') + 'π')}${v('x')} cos ${NX(Lk)}]<sub>0</sub><sup>L</sup> + ${mFrac('L', v('n') + 'π')}${mInt('0', 'L')}cos ${NX(Lk)} ${v('dx')} = −${mFrac('L²', v('n') + 'π')}${sgnN}`),
  xCos: Lk => eq(`${mInt('0', 'L')}${v('x')} cos ${NX(Lk)} ${v('dx')} = [${mFrac('L', v('n') + 'π')}${v('x')} sin ${NX(Lk)}]<sub>0</sub><sup>L</sup> − ${mFrac('L', v('n') + 'π')}${mInt('0', 'L')}sin ${NX(Lk)} ${v('dx')} = ${mFrac('L²', v('n') + '²π²')}(${sgnN} − 1)`),
  x2Cos: Lk => eq(`${mInt('0', 'L')}${v('x')}² cos ${NX(Lk)} ${v('dx')} = [${mFrac('L', v('n') + 'π')}${v('x')}² sin ${NX(Lk)}]<sub>0</sub><sup>L</sup> − ${mFrac('2L', v('n') + 'π')}${mInt('0', 'L')}${v('x')} sin ${NX(Lk)} ${v('dx')} = ${mFrac('2L³', v('n') + '²π²')}${sgnN}`),
};
const ONE_MINUS = n => 1 - (n % 2 ? -1 : 1);
const MINUS_ONE = n => (n % 2 ? -1 : 1) - 1;

/* 각 유형: a0·an·bn의 일반식 = m × f(n)이고, m은 k, L로 정확히 계산합니다. */
const FAMILIES = [
  { id: 'sign', title: '사각파 (기함수)', mode: 'full', expr: 'k*sign(x)', statement: (k, Lk) => `${v('f')}(${v('x')}) = −${kText(k)} (−${lEntry(Lk)[3]} &lt; ${v('x')} &lt; 0), ${kText(k)} (0 &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})`,
    a0: () => new Q(0), a: null, b: { m: k => kQ(k).times(new Q(2)).over(new Q(1, 1, 1)), text: `(1 − ${sgnN})/${v('n')}`, f: n => ONE_MINUS(n) / n },
    steps: (k, Lk) => [
      ['대칭 확인', `주어진 함수는 기함수입니다. 기함수 × cos ${NX(Lk)}는 기함수이므로 적분이 0이 되어 ${v('a')}<sub>0</sub> = 0, ${v('a<sub>n</sub>')} = 0입니다.`],
      ['사인 계수 식', `기함수 × sin ${NX(Lk)}는 우함수이므로 구간의 절반만 두 번 계산합니다.${eq(`${v('b<sub>n</sub>')} = ${mFrac('1', 'L')}${mInt('−L', 'L')}${v('f')}(${v('x')}) sin ${NX(Lk)} ${v('dx')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k')} sin ${NX(Lk)} ${v('dx')}`)}`],
      ['적분', piece.sinInt(Lk)],
    ] },
  { id: 'step', title: '한쪽만 켜진 펄스', mode: 'full', expr: 'x>0 ? k : 0', statement: (k, Lk) => `${v('f')}(${v('x')}) = 0 (−${lEntry(Lk)[3]} &lt; ${v('x')} &lt; 0), ${kText(k)} (0 &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})`,
    a0: k => kQ(k).over(new Q(2)), a: null, b: { m: k => kQ(k).over(new Q(1, 1, 1)), text: `(1 − ${sgnN})/${v('n')}`, f: n => ONE_MINUS(n) / n },
    steps: (k, Lk) => [
      ['대칭 확인', '우함수도 기함수도 아니므로 세 계수를 모두 계산합니다. 함수가 0이 아닌 구간은 (0, L)뿐입니다.'],
      ['상수항', eq(`${v('a')}<sub>0</sub> = ${mFrac('1', '2L')}${mInt('0', 'L')}${v('k')} ${v('dx')} = ${mFrac(v('k'), '2')}`)],
      ['코사인 계수', `${eq(`${v('a<sub>n</sub>')} = ${mFrac('1', 'L')}${mInt('0', 'L')}${v('k')} cos ${NX(Lk)} ${v('dx')}`)}${piece.cosInt(Lk)}따라서 ${v('a<sub>n</sub>')} = 0입니다.`],
      ['사인 계수', `${eq(`${v('b<sub>n</sub>')} = ${mFrac('1', 'L')}${mInt('0', 'L')}${v('k')} sin ${NX(Lk)} ${v('dx')}`)}${piece.sinInt(Lk)}`],
    ] },
  { id: 'linear', title: '일차함수 (기함수)', mode: 'full', expr: 'k*x', statement: (k, Lk) => `${v('f')}(${v('x')}) = ${k === 1 ? '' : kText(k)}${v('x')} (−${lEntry(Lk)[3]} &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})`,
    a0: () => new Q(0), a: null, b: { m: (k, Lk) => kQ(k).times(new Q(2)).times(lEntry(Lk)[2]).over(new Q(1, 1, 1)), text: `(−1)<sup><i>n</i>+1</sup>/${v('n')}`, f: n => (n % 2 ? 1 : -1) / n },
    steps: (k, Lk) => [
      ['대칭 확인', `기함수이므로 ${v('a')}<sub>0</sub> = 0, ${v('a<sub>n</sub>')} = 0입니다.`],
      ['사인 계수 식', eq(`${v('b<sub>n</sub>')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k x')} sin ${NX(Lk)} ${v('dx')}`)],
      ['부분적분', `${piece.xSin(Lk)}경계항에서 cos ${v('n')}π = ${sgnN}이고, 남은 적분은 0입니다.`],
    ] },
  { id: 'abs', title: '절댓값 (우함수)', mode: 'full', expr: 'k*abs(x)', statement: (k, Lk) => `${v('f')}(${v('x')}) = ${k === 1 ? '' : kText(k)}|${v('x')}| (−${lEntry(Lk)[3]} &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})`,
    a0: (k, Lk) => kQ(k).times(lEntry(Lk)[2]).over(new Q(2)), a: { m: (k, Lk) => kQ(k).times(new Q(2)).times(lEntry(Lk)[2]).over(new Q(1, 1, 2)), text: `(${sgnN} − 1)/${v('n')}²`, f: n => MINUS_ONE(n) / (n * n) }, b: null,
    steps: (k, Lk) => [
      ['대칭 확인', `우함수이므로 ${v('b<sub>n</sub>')} = 0이고, 나머지는 구간의 절반으로 계산합니다.`],
      ['상수항', eq(`${v('a')}<sub>0</sub> = ${mFrac('1', 'L')}${mInt('0', 'L')}${v('k x')} ${v('dx')} = ${mFrac('kL', '2')}`)],
      ['코사인 계수 식', eq(`${v('a<sub>n</sub>')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k x')} cos ${NX(Lk)} ${v('dx')}`)],
      ['부분적분', piece.xCos(Lk)],
    ] },
  { id: 'square', title: '이차함수 (우함수)', mode: 'full', expr: 'k*x^2', statement: (k, Lk) => `${v('f')}(${v('x')}) = ${k === 1 ? '' : kText(k)}${v('x')}² (−${lEntry(Lk)[3]} &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})`,
    a0: (k, Lk) => kQ(k).times(lEntry(Lk)[2]).times(lEntry(Lk)[2]).over(new Q(3)), a: { m: (k, Lk) => kQ(k).times(new Q(4)).times(lEntry(Lk)[2]).times(lEntry(Lk)[2]).over(new Q(1, 1, 2)), text: `${sgnN}/${v('n')}²`, f: n => (n % 2 ? -1 : 1) / (n * n) }, b: null,
    steps: (k, Lk) => [
      ['대칭 확인', `우함수이므로 ${v('b<sub>n</sub>')} = 0입니다.`],
      ['상수항', eq(`${v('a')}<sub>0</sub> = ${mFrac('1', 'L')}${mInt('0', 'L')}${v('k x')}² ${v('dx')} = ${mFrac('kL²', '3')}`)],
      ['코사인 계수 식', eq(`${v('a<sub>n</sub>')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k x')}² cos ${NX(Lk)} ${v('dx')}`)],
      ['부분적분을 두 번', `${piece.x2Cos(Lk)}첫 경계항은 sin ${v('n')}π = 0으로 사라지고, 남은 적분은 위의 ${v('x')} sin 적분과 같습니다.`],
    ] },
  { id: 'halfsine', title: '반구간 사인 전개 (상수)', mode: 'sine', expr: 'k', statement: (k, Lk) => `${v('f')}(${v('x')}) = ${kText(k)} (0 &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})을 사인 급수로 전개`,
    a0: () => new Q(0), a: null, b: { m: k => kQ(k).times(new Q(2)).over(new Q(1, 1, 1)), text: `(1 − ${sgnN})/${v('n')}`, f: n => ONE_MINUS(n) / n },
    steps: (k, Lk) => [
      ['확장', `(0, L)의 함수를 기함수로 확장해 주기 2L인 함수로 봅니다. 확장한 함수는 사각파이므로 사인 항만 남습니다.`],
      ['사인 계수 식', eq(`${v('b<sub>n</sub>')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k')} sin ${NX(Lk)} ${v('dx')}`)],
      ['적분', piece.sinInt(Lk)],
    ] },
  { id: 'halfcos', title: '반구간 코사인 전개 (일차)', mode: 'cosine', expr: 'k*x', statement: (k, Lk) => `${v('f')}(${v('x')}) = ${k === 1 ? '' : kText(k)}${v('x')} (0 &lt; ${v('x')} &lt; ${lEntry(Lk)[3]})을 코사인 급수로 전개`,
    a0: (k, Lk) => kQ(k).times(lEntry(Lk)[2]).over(new Q(2)), a: { m: (k, Lk) => kQ(k).times(new Q(2)).times(lEntry(Lk)[2]).over(new Q(1, 1, 2)), text: `(${sgnN} − 1)/${v('n')}²`, f: n => MINUS_ONE(n) / (n * n) }, b: null,
    steps: (k, Lk) => [
      ['확장', '(0, L)의 함수를 우함수로 확장합니다. 확장한 함수는 삼각파이므로 코사인 항만 남습니다.'],
      ['상수항', eq(`${v('a')}<sub>0</sub> = ${mFrac('1', 'L')}${mInt('0', 'L')}${v('k x')} ${v('dx')} = ${mFrac('kL', '2')}`)],
      ['코사인 계수 식', eq(`${v('a<sub>n</sub>')} = ${mFrac('2', 'L')}${mInt('0', 'L')}${v('k x')} cos ${NX(Lk)} ${v('dx')}`)],
      ['부분적분', piece.xCos(Lk)],
    ] },
];

/** n = 1, 2, …의 정확한 계수입니다. f(n)은 유리수이므로 Q로 바꿉니다. */
function coefExact(part, k, Lk, n) {
  if (!part) return new Q(0);
  const value = part.f(n), scale = n * n;
  return part.m(k, Lk).times(new Q(Math.round(value * scale), scale));
}
function exampleOf(famId, k, Lk) {
  const fam = FAMILIES.find(f => f.id === famId), Lv = lEntry(Lk)[1];
  const a0 = fam.a0(k, Lk);
  const lead = m => { const t = m.toString(); return t === '1' ? '' : t === '−1' ? '−' : t.includes('/') ? `(${t}) · ` : `${t} · `; };
  const part = (name, p) => p ? `${name} = ${lead(p.m(k, Lk))}${p.text}` : `${name} = 0`;
  const nameA = v('a<sub>n</sub>'), nameB = v('b<sub>n</sub>');
  const series = [];
  if (!a0.zero) series.push(a0.toString());
  for (let n = 1; n <= 7 && series.length < 5; n++) for (const [p, tr] of [[fam.a, 'cos'], [fam.b, 'sin']]) {
    const c = coefExact(p, k, Lk, n);
    if (c.zero) continue;
    const abs = new Q(Math.abs(c.n), c.d, c.p), size = abs.toString() === '1' ? '' : `${abs} `, arg = Lk === 'pi' ? `${n === 1 ? '' : n}${v('x')}` : `${n === 1 ? '' : n}π${v('x')}/${lEntry(Lk)[3]}`;
    series.push(`${series.length ? (c.n < 0 ? ' − ' : ' + ') : (c.n < 0 ? '−' : '')}${size}${tr} ${arg}`);
  }
  const conclusion = `${v('a')}<sub>0</sub> = ${a0}, &nbsp; ${part(nameA, fam.a)}, &nbsp; ${part(nameB, fam.b)}`;
  return { fam, k, Lk, L: Lv, id: `${famId}|${k}|${Lk}`,
    problem: `${fam.mode === 'full' ? `주기 ${Lk === 'pi' ? '2π' : 2 * Lv}인 함수 ` : ''}${fam.statement(k, Lk)}의 Fourier ${fam.mode === 'full' ? '급수를' : '계수를'} 구하시오.`,
    steps: [...fam.steps(k, Lk), ['결과', `${v('k')} = ${kText(k)}, L = ${lEntry(Lk)[3]}을 대입하고 ${sgnN} 값을 정리합니다.${eq(conclusion)}${eq(`${v('f')}(${v('x')}) = ${series.join('')} + ⋯`)}`]],
    source: { expr: fam.expr, params: fam.expr.includes('k') ? { k } : {} } };
}
