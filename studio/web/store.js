'use strict';
/* 저장(자동·예제 모음 파일)과 Word 출력. */
/* ── 저장: 프로그램 안(자동)과 파일(예제 모음) ───────── */
const STORE = 'lectureStudio.v1';
/** 저장할 때는 축(axes)만 남기고, 축에서 만들어지는 값은 지웁니다. 읽을 때 mergeCfg가 다시 만듭니다. */
const DERIVED = ['on', 'halfMode', 'waveDomain', 'waveEnds', 'heatDomain', 'bc', 'damping'];
const storedCfg = cfg => { const c = copy(cfg); for (const k of DERIVED) delete c[k]; return c; };
const storedExample = e => ({ ...e, ...(e.cfg ? { cfg: storedCfg(e.cfg) } : {}), figures: (e.figures ?? []).map(f => ({ ...f, cfg: storedCfg(f.cfg) })) });
const stateData = () => ({ v: 1, cfg: storedCfg(S.cfg), draft: storedExample(S.draft), saved: S.saved.map(storedExample), edits: S.edits, sheet: S.sheet });
const cleanExample = e => ({ cfg: mergeCfg(e?.cfg), items: Array.isArray(e?.items) ? e.items.map(it => ({ ...newItem(KINDS[it.kind] ? it.kind : 'free'), ...it })) : [], figures: Array.isArray(e?.figures) ? e.figures.filter(f => PANELS[f?.panel]).map(f => ({ size: 'mid', caption: '', zoom: null, ...f, cfg: mergeCfg(f.cfg) })) : [] });
function applyState(d) {
  if (!d || d.v !== 1) return false;
  S.cfg = mergeCfg(d.cfg);
  S.draft = { ...emptyDraft(), ...cleanExample(d.draft), editing: Number.isInteger(d.draft?.editing) ? d.draft.editing : null, custom: !!d.draft?.custom };
  S.saved = Array.isArray(d.saved) ? d.saved.map(cleanExample) : [];
  S.edits = d.edits && typeof d.edits === 'object' ? { ...d.edits } : {};
  S.sheet = { ...copy(SHEET), ...(d.sheet ?? {}) };
  if (S.draft.editing !== null && !S.saved[S.draft.editing]) S.draft.editing = null;
  return true;
}
let saveTimer = 0;
/** 바뀐 내용을 프로그램 안에 저장합니다(다음 실행에 그대로 열림). */
function persist() {
  if (S.noSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(stateData())); } catch { /* 저장 공간을 쓸 수 없으면 건너뜁니다 */ } }, 300);
}
function restore() { try { return applyState(JSON.parse(localStorage.getItem(STORE) ?? 'null')); } catch { return false; } }
const libraryText = () => JSON.stringify({ kind: 'lecture-studio-library', version: 1, saved: S.saved.map(storedExample), edits: S.edits, sheet: S.sheet }, null, 1);
/** 예제 모음 파일을 읽어 담은 예제에 더하고, 고친 개념 설명과 문제지 양식을 가져옵니다. */
function importLibrary(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('예제 모음 파일을 읽을 수 없습니다.'); }
  if (d?.kind !== 'lecture-studio-library') throw new Error('예제 모음 파일이 아닙니다.');
  const list = (Array.isArray(d.saved) ? d.saved : []).map(cleanExample);
  S.saved.push(...list);
  if (d.edits && typeof d.edits === 'object') Object.assign(S.edits, d.edits);
  if (d.sheet && typeof d.sheet === 'object') S.sheet = { ...S.sheet, ...d.sheet };
  return list.length;
}
function download(blob, name) {
  if (S.fakeDownload) { S.lastDownload = name; return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
let statusTimer = 0;
/** 화면 아래 가운데에 알림을 띄웁니다. action({label, fn})을 주면 단추가 함께 나옵니다. */
function setStatus(text, action = null) {
  $('status').innerHTML = `${esc(text)}${action ? ` <button type="button" class="mini" id="statusAct">${esc(action.label)}</button>` : ''}`;
  S.statusAct = action?.fn ?? null;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').innerHTML = ''; S.statusAct = null; }, action ? 12000 : 7000);
}
/* 프로그램 창(app.py)이 파일을 저장한 뒤 부릅니다. */
window.studioSaved = (path, opened) => setStatus(opened === false ? `저장했습니다: ${path} (이 PC에서 Word 문서를 열 프로그램을 찾지 못했습니다. 파일은 저장되었습니다.)` : `저장했습니다: ${path}`);

/* ── Word 출력 ─────────────────────────────────────── */
const conceptMarkup = id => S.edits[id] ?? CONCEPT_MARKUP[id];
const FIG_WIDTH = { small: .55, mid: .8, large: 1 };
/** 펜 자국과 점 표시를 그래프 좌표(frame)에 맞춰 그립니다. 화면, Word, PDF가 같이 씁니다. */
function drawInk(ctx, f, ink, marks, C) {
  if (!f) return;
  const X = x => f.b.l + (x - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w, Y = y => f.b.t + (f.yr[1] - y) / (f.yr[1] - f.yr[0]) * f.b.h;
  ctx.save(); ctx.beginPath(); ctx.rect(f.b.l, f.b.t, f.b.w, f.b.h); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const stroke of ink ?? []) { ctx.strokeStyle = C.hot; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); stroke.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); }
  ctx.restore();
  for (const x of marks ?? []) {
    const lines = f.probe(x);
    if (!lines.length) continue;
    const y = lines[0][1], px = X(x), py = Y(y);
    if (!isFinite(px) || !isFinite(py)) continue;
    dot(ctx, px, py, C.hot, C, 5);
    panelText(ctx, `x = ${fmt(x, 3)}, ${lines[0][0]} = ${fmt(y, 4)}`, px + 8, py - 20 * C.scale, C);
  }
}
/** 그림 하나를 흰 배경으로 그립니다(PNG와 고칠 수 있는 SVG). 그림을 담을 때의 설정·시간·확대 범위·펜 표시를 그대로 씁니다. */
function figureImage(fig) {
  const cfg = mergeCfg(fig.cfg), R = compute(cfg), canvas = $('exportCanvas'), theme = document.documentElement.dataset.theme, zoom = S.zoom, key = S.drawingKey;
  document.documentElement.dataset.theme = 'light';
  S.drawingKey = 'export'; S.zoom = fig.zoom ? { panel: 'export', xr: fig.zoom } : null;
  try {
    const C = themeColors(), { ctx, w, h } = prepare(canvas);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const meta = PANELS[fig.panel](ctx, w, h, C, cfg, R, null);
    drawInk(ctx, { ...meta.frame, probe: meta.probe }, fig.ink, fig.marks, C);
    const svgCtx = new SvgContext(Math.round(w), Math.round(h));
    PANELS[fig.panel](svgCtx, w, h, C, cfg, R, null);
    drawInk(svgCtx, { ...meta.frame, probe: meta.probe }, fig.ink, fig.marks, C);
    return { png: canvas.toDataURL('image/png'), svg: svgCtx.toString(), caption: String(fig.caption ?? '').trim() || `${meta.title} (${meta.legend.map(([, t]) => t.replace(/<[^>]+>/g, '')).join(', ')})`, ratio: h / w, width: FIG_WIDTH[fig.size] ?? .8 };
  } finally { document.documentElement.dataset.theme = theme; S.zoom = zoom; S.drawingKey = key; }
}
const currentExample = () => ({ cfg: copy({ ...S.good, s: S.cfg.s }), items: copy(S.draft.items), figures: copy(S.draft.figures) });
/** 개념 설명, 문제, 그림, 풀이를 문서 조각으로 모읍니다. 담은 예제가 없으면 지금 만드는 예제를 씁니다. */
function exportBlocks() {
  const list = S.saved.length ? S.saved : [currentExample()], o = S.sheet, blocks = [];
  if (o.concept) {
    blocks.push(DOC.h1('개념 정리'));
    for (const c of CONCEPTS) if (list.some(e => e.cfg.on[c.id])) blocks.push(DOC.h2(`${c.title} (${c.ch})`), ...markupBlocks(conceptMarkup(c.id)));
  }
  list.forEach((e, i) => {
    const cfg = mergeCfg(e.cfg), R = compute(cfg), items = e.items.length ? e.items : autoItems(cfg).map(it => ({ ...it, text: problemText(it.kind, cfg, R) }));
    blocks.push(DOC.h1(`예제 ${i + 1}  (${recipeText(cfg)})`));
    items.forEach((it, k) => blocks.push(...itemBlocks(it.text || (it.kind === 'free' ? '' : problemText(it.kind, cfg, R)), k, it.points)));
    if (o.graph) {
      const figs = e.figures.length ? e.figures : panelIds(cfg).map(panel => ({ panel, cfg, size: 'mid' }));
      for (const fig of figs) { const img = figureImage(fig); blocks.push(DOC.fig(img.png, img.caption, img.ratio, img.width, img.svg)); }
    }
    if (o.solution) { blocks.push(DOC.h2('풀이')); items.forEach((it, k) => blocks.push(...itemBlocks(solutionOf(it, cfg, R) || '(풀이 없음)', k))); }
    else if (+o.space) blocks.push(DOC.gap(+o.space));
  });
  return blocks;
}
const docOptions = () => ({ subtitle: S.sheet.subtitle.trim(), student: !!S.sheet.student });
/** 담은 예제가 있는데 지금 예제를 담지 않았거나 고친 내용을 저장하지 않았으면 먼저 묻습니다. kind는 'word' 또는 'pdf'입니다. */
function exportWord(force = false, kind = 'word') {
  if (!S.good) return;
  S.pendingExport = kind;
  if (!force && S.saved.length && S.draft.dirty) {
    $('choiceMsg').textContent = S.draft.editing !== null ? `예제 ${S.draft.editing + 1}에서 고친 내용을 아직 저장하지 않았습니다.` : '지금 만드는 예제는 아직 담지 않아 Word에 들어가지 않습니다.';
    $('choiceAdd').textContent = S.draft.editing !== null ? '저장하고 출력' : '이 예제도 담고 출력';
    if (S.page !== 'out') setPage('out');
    $('exportChoice').hidden = false;
    $('exportChoice').scrollIntoView({ block: 'nearest' });
    setStatus("출력하기 전에 확인할 것이 있습니다. 'Word로 출력' 아래를 보십시오.");
    return;
  }
  $('exportChoice').hidden = true;
  if (kind === 'pdf') return exportPdf();
  try {
    const title = S.sheet.title.trim() || '공업수학 예제', doc = buildDocx(title, exportBlocks(), docOptions());
    S.lastDoc = doc;
    download(doc.blob, `${title}.docx`);
  } catch (e) { setStatus(`Word로 출력하지 못했습니다: ${e.message}`); }
}
/** 같은 내용을 인쇄 문서로 만들어 PDF로 저장합니다(프로그램 창이 PDF 저장을 맡습니다). */
function exportPdf() {
  try {
    const title = S.sheet.title.trim() || '공업수학 예제', o = docOptions();
    $('printArea').innerHTML = `<h1>${esc(title)}</h1>${o.subtitle ? `<p>${esc(o.subtitle)}</p>` : ''}${o.student ? '<p class="student">학번: ______________    이름: ______________</p>' : ''}<div class="doc">${blocksHtml(exportBlocks(), true)}</div>`;
    S.themeBeforePrint = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light';
    S.titleBeforePrint = document.title; document.title = title;
    if (S.fakeDownload) { S.lastDownload = `${title}.pdf`; window.studioPrintDone(); return; }
    window.print();
  } catch (e) { setStatus(`PDF로 출력하지 못했습니다: ${e.message}`); }
}
/* 프로그램 창이 PDF 저장을 마치면(또는 취소하면) 부릅니다. */
window.studioPrintDone = () => {
  if (S.themeBeforePrint) document.documentElement.dataset.theme = S.themeBeforePrint;
  if (S.titleBeforePrint) document.title = S.titleBeforePrint;
  S.themeBeforePrint = null; S.titleBeforePrint = null; S.dirty = true;
};
