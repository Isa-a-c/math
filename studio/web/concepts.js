'use strict';
/* 등록부: 개념 모듈과 주제를 모읍니다.
   개념 모듈(modules/*.js) = 개념 하나의 계산(compute), 그래프(panels), 요약(summary), 소문항(items: 자동 문장·풀이), 설명(markup).
   주제(defineTopic) = 문제 하나(방정식 × 영역): 쓰는 개념 모듈(uses), 계산에 넘길 값(params), 입력 칸(fields), 양 끝·감쇠 선택, 풀이 단계(stages), 교재의 절(name).
   새 주제는 modules/에 파일 하나를 더하고 studio.html에 불러오면 됩니다. 본체(core, content, draw, ui, problem)는 목록을 돌기만 합니다.
   설명은 고칠 수 있는 글입니다. 문단은 빈 줄로 나누고, $…$는 수식, $$…$$ 문단은 가운데 수식, '> '는 강조 상자입니다. 화면의 '개념' 탭에서 고친 내용이 먼저 쓰입니다. */
const MODULES = [], CONCEPTS = [], CONCEPT_MARKUP = {}, PANELS = {}, TOPICS = [];
/** 개념 모듈을 등록합니다. 등록 순서가 계산·요약·설명·소문항의 순서입니다. */
function defineConcept(mod) {
  MODULES.push(mod);
  CONCEPTS.push({ id: mod.id, ch: mod.ch, title: mod.title });
  CONCEPT_MARKUP[mod.id] = mod.markup;
  Object.assign(PANELS, mod.panels ?? {});
}
/** 주제(풀 수 있는 문제)를 등록합니다. */
function defineTopic(topic) { TOPICS.push(topic); }
/** 양 끝 조건이 같고 열 방출이 아니면 반구간 사인·코사인 전개(교재의 급수)로 봅니다. */
const plainEnds = p => p.left === p.right && p.left !== 'robin';
