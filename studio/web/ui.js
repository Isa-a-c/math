'use strict';
/* 화면: 개념 더하기(기본 개념 + 개념 카드), 설정, 그래프 칸, 탭, 안내, 재생, 입력, 시작. */
/* ── 문제 정하기와 풀이 단계 ─────────────────────── */
/** 개념 이름으로 문제를 정합니다(발표 준비 스크립트·검사용). */
const CONCEPT_PROBLEM = {
  series: () => [{ eq: 'none', domain: 'periodic' }, 'partial'], coef: () => [{ eq: 'none', domain: 'periodic' }, 'coef'],
  spectrum: () => [{ eq: 'none', domain: 'periodic' }, 'spectrum'], gibbs: () => [{ eq: 'none', domain: 'periodic' }, 'gibbs'],
  transform: () => [{ eq: 'none', domain: 'line' }, 'partial'], half: cfg => [{ eq: 'none', domain: 'interval', left: cfg.halfMode === 'cosine' ? 'free' : 'fixed' }, 'partial'],
  wave: () => [{ eq: 'wave', domain: 'interval' }], membrane: () => [{ eq: 'wave', domain: 'rect' }], heat: () => [{ eq: 'heat', domain: 'interval' }],
};
function select(id) { const [p, look] = CONCEPT_PROBLEM[id](S.cfg); Object.assign(S.cfg.prob, p); if (look) S.cfg.look = look; S.cfg.stage = null; applyProblem(S.cfg); }
const segRow = (label, key, list, value, why = () => '') => `<div class="fld"><span class="flabel">${label}</span><div class="seg" role="group" aria-label="${label}" style="--n:${list.length === 4 ? 2 : list.length}">${list.map(([v, t]) => { const no = why(v); return `<button type="button" data-prob="${key}" data-value="${v}" aria-pressed="${value === v}"${no ? ` disabled title="${esc(no)}"` : ''}>${t}</button>`; }).join('')}</div></div>`;
/** 왼쪽 위 '문제': 고르는 것만(방정식, 영역, 끝·변의 조건, 감쇠). 상수는 '함수와 값', 교재의 절은 그래프 위 단계 줄에 있습니다. */
function problemHtml(cfg) {
  const p = cfg.prob, heat = p.eq === 'heat', eqTex = EQUATIONS.find(e => e.id === p.eq).tex;
  let html = segRow('방정식', 'eq', EQUATIONS.map(e => [e.id, e.label]), p.eq) + (eqTex ? `<p class="eqline">${tex(eqTex).h}</p>` : '')
    + segRow('영역', 'domain', DOMAINS.map(d => [d.id, d.label]), p.domain, v => domainOk(p.eq, v) ? '' : DOMAINS.find(d => d.id === v).why ?? '이 방정식에는 아직 없습니다.');
  const t = topicOf(cfg);
  const opts = endOptions(t);
  for (const [side, label] of DOMAINS.find(d => d.id === p.domain).sides ?? []) if (opts[side]) html += segRow(label, side, opts[side], p[side]);
  if (t.note) html += `<p class="hint">${esc(t.note(p))}</p>`;
  if (t.damp) html += segRow('감쇠', 'damp', [['off', '없음'], ['on', '있음']], p.damp ? 'on' : 'off');
  return html;
}
const STAGE_FIELDS = {
  wMax: { k: 'wMax', type: 'text', label: '적분의 위끝 a', hint: '크게 할수록 f에 가까워집니다. 범위 X 밖은 0으로 봅니다.' },
  M: { k: 'M', type: 'range', label: '모드 수 (가로·세로 각각)', min: 1, max: 20 },
};
/** 전개 단계: 볼 그래프(부분합·계수·계수 크기·도약)와 그 설정. */
function lookHtml(cfg) {
  const n = S.R?.series.jumps.length ?? 0, look = cfg.look ?? 'partial';
  const extra = [...(look === 'coef' || look === 'spectrum' ? [{ k: 'coefKind', type: 'seg', label: '구할 계수', options: [['b', 'bₙ (사인)'], ['a', 'aₙ (코사인)']] }, { k: 'coefN', type: 'range', label: '차수 n', min: 1, max: 20 }] : []),
    ...(look === 'gibbs' && n > 1 ? [{ k: 'jumpIndex', type: 'range', label: `확대할 도약점 (${n}개 중)`, min: 1, max: n }] : [])];
  return `<div class="fld"><span class="flabel">그래프로 볼 것</span><div class="seg" role="group" aria-label="그래프로 볼 것" style="--n:4">${LOOKS.map(([v, t]) => `<button type="button" data-look="${v}" aria-pressed="${look === v}">${t}</button>`).join('')}</div></div>${extra.map(f => fieldHtml(f, cfg)).join('')}`;
}
/** 단계 줄 아래: 지금 단계의 교재 수식(크게)과 그 단계의 설정. */
function stageBoxHtml(cfg) {
  const s = stageOf(cfg), extra = (s.look ? lookHtml(cfg) : '') + (s.fields ?? []).map(k => fieldHtml(STAGE_FIELDS[k], cfg)).join('');
  return `<div class="doc formula">${blocksHtml(markupBlocks(s.md))}</div>${extra ? `<div class="stage-set">${extra}</div>` : ''}`;
}
/** 그래프 위 단계 줄: ① 변수분리 → ② 전개 → ③ 해. 지금 그래프의 단계가 강조되고, 누르면 그 단계로 갑니다. */
function stageBarHtml(cfg) {
  const list = stagesOf(cfg), act = stageOf(cfg).id;
  return `<span class="hint">${esc(recipeText(cfg))}</span>${list.map((s, i) => `${i ? '<span class="arrow" aria-hidden="true">→</span>' : ''}<button type="button" data-stage="${s.id}" aria-pressed="${s.id === act}"><span class="num">${i + 1}</span>${s.title}</button>`).join('')}`;
}
const pushUndo = () => { S.undoStack.push({ cfg: copy(S.cfg) }); if (S.undoStack.length > 20) S.undoStack.shift(); };
/** 문제를 바꿉니다. 맞지 않는 값은 고치고, 영역이나 f(x)의 뜻이 바뀌면 알립니다. 되돌릴 수 있습니다. */
function changeProblem(key, value) {
  pushUndo();
  const p = S.cfg.prob, before = { domain: p.domain, role: roleOf(S.cfg) };
  if (key === 'ends') p.left = p.right = value; else if (key === 'damp') p.damp = value === 'on'; else p[key] = value;
  normalizeProblem(p); S.cfg.stage = null; applyProblem(S.cfg);
  const notes = [], role = roleOf(S.cfg);
  if (key !== 'domain' && p.domain !== before.domain) notes.push(`영역을 ${domainLabel(p.domain)}(으)로 바꿨습니다.`);
  if (role !== before.role) notes.push(`입력한 f(x)는 이제 ${role}입니다.`);
  setStatus(`${notes.join(' ') || `문제: ${recipeText(S.cfg)}`}`, { label: '되돌리기', fn: undo });
  renderSettings(); recompute();
}
/* ── 화면 전환: 시각화 / 예제·출력 ─────────────────── */
function setPage(page) {
  S.page = page;
  for (const b of $$('[data-page][role="tab"]')) b.setAttribute('aria-selected', b.dataset.page === page);
  $('vizPage').hidden = page !== 'viz'; $('makePage').hidden = page !== 'make'; $('outPage').hidden = page !== 'out';
  if (document.body.classList.contains('present') && page !== 'viz') $('presentBtn').click();
  if (page === 'make') { setPlaying(false); rerenderMake(); }
  else if (page === 'out') { setPlaying(false); renderOut(); }
  else S.dirty = true;
}
/** 출력 화면 오른쪽: 담은 예제(없으면 지금 만드는 예제)의 문제를 미리 보여 줍니다. */
function renderOut() {
  const list = S.saved.length ? S.saved : (S.good ? [currentExample()] : []);
  $('outPreview').innerHTML = list.map((e, i) => { try { const cfg = mergeCfg(e.cfg), R = compute(cfg); return `<h4>예제 ${i + 1}${S.saved.length ? '' : ' (아직 담지 않음)'} <small>${esc(recipeText(cfg))}</small></h4>${e.items.map((it, k) => blocksHtml(itemBlocks(it.text || problemText(it.kind, cfg, R), k, it.points))).join('')}<p class="hint">그림 ${e.figures.length || panelIds(cfg).length}개${e.figures.length ? '' : '(자동)'}</p>`; } catch (err) { return `<p class="warn">예제 ${i + 1}: ${esc(err.message)}</p>`; } }).join('') || '<p class="hint">아직 예제가 없습니다. 예제 만들기 화면에서 만드십시오.</p>';
}
/* ── 메뉴 줄: 누르면 펼치고, 펼친 상태에서는 다른 메뉴에 마우스를 올리면 바뀝니다. Esc나 바깥을 누르면 닫습니다. ── */
function openMenu(top) {
  for (const t of $$('.menu-top')) { const on = t === top; t.setAttribute('aria-expanded', on); t.nextElementSibling.hidden = !on; }
  S.menuOpen = !!top;
  top?.nextElementSibling.querySelector('button')?.focus();
}
const closeMenus = () => openMenu(null);
/** 예제·출력 페이지 위쪽에 지금 설정을 한 줄로 보여 줍니다. */
const setupText = () => { const g = S.good; return g ? `지금 설정: ${esc(fMarkupPlain(g))}, L = ${esc(prettyExpr(g.L))}, 개념: ${esc(recipeText(g))}. 그림은 시각화 화면의 '그래프 담기'로 넣습니다.` : ''; };
const fMarkupPlain = cfg => `f(x) = ${prettyExpr(cfg.f, cfg.params)}`;
/* ── 지운 것 되돌리기(최근 20번) ── */
S.undoStack = [];
/** 지우는 동작을 하기 전 상태를 남기고, 알림에 '되돌리기'를 띄웁니다. Ctrl+Z로도 되돌립니다. */
function undoable(message, mutate) {
  S.undoStack.push(copy({ saved: S.saved, draft: S.draft, edits: S.edits }));
  if (S.undoStack.length > 20) S.undoStack.shift();
  mutate();
  renderSaved(); rerenderTab(); persist();
  setStatus(message, { label: '되돌리기', fn: undo });
}
function undo() {
  const st = S.undoStack.pop();
  if (!st) return setStatus('되돌릴 것이 없습니다.');
  if (st.cfg) { S.cfg = st.cfg; renderSettings(); recompute(); return setStatus('문제를 되돌렸습니다.'); }
  S.saved = st.saved; S.draft = st.draft; S.edits = st.edits;
  renderSaved(); rerenderTab(); persist();
  return setStatus('되돌렸습니다.');
}

/* ── 설정 화면 ─────────────────────────────────────── */
const hintOf = cfg => halfDomain(cfg) ? '(0, L)에서의 함수. 예: x*(L-x), sin(pi*x/L), sin x' : '예: x^2, sign(x), abs(x), 2 sin x + 1';
function fieldHtml(field, cfg) {
  const { k, label, hint } = field, id = `f_${k}`;
  if (field.type === 'seg') return `<div class="fld"><span class="flabel">${label}</span><div class="seg" style="--n:${field.options.length}">${field.options.map(([value, text]) => `<button type="button" data-seg="${k}" data-value="${value}" aria-pressed="${cfg[k] === value}">${text}</button>`).join('')}</div></div>`;
  if (field.type === 'range') return `<div class="fld"><label class="flabel" for="${id}">${label}<output id="${id}_out">${cfg[k]}</output></label><input id="${id}" type="range" data-field="${k}" data-num="1" min="${field.min}" max="${field.max}" value="${cfg[k]}"></div>`;
  return `<div class="fld"><label class="flabel" for="${id}">${label}</label><input class="tf" id="${id}" type="text" spellcheck="false" autocomplete="off" data-field="${k}" value="${esc(cfg[k])}">${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
}
/** 입력한 함수를 교재처럼 보여 줍니다. 구간별이면 중괄호로 나눕니다. */
function previewHtml(cfg) {
  const rows = piecewiseRows(cfg, halfDomain(cfg));
  if (rows && rows.length > 1) return `<span class="m"><i>f</i>(<i>x</i>) =</span><span class="cases"><span class="brace">{</span><span class="rows">${rows.map(r => `<span><span class="m">${tex(polyTex(r.poly)).h}</span><em class="m">${tex(piTex(r.lo)).h} ≤ <i>x</i> &lt; ${tex(piTex(r.hi)).h}</em></span>`).join('')}</span></span>`;
  const pieces = piecesOf(cfg.f), node = s => tex(prettyExpr(s)).h;
  if (!pieces || pieces.length === 1) return `<span class="m"><i>f</i>(<i>x</i>) = ${node(cfg.f)}</span>`;
  const bounds = [halfDomain(cfg) ? '0' : '−L', ...pieces.slice(0, -1).map(p => p.until), 'L'];
  return `<span class="m"><i>f</i>(<i>x</i>) =</span><span class="cases"><span class="brace">{</span><span class="rows">${pieces.map((p, i) => `<span><span class="m">${node(p.expr)}</span><em class="m">${node(bounds[i])} ≤ <i>x</i> &lt; ${node(bounds[i + 1])}</em></span>`).join('')}</span></span>`;
}
function renderPreview() {
  const el = $('fPreview');
  if (!el) return;
  try { compile(S.cfg.f); el.innerHTML = previewHtml(S.cfg); } catch { el.innerHTML = '<span class="hint">식을 다 입력하면 여기에 보입니다.</span>'; }
}
function fHtml(cfg) {
  const mode = fieldHtml({ k: 'fMode', type: 'seg', label: esc(roleOf(cfg)), options: [['single', '식 하나'], ['pieces', '구간별']] }, cfg);
  if (cfg.fMode !== 'pieces') return `${mode}<div class="fld"><input class="tf" id="f_f" type="text" spellcheck="false" autocomplete="off" data-field="f" aria-label="함수 f(x)" value="${esc(cfg.f)}"><span class="hint">${esc(hintOf(cfg))}</span></div><div class="preview" id="fPreview"></div>`;
  const last = cfg.pieces.length - 1;
  const rows = cfg.pieces.map((p, i) => i < last
    ? `<div class="piece"><span>x &lt;</span><input class="tf until" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="until" aria-label="${i + 1}번 구간의 끝" value="${esc(p.until)}"><span>이면</span><input class="tf" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="expr" aria-label="${i + 1}번 구간의 식" value="${esc(p.expr)}"><button type="button" class="x" data-unpiece="${i}" aria-label="${i + 1}번 구간 빼기">×</button></div>`
    : `<div class="piece"><span>그 외</span><input class="tf" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="expr" aria-label="마지막 구간의 식" value="${esc(p.expr)}"></div>`).join('');
  return `${mode}<div class="fld"><span class="hint">구간 ${halfDomain(cfg) ? '0' : '−L'} ~ L을 왼쪽부터 나눕니다. 식에는 sin x, 2x처럼 써도 됩니다.</span>${rows}<button type="button" class="btn" id="addPiece">+ 구간 추가</button></div><div class="preview" id="fPreview"></div>`;
}
function renderSettings() {
  const cfg = S.cfg, p = cfg.prob, dom = DOMAINS.find(d => d.id === p.domain), base = [
    ...(topicOf(cfg).fields?.(p) ?? []),
    ...(dom.lLabel ? [{ k: 'L', type: 'text', label: dom.lLabel, hint: 'pi, 2, 1/2처럼 씁니다.' }, { k: 'N', type: 'range', label: '항의 개수 N (부분합에 더할 항)', min: 1, max: 200 }] : []),
    ...(anyInfinite(cfg) ? [{ k: 'X', type: 'text', label: '보이는 범위 X (−X < x < X)' }] : [])];
  $('problem').innerHTML = problemHtml(cfg);
  $('baseFields').innerHTML = fHtml(cfg) + base.map(f => fieldHtml({ ...f, label: esc(f.label) }, cfg)).join('');
  renderPreview();
  $('stageBar').innerHTML = stageBarHtml(cfg);
  $('stageBox').innerHTML = stageBoxHtml(cfg);
  for (const k of ['xMin', 'xMax', 'yMin', 'yMax', 'tEndWave', 'tEndHeat']) if (document.activeElement !== $(`f_${k}`)) $(`f_${k}`).value = cfg[k] ?? '';
  renderParams(true);
}
/** 수식에 새 글자를 쓰면 그 글자의 값을 넣는 칸이 생깁니다. */
function renderParams(force) {
  const cfg = S.cfg, names = new Set();
  for (const key of ['f', ...(cfg.on.wave ? ['g'] : [])]) { try { compile(String(cfg[key])).params.forEach(p => names.add(p)); } catch { /* 입력 중인 수식 */ } }
  const list = [...names], fresh = list.filter(p => !S.knownParams.has(p));
  for (const p of list) if (!(p in cfg.params)) cfg.params[p] = 1;
  if (!force && fresh.length) setStatus(`수식의 ${fresh.map(p => `'${p}'`).join(', ')}를 변수로 만들었습니다(값 ${fresh.map(p => cfg.params[p]).join(', ')}). 오타라면 수식을 고치십시오.`);
  S.knownParams = new Set(list);
  const key = list.join(',');
  if (!force && key === S.paramKey) return;
  S.paramKey = key;
  $('paramFields').innerHTML = list.map(p => `<div class="fld"><label class="flabel" for="p_${p}">수식의 변수 ${p}</label><input class="tf" id="p_${p}" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" data-param="${p}" value="${cfg.params[p]}"></div>`).join('');
}
function renderSheet() {
  for (const el of $$('[data-sheet]')) { const v = S.sheet[el.dataset.sheet]; if (el.type === 'checkbox') el.checked = !!v; else if (document.activeElement !== el) el.value = v ?? ''; }
}
function renderSaved() {
  $('savedList').innerHTML = S.saved.map((e, i) => `<li class="${S.draft.editing === i ? 'editing' : ''}"><span>${i + 1}. ${esc(prettyExpr(e.cfg.f, e.cfg.params))} · 소문항 ${e.items.length} · 그림 ${e.figures.length}</span><span class="acts"><button type="button" class="mini" data-edit="${i}">고치기</button><button type="button" class="x" data-smove="${i}" data-dir="-1" aria-label="${i + 1}번 위로">↑</button><button type="button" class="x" data-smove="${i}" data-dir="1" aria-label="${i + 1}번 아래로">↓</button><button type="button" class="x" data-unsave="${i}" aria-label="${i + 1}번 빼기">×</button></span></li>`).join('');
  $('savedCount').textContent = S.saved.length ? `담은 예제 ${S.saved.length}개 (Word에 이 순서로 들어갑니다). 다른 PC로 옮기려면 '예제 모음 저장'을 쓰십시오.` : "담은 예제가 없으면 '예제 만들기'에서 만드는 예제를 출력합니다.";
}
function setSeg(key, value) {
  const cfg = S.cfg;
  if (key === 'fMode') { if (value === 'pieces' && cfg.fMode !== 'pieces') cfg.pieces = toPieces(cfg.f, cfg); cfg.fMode = value; return; }
  cfg[key] = value;
}
function showError(text) {
  $('err').textContent = text; $('err').hidden = !text;
  $('graphErr').textContent = text ? `입력을 확인하십시오: ${text} — 그래프는 마지막으로 계산된 결과입니다.` : ''; $('graphErr').hidden = !text;
}
function recompute() {
  applyProblem(S.cfg);
  try {
    S.R = compute(S.cfg);
    S.good = copy(S.cfg);   // 입력이 잘못되면 그래프는 마지막으로 계산된 설정으로 그립니다.
    showError('');
  } catch (e) { showError(e.message); }
  $('transport').hidden = !(S.good && (S.good.on.wave || S.good.on.heat));
  syncDraft();
  if (S.ready && S.saved.length) S.draft.dirty = true;   // 설정이 바뀌면 지금 예제는 담은 예제와 달라집니다.
  renderTabs(true);
  persist();
  S.dirty = true;
}

/* ── 그래프 칸 ─────────────────────────────────────── */
/** 고정한 결과가 다른 개념의 그래프이면 나란히 보여 줍니다. 같은 개념이면 한 칸에 겹칩니다. */
function panelKeys() { if (!S.good) return []; const v = viewOf(S.good); return S.pin && S.pin.panel !== v ? ['pin', v] : [v]; }
function renderPanels() {
  const keys = panelKeys(), key = keys.join(',');
  $('pinBtn').textContent = S.pin ? '고정 해제' : '고정(비교)';
  $('pinBtn').setAttribute('aria-pressed', !!S.pin);
  if (key === S.panelKey) return;
  S.panelKey = key;
  if (S.zoom && !keys.includes(S.zoom.panel)) S.zoom = null;
  $('panels').style.setProperty('--cols', keys.length);
  $('panels').style.setProperty('--rows', 1);
  $('panels').innerHTML = keys.map(k => `<section class="pnl" data-panel="${k}"><header><span class="pt"></span><span class="legend"></span><span class="badges"></span></header><div class="cw"><canvas class="main" role="img"></canvas><canvas class="ov" tabindex="0" aria-label="그래프. ←→ 값 읽기, Shift+←→ 이동, +/− 확대, 0 원래대로, Enter 점 표시"></canvas></div></section>`).join('');
}
function draw() {
  renderPanels();
  if (!S.R) return;
  const cfg = { ...S.good, s: S.cfg.s }, C = themeColors();
  for (const el of $$('#panels .pnl')) {
    const key = el.dataset.panel, canvas = el.querySelector('canvas.main'), { ctx, w, h } = prepare(canvas);
    ctx.clearRect(0, 0, w, h);
    if (w < 60 || h < 50) continue;
    S.drawingKey = key;
    const meta = key === 'pin' ? PANELS[S.pin.panel](ctx, w, h, C, { ...S.pin.cfg, s: S.cfg.s }, S.pin.R, null) : PANELS[key](ctx, w, h, C, cfg, S.R, S.pin?.panel === key ? S.pin : null);
    if (key === 'pin') meta.title = `고정: ${meta.title}`;
    S.frames[key] = { ...meta.frame, probe: meta.probe, pick: meta.pick, snap: meta.snap };
    el.querySelector('.pt').textContent = meta.title;
    const html = legendHtml(meta.legend), lg = el.querySelector('.legend');
    if (lg.innerHTML !== html) lg.innerHTML = html;
    const badges = `${S.R.view?.x || S.R.view?.y ? '<button type="button" class="badge" data-clearrange title="왼쪽 \'그래프 범위\'에서 정한 범위를 지웁니다">범위 지정됨 ✕</button>' : ''}${S.zoom?.panel === key ? '<button type="button" class="badge" data-unzoom title="확대를 풉니다(더블클릭과 같음)">확대됨 ✕</button>' : ''}`, bg = el.querySelector('.badges');
    if (bg.innerHTML !== badges) bg.innerHTML = badges;
    canvas.setAttribute('aria-label', meta.title);
    drawOverlay(el);
  }
  S.drawingKey = '';
  if (S.tab === 'summary') renderTabs(false);
  $('tOut').textContent = ['wave', 'membrane', 'heat'].filter(id => cfg.on[id] && S.R[id]).map(id => `${{ wave: '현', membrane: '막', heat: '막대' }[id]} t = ${fmt(timeOf(S.R[id], cfg), 3)}`).join(' · ');
  $('tSlider').value = S.cfg.s;
}
/** 그래프 위의 펜 자국, 점 표시, 마우스 위치 세로선을 그립니다(그래프와 따로 지웁니다). */
function drawOverlay(el) {
  const key = el.dataset.panel, ov = el.querySelector('canvas.ov'), { ctx, w, h } = prepare(ov), C = themeColors(), f = S.frames[key];
  ctx.clearRect(0, 0, w, h);
  ov.style.pointerEvents = S.tool === 'view' ? 'auto' : 'auto';
  ov.style.cursor = S.tool === 'pen' ? 'crosshair' : S.tool === 'mark' ? 'cell' : S.zoom?.panel === key ? 'grab' : 'default';
  if (!f) return;
  const X = x => f.b.l + (x - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w;
  drawInk(ctx, f, S.ink[key], S.marks[key], C);
  if (S.hover?.key === key && S.tool === 'view') vline(ctx, X(S.hover.x), f.b, C.muted, [2, 3]);
}
/** 점 도구: 찍은 점 근처를 누르면 그 점을 지우고, 아니면 누른 곳에서 가장 가까운 곡선 위에 점을 찍습니다. 그래프 밖은 무시합니다. */
function toggleMark(el, key, px, py) {
  const f = S.frames[key];
  if (!f) return;
  const list = S.marks[key] ??= [], near = list.findIndex(m => { const p = markPoint(f, m); return p && Math.hypot(p.px - px, p.py - py) < 10; });
  if (near >= 0) { list.splice(near, 1); setStatus('점을 지웠습니다.'); }
  else {
    const x = f.xr[0] + (px - f.b.l) / f.b.w * (f.xr[1] - f.xr[0]), y = f.yr[1] - (py - f.b.t) / f.b.h * (f.yr[1] - f.yr[0]), m = markAt(f, x, y);
    if (!m) return setStatus('그래프 안쪽을 누르면 가장 가까운 곡선 위에 점이 찍힙니다.');
    list.push(m);
  }
  drawOverlay(el);
}
const redrawOverlays = () => $$('#panels .pnl').forEach(drawOverlay);
/** 마우스 위치를 그래프의 y로 바꿉니다. */
function yAt(el, clientY) {
  const f = S.frames[el.dataset.panel], r = el.querySelector('canvas.ov').getBoundingClientRect();
  return f ? f.yr[1] - (clientY - r.top - f.b.t) / f.b.h * (f.yr[1] - f.yr[0]) : null;
}
/** 마우스 위치를 그래프의 x로 바꿉니다. */
function xAt(el, clientX) {
  const f = S.frames[el.dataset.panel], r = el.querySelector('canvas.ov').getBoundingClientRect();
  if (!f) return null;
  return f.xr[0] + (clientX - r.left - f.b.l) / f.b.w * (f.xr[1] - f.xr[0]);
}
function showProbe(el, e) {
  const x = xAt(el, e.clientX), f = S.frames[el.dataset.panel], tip = $('probe');
  if (x === null || !f || x < f.xr[0] || x > f.xr[1]) { tip.hidden = true; S.hover = null; return; }
  S.hover = { key: el.dataset.panel, x };
  tip.innerHTML = [`x = ${fmt(x, 3)}`, ...f.probe(x).map(([k, v]) => `${esc(k)} = ${fmt(v, 4)}`)].join('<br>');
  const col = document.querySelector('.plotCol').getBoundingClientRect();
  tip.style.left = `${e.clientX - col.left + 14}px`; tip.style.top = `${e.clientY - col.top + 10}px`;
  tip.hidden = false;
}

/* ── 아래 탭: 요약, 개념, 예제 만들기 ──────────────── */
function conceptTabHtml(cfg) {
  return `<div class="doc">${CONCEPTS.filter(c => cfg.on[c.id]).map(c => {
    const head = `<h3>${c.title} <small>${c.ch}${S.edits[c.id] !== undefined ? ' · 고친 설명' : ''}</small>${S.editingConcept === c.id ? '' : ` <button type="button" class="mini" data-cedit="${c.id}">고치기</button>`}</h3>`;
    if (S.editingConcept === c.id) return `<section class="now">${head}<textarea id="conceptText" rows="12" spellcheck="false">${esc(conceptMarkup(c.id))}</textarea><div class="row"><button type="button" class="btn primary" data-csave="${c.id}">저장</button><button type="button" class="btn" data-creset="${c.id}">기본값으로</button><button type="button" class="btn" data-ccancel>취소</button></div><p class="hint tex">문단은 빈 줄로 나눕니다. $…$는 수식(예: $a_n$, $\\frac{1}{L}$, $\\int_0^L f\\,dx$), $$…$$ 문단은 가운데 수식, '&gt; '로 시작하면 강조 상자, **굵게**입니다.</p></section>`;
    return `<section class="${c.id === deepestOf(cfg) ? 'now' : ''}">${head}${blocksHtml(markupBlocks(conceptMarkup(c.id)))}</section>`;
  }).join('')}</div>`;
}
function exampleTabHtml() {
  const d = S.draft, kinds = Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const items = d.items.map((it, i) => `<div class="item" data-i="${i}">
    <div class="item-top"><b>(${i + 1})</b><span class="kind">${KINDS[it.kind].label}${it.edited ? ' · 직접 고침' : ''}</span>
      <label class="pts">배점 <input class="tf" type="text" inputmode="numeric" data-ifield="points" data-i="${i}" value="${esc(it.points)}"></label>
      <button type="button" class="x" data-imove="${i}" data-dir="-1" aria-label="위로">↑</button><button type="button" class="x" data-imove="${i}" data-dir="1" aria-label="아래로">↓</button><button type="button" class="x" data-idel="${i}" aria-label="소문항 빼기">×</button></div>
    <textarea class="tf" rows="2" data-ifield="text" data-i="${i}" aria-label="${i + 1}번 문장" placeholder="문장을 쓰십시오. 수식은 $…$">${esc(it.text)}</textarea>
    <div class="item-sol">${it.kind === 'free' ? '' : `<label class="ck small"><input type="checkbox" data-ifield="auto" data-i="${i}" ${it.auto ? 'checked' : ''}>자동 풀이 넣기</label>`}${it.edited && it.kind !== 'free' ? `<button type="button" class="mini" data-irevert="${i}">자동 문장으로</button>` : ''}</div>
    <div class="warnslot">${itemWarn(it, i)}</div>
    <textarea class="tf" rows="1" data-ifield="note" data-i="${i}" aria-label="${i + 1}번 풀이 메모" placeholder="풀이에 덧붙일 설명 (선택)">${esc(it.note)}</textarea></div>`).join('');
  const figs = figuresHtml();
  return exampleBody(d, kinds, items, figs);
}
const SETUP_KEYS = ['f', 'L', 'N', 'params', 'prob', 'look', 'kDamp', 'on', 'halfMode', 'coefKind', 'coefN', 'waveDomain', 'waveEnds', 'damping', 'g', 'c', 'heatDomain', 'alpha', 'bc', 'left', 'right', 'X', 'jumpIndex', 'wMax', 'b', 'h', 'M'];
/** 그림을 담은 뒤 함수나 개념 설정이 바뀌었는지 봅니다(시간, 확대는 그림마다 다를 수 있어 보지 않습니다). */
const sameSetup = (a, b) => SETUP_KEYS.every(k => JSON.stringify(a?.[k]) === JSON.stringify(b?.[k]));
/** 문장을 직접 고쳤는데 자동 풀이가 켜져 있으면, 풀이가 설정의 함수 기준이라는 것을 알립니다. */
const itemWarn = (it, i) => it.edited && it.auto && it.kind !== 'free' ? `<p class="warn">문장을 직접 고쳤습니다. 자동 풀이는 설정의 함수 ${esc(prettyExpr(S.good?.f ?? '', S.good?.params ?? {}))}로 계산합니다. 문장의 함수나 값이 다르면 <button type="button" class="mini" data-autooff="${i}">자동 풀이 끄기</button> 후 풀이 메모를 쓰십시오.</p>` : '';
function figuresHtml() {
  return S.draft.figures.map((f, i) => `<div class="figrow"><span>그림 ${i + 1}</span><span class="hint">${esc(f.panel === 'eigen' ? '고유함수' : conceptOf(f.panel === 'series' && f.cfg.on.half ? 'half' : f.panel)?.title ?? f.panel)}</span>
    <input class="tf" type="text" data-ffield="caption" data-f="${i}" placeholder="그림 설명 (비우면 자동)" value="${esc(f.caption)}">
    <select data-ffield="size" data-f="${i}" aria-label="그림 ${i + 1} 크기">${[['small', '작게'], ['mid', '보통'], ['large', '크게']].map(([v, t]) => `<option value="${v}" ${f.size === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <button type="button" class="x" data-fdel="${i}" aria-label="그림 ${i + 1} 빼기">×</button>${S.good && !sameSetup(f.cfg, S.good) ? `<span class="warn">담은 뒤 설정이 바뀜</span><button type="button" class="mini" data-frecap="${i}">지금 설정으로 다시 담기</button>` : ''}</div>`).join('');
}
function exampleBody(d, kinds, items, figs) {
  return `<div class="editor">
    <div class="ed-head"><b>${d.editing === null ? '새 예제' : `예제 ${d.editing + 1} 고치는 중`}</b>
      <select id="addKind" aria-label="소문항 추가"><option value="">+ 소문항 추가</option>${kinds}</select>
      <button type="button" class="btn" id="draftReset">자동 초안으로</button>
      <span class="hint tex">수식은 $…$로 씁니다. 예: $a_n = \\frac{1}{L}\\int_{-L}^{L} f\\cos nx\\,dx$</span></div>
    <div id="items">${items || '<p class="hint">소문항이 없습니다. 위에서 추가하십시오.</p>'}</div>
    <div class="ed-figs"><b>그림</b> <span class="hint">${d.figures.length ? '' : "그래프 위 '그래프 담기'로 지금 장면을 담습니다. 담지 않으면 켠 개념의 그래프가 자동으로 들어갑니다."}</span><div id="edFigs">${figs}</div></div>
    <div class="row"><button type="button" class="btn primary" id="saveExample">${d.editing === null ? '이 예제 담기' : `예제 ${d.editing + 1}에 저장`}</button>${d.editing === null ? '' : '<button type="button" class="btn" id="newExample">새 예제 만들기</button>'}</div>
    <h4>미리보기</h4><div class="doc" id="exPreview"></div></div>`;
}
function renderExamplePreview() {
  const el = $('exPreview');
  if (!el || !S.R || !S.good) return;
  const cfg = S.good, items = S.draft.items;
  try {
    el.innerHTML = `<h3>문제</h3>${items.map((it, k) => blocksHtml(itemBlocks(it.text, k, it.points))).join('')}${S.draft.figures.map((f, i) => `<p class="hint">[그림 ${i + 1}] ${esc(f.caption || '그래프')}</p>`).join('')}<h3>풀이</h3>${items.map((it, k) => blocksHtml(itemBlocks(solutionOf(it, cfg, S.R) || '(풀이 없음)', k))).join('')}`;
  } catch (e) { el.textContent = e.message; }
}
/** 설정이 바뀌면 고치지 않은 문장을 새 값으로 바꿉니다. 입력 중인 칸은 건드리지 않습니다. */
function refreshExample() {
  if ($$('#items .item').length !== S.draft.items.length) return rerenderMake();
  for (const ta of $$('#items textarea[data-ifield="text"]')) if (document.activeElement !== ta) ta.value = S.draft.items[+ta.dataset.i].text;
  for (const slot of $$('#items .warnslot')) { const i = +slot.closest('.item').dataset.i, html = itemWarn(S.draft.items[i], i); if (slot.innerHTML !== html) slot.innerHTML = html; }
  if ($('edFigs') && !$('edFigs').contains(document.activeElement)) { const html = figuresHtml(); if ($('edFigs').innerHTML !== html) $('edFigs').innerHTML = html; }
  renderExamplePreview();
}
function renderTabs(all) {
  for (const b of $$('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === S.tab);
  $('bottom').classList.toggle('tall', S.editingConcept !== null);
  if (!S.R || !S.good) { $('tabBody').innerHTML = ''; return; }
  const cfg = { ...S.good, s: S.cfg.s };
  let html;
  if (S.tab === 'summary') html = `<ul class="sumlist">${summary(cfg, S.R).map(([t, line]) => `<li><b>${t}</b> ${line}</li>`).join('')}</ul>${valueTable()}`;
  else if (!all) return;
  else { if (S.editingConcept && document.activeElement === $('conceptText')) return; html = conceptTabHtml(cfg); }
  if (S.lastTab !== html) { $('tabBody').innerHTML = html; S.lastTab = html; $('tabBody').querySelector('.now')?.scrollIntoView({ block: 'start' }); }
}
const rerenderTab = () => { S.lastTab = ''; renderTabs(true); rerenderMake(); };
/** 예제·출력 페이지를 그립니다. 이미 그려져 있으면 입력 중인 칸을 건드리지 않고 바뀐 부분만 고칩니다. */
function renderMake() {
  if (S.page !== 'make' || !S.R || !S.good) return;
  const line = setupText();
  if ($('setupLine').innerHTML !== line) $('setupLine').innerHTML = line;
  if (S.lastMake && $('items')) return refreshExample();
  $('exampleEditor').innerHTML = exampleTabHtml(); S.lastMake = true; renderExamplePreview();
}
const rerenderMake = () => { S.lastMake = false; renderMake(); };
/** 그래프 값 표: 화면의 그래프에서 가로축을 10등분한 점의 값입니다(화면 낭독기와 확인용). */
function valueTable() {
  const key = panelKeys().at(-1), f = S.frames[key];
  if (!f?.probe) return '';
  const xs = Array.from({ length: 11 }, (_, i) => f.xr[0] + i / 10 * (f.xr[1] - f.xr[0])), rows = xs.map(x => [x, f.probe(x)]);
  const heads = rows[0][1].map(([k]) => `<th>${esc(k)}</th>`).join('');
  return `<details class="vtable"><summary>그래프 값 표</summary><table><tr><th>x</th>${heads}</tr>${rows.map(([x, vals]) => `<tr><td>${fmt(x, 3)}</td>${vals.map(([, v]) => `<td>${fmt(v, 4)}</td>`).join('')}</tr>`).join('')}</table></details>`;
}
function saveExample() {
  queueMicrotask(() => { if (S.page === 'out') renderOut(); });
  if (!S.good) return;
  const ex = currentExample();
  if (S.draft.editing !== null && S.saved[S.draft.editing]) { S.saved[S.draft.editing] = ex; setStatus(`예제 ${S.draft.editing + 1}을 저장했습니다.`); }
  else { S.saved.push(ex); setStatus(`예제 ${S.saved.length}을 담았습니다.`); }
  S.draft = emptyDraft(); syncDraft();
  renderSaved(); rerenderTab(); persist();
}
/** 함수와 설정을 처음 상태로 돌립니다. 만든 예제와 고친 설명은 그대로이며, 되돌릴 수 있습니다. */
function resetAll() {
  S.undoCfg = copy(S.cfg);
  S.cfg = copy(DEFAULTS); S.zoom = null; S.pin = null; S.ink = {}; S.marks = {};
  renderSettings(); recompute();
  setStatus('함수와 설정을 처음 상태로 돌렸습니다. 만든 예제와 고친 설명은 그대로입니다.', { label: '되돌리기', fn: () => { S.cfg = S.undoCfg; renderSettings(); recompute(); } });
}
function editSaved(i) {
  const e = S.saved[i];
  S.cfg = mergeCfg(e.cfg);
  S.draft = { items: copy(e.items), figures: copy(e.figures), editing: i, custom: true, dirty: false };
  renderSettings(); recompute(); S.draft.dirty = false; setPage('make'); renderSaved();
}

/* ── 처음 안내와 도움말 ─────────────────────────────── */
const TOUR = [
  ['#problem', '문제를 정합니다', '방정식(없음·파동·열), 영역, 양 끝 조건을 고릅니다. 아래에 교재의 어느 절인지 나옵니다. 사인 급수인지 코사인 급수인지, 급수인지 적분인지는 고르지 않습니다. 영역과 양 끝 조건이 정합니다.'],
  ['#baseFields', '함수를 입력합니다', 'x^2, sin x, |x|처럼 씁니다. 칸 이름에 이 함수의 뜻(초기 변위, 초기 온도 등)과 구간이 나옵니다. 구간마다 식이 다르면 "구간별"을 고릅니다. 아래 미리보기로 제대로 들어갔는지 확인합니다.'],
  ['#stageBar', '풀이 단계를 따라갑니다', '그래프 위 줄에 교재의 절과 풀이 단계(변수분리와 고유값 문제 → 전개 → 해)가 있습니다. 단계를 누르면 그 단계의 그래프로 바뀌고, 바로 아래에 그 단계의 교재 수식과 설정이 나옵니다. 전개 단계에서는 부분합·계수의 의미·계수 크기·도약을 골라 봅니다. 문제를 바꾼 것은 Ctrl+Z로 되돌립니다.'],
  ['.tools', '그래프를 살펴봅니다', '그래프 위에 마우스를 올리면 값이 보입니다. Ctrl+휠로 확대, 끌어서 이동, 더블클릭으로 원래대로 돌아갑니다. 그래프를 누른 뒤 키보드(←→ 값 읽기, +/− 확대, Enter 점)로도 다룹니다. "고정(비교)"은 지금 결과를 남겨 비교하고, "그래프 담기"는 이 장면을 예제의 그림으로 넣습니다.'],
  ['#bottom', '요약과 개념 설명', '아래 탭에서 요약(그래프 값 표 포함)과 개념 설명을 봅니다. 개념 설명은 "고치기"로 바꿀 수 있습니다. 가운데 줄을 끌어 이 칸의 높이를 바꿉니다.'],
  ['#menubar', '메뉴 줄', '맨 위 메뉴 줄의 "예제 만들기"에서 문제 문장, 배점, 풀이 메모를 쓰고 예제를 모읍니다. "출력"에서 Word나 PDF로 내보냅니다. 파일·편집·보기·도움말 메뉴에 예제 모음 열기·저장, 되돌리기(Ctrl+Z), 발표 모드, 글자 크기, 도움말이 있습니다. 만든 내용은 자동 저장됩니다.'],
];
const TOUR_KEY = 'lectureStudio.tourDone';
function showTour(i) {
  $$('.spot').forEach(el => el.classList.remove('spot'));
  if (i < 0 || i >= TOUR.length) { $('tour').hidden = true; S.tourStep = -1; if (!S.noSave) try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* 건너뜀 */ } return; }
  S.tourStep = i;
  const [sel, title, text] = TOUR[i], target = document.querySelector(sel);
  if (S.page !== 'viz' && TOUR[i][0] !== '#menubar') setPage('viz');
  target?.classList.add('spot'); target?.scrollIntoView?.({ block: 'nearest' });
  $('tourStep').textContent = `처음 안내 ${i + 1} / ${TOUR.length}`; $('tourTitle').textContent = title; $('tourText').textContent = text;
  $('tourPrev').disabled = i === 0; $('tourNext').textContent = i === TOUR.length - 1 ? '시작하기' : '다음';
  $('tour').hidden = false;
}
const tourDone = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };

/* ── 재생 ─────────────────────────────────────────── */
function setPlaying(on) { S.playing = on; S.last = 0; $('playBtn').setAttribute('aria-pressed', on); $('pauseBtn').setAttribute('aria-pressed', !on && S.cfg.s > 0); }
function tick(dt) { S.cfg.s += dt * S.rate / 12; if (S.cfg.s > 1) S.cfg.s = 0; S.dirty = true; }
function frame(now) {
  if (S.playing && S.R) { if (S.last) tick(Math.min(.1, (now - S.last) / 1000)); S.last = now; }
  if (S.dirty) { S.dirty = false; draw(); }
  requestAnimationFrame(frame);
}

/* ── 입력 ─────────────────────────────────────────── */
const move = (list, i, dir) => { const j = i + dir; if (j < 0 || j >= list.length) return false; [list[i], list[j]] = [list[j], list[i]]; return true; };
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset, draft = S.draft;
  if (d.seg) { setSeg(d.seg, d.value); renderSettings(); return recompute(); }
  if (d.prob) return changeProblem(d.prob, d.value);
  if (d.look) { pushUndo(); S.cfg.look = d.look; S.cfg.stage = 'expand'; applyProblem(S.cfg); renderSettings(); return recompute(); }
  if (d.stage) { S.cfg.stage = d.stage; renderSettings(); return recompute(); }
  if (t.classList.contains('menu-top')) return openMenu(t.getAttribute('aria-expanded') === 'true' ? null : t);
  if (t.closest('.menu-list')) closeMenus();
  if (d.click) return $(d.click).click();
  if (d.page) return setPage(d.page);
  if (d.tab) { S.tab = d.tab; S.lastTab = ''; return renderTabs(true); }
  if (d.tool) { S.tool = d.tool; for (const b of $$('[data-tool]')) b.setAttribute('aria-pressed', b.dataset.tool === S.tool); $('probe').hidden = true; S.hover = null; return redrawOverlays(); }
  if (d.unsave !== undefined) { const i = +d.unsave; return undoable(`예제 ${i + 1}을 지웠습니다.`, () => { S.saved.splice(i, 1); if (draft.editing === i) draft.editing = null; else if (draft.editing > i) draft.editing--; }); }
  if (d.smove !== undefined) { const i = +d.smove; if (move(S.saved, i, +d.dir)) { if (draft.editing === i) draft.editing += +d.dir; else if (draft.editing === i + +d.dir) draft.editing = i; } renderSaved(); return persist(); }
  if (d.edit !== undefined) return editSaved(+d.edit);
  if (d.imove !== undefined) { move(draft.items, +d.imove, +d.dir); draft.custom = true; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.idel !== undefined) return undoable(`소문항 (${+d.idel + 1})을 지웠습니다.`, () => { draft.items.splice(+d.idel, 1); draft.custom = true; draft.dirty = true; });
  if (d.irevert !== undefined) { draft.items[+d.irevert].edited = false; draft.dirty = true; syncDraft(); rerenderTab(); return persist(); }
  if (d.fdel !== undefined) return undoable(`그림 ${+d.fdel + 1}을 지웠습니다.`, () => { draft.figures.splice(+d.fdel, 1); draft.dirty = true; });
  if (d.frecap !== undefined) { const f = draft.figures[+d.frecap]; f.panel = S.good.on[f.panel] ? f.panel : viewOf(S.good); f.cfg = copy({ ...S.good, s: S.cfg.s }); f.zoom = null; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.autooff !== undefined) { draft.items[+d.autooff].auto = false; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.clearrange !== undefined) { for (const k of ['xMin', 'xMax', 'yMin', 'yMax']) S.cfg[k] = ''; renderSettings(); return recompute(); }
  if (d.unzoom !== undefined) { S.zoom = null; S.dirty = true; return undefined; }
  if (d.cedit) { S.editingConcept = d.cedit; S.tab = 'concept'; return rerenderTab(); }
  if (d.csave) { S.edits[d.csave] = $('conceptText').value; S.editingConcept = null; rerenderTab(); setStatus('개념 설명을 저장했습니다. Word 출력에도 이 글이 들어갑니다.'); return persist(); }
  if (d.creset) return undoable(`'${conceptOf(d.creset).title}'의 고친 설명을 기본값으로 돌렸습니다.`, () => { delete S.edits[d.creset]; S.editingConcept = null; });
  if (d.ccancel !== undefined) { S.editingConcept = null; return rerenderTab(); }
  if (d.unpiece !== undefined) {
    S.cfg.pieces.splice(+d.unpiece, 1);
    if (S.cfg.pieces.length < 2) { S.cfg.fMode = 'single'; S.cfg.f = S.cfg.pieces[0].expr; } else S.cfg.f = piecesExpr(S.cfg.pieces);
    renderSettings(); return recompute();
  }
  switch (t.id) {
    case 'statusAct': { const fn = S.statusAct; $('status').innerHTML = ''; S.statusAct = null; return fn?.(); }
    case 'choiceAdd': $('exportChoice').hidden = true; saveExample(); return exportWord(true, S.pendingExport);
    case 'choiceOnly': return exportWord(true, S.pendingExport);
    case 'pdfBtn': return exportWord(false, 'pdf');
    case 'choiceCancel': $('exportChoice').hidden = true; return undefined;
    case 'resetBtn': return resetAll();
    case 'helpBtn': $('help').hidden = false; return $('helpClose').focus();
    case 'undoBtn': return undo();
    case 'tourAgain2': return showTour(0);
    case 'helpClose': $('help').hidden = true; return undefined;
    case 'tourAgain': $('help').hidden = true; return showTour(0);
    case 'tourNext': return showTour(S.tourStep + 1 >= TOUR.length ? -1 : S.tourStep + 1);
    case 'tourPrev': return showTour(Math.max(0, S.tourStep - 1));
    case 'tourSkip': return showTour(-1);
    case 'addPiece': S.cfg.pieces.splice(S.cfg.pieces.length - 1, 0, { until: 'L/2', expr: '0' }); S.cfg.f = piecesExpr(S.cfg.pieces); renderSettings(); return recompute();
    case 'playBtn': return setPlaying(true);
    case 'pauseBtn': return setPlaying(false);
    case 'stopBtn': setPlaying(false); S.cfg.s = 0; S.dirty = true; return undefined;
    case 'captureBtn': {
      if (!S.good) return undefined;
      const panel = viewOf(S.good);
      draft.figures.push({ panel, cfg: copy({ ...S.good, s: S.cfg.s }), zoom: S.zoom?.panel === panel ? [...S.zoom.xr] : null, caption: '', size: 'mid', ink: copy(S.ink[panel] ?? []), marks: copy(S.marks[panel] ?? []) });
      draft.dirty = true;
      setStatus(`그림 ${draft.figures.length}을 예제에 담았습니다. 위쪽 '예제·출력'에서 설명과 크기를 정합니다.`);
      return persist();
    }
    case 'pinBtn': S.pin = S.pin ? null : { cfg: copy(S.good), R: S.R, panel: viewOf(S.good) }; S.panelKey = ''; S.dirty = true; return undefined;
    case 'clearInk': S.ink = {}; S.marks = {}; return redrawOverlays();
    case 'draftReset': return undoable('소문항을 자동 초안으로 바꿨습니다.', () => { S.draft = { ...emptyDraft(), figures: draft.figures, editing: draft.editing, dirty: true }; syncDraft(); });
    case 'saveExample': return saveExample();
    case 'newExample': S.draft = emptyDraft(); syncDraft(); rerenderTab(); renderSaved(); return persist();
    case 'wordBtn': return exportWord();
    case 'libSave': download(new Blob([libraryText()], { type: 'application/json' }), `${S.sheet.title.trim() || '공업수학 예제'} 예제 모음.json`); return undefined;
    case 'libOpen': $('libFile').value = ''; return $('libFile').click();
    case 'themeBtn': document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; t.textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게'; S.dirty = true; return undefined;
    case 'bigger': return setSize(.1);
    case 'smaller': return setSize(-.1);
    case 'presentBtn': if (S.page !== 'viz' && !document.body.classList.contains('present')) setPage('viz'); document.body.classList.toggle('present'); t.innerHTML = `${document.body.classList.contains('present') ? '발표 끝내기' : '발표 모드'}<kbd>F</kbd>`; try { if (document.body.classList.contains('present')) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 선택 사항 */ } S.dirty = true; return undefined;
    default: return undefined;
  }
});
let size = 1.1;
function setSize(d) { size = Math.max(.9, Math.min(1.8, +(size + d).toFixed(2))); document.documentElement.style.fontSize = `${16 * size}px`; S.dirty = true; }
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'tSlider') { S.cfg.s = +t.value; S.dirty = true; return; }
  if (d.field) {
    S.cfg[d.field] = d.num ? +t.value : t.value;
    if (d.num) $(`${t.id}_out`).textContent = t.value;
    renderParams(false); renderPreview(); recompute();
  } else if (d.piece !== undefined) {
    S.cfg.pieces[+d.piece][d.part] = t.value; S.cfg.f = piecesExpr(S.cfg.pieces);
    renderParams(false); renderPreview(); recompute();
  } else if (d.param && t.value !== '' && isFinite(+t.value)) { S.cfg.params[d.param] = +t.value; recompute(); }
  else if (d.ifield && t.type !== 'checkbox') {
    const it = S.draft.items[+d.i];
    it[d.ifield] = t.value;
    if (d.ifield === 'text') { it.edited = true; const slot = t.closest('.item')?.querySelector('.warnslot'); if (slot) slot.innerHTML = itemWarn(it, +d.i); }
    S.draft.dirty = true; renderExamplePreview(); persist();
  } else if (d.ffield === 'caption') { S.draft.figures[+d.f].caption = t.value; S.draft.dirty = true; renderExamplePreview(); persist(); }
  else if (d.sheet && t.type !== 'checkbox') { S.sheet[d.sheet] = t.value; persist(); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.ifield === 'auto') { const it = S.draft.items[+d.i]; it.auto = t.checked; S.draft.dirty = true; const slot = t.closest('.item')?.querySelector('.warnslot'); if (slot) slot.innerHTML = itemWarn(it, +d.i); renderExamplePreview(); persist(); }
  else if (d.ffield === 'size') { S.draft.figures[+d.f].size = t.value; S.draft.dirty = true; persist(); }
  else if (d.sheet) { S.sheet[d.sheet] = t.type === 'checkbox' ? t.checked : t.value; persist(); }
  else if (t.id === 'addKind' && t.value) { const it = newItem(t.value); S.draft.items.push(it); S.draft.custom = true; S.draft.dirty = true; syncDraft(); rerenderTab(); persist(); }
  else if (t.id === 'rateSel') S.rate = +t.value;
  else if (t.id === 'libFile' && t.files[0]) {
    const reader = new FileReader();
    reader.onload = () => { try { const n = importLibrary(String(reader.result)); renderSaved(); renderSheet(); rerenderTab(); persist(); setStatus(`예제 ${n}개를 불러왔습니다.`); } catch (err) { setStatus(err.message); } };
    reader.readAsText(t.files[0], 'utf-8');
  }
});
document.addEventListener('keydown', e => {
  if (S.menuOpen) {
    const items = $$('.menu-list:not([hidden]) button'), i = items.indexOf(document.activeElement), tops = $$('.menu-top'), cur = tops.findIndex(x => x.getAttribute('aria-expanded') === 'true');
    if (e.key === 'Escape') { tops[cur]?.focus(); closeMenus(); e.preventDefault(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { openMenu(tops[(cur + (e.key === 'ArrowRight' ? 1 : tops.length - 1)) % tops.length]); e.preventDefault(); return; }
  }
  if (e.key === 'Escape' && !$('help').hidden) { $('help').hidden = true; return; }
  if (e.key === 'Escape' && !$('tour').hidden) { showTour(-1); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && !['range', 'checkbox'].includes(e.target.type)) return;
  if (e.ctrlKey && ['z', 'Z', 'ㅋ'].includes(e.key)) { e.preventDefault(); undo(); return; }
  if (e.target.matches?.('canvas.ov')) return;   // 그래프의 키보드 조작은 아래 그래프 칸에서 처리합니다.
  if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') { if (S.page === 'viz') $('presentBtn').click(); }
  else if (e.key === 'Escape' && document.body.classList.contains('present')) $('presentBtn').click();
  else if (e.key === ' ' && !$('transport').hidden && e.target.tagName !== 'BUTTON') { e.preventDefault(); setPlaying(!S.playing); }
});
document.addEventListener('pointerdown', e => { if (S.menuOpen && !e.target.closest('.menu')) closeMenus(); });
$('menubar').addEventListener('pointerover', e => { const t = e.target.closest('.menu-top'); if (S.menuOpen && t && t.getAttribute('aria-expanded') !== 'true') openMenu(t); });
// 고른 목록 위에서 스크롤해도 값이 바뀌지 않게 합니다.
document.addEventListener('wheel', e => { if (e.target.tagName === 'SELECT' && document.activeElement === e.target) e.target.blur(); }, { passive: true });
/* 그래프 위 마우스: 보기(값 읽기, Ctrl+휠 확대, 끌어서 이동), 펜(그리기), 점(값 표시). */
let drag = null;
$('panels').addEventListener('pointerdown', e => {
  const el = e.target.closest('.pnl');
  if (!el || e.target.tagName !== 'CANVAS') return;
  const key = el.dataset.panel, r = el.querySelector('canvas.ov').getBoundingClientRect();
  if (S.tool === 'pen') { (S.ink[key] ??= []).push([[xAt(el, e.clientX), yAt(el, e.clientY)]]); drag = { kind: 'pen', key, el, r }; }
  else if (S.tool === 'mark') { toggleMark(el, key, e.clientX - r.left, e.clientY - r.top); return; }
  else if (S.zoom?.panel === key) drag = { kind: 'pan', key, el, x0: e.clientX, xr: [...S.zoom.xr], w: S.frames[key].b.w };
  if (drag) try { e.target.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트에는 포인터가 없습니다 */ }
});
$('panels').addEventListener('pointermove', e => {
  const el = e.target.closest('.pnl');
  if (drag?.kind === 'pen') { S.ink[drag.key].at(-1).push([xAt(drag.el, e.clientX), yAt(drag.el, e.clientY)]); return drawOverlay(drag.el); }
  if (drag?.kind === 'pan') { const shift = -(e.clientX - drag.x0) / drag.w * (drag.xr[1] - drag.xr[0]); S.zoom = { panel: drag.key, xr: [drag.xr[0] + shift, drag.xr[1] + shift] }; S.dirty = true; return undefined; }
  if (el && S.tool !== 'pen') { showProbe(el, e); drawOverlay(el); }
  return undefined;
});
const endDrag = () => { drag = null; };
$('panels').addEventListener('pointerup', endDrag);
$('panels').addEventListener('pointercancel', endDrag);
$('panels').addEventListener('pointerleave', () => { $('probe').hidden = true; S.hover = null; redrawOverlays(); });
$('panels').addEventListener('wheel', e => {
  const el = e.target.closest('.pnl');
  if (!e.ctrlKey || !el || e.target.tagName !== 'CANVAS') return;
  e.preventDefault();
  const key = el.dataset.panel, f = S.frames[key], x = xAt(el, e.clientX);
  if (!f || x === null) return;
  const k = e.deltaY < 0 ? 1 / 1.25 : 1.25, xr = S.zoom?.panel === key ? S.zoom.xr : f.xr;
  S.zoom = { panel: key, xr: [x - (x - xr[0]) * k, x + (xr[1] - x) * k] };
  S.dirty = true;
}, { passive: false });
/* 그래프의 키보드 조작: ←→ 값 읽기 위치, Shift+←→ 이동, +/− 확대, 0 원래대로, Enter 점 표시. 값은 화면 낭독기에도 읽힙니다. */
function probeAt(el, x) {
  const key = el.dataset.panel, f = S.frames[key], tip = $('probe');
  if (!f) return;
  S.hover = { key, x };
  const lines = [`x = ${fmt(x, 3)}`, ...f.probe(x).map(([k, v]) => `${k} = ${fmt(v, 4)}`)];
  tip.innerHTML = lines.map(esc).join('<br>');
  const r = el.querySelector('canvas.ov').getBoundingClientRect(), col = document.querySelector('.plotCol').getBoundingClientRect();
  tip.style.left = `${r.left - col.left + f.b.l + (x - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w + 14}px`; tip.style.top = `${r.top - col.top + f.b.t + 10}px`;
  tip.hidden = false;
  $('liveProbe').textContent = lines.join(', ');
  drawOverlay(el);
}
$('panels').addEventListener('keydown', e => {
  const el = e.target.closest('.pnl');
  if (!el || !e.target.matches('canvas.ov')) return;
  const key = el.dataset.panel, f = S.frames[key];
  if (!f) return;
  const span = f.xr[1] - f.xr[0], x = S.hover?.key === key ? S.hover.x : (f.xr[0] + f.xr[1]) / 2;
  let used = true;
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey) { const d = (e.key === 'ArrowLeft' ? -1 : 1) * span * .1; S.zoom = { panel: key, xr: [f.xr[0] + d, f.xr[1] + d] }; S.dirty = true; }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') probeAt(el, Math.max(f.xr[0], Math.min(f.xr[1], x + (e.key === 'ArrowLeft' ? -1 : 1) * span / 50)));
  else if (e.key === '+' || e.key === '=' || e.key === '-') { const k = e.key === '-' ? 1.25 : 1 / 1.25; S.zoom = { panel: key, xr: [x - (x - f.xr[0]) * k, x + (f.xr[1] - x) * k] }; S.dirty = true; }
  else if (e.key === '0') { S.zoom = null; S.dirty = true; }
  else if (e.key === 'Enter') { const m = markAt(f, x, pickLines(f, f.snap ? f.snap(x) : x)[0]?.[1] ?? NaN); if (m) { (S.marks[key] ??= []).push(m); drawOverlay(el); setStatus(`x = ${fmt(m.x, 3)}에 점을 표시했습니다.`); } }
  else used = false;
  if (used) { e.preventDefault(); e.stopPropagation(); }
});
$('panels').addEventListener('dblclick', e => { if (e.target.tagName === 'CANVAS' && S.tool === 'view') { S.zoom = null; S.dirty = true; } });
/* 그래프와 아래 칸 사이의 줄을 끌어 아래 칸의 높이를 바꿉니다. */
let sizing = null;
$('resizer').addEventListener('pointerdown', e => { sizing = { y: e.clientY, h: $('bottom').getBoundingClientRect().height }; try { $('resizer').setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 */ } });
$('resizer').addEventListener('pointermove', e => {
  if (!sizing) return;
  const h = Math.max(70, Math.min(window.innerHeight * .75, sizing.h - (e.clientY - sizing.y)));
  $('bottom').style.maxHeight = `${h}px`; $('bottom').style.height = `${h}px`; S.dirty = true;
});
$('resizer').addEventListener('pointerup', () => { sizing = null; });
$('resizer').addEventListener('dblclick', () => { $('bottom').style.maxHeight = ''; $('bottom').style.height = ''; S.dirty = true; });
new ResizeObserver(() => { S.dirty = true; }).observe(document.body);

/* ── 시작 ─────────────────────────────────────────── */
$('verLabel').textContent = `v${APP_VERSION}`;
$('helpTitle').textContent = `도움말 (공업수학 시각화 v${APP_VERSION})`;
S.page = 'viz';
if (window.innerHeight < 820) size = .95;   // 노트북·프로젝터처럼 낮은 화면은 글자를 조금 줄입니다.
document.documentElement.style.fontSize = `${16 * size}px`;
const restored = restore();
if (!restored) syncDraft();
renderSettings(); renderSaved(); renderSheet(); recompute();
S.ready = true; S.draft.dirty = false; setPage('viz');
if (restored) setStatus('지난번 작업을 불러왔습니다.', { label: '처음 상태로', fn: resetAll });
if (!tourDone() && !location.search.includes('selftest')) showTour(0);
requestAnimationFrame(frame);
// 자체 검사는 app.py --self-test가 studio.html?selftest로 열 때만 불러옵니다.
if (location.search.includes('selftest')) { const sc = document.createElement('script'); sc.src = 'selftest.js'; document.body.appendChild(sc); }
