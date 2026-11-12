'use strict';
/* 수식과 문서 조각을 화면(HTML)과 Word(docx) 두 가지로 씁니다. Word 파일은 인터넷 없이 페이지 안에서 만듭니다. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── 수식: 각 조각은 { h: 화면용 HTML, o: Word 수식(OMML) }입니다. ── */
const omr = (s, upright) => `<m:r>${upright ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : ''}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">${esc(s)}</m:t></m:r>`;
/** 글자는 기울여 씁니다(변수). */
const T = s => ({ h: esc(s).replace(/[A-Za-zα-ω]+/g, w => `<i>${w}</i>`), o: omr(s) });
/** 똑바로 쓰는 글자(함수 이름, 한글, 기호). */
const U = s => ({ h: esc(s), o: omr(s, true) });
const node = x => typeof x === 'string' ? T(x) : x;
const cat = (...xs) => { const n = xs.map(node); return { h: n.map(v => v.h).join(''), o: n.map(v => v.o).join('') }; };
const sub = (b, s) => { b = node(b); s = node(s); return { h: `${b.h}<sub>${s.h}</sub>`, o: `<m:sSub><m:e>${b.o}</m:e><m:sub>${s.o}</m:sub></m:sSub>` }; };
const sup = (b, s) => { b = node(b); s = node(s); return { h: `${b.h}<sup>${s.h}</sup>`, o: `<m:sSup><m:e>${b.o}</m:e><m:sup>${s.o}</m:sup></m:sSup>` }; };
const frac = (a, b) => { a = node(a); b = node(b); return { h: `<span class="frac"><span>${a.h}</span><span>${b.h}</span></span>`, o: `<m:f><m:num>${a.o}</m:num><m:den>${b.o}</m:den></m:f>` }; };
const nary = (symbol, lo, hi, body, html) => { lo = node(lo); hi = node(hi); return { h: html(lo.h, hi.h) + body.h, o: `<m:nary><m:naryPr><m:chr m:val="${symbol}"/><m:limLoc m:val="${symbol === '∑' ? 'undOvr' : 'subSup'}"/></m:naryPr><m:sub>${lo.o}</m:sub><m:sup>${hi.o}</m:sup><m:e>${body.o}</m:e></m:nary>` }; };
const integral = (lo, hi, ...body) => nary('∫', lo, hi, cat(...body), (l, h) => `<span class="int"><span class="ig">∫</span><span class="lim"><span>${h}</span><span>${l}</span></span></span>`);
const sum = (lo, hi, ...body) => nary('∑', lo, hi, cat(...body), (l, h) => `<span class="sum"><small>${h}</small><span class="sg">Σ</span><small>${l}</small></span>`);
const fn = (name, ...arg) => { const a = cat(...arg); return { h: `${esc(name)} ${a.h}`, o: `<m:func><m:fName>${omr(name, true)}</m:fName><m:e>${a.o}</m:e></m:func>` }; };
const root = (...x) => { const a = cat(...x); return { h: `√(${a.h})`, o: `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${a.o}</m:e></m:rad>` }; };

/* ── 문서 조각 ── */
const isMath = x => x && typeof x === 'object' && 'o' in x;
const B = text => ({ bold: text });
const DOC = {
  h1: t => ({ k: 'h1', t }), h2: t => ({ k: 'h2', t }),
  p: (...seg) => ({ k: 'p', seg }), key: (...seg) => ({ k: 'key', seg }),
  eq: (...m) => ({ k: 'eq', m: cat(...m) }),
  fig: (png, caption, ratio, width = 1) => ({ k: 'fig', png, caption, ratio, width }),
  gap: n => ({ k: 'gap', n }),
};
// 문자열에는 내장 함수 String.prototype.bold가 있으므로 문자열인지 먼저 확인합니다.
const segHtml = seg => seg.map(s => typeof s === 'string' ? esc(s) : isMath(s) ? `<span class="m">${s.h}</span>` : s.bold !== undefined ? `<b>${esc(s.bold)}</b>` : esc(s)).join('');
/** 화면용 HTML입니다. 그림과 빈칸은 화면에 이미 있거나 필요 없으므로 넣지 않습니다. */
function blocksHtml(blocks) {
  return blocks.map(b => b.k === 'h1' ? `<h3>${esc(b.t)}</h3>` : b.k === 'h2' ? `<h4>${esc(b.t)}</h4>` : b.k === 'p' ? `<p>${segHtml(b.seg)}</p>` : b.k === 'key' ? `<p class="key">${segHtml(b.seg)}</p>` : b.k === 'eq' ? `<div class="eq">${b.m.h}</div>` : '').join('');
}

/* ── 글 표기: 문단은 빈 줄로 나누고, $…$는 수식, $$…$$만 있는 문단은 가운데 수식, '> '로 시작하면 강조 상자, **…**는 굵게 ── */
const TEX_SYMBOL = { pi: 'π', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', theta: 'θ', omega: 'ω', sigma: 'σ', phi: 'φ', mu: 'μ', rho: 'ρ', tau: 'τ', Delta: 'Δ',
  infty: '∞', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', cdot: '·', times: '×', to: '→', pm: '±', partial: '∂', ldots: '…', cdots: '⋯', dots: '…' };
const TEX_SPACE = { ',': ' ', ';': ' ', ' ': ' ', quad: ' ', qquad: '  ' };
const TEX_FUNCTIONS = ['sin', 'cos', 'tan', 'exp', 'ln', 'log', 'sinh', 'cosh', 'tanh', 'sign', 'abs', 'step', 'sqrt', 'max', 'min', 'lim', 'arctan'];
/** LaTeX와 비슷한 수식 표기를 수식 조각으로 바꿉니다: a_n, x^2, \frac{a}{b}, \int_{a}^{b}, \sum_{n=1}^{\infty}, \sqrt{x}, \pi, \cos x, \text{글}. */
function tex(src) {
  const toks = String(src).match(/\\[A-Za-z]+|\\[^A-Za-z]|[A-Za-z]+|\d+(?:\.\d+)?|[가-힣]+(?:\s+[가-힣]+)*|\s+|./g) ?? [];
  let i = 0;
  const peek = () => { while (i < toks.length && /^\s+$/.test(toks[i])) i++; return toks[i]; };
  const group = close => { const g = seq([close]); if (peek() === close) i++; return g; };
  const arg = () => { if (peek() === '{') { i++; return group('}'); } return atom(); };
  const fnWord = name => { const next = peek(); return U(name + (next === '(' || next === undefined ? '' : ' ')); };
  function postfix(base) {
    for (;;) {
      const t = peek();
      if (t === '_') { i++; base = sub(base, arg()); } else if (t === '^') { i++; base = sup(base, arg()); } else return base;
    }
  }
  /** stops에 닿거나, opStop이면 맨 바깥의 =, +, − 등에서 멈춥니다(적분·합의 몸통). */
  function seq(stops, opStop) {
    const parts = [];
    for (;;) {
      const t = peek();
      if (t === undefined || stops.includes(t) || (opStop && ['=', ',', '+', '-', '−', '<', '>'].includes(t))) break;
      parts.push(postfix(atom()));
    }
    return cat(...parts);
  }
  function atom() {
    const t = peek();
    i++;
    if (t === '{') return group('}');
    if (t === '(') return cat(U('('), group(')'), U(')'));
    if (t[0] === '\\') {
      const name = t.slice(1);
      if (name in TEX_SPACE) return U(TEX_SPACE[name]);
      if (name === 'frac') { const a = arg(); return frac(a, arg()); }
      if (name === 'sqrt') return root(arg());
      if (name === 'text' || name === 'mathrm') {
        if (peek() !== '{') return U('');
        i++;
        let text = '';
        while (i < toks.length && toks[i] !== '}') text += toks[i++];
        i++;
        return U(text);
      }
      if (name === 'int' || name === 'sum') {
        let lo = U(''), hi = U('');
        for (;;) { const n = peek(); if (n === '_') { i++; lo = arg(); } else if (n === '^') { i++; hi = arg(); } else break; }
        const body = seq(['}', ')'], true);
        return name === 'int' ? integral(lo, hi, body) : sum(lo, hi, body);
      }
      if (TEX_FUNCTIONS.includes(name)) return fnWord(name);
      if (name === 'left' || name === 'right') return U('');
      if (name in TEX_SYMBOL) { const sym = TEX_SYMBOL[name]; return /[α-ω]/.test(sym) ? T(sym) : U(sym); }
      return U(name);
    }
    if (/^[A-Za-z]+$/.test(t)) return TEX_FUNCTIONS.includes(t) ? fnWord(t) : T(t);
    if (t === '-') return U('−');
    if (t === '*') return U('∗');   // B_n^*, E^*의 별표. 곱하기는 \cdot로 씁니다.
    return U(t);
  }
  return seq([]);
}
/** 문단 안의 $…$(수식)와 **…**(굵게)를 나눕니다. */
const inlineSegments = text => String(text).split(/(\$[^$]+\$|\*\*[^*]+\*\*)/).filter(Boolean).map(s => s.startsWith('$') && s.length > 2 ? tex(s.slice(1, -1)) : s.startsWith('**') ? B(s.slice(2, -2)) : s);
/** 글을 문서 조각으로 바꿉니다. 화면과 Word가 같은 글을 씁니다. */
function markupBlocks(text) {
  return String(text ?? '').replace(/\r/g, '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(par => {
    if (/^\$\$[\s\S]+\$\$$/.test(par)) return DOC.eq(tex(par.slice(2, -2)));
    if (par.startsWith('## ')) return DOC.h2(par.slice(3));
    if (par.startsWith('> ')) return DOC.key(...inlineSegments(par.slice(2).replace(/\n/g, ' ')));
    return DOC.p(...inlineSegments(par.replace(/\n/g, ' ')));
  });
}

/* ── Word 파일 ── */
const XHEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
  + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FONT = '<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic" w:cs="Malgun Gothic"/>';
const pstyle = (id, name, ppr, rpr = '', next = 'Normal') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="${next}"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
const STYLES = `${XHEAD}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>${FONT}<w:sz w:val="22"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>`
  + '<w:pPrDefault><w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:spacing w:after="120" w:line="312" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
  + pstyle('Title', 'Title', '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="1F5FD0"/></w:pBdr><w:spacing w:after="240"/>', '<w:b/><w:color w:val="111827"/><w:sz w:val="40"/>')
  + pstyle('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="1F3B73"/><w:sz w:val="32"/>')
  + pstyle('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>', '<w:b/><w:color w:val="1F3B73"/><w:sz w:val="26"/>')
  + pstyle('Equation', 'Equation', '<w:spacing w:before="60" w:after="120"/><w:jc w:val="center"/>')
  + pstyle('Figure', 'Figure', '<w:keepNext/><w:spacing w:before="120" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', '', 'Caption')
  + pstyle('Caption', 'caption', '<w:spacing w:after="200"/><w:jc w:val="center"/>', '<w:color w:val="4B5563"/><w:sz w:val="18"/>')
  + pstyle('Point', 'Point', '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="D4500F"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/><w:spacing w:before="120" w:after="160"/><w:ind w:left="200"/>')
  + '</w:styles>';
const SETTINGS = `${XHEAD}<w:settings ${NS}><m:mathPr><m:mathFont m:val="Cambria Math"/><m:defJc m:val="centerGroup"/></m:mathPr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
const FOOTRUN = '<w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr>';
const FOOTER = `${XHEAD}<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${FOOTRUN}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${FOOTRUN}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>${FOOTRUN}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${FOOTRUN}<w:t>1</w:t></w:r><w:r>${FOOTRUN}<w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
const TYPES = `${XHEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>`
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
  + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
  + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
const PACKAGE_RELS = `${XHEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const runs = seg => seg.map(s => typeof s === 'string' ? `<w:r><w:t xml:space="preserve">${esc(s)}</w:t></w:r>` : isMath(s) ? `<m:oMath>${s.o}</m:oMath>` : s.bold !== undefined ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(s.bold)}</w:t></w:r>` : `<w:r><w:t xml:space="preserve">${esc(s)}</w:t></w:r>`).join('');
const para = (style, inner) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`;
/** 문서 본문(document.xml)과 그림 목록을 만듭니다. */
function documentXml(title, blocks, opts = {}) {
  const images = [], body = [para('Title', runs([title]))];
  if (opts.subtitle) body.push(para('', runs([opts.subtitle])));
  if (opts.student) body.push('<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">학번: ______________    이름: ______________</w:t></w:r></w:p>');
  for (const b of blocks) {
    if (b.k === 'h1') body.push(para('Heading1', runs([b.t])));
    else if (b.k === 'h2') body.push(para('Heading2', runs([b.t])));
    else if (b.k === 'p') body.push(para('', runs(b.seg)));
    else if (b.k === 'key') body.push(para('Point', runs(b.seg)));
    else if (b.k === 'eq') body.push(`<w:p><w:pPr><w:pStyle w:val="Equation"/></w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>${b.m.o}</m:oMath></m:oMathPara></w:p>`);
    else if (b.k === 'gap') for (let i = 0; i < b.n; i++) body.push('<w:p/>');
    else if (b.k === 'fig') {
      images.push(b.png);
      const i = images.length, cx = Math.round(5760000 * (b.width ?? 1)), cy = Math.round(cx * b.ratio);
      body.push(`<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${i}" name="그림 ${i}" descr="${esc(b.caption)}"/>`
        + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i}" name="fig${i}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdFig${i}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
      body.push(para('Caption', runs([`그림 ${i}. ${b.caption}`])));
    }
  }
  const section = '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1474" w:bottom="1417" w:left="1474" w:header="708" w:footer="567" w:gutter="0"/></w:sectPr>';
  return { xml: `${XHEAD}<w:document ${NS}><w:body>${body.join('')}${section}</w:body></w:document>`, images };
}

/* ── ZIP(압축 없이 저장) ── */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = bytes => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nm = enc.encode(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    // 날짜는 1980-01-01로 고정합니다(0x0021).
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [12, 0x21, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nm.length, 2]].forEach(([at, v, size]) => size === 4 ? h.setUint32(at, v, true) : h.setUint16(at, v, true));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [14, 0x21, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nm.length, 2], [42, offset, 4]].forEach(([at, v, size]) => size === 4 ? c.setUint32(at, v, true) : c.setUint16(at, v, true));
    parts.push(new Uint8Array(h.buffer), nm, data);
    central.push(new Uint8Array(c.buffer), nm);
    offset += 30 + nm.length + data.length;
  }
  const size = central.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
const pngBytes = dataUrl => Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0));
/** 제목과 문서 조각으로 Word 파일(Blob)을 만듭니다. */
function buildDocx(title, blocks, opts = {}) {
  const enc = new TextEncoder(), { xml, images } = documentXml(title, blocks, opts);
  const figRels = images.map((_, i) => `<Relationship Id="rIdFig${i + 1}" Type="${REL}/image" Target="media/fig${i + 1}.png"/>`).join('');
  const docRels = `${XHEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="${REL}/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="${REL}/footer" Target="footer1.xml"/>${figRels}</Relationships>`;
  const core = `${XHEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:language>ko-KR</dc:language></cp:coreProperties>`;
  const files = [['[Content_Types].xml', TYPES], ['_rels/.rels', PACKAGE_RELS], ['docProps/core.xml', core], ['word/document.xml', xml], ['word/styles.xml', STYLES], ['word/settings.xml', SETTINGS], ['word/footer1.xml', FOOTER], ['word/_rels/document.xml.rels', docRels]]
    .map(([name, text]) => [name, enc.encode(text)]);
  images.forEach((png, i) => files.push([`word/media/fig${i + 1}.png`, pngBytes(png)]));
  return { blob: zipStore(files), xml, images: images.length };
}
