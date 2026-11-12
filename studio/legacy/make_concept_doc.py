"""개념 설명 Word 문서(web/concept_fourier.docx, web/concept_pde.docx)를 만듭니다. 프로그램은 이 파일을 그대로 내보냅니다.

내용을 고친 뒤 다시 실행: python make_concept_doc.py (matplotlib, numpy 필요)
수식은 Word에서 고칠 수 있는 수식 개체로 넣습니다.
"""
import io
import zipfile
from math import erf
from pathlib import Path
from xml.sax.saxutils import escape

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

WEB = Path(__file__).resolve().parent / 'web'
PI = np.pi
BLUE, HOT, INK, BAND, GREEN = '#1f5fd0', '#d4500f', '#111827', '#eef2fb', '#1f7a4d'
plt.rcParams.update({'font.family': ['Malgun Gothic', 'DejaVu Sans'], 'mathtext.fontset': 'stix', 'font.size': 10, 'axes.axisbelow': True,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': '#e5e7eb', 'grid.linewidth': .7})


# ── 수식 조각 ─────────────────────────────────────────
def mr(text, upright=False):
    pr = '<m:rPr><m:sty m:val="p"/></m:rPr>' if upright else ''
    return f'<m:r>{pr}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">{escape(text)}</m:t></m:r>'


def mx(*parts):
    return ''.join(p if p.startswith('<m:') else mr(p) for p in parts)


def sub(base, s):
    return f'<m:sSub><m:e>{mx(base)}</m:e><m:sub>{mx(s)}</m:sub></m:sSub>'


def sup(base, s):
    return f'<m:sSup><m:e>{mx(base)}</m:e><m:sup>{mx(s)}</m:sup></m:sSup>'


def frac(a, b):
    return f'<m:f><m:num>{mx(a)}</m:num><m:den>{mx(b)}</m:den></m:f>'


def nary(symbol, lo, hi, *body):
    return (f'<m:nary><m:naryPr><m:chr m:val="{symbol}"/><m:limLoc m:val="{"undOvr" if symbol == "∑" else "subSup"}"/></m:naryPr>'
            f'<m:sub>{mx(lo)}</m:sub><m:sup>{mx(hi)}</m:sup><m:e>{mx(*body)}</m:e></m:nary>')


def fn(name, *arg):
    return f'<m:func><m:fName>{mr(name, True)}</m:fName><m:e>{mx(*arg)}</m:e></m:func>'


def integral(lo, hi, *body):
    return nary('∫', lo, hi, *body)


def sigma(*body):
    return nary('∑', 'n=1', '∞', *body)


COS, SIN = (lambda *a: fn('cos', *a)), (lambda *a: fn('sin', *a))
A0, AN, BN, AM = sub('a', '0'), sub('a', 'n'), sub('b', 'n'), sub('a', 'm')
DX = ' dx'
TERM = mx(AN, ' ', COS('nx'), ' + ', BN, ' ', SIN('nx'))


# ── 문단 조각 ─────────────────────────────────────────
class Math:
    def __init__(self, *parts):
        self.xml = f'<m:oMath>{mx(*parts)}</m:oMath>'


class Bold:
    def __init__(self, text):
        self.xml = f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def inline(items):
    out = []
    for item in items:
        out.append(item.xml if isinstance(item, (Math, Bold)) else f'<w:r><w:t xml:space="preserve">{escape(item)}</w:t></w:r>')
    return ''.join(out)


m = Math
B = Bold
BODY, IMAGES = [], []


def P(*items, style=None):
    pr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    BODY.append(f'<w:p>{pr}{inline(items)}</w:p>')


def KEY(*items):
    P(*items, style='Point')


def H(text):
    BODY.append(f'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>{escape(text)}</w:t></w:r></w:p>')


def EQ(*parts):
    BODY.append(f'<w:p><w:pPr><w:pStyle w:val="Equation"/></w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>{mx(*parts)}</m:oMath></m:oMathPara></w:p>')


def FIG(fig, caption):
    """그림과 설명을 넣습니다. 번호는 넣는 순서대로 붙습니다."""
    buffer = io.BytesIO()
    fig.savefig(buffer, format='png', dpi=200)
    plt.close(fig)
    IMAGES.append(buffer.getvalue())
    i = len(IMAGES)
    width, height = fig.get_size_inches()
    cx = 5760000  # 본문 폭 16 cm
    cy = int(cx * height / width)
    alt = escape(caption, {'"': '&quot;'})
    BODY.append(
        f'<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
        f'<wp:docPr id="{i}" name="그림 {i}" descr="{alt}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        f'<pic:nvPicPr><pic:cNvPr id="{i}" name="fig{i}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdFig{i}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>')
    P(f'그림 {i}. {caption}', style='Caption')


# ── 그래프 ───────────────────────────────────────────
def pi_ticks(ax, lo, hi, step=PI / 2):
    names = {-3: '−3π/2', -2: '−π', -1: '−π/2', 0: '0', 1: 'π/2', 2: 'π', 3: '3π/2', -6: '−3π', -4: '−2π', 4: '2π', 6: '3π'}
    k = np.arange(np.ceil(lo / step), np.floor(hi / step) + 1)
    ax.set_xticks(k * step)
    ax.set_xticklabels([names[int(round(i * step / (PI / 2)))] for i in k])


def panels(n=1, height=2.3, **kw):
    fig, axes = plt.subplots(1, n, figsize=(6.3, height), layout='constrained', **kw)
    return fig, np.atleast_1d(axes)


def periodic(f, L=PI):
    return lambda x: f((np.asarray(x) + L) % (2 * L) - L)


def coefficients(f, L=PI, N=100, q=40000):
    """중점 규칙으로 계수를 구합니다."""
    h = 2 * L / q
    x = -L + (np.arange(q) + .5) * h
    y = f(x)
    n = np.arange(1, N + 1)[:, None]
    return np.mean(y), (np.cos(n * PI * x / L) @ y) * h / L, (np.sin(n * PI * x / L) @ y) * h / L


def partial(coef, x, N, L=PI):
    a0, a, b = coef
    n = np.arange(1, N + 1)[:, None]
    return a0 + (a[:N] @ np.cos(n * PI * x / L)) + (b[:N] @ np.sin(n * PI * x / L))


def broken(x, y, tol=.5):
    """도약에서 세로선이 생기지 않도록 끊습니다."""
    y = np.asarray(y, float).copy()
    y[1:][np.abs(np.diff(y)) > tol] = np.nan
    return y


square = periodic(np.sign)
triangle = periodic(np.abs)
saw = periodic(lambda x: x)
XX = np.linspace(-1.5 * PI, 1.5 * PI, 3000)
SQ = coefficients(square)
TRI = coefficients(triangle)


def fig_periodic():
    fig, (ax,) = panels(height=2.1)
    x = np.linspace(-3 * PI, 3 * PI, 2000)
    ax.axvspan(-PI, PI, color=BAND, zorder=0)
    ax.plot(x, np.sin(x) + .5 * np.sin(2 * x) + .3 * np.cos(3 * x), color=BLUE, lw=1.8)
    ax.annotate('', xy=(PI, 1.75), xytext=(-PI, 1.75), arrowprops={'arrowstyle': '<->', 'color': HOT})
    ax.text(0, 1.85, '한 주기 $p$ = 2π', color=HOT, ha='center', va='bottom')
    ax.set_ylim(-2, 2.4)
    pi_ticks(ax, -3 * PI, 3 * PI, PI)
    ax.set_xlabel('$x$')
    return fig


def fig_family():
    fig, axes = panels(2, sharey=True)
    x = np.linspace(-PI, PI, 800)
    for ax, n in zip(axes, (1, 3)):
        name = '' if n == 1 else n
        ax.plot(x, np.sin(n * x), color=BLUE, lw=1.8, label=f'sin {name}$x$')
        ax.plot(x, np.cos(n * x), color=HOT, lw=1.5, ls='--', label=f'cos {name}$x$')
        ax.set_title(f'$n$ = {n}', fontsize=10)
        ax.legend(loc='lower right', frameon=False, fontsize=8, ncols=2)
        ax.set_ylim(-1.6, 1.3)
        pi_ticks(ax, -PI, PI)
    return fig


def fig_partial():
    fig, axes = panels(3, height=2.2, sharey=True)
    for ax, N in zip(axes, (1, 3, 15)):
        ax.axvspan(-PI, PI, color=BAND, zorder=0)
        ax.plot(XX, broken(XX, square(XX)), color=INK, lw=1.4, label='$f(x)$')
        ax.plot(XX, partial(SQ, XX, N), color=BLUE, lw=1.5, label='부분합')
        ax.set_title(f'$S_{{{N}}}$', fontsize=10)
        pi_ticks(ax, -PI, PI, PI)
    fig.legend(*axes[0].get_legend_handles_labels(), loc='outside lower center', frameon=False, fontsize=8, ncols=2)
    return fig


def fig_decay():
    fig, axes = panels(2, height=2.1, sharey=True)
    n = np.arange(1, 13)
    for ax, values, title in ((axes[0], np.abs(SQ[2][:12]), '사각파 |$b_n$|: 1/$n$로 감소'), (axes[1], np.abs(TRI[1][:12]), '삼각파 |$a_n$|: 1/$n^2$으로 감소')):
        ax.bar(n, values, color=BLUE, width=.6)
        ax.set_title(title, fontsize=10)
        ax.set_xlabel('$n$')
        ax.set_xticks(n[1::2])
        ax.grid(axis='x', visible=False)
    return fig


def area(ax, x, y):
    ax.fill_between(x, y, 0, where=y >= 0, color=BLUE, alpha=.3, lw=0, label='양의 넓이')
    ax.fill_between(x, y, 0, where=y < 0, color=HOT, alpha=.3, lw=0, label='음의 넓이')
    ax.plot(x, y, color=INK, lw=1)
    ax.axhline(0, color='#6b7280', lw=.7)


def fig_ortho():
    fig, axes = panels(2, sharey=True)
    x = np.linspace(-PI, PI, 2000)
    area(axes[0], x, np.sin(2 * x) * np.sin(3 * x))
    axes[0].set_title('sin 2$x$ · sin 3$x$: 적분값 0', fontsize=10)
    area(axes[1], x, np.sin(2 * x) ** 2)
    axes[1].set_title('sin² 2$x$: 적분값 π', fontsize=10)
    axes[0].legend(loc='lower right', frameon=False, fontsize=8, ncols=2)
    axes[0].set_ylim(-1.4, 1.2)
    for ax in axes:
        pi_ticks(ax, -PI, PI)
    return fig


def fig_euler():
    fig, axes = panels(2)
    x = np.linspace(-PI + 1e-3, PI - 1e-3, 2000)
    axes[0].plot(x, x, color=INK, lw=1.5, label='$f(x) = x$')
    axes[0].plot(x, np.sin(x), color=BLUE, lw=1.5, ls='--', label='sin $x$')
    axes[0].legend(frameon=False, fontsize=8)
    axes[0].set_title('함수와 파동', fontsize=10)
    area(axes[1], x, x * np.sin(x))
    axes[1].set_title('곱의 넓이 = 2π, 따라서 $b_1$ = 2', fontsize=10)
    for ax in axes:
        pi_ticks(ax, -PI, PI)
    return fig


def fig_symmetry():
    fig, axes = panels(2)
    x = np.linspace(-PI, PI, 2000)
    area(axes[0], x, x ** 2 * np.sin(2 * x))
    axes[0].set_title('우함수 × 기함수: $x^2$ sin 2$x$', fontsize=10)
    area(axes[1], x, x * np.cos(2 * x))
    axes[1].set_title('기함수 × 우함수: $x$ cos 2$x$', fontsize=10)
    for ax in axes:
        pi_ticks(ax, -PI, PI)
    return fig


def fig_gibbs():
    fig, axes = panels(2, sharey=True)
    x = np.linspace(-1, 1, 3000)
    for ax, N in zip(axes, (15, 61)):
        ax.plot(x, broken(x, np.sign(x)), color=INK, lw=1.4)
        ax.plot(x, partial(SQ, x, N), color=BLUE, lw=1.3)
        ax.plot(0, 0, 'o', color=HOT, ms=5)
        ax.annotate('두 극한의 평균 0', (0, 0), (.15, -.35), color=HOT, fontsize=9, arrowprops={'arrowstyle': '-', 'color': HOT})
        ax.set_title(f'$S_{{{N}}}$', fontsize=10)
        ax.set_xlabel('$x$')
    return fig


def fig_scale():
    L = 2
    f = periodic(np.sign, L)
    coef = coefficients(f, L)
    x = np.linspace(-1.5 * L, 1.5 * L, 2000)
    fig, (ax,) = panels(height=2.1)
    ax.axvspan(-L, L, color=BAND, zorder=0)
    ax.plot(x, broken(x, f(x)), color=INK, lw=1.4, label='$f(x)$')
    ax.plot(x, partial(coef, x, 7, L), color=BLUE, lw=1.5, label='$S_7$')
    ax.set_xticks(np.arange(-3, 4))
    ax.set_xlabel('$x$')
    fig.legend(*ax.get_legend_handles_labels(), loc='outside lower center', frameon=False, fontsize=8, ncols=2)
    return fig


def fig_half():
    fig, axes = panels(3, height=2.2, sharey=True)
    tent = lambda x: np.where(x < PI / 2, x, PI - x)
    even = periodic(lambda x: tent(np.abs(x)))
    odd = periodic(lambda x: np.sign(x) * tent(np.abs(x)))
    x = np.linspace(0, PI, 400)
    axes[0].plot(x, tent(x), color=INK, lw=1.8)
    axes[0].set_title('주어진 함수', fontsize=10)
    for ax, f, title in ((axes[1], even, '우함수 확장: 코사인'), (axes[2], odd, '기함수 확장: 사인')):
        ax.plot(XX, f(XX), color=INK, lw=1.4)
        ax.plot(XX, partial(coefficients(f), XX, 7), color=BLUE, lw=1.3, ls='--')
        ax.set_title(title, fontsize=10)
    for ax in axes:
        ax.axvspan(0, PI, color=BAND, zorder=0)
        ax.set_xlim(-1.5 * PI, 1.5 * PI)
        pi_ticks(ax, -PI, PI, PI)
    return fig


# ── 문서 파일 ─────────────────────────────────────────
NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
FONT = '<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic" w:cs="Malgun Gothic"/>'


def style(sid, name, ppr='', rpr='', based='Normal', nxt='Normal'):
    base = f'<w:basedOn w:val="{based}"/>' if based else ''
    return f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>{base}<w:next w:val="{nxt}"/><w:qFormat/><w:pPr>{ppr}</w:pPr><w:rPr>{rpr}</w:rPr></w:style>'


STYLES = (
    f'{HEAD}<w:styles {NS}><w:docDefaults><w:rPrDefault><w:rPr>{FONT}<w:sz w:val="22"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>'
    '<w:pPrDefault><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:spacing w:after="120" w:line="312" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + style('Title', 'Title', '<w:spacing w:after="60"/>', '<w:b/><w:color w:val="111827"/><w:sz w:val="44"/>', nxt='Subtitle')
    + style('Subtitle', 'Subtitle', '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="1F5FD0"/></w:pBdr><w:spacing w:after="240"/>', '<w:color w:val="4B5563"/><w:sz w:val="22"/>')
    + style('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="1F3B73"/><w:sz w:val="30"/>')
    + style('Equation', 'Equation', '<w:spacing w:before="60" w:after="120"/><w:jc w:val="center"/>', '', nxt='Normal')
    + style('Figure', 'Figure', '<w:keepNext/><w:spacing w:before="120" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', '', nxt='Caption')
    + style('Caption', 'caption', '<w:spacing w:after="200"/><w:jc w:val="center"/>', '<w:color w:val="4B5563"/><w:sz w:val="18"/>')
    + style('Point', 'Point', '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="D4500F"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/><w:spacing w:before="120" w:after="160"/><w:ind w:left="200"/>', '')
    + '</w:styles>')
SECTION = ('<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/>'
           '<w:pgMar w:top="1417" w:right="1474" w:bottom="1417" w:left="1474" w:header="708" w:footer="567" w:gutter="0"/></w:sectPr>')
FOOTER = (f'{HEAD}<w:ftr {NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
          '<w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>'
          '<w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
SETTINGS = (f'{HEAD}<w:settings {NS}><m:mathPr><m:mathFont m:val="Cambria Math"/><m:defJc m:val="centerGroup"/></m:mathPr>'
            '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>')
TYPES = (f'{HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
         '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
         '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
         '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
         '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
         '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>')
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PACKAGE_RELS = (f'{HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{REL}/officeDocument" Target="word/document.xml"/>'
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')


def write_doc(name, title):
    """모아 둔 본문과 그림을 Word 파일로 쓰고 비웁니다."""
    core = (f'{HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
            f'<dc:title>{escape(title)}</dc:title><dc:language>ko-KR</dc:language></cp:coreProperties>')
    fig_rels = ''.join(f'<Relationship Id="rIdFig{i}" Type="{REL}/image" Target="media/fig{i}.png"/>' for i in range(1, len(IMAGES) + 1))
    doc_rels = (f'{HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="{REL}/styles" Target="styles.xml"/>'
                f'<Relationship Id="rIdSettings" Type="{REL}/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="{REL}/footer" Target="footer1.xml"/>{fig_rels}</Relationships>')
    out = WEB / name
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', TYPES)
        z.writestr('_rels/.rels', PACKAGE_RELS)
        z.writestr('docProps/core.xml', core)
        z.writestr('word/document.xml', f'{HEAD}<w:document {NS}><w:body>{"".join(BODY)}{SECTION}</w:body></w:document>')
        z.writestr('word/styles.xml', STYLES)
        z.writestr('word/settings.xml', SETTINGS)
        z.writestr('word/footer1.xml', FOOTER)
        z.writestr('word/_rels/document.xml.rels', doc_rels)
        for i, data in enumerate(IMAGES, 1):
            z.writestr(f'word/media/fig{i}.png', data)
    print(out, round(out.stat().st_size / 1024), 'KiB', len(IMAGES), 'figures')
    BODY.clear()
    IMAGES.clear()

# ── Fourier 문서 ──────────────────────────────────────
P('Fourier 급수 개념 정리', style='Title')
P('Kreyszig 공업수학 10판 하 · 11장', style='Subtitle')

H('1. 주기함수와 삼각함수')
P('어떤 양수 ', m('p'), '에 대해 모든 ', m('x'), '에서 아래 식이 성립하면 ', m('f'), '를 ', B('주기함수'), ', ', m('p'), '를 ', B('주기'), '라고 합니다.')
EQ('f(x+p) = f(x)')
P('주기가 ', m('p'), '이면 2', m('p'), ', 3', m('p'), '도 주기입니다. 한 주기의 모양이 그대로 반복되기 때문입니다. 가장 작은 양의 주기를 ', B('기본주기'), '라고 합니다.')
FIG(fig_periodic(), '같은 모양이 2π마다 반복되는 주기함수')
P('주기 2π인 가장 단순한 함수들이 ', B('삼각함수계'), '입니다. ', m('n'), '이 커질수록 한 주기 안에서 더 빠르게 진동합니다.')
EQ('1, ', COS('x'), ', ', SIN('x'), ', ', COS('2x'), ', ', SIN('2x'), ', …')
FIG(fig_family(), '차수 n이 커질수록 한 주기 안의 진동 횟수가 늘어납니다.')
KEY(B('핵심 질문. '), '이 단순한 파동들을 적당한 비율로 더하면, 복잡한 주기함수도 만들 수 있을까요? 끊어진 함수까지도 가능할까요?')

H('2. Fourier 급수의 뜻')
P('주기 2π인 함수를 삼각함수의 합으로 나타낸 것이 ', B('Fourier 급수'), '입니다. ', m(A0), ', ', m(AN), ', ', m(BN), '을 ', B('Fourier 계수'), '라고 합니다.')
EQ('f(x) = ', A0, ' + ', sigma('(', TERM, ')'))
P('실제로는 무한히 더할 수 없으므로 ', m('N'), '차까지 더한 ', B('부분합'), ' ', m(sub('S', 'N')), '을 봅니다. 항을 더할수록 곡선이 함수에 가까워집니다.')
EQ(sub('S', 'N'), '(x) = ', A0, ' + ', nary('∑', 'n=1', 'N', '(', TERM, ')'))
FIG(fig_partial(), '사각파의 부분합. 첫 항은 사인 곡선 하나이고, 항이 늘수록 사각파에 가까워집니다.')
P('계수의 크기가 그 진동수의 비중입니다. 도약이 있는 사각파는 계수가 ', m('1/n'), '로 느리게 줄고, 연속인 삼각파는 ', m('1/', sup('n', '2')), '으로 빠르게 줄어듭니다. 그래서 삼각파가 더 적은 항으로 맞습니다.')
FIG(fig_decay(), '사각파와 삼각파의 계수 크기 비교 (세로축 눈금은 같습니다)')

H('3. 직교성')
P('계수를 구하는 열쇠는 ', B('직교성'), '입니다. 서로 다른 두 삼각함수를 곱해 한 주기 적분하면 0입니다. 곱한 곡선에서 위와 아래의 넓이가 상쇄되기 때문입니다.')
EQ(integral('-π', 'π', SIN('nx'), ' ', SIN('mx'), DX), ' = 0   (n≠m)')
P('코사인끼리, 그리고 사인과 코사인 사이에도 같은 일이 일어납니다. 곱을 합으로 바꾸면 주기함수의 온전한 적분만 남기 때문입니다.')
EQ(integral('-π', 'π', COS('nx'), ' ', COS('mx'), DX), ' = 0   (n≠m),      ', integral('-π', 'π', SIN('nx'), ' ', COS('mx'), DX), ' = 0')
P('같은 함수끼리 곱하면 제곱이 되어 넓이가 모두 양수로 쌓입니다. 이 값 π가 다음 유도에서 쓰입니다.')
EQ(integral('-π', 'π', fn('sin²', 'nx'), DX), ' = ', integral('-π', 'π', fn('cos²', 'nx'), DX), ' = π')
FIG(fig_ortho(), '서로 다른 함수의 곱은 넓이가 상쇄되고, 같은 함수의 곱은 넓이가 쌓입니다.')

H('4. Euler 공식 유도')
P('급수의 양변에 ', m(COS('mx')), '를 곱하고 −π에서 π까지 적분합니다.')
EQ(integral('-π', 'π', 'f(x) ', COS('mx'), DX), ' = ', integral('-π', 'π', '[', A0, ' + ', nary('∑', 'n=1', '∞', '(', TERM, ')'), '] ', COS('mx'), DX))
P('직교성 때문에 ', m('n=m'), '인 코사인 항 하나만 남고 나머지는 모두 0입니다. 남는 값은 ', m(AM, 'π'), '입니다.')
EQ(integral('-π', 'π', 'f(x) ', COS('mx'), DX), ' = ', AM, 'π')
P('양변을 π로 나누면 계수 공식이 나옵니다. ', m(SIN('mx')), '를 곱하면 ', m(BN), ', 그냥 적분하면 ', m(A0), '가 같은 방법으로 나옵니다. 이것이 ', B('Euler 공식'), '입니다.')
EQ(A0, ' = ', frac('1', '2π'), integral('-π', 'π', 'f(x)', DX))
EQ(AN, ' = ', frac('1', 'π'), integral('-π', 'π', 'f(x) ', COS('nx'), DX))
EQ(BN, ' = ', frac('1', 'π'), integral('-π', 'π', 'f(x) ', SIN('nx'), DX))
KEY(B('그림의 뜻. '), '계수는 함수와 그 파동을 곱한 곡선의 넓이에서 나옵니다. 함수에 그 파동이 많이 들어 있을수록 넓이가 한쪽으로 쌓입니다.')
FIG(fig_euler(), 'f(x) = x와 sin x. 곱한 곡선의 넓이를 π로 나눈 값이 계수입니다.')

H('5. 우함수와 기함수')
P('대칭을 쓰면 적분의 절반이 필요 없습니다. ', B('우함수'), '는 ', m('f(-x) = f(x)'), ', ', B('기함수'), '는 ', m('f(-x) = -f(x)'), '입니다.')
P('우함수 × ', m(SIN('nx')), '는 기함수입니다. 왼쪽과 오른쪽 넓이가 반대 부호로 상쇄되어 ', m(BN, ' = 0'), '입니다. 우함수의 급수는 ', B('코사인 급수'), '입니다.')
P('기함수 × ', m(COS('nx')), '도 기함수라 ', m(AN, ' = 0'), '입니다. 기함수의 급수는 ', B('사인 급수'), '입니다. 계산 전에 대칭을 먼저 보면 계산이 절반으로 줄어듭니다.')
FIG(fig_symmetry(), '곱이 기함수이면 왼쪽과 오른쪽 넓이가 상쇄되어 적분이 0입니다.')

H('6. 수렴과 도약점')
KEY(B('정리. '), '구분연속이고 한쪽 도함수를 갖는 주기함수의 Fourier 급수는 수렴합니다. 연속인 점에서 합은 ', m('f(x)'), '입니다.')
P('도약이 있는 점에서는 왼쪽·오른쪽 극한의 ', B('평균'), '으로 수렴합니다. 사각파는 ', m('x = 0'), '에서 합이 0입니다.')
EQ(mr('합', True), ' = ', frac(mx('f(', sub('x', '0'), '-0) + f(', sub('x', '0'), '+0)'), '2'))
P('도약 옆의 봉우리는 항을 늘려도 사라지지 않습니다. 폭은 좁아지지만 높이는 도약 크기의 약 9%로 남습니다. 이것이 ', B('Gibbs 현상'), '입니다.')
FIG(fig_gibbs(), '도약점 부근을 확대한 그림. 항이 늘면 봉우리의 폭은 좁아지지만 높이는 그대로입니다.')

H('7. 임의의 주기')
P('주기가 2π가 아니라 ', m('2L'), '이면 변수를 바꿉니다. ', m('v = πx/L'), '로 놓으면 주기 2π인 함수가 되어 지금까지의 결과를 그대로 쓸 수 있습니다.')
P('다시 ', m('x'), '로 쓰면 급수와 계수는 다음과 같습니다. 공식의 ', m('nx'), '가 ', m('nπx/L'), '로, 앞의 1/π가 ', m('1/L'), '로 바뀝니다.')
ARG = frac('nπx', 'L')
EQ('f(x) = ', A0, ' + ', sigma('(', AN, ' ', COS(ARG), ' + ', BN, ' ', SIN(ARG), ')'))
EQ(A0, ' = ', frac('1', '2L'), integral('-L', 'L', 'f(x)', DX))
EQ(AN, ' = ', frac('1', 'L'), integral('-L', 'L', 'f(x) ', COS(ARG), DX))
EQ(BN, ' = ', frac('1', 'L'), integral('-L', 'L', 'f(x) ', SIN(ARG), DX))
FIG(fig_scale(), 'L = 2인 사각파와 부분합 S₇. 주기는 4이고 계수 공식의 구조는 그대로입니다.')

H('8. 반구간 전개')
P('함수가 ', m('(0, L)'), '에서만 주어질 때가 많습니다. 현이나 막대처럼 길이가 정해진 문제입니다. 이때는 왼쪽을 우리가 정해 주기함수로 ', B('확장'), '할 수 있습니다.')
P('우함수로 확장하면 코사인 항만 남습니다. 이것이 ', B('반구간 코사인 전개'), '입니다.')
EQ(A0, ' = ', frac('1', 'L'), integral('0', 'L', 'f(x)', DX), ',      ', AN, ' = ', frac('2', 'L'), integral('0', 'L', 'f(x) ', COS(ARG), DX))
P('기함수로 확장하면 사인 항만 남습니다. 이것이 ', B('반구간 사인 전개'), '입니다. 양 끝이 고정된 현의 해가 사인 급수인 이유가 여기에 있습니다.')
EQ(BN, ' = ', frac('2', 'L'), integral('0', 'L', 'f(x) ', SIN(ARG), DX))
FIG(fig_half(), '같은 함수를 두 가지로 확장한 결과. 음영이 주어진 구간이고 점선은 7차 부분합입니다.')


write_doc('concept_fourier.docx', 'Fourier 급수 개념 정리')


# ── 파동과 열 문서 ────────────────────────────────────
def tri_coef(N=60):
    x = (np.arange(4000) + .5) / 4000
    f = np.where(x < .5, x, 1 - x)
    return 2 * (np.sin(np.arange(1, N + 1)[:, None] * PI * x) @ f) / 4000


def fig_modes():
    fig, axes = panels(3, height=1.9, sharey=True)
    x = np.linspace(0, 1, 400)
    for ax, n in zip(axes, (1, 2, 3)):
        for phase, style in ((1, '-'), (.5, '--'), (-1, ':')):
            ax.plot(x, phase * np.sin(n * PI * x), color=BLUE, lw=1.4, ls=style)
        ax.set_title(f'$n$ = {n}', fontsize=10)
        ax.set_xlabel('$x/L$')
    return fig


def fig_string():
    B, x, fig = tri_coef(), np.linspace(0, 1, 500), plt.figure(figsize=(6.3, 2.3), layout='constrained')
    ax = fig.add_subplot()
    n = np.arange(1, len(B) + 1)
    for t, style, shade in ((0, '-', INK), (.25, '--', BLUE), (.5, '-.', HOT), (1, ':', '#6b7280')):
        ax.plot(x, (B * np.cos(n * PI * t)) @ np.sin(n[:, None] * PI * x), color=shade, ls=style, lw=1.5, label=f'$ct/L$ = {t}')
    ax.set_xlabel('$x/L$')
    ax.set_ylabel('$u$')
    fig.legend(*ax.get_legend_handles_labels(), loc='outside lower center', frameon=False, fontsize=8, ncols=4)
    return fig


def fig_dalembert():
    fig, axes = panels(3, height=1.9, sharey=True)
    x = np.linspace(-8, 8, 800)
    f = lambda s: np.exp(-s ** 2)
    for ax, t in zip(axes, (0, 2, 5)):
        ax.plot(x, .5 * (f(x - t) + f(x + t)), color=BLUE, lw=1.6)
        ax.set_title(f'$ct$ = {t}', fontsize=10)
        ax.set_xlabel('$x$')
    return fig


def fig_decay_heat():
    fig, axes = panels(2, height=2.2)
    x = np.linspace(0, 1, 400)
    for t, style in ((0, '-'), (.02, '--'), (.1, '-.'), (.3, ':')):
        axes[0].plot(x, np.sin(PI * x) * np.exp(-PI ** 2 * t) + .5 * np.sin(5 * PI * x) * np.exp(-25 * PI ** 2 * t), color=HOT, ls=style, lw=1.4, label=f'$\\alpha t/L^2$ = {t}')
    axes[0].legend(frameon=False, fontsize=7, ncols=2, loc='upper center')
    axes[0].set_ylim(-.05, 2.2)
    axes[0].set_xlabel('$x/L$')
    axes[0].set_title('고주파가 먼저 사라짐', fontsize=10)
    s = np.linspace(0, .3, 200)
    for n, color, style in ((1, BLUE, '-'), (2, HOT, '--'), (3, INK, ':')):
        axes[1].plot(s, np.exp(-(n * PI) ** 2 * s), color=color, ls=style, lw=1.5, label=f'$n$ = {n}')
    axes[1].legend(frameon=False, fontsize=8)
    axes[1].set_xlabel('$\\alpha t/L^2$')
    axes[1].set_title('모드 진폭의 감쇠', fontsize=10)
    return fig


def fig_boundary():
    fig, axes = panels(2, height=2.1, sharey=True)
    x = np.linspace(0, 1, 400)
    N = np.arange(1, 80)
    f = np.where(x < .5, 2.0, 0.0)
    q = (np.arange(4000) + .5) / 4000
    f0 = np.where(q < .5, 2.0, 0.0)
    sine = 2 * (np.sin(N[:, None] * PI * q) @ f0) / 4000
    cosine = 2 * (np.cos(N[:, None] * PI * q) @ f0) / 4000
    mean = f0.mean()
    for t, style in ((0, '-'), (.01, '--'), (.05, '-.'), (.3, ':')):
        decay = np.exp(-(N * PI) ** 2 * t)
        # t = 0은 급수의 잔물결 없이 주어진 함수를 그대로 그립니다.
        axes[0].plot(x, broken(x, f) if t == 0 else (sine * decay) @ np.sin(N[:, None] * PI * x), color=HOT, ls=style, lw=1.3, label=f'{t}')
        axes[1].plot(x, broken(x, f) if t == 0 else mean + (cosine * decay) @ np.cos(N[:, None] * PI * x), color=HOT, ls=style, lw=1.3)
    axes[0].set_title('양 끝 온도 0: 0으로 감', fontsize=10)
    axes[1].set_title('양 끝 단열: 평균으로 감', fontsize=10)
    axes[1].axhline(mean, color=GREEN, lw=1, ls='--')
    fig.legend(*axes[0].get_legend_handles_labels(), title='$\\alpha t/L^2$', loc='outside right center', frameon=False, fontsize=8, title_fontsize=8)
    for ax in axes:
        ax.set_xlabel('$x/L$')
    return fig


def fig_kernel():
    fig, (ax,) = panels(height=2.1)
    x = np.linspace(-6, 6, 800)
    ax.plot(x, np.where(np.abs(x) < 1, 1.0, np.nan), color=INK, lw=1.6, label='처음')
    for t, style in ((.1, '--'), (.5, '-.'), (2, ':')):
        w = 2 * np.sqrt(t)
        ax.plot(x, [.5 * (erf((v + 1) / w) - erf((v - 1) / w)) for v in x], color=HOT, ls=style, lw=1.4, label=f'$\\alpha t$ = {t}')
    ax.set_xlabel('$x$')
    fig.legend(*ax.get_legend_handles_labels(), loc='outside lower center', frameon=False, fontsize=8, ncols=4)
    return fig


U_TT = sub('u', 'tt')
U_XX = sub('u', 'xx')
ARGN = frac('nπx', 'L')
LAM = sub('λ', 'n')
TWO_L = frac('2', 'L')
P('파동과 열 개념 정리', style='Title')
P('Kreyszig 공업수학 10판 하 · 12장', style='Subtitle')

H('1. 파동방정식')
P('양 끝이 고정된 현의 작은 진동은 ', B('파동방정식'), '을 따릅니다. ', m('c²'), '은 장력을 선밀도로 나눈 값이고, ', m('c'), '는 파동이 전해지는 속도입니다.')
EQ(U_TT, ' = ', sup('c', '2'), U_XX)
P('풀이에 필요한 조건은 네 가지입니다. 양 끝 고정 ', m('u(0,t) = u(L,t) = 0'), ', 초기 변위 ', m('u(x,0) = f(x)'), ', 초기 속도 ', m(sub('u', 't'), '(x,0) = g(x)'), '입니다.')

H('2. 변수분리')
P(B('변수분리'), '는 해를 ', m('u = F(x)G(t)'), '로 놓는 방법입니다. 방정식에 넣으면 양쪽이 서로 다른 변수만의 함수가 되므로, 둘 다 같은 상수 ', m('k'), '여야 합니다.')
EQ(frac("G''", mx(sup('c', '2'), 'G')), ' = ', frac("F''", 'F'), ' = k')
P('고정 조건을 만족하는 0이 아닌 ', m('F'), '는 ', m('k = -', sup('p', '2')), ', ', m('p = nπ/L'), '일 때만 있습니다. 이때 시간 쪽은 각진동수 ', m(LAM), '의 진동입니다.')
EQ(sub('F', 'n'), '(x) = ', SIN(ARGN), ',      ', LAM, ' = ', frac('cnπ', 'L'))

H('3. 현의 해')
P('각 ', m('n'), '에 대한 해를 ', B('고유함수'), ' 또는 정규 모드라고 합니다. ', m('n'), '번째 모드에는 움직이지 않는 절점이 ', m('n-1'), '개 있습니다.')
FIG(fig_modes(), '앞 세 모드의 모양. 선은 서로 다른 시각이며, 절점은 움직이지 않습니다.')
P('모드를 모두 더한 것이 해입니다. 계수는 ', m('t = 0'), '의 조건에서 나오며, 반구간 사인 전개의 계수와 같습니다.')
EQ('u(x,t) = ', sigma('(', sub('B', 'n'), ' ', COS(mx(LAM, 't')), ' + ', sup(sub('B', 'n'), '*'), ' ', SIN(mx(LAM, 't')), ') ', SIN(ARGN)))
EQ(sub('B', 'n'), ' = ', TWO_L, integral('0', 'L', 'f(x) ', SIN(ARGN), DX))
EQ(sup(sub('B', 'n'), '*'), ' = ', frac('2', 'cnπ'), integral('0', 'L', 'g(x) ', SIN(ARGN), DX))
P('모든 ', m(LAM), '이 ', m(sub('λ', '1')), '의 정수배이므로 현은 주기 ', m('2L/c'), '로 처음 모양으로 돌아옵니다. 감쇠가 없어 에너지는 줄지 않습니다.')
FIG(fig_string(), '가운데를 들어 올린 삼각형 현. ct/L = 1에서 뒤집힌 모양이 됩니다.')

H('4. D’Alembert 해')
P('무한히 긴 현에서는 경계가 없어 모드로 나누지 않고 풀 수 있습니다. 변수를 ', m('v = x + ct'), ', ', m('w = x - ct'), '로 바꾸면 방정식이 ', m(sub('u', 'vw'), ' = 0'), '이 됩니다.')
EQ('u(x,t) = ', frac('1', '2'), '[f(x+ct) + f(x-ct)] + ', frac('1', '2c'), integral('x-ct', 'x+ct', 'g(s)\u2009ds'))
P('초기 속도가 0이면 초기 모양이 절반씩 나뉘어 왼쪽과 오른쪽으로 속도 ', m('c'), '로 움직입니다. 모양은 변하지 않습니다.')
FIG(fig_dalembert(), '가우스 곡선의 초기 변위가 두 개의 파동으로 나뉩니다.')

H('5. 열방정식')
P('균일한 막대의 온도는 ', B('열방정식'), '을 따릅니다. ', m('c²'), '은 열확산계수입니다. 프로그램에서는 이 값을 ', m('α'), '로 입력합니다.')
EQ(sub('u', 't'), ' = ', sup('c', '2'), U_XX, ',      α = ', sup('c', '2'))
P('양 끝 온도가 0일 때 변수분리를 하면 공간 쪽은 현과 같고, 시간 쪽은 진동이 아니라 지수 감쇠입니다. 시간 미분이 1차이기 때문입니다.')
EQ('u(x,t) = ', sigma(sub('B', 'n'), ' ', SIN(ARGN), ' ', sup('e', mx('-', sup(LAM, '2'), 't'))))
EQ(sub('B', 'n'), ' = ', TWO_L, integral('0', 'L', 'f(x) ', SIN(ARGN), DX), ',      ', LAM, ' = ', frac('cnπ', 'L'))
P('감쇠율 ', m(sup(LAM, '2')), '은 ', m(sup('n', '2')), '에 비례합니다. 그래서 고주파 성분이 먼저 사라지고 온도 분포는 빠르게 매끄러워집니다. 시간이 지나면 첫 모드만 남습니다.')
FIG(fig_decay_heat(), '두 모드가 섞인 온도의 변화(왼쪽)와 차수별 감쇠(오른쪽)')

H('6. 정상 상태와 단열')
KEY(B('양 끝 온도가 0이 아닐 때. '), '양 끝이 ', m(sub('U', '1')), ', ', m(sub('U', '2')), '이면 시간이 지나 변하지 않는 ', B('정상 상태'), ' ', m('U(x)'), '를 먼저 구합니다. ', m(sub('u', 't'), ' = 0'), '이므로 직선입니다.')
EQ('U(x) = ', sub('U', '1'), ' + (', sub('U', '2'), ' - ', sub('U', '1'), ')', frac('x', 'L'))
P('나머지 ', m('u - U'), '는 양 끝이 0인 문제이므로, 초기 온도를 ', m('f - U'), '로 바꾸어 5절의 식을 그대로 씁니다.')
P('양 끝이 ', B('단열'), '이면 조건이 ', m(sub('u', 'x'), ' = 0'), '이 되어 코사인 급수가 나옵니다. 열이 빠져나가지 못하므로 온도는 처음의 평균 ', m(sub('A', '0')), '으로 갑니다.')
EQ('u(x,t) = ', sub('A', '0'), ' + ', sigma(sub('A', 'n'), ' ', COS(ARGN), ' ', sup('e', mx('-', sup(LAM, '2'), 't'))))
EQ(sub('A', '0'), ' = ', frac('1', 'L'), integral('0', 'L', 'f(x)', DX), ',      ', sub('A', 'n'), ' = ', TWO_L, integral('0', 'L', 'f(x) ', COS(ARGN), DX))
FIG(fig_boundary(), '왼쪽 절반만 뜨거운 막대. 경계 조건에 따라 도달하는 온도가 달라집니다.')

H('7. 무한 막대')
P('막대가 무한히 길면 합 대신 Fourier 적분을 쓰고, 해는 초기 온도와 ', B('열핵'), '의 합성곱이 됩니다.')
EQ('u(x,t) = ', frac('1', mx('2c', f'<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>{mr("πt")}</m:e></m:rad>')), integral('-∞', '∞', 'f(v) ', fn('exp', '(', frac(mx('-', sup('(x-v)', '2')), mx('4', sup('c', '2'), 't')), ')'), '\u2009dv'))
P('열핵은 분산이 ', m('2', sup('c', '2'), 't'), '인 가우스 곡선입니다. 열은 시간의 제곱근에 비례하여 퍼지고, 전체 열량은 변하지 않습니다. 끊어진 초기 온도도 ', m('t > 0'), '이면 곧바로 매끄러워집니다.')
FIG(fig_kernel(), '사각 펄스 모양의 초기 온도가 퍼지는 모습')

H('8. 파동과 열 비교')
P('두 방정식은 변수분리와 Fourier 급수라는 같은 틀로 풀리지만, 시간 미분의 차수가 달라 성질이 다릅니다.')
P(B('시간 변화. '), '파동은 ', m(COS(mx(LAM, 't'))), '로 계속 진동하고, 열은 ', m(sup('e', mx('-', sup(LAM, '2'), 't'))), '로 감쇠합니다.')
P(B('모양. '), '파동은 모양을 유지하며 전파하므로 꺾인 점이 사라지지 않습니다. 열은 꺾인 점과 도약을 곧바로 매끄럽게 만듭니다.')
P(B('전파 속도. '), '파동의 신호는 유한한 속도 ', m('c'), '로 가지만, 열방정식의 해는 ', m('t > 0'), '이면 모든 곳에서 값이 바로 달라집니다.')
write_doc('concept_pde.docx', '파동과 열 개념 정리')
