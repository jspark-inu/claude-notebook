# Claude Notebook v2 작업 상태 (Spec 1)

마지막 세션: 2026-05-10 새벽 (사용자 자고 있음, Claude + Codex 자율 진행)
브랜치: `spec1-real-impl`
운영본 8888: `/home/dami/claude-notebook` — 그대로, 절대 건드리지 않음
v2 8889: `/home/dami/claude-notebook-v2` — 이 폴더

## Spec / Plan

- Spec 1: `/home/dami/wj/docs/superpowers/specs/2026-05-09-claude-notebook-real-impl-design.md` (rev3)
- Plan: `/home/dami/wj/docs/superpowers/plans/2026-05-09-claude-notebook-real-impl.md` (rev3)
- Parity evidence: `/home/dami/wj/docs/superpowers/specs/2026-05-09-claude-notebook-feature-parity-evidence.md`

## 이번 세션 (2026-05-10) 새벽 작업 요약

사용자가 어제 commit 한 Task 1~11 가 빌드만 통과했지 실제 동작 검증이 안 된 상태였음을 발견. 사용자께서 (A) "P0 부터 순서대로 전부 fix" 선택 → Claude + Codex 교차 검증으로 핵심 결함 9개 fix.

### 발견 + 수정 commit 2개

**`33521df`** — P0/P1 결함 다수 fix
- [P0] 터미널 무한 생성 (`focus=terminal` 매 F5 마다 POST). `history.replaceState` 로 URL 정리
- [P0] legacy iframe file viewer 빈 화면 (옛 자원 누락 + path-replace 가 신규 app.js 끼워넣음). 운영본 8888 의 정적 자원 풀세트 복사 + handler 경로 수정
- [P0] `layout.js` mount-tab CustomEvent bubbling 끊김 (sec detached 상태에서 dispatch). `mountEl.appendChild(sec)` 를 dispatch 위로 이동
- [P0] finder 자기재귀 (`onNavigate: loadFinderGrid` wiring)
- [P1] tab/layout state localStorage persist (`cn-v2-tabs`, `cn-v2-layout`) — F5 시 탭 사라지던 회귀
- [P1] splitter 드래그 종료 시 persist 누락
- [P1] legacy iframe 안 옛 사이드바/☰ hide CSS 주입 (이중 사이드바 회귀)
- [B 방향] OUTER 트리/finder 클릭 → kind:'file' FileViewerInstance (PDF/text 미구현) 가 아니라 활성 'files' 탭의 legacy iframe `__cnOpenFile(path)` 직접 호출. PDF/CSV/XLSX/finder/history/auto-save 풀세트 즉시 회복

**`8e4d6b0`** — P2 가드 추가
- legacy `window.__cnIsDirty` 노출
- outer `beforeunload` 가드 (any 'files' iframe 의 dirty → confirm prompt)
- tab close 시 dirty confirm
- `openFileTab` 실패 시 alert (silent failure 방지)

### Puppeteer 헤드리스 검증 통과

| 시나리오 | 결과 |
|---------|------|
| F5 ×2 → POST `/api/terminals` 0건 | ✅ |
| Split + Files 추가 → F5 → 탭/leaf 그대로 + sizes 복원 | ✅ |
| OUTER 트리 → CLAUDE.md md 렌더링 | ✅ |
| OUTER 트리 → PDF 25 페이지 viewer | ✅ |
| 외곽 사이드바 1개 (이중 제거) | ✅ |
| 사이드바 토글 (280→0px) | ✅ |
| 탭 close, filesCount 증가 (Files 1/2/3) | ✅ |
| 모바일 < 720px → Split no-op | ✅ |
| `__cnIsDirty` 노출, 깨끗할 때 false | ✅ |
| beforeunload 깨끗할 때 prompt 안 뜸 | ✅ |
| 콘솔 에러 0건 | ✅ |

## 알려진 잔여 (Spec 1 → Spec 2 deferred 후보)

| # | 항목 | 영향 | 처리 |
|---|------|------|------|
| 1 | TerminalInstance.attachInputBar/attachUpload/attachVKB/setChatMode wiring 0건 + outer index.html 에 input bar/chat/upload UI 슬롯 없음 | S1-Terminal 의 chat/multiline-paste/drag-upload/vkb 미달. 기본 xterm + WS 터미널은 동작 (헤드리스에서 ORB 차단으로 검증 못 했지만 코드는 정상) | Spec 1.5 또는 Spec 2 — UI 디자인 결정 필요 (사용자 confirm) |
| 2 | FileViewerInstance 자체 미완 (kind:'file' 경로) | B 방향 채택으로 dead code 화. 영향 없음 | Spec 2 multi-tab DnD 들어갈 때 다시 살리면 됨 |
| 3 | Real browser 에서 dirty 상태 만들고 beforeunload prompt 동작하는지 사용자 확인 | parity S7 최종 게이트 | 사용자 깨면 1회 시연 |

## 사용자 확인 필요 (아침)

8889 (`http://100.88.12.3:8889/claude-notebook`) 하드 리프레시 후:

1. 외곽 사이드바 트리 → 아무 .md 클릭 → 본문에 잘 렌더되는지
2. 외곽 사이드바 트리 → .pdf 클릭 → PDF viewer 보이는지
3. + 버튼 → 새 터미널 생성 + 입력/출력 정상인지 (이게 chat/upload 없이도 OK 인지)
4. Split → 양쪽 leaf 독립인지
5. 탭 좀 만들고 F5 → 그대로인지
6. 텍스트 파일 편집 후 저장 안 된 상태에서 F5 → "저장되지 않은 변경..." confirm 뜨는지

## 운영 교체 (Task 12) 진입 가능?

**조건부 가능**. 위 1~6 다 PASS 면 운영 교체 가능. 다만 잔여 #1 (Terminal chat/upload/vkb) 는 spec parity 조항 §5.7.4 의 일부이므로:
- (a) Spec 1.5 만들어서 그 부분만 따로 처리
- (b) Spec 1 의 §5.7.4 S1-Terminal 항목을 spec exception 으로 문서화 (chat/upload/vkb 는 Spec 2 로 deferred)

둘 중 사용자 결정 필요.

## 8889 부팅 명령

```bash
cd /home/dami/claude-notebook-v2 && source .venv/bin/activate
PYTHONPATH=. nohup jupyter notebook --no-browser --ip=0.0.0.0 --port=8889 --notebook-dir=/home/dami/wj > /tmp/cn-v2.log 2>&1 &
disown
```

## 8890 인증-off probe (puppeteer 검증용)

```bash
cd /home/dami/claude-notebook-v2 && source .venv/bin/activate
PYTHONPATH=. nohup jupyter notebook --no-browser --ip=127.0.0.1 --port=8890 --notebook-dir=/home/dami/wj --NotebookApp.token='' --NotebookApp.password='' --NotebookApp.disable_check_xsrf=True > /tmp/cn-v2-probe.log 2>&1 &
disown
```

## 운영 8888 무사 확인

```bash
ss -tlnp 2>/dev/null | grep -E ":8888|:8889"
curl -s -o /dev/null -w "v1:%{http_code} v2:%{http_code}\n" http://localhost:8888/claude-notebook http://localhost:8889/claude-notebook
```

## 후속 spec 메모

- **Spec 1.5 (or §5.7.4 예외)**: TerminalInstance 메서드 wiring + outer 페이지에 input bar/chat/upload UI 슬롯 추가
- **Spec 2**: 탭 드래그앤드롭 + 진짜 multi-tab file viewer (FileViewerInstance 살리기)
- **Spec 3**: 원격 파일 트리 (SSH 호스트 따라 Files 가 바뀜)

## 주요 commit 흐름 (요약)

```
8e4d6b0  feat: spec1 P2 가드 (beforeunload/tab-close confirm/openFileTab fallback)
33521df  fix: spec1 P0/P1 결함 다수 (file viewer/PDF/persist/이중 사이드바/터미널 무한 생성)
0f8037e  docs: RESUME.md — 다음 세션 인수인계 (이전 세션)
9b1a96a  fix: app.js init safe() try-catch 격리
... (이전 task1~11)
```
