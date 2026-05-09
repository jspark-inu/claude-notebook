# Claude Notebook v2 작업 상태 (Spec 1)

마지막 세션: 2026-05-09 (대화 종료 시점)
브랜치: `spec1-real-impl`
운영본 8888: `/home/dami/claude-notebook` — 그대로, 절대 건드리지 않음
v2 8889: `/home/dami/claude-notebook-v2` — 이 폴더, 작업 진행 중

## Spec / Plan

- Spec 1 (이거): `/home/dami/wj/docs/superpowers/specs/2026-05-09-claude-notebook-real-impl-design.md` (rev3)
- Plan: `/home/dami/wj/docs/superpowers/plans/2026-05-09-claude-notebook-real-impl.md` (rev3)
- 목업: `https://ipi.damilab.cc/notebook-mockup/v2/?variant=a`

## 진행 상황

Plan 의 Task 1 ~ 11 commit 완료. Task 12 (parity 시나리오 + 운영 교체) 진입 전.

마지막 commit: `9b1a96a` ("safe() try-catch 로 init 격리").

총 25+ commit. 아래 상태에 도달:
- 백엔드 hosts.py / terminals.py / jsonio.py 추가
- Jupyter 라우트 통합 (`/claude-notebook` 단일 페이지)
- 프런트엔드 Multi-instance refactor (TerminalInstance, FileViewerInstance)
- 통합 페이지 (사이드바 + 메인 leaf + 탭)
- SSH 칩 + 드롭다운 + Add Host 모달 + ssh config 자동 임포트
- Split 패널 + splitter 드래그
- Files iframe 탭 (legacy 페이지 풀세트 보존)
- 사이드바 collapse + 폭 드래그

## 알려진 잔여 문제 (마지막 세션 끝 시점)

**아직 검증 안 됨** — 사용자가 하드 리프레시 후 클릭 동작 확인을 못 함:

1. F12 console 에 init 에러 있는지 — 정확한 메시지 받아야 fix 가능
2. ☰ 사이드바 토글이 실제 동작하는지
3. Split 후 splitter 드래그 동작하는지
4. + 버튼 클릭 시 새 터미널 생성되는지
5. 탭 X 닫기 + leaf X 닫기

`safe()` 래퍼 추가했으니 한 모듈 실패해도 다른 모듈은 동작할 것. 콘솔에 `[init] X failed:` 형태로 어디 깨졌는지 표시됨.

## 후속 spec 메모

- **Spec 2**: 탭 드래그앤드롭 (다른 split 으로 옮기기, drop zone 으로 새 split). Spec 1 운영 교체 + 7일 안정 후
- **Spec 3**: 원격 파일 트리 (SSH 호스트 따라 Files 가 바뀜) — 사용자가 이번 세션에 명시 요청

## 다음 세션 시작 시 할 일

1. 사용자가 8889 새로고침해서 통합 페이지 동작 확인
2. F12 console 에러 캡처 → fix
3. parity 시나리오 (spec §5.7.4 의 S1~S8) 시연
4. 모든 시나리오 PASS → 사용자 명시 OK 후 Task 12 운영 교체

## 8889 부팅 명령

```bash
cd /home/dami/claude-notebook-v2 && source .venv/bin/activate
PYTHONPATH=. nohup jupyter notebook --no-browser --ip=0.0.0.0 --port=8889 --notebook-dir=/home/dami/wj > /tmp/cn-v2.log 2>&1 &
disown
```

## 운영 8888 무사 확인

```bash
ss -tlnp 2>/dev/null | grep -E ":8888|:8889"
curl -s -o /dev/null -w "v1:%{http_code} v2:%{http_code}\n" http://localhost:8888/claude-notebook http://localhost:8889/claude-notebook
```

## 주요 commit 흐름 (요약)

```
9b1a96a  fix: app.js init safe() try-catch 격리
be1c2f9  fix: ☰ 토픽바 좌측 + sidebar-head 강제 숨김
ab2c608  fix: Files 버튼 매 클릭 새 탭 (counter)
b612139  fix: tabStore.openTab 가 leafId 변경 X — split 보존
ae0aef1  feat: Files 탭 (legacy iframe) — Notion / 폴더 그리드 보존
3df54de  fix: leaf 활성화 시 render() 안 부름 — click 핸들러 살림 (가장 큰 버그)
2b40512  fix: 탭별 영구 컨테이너로 xterm/file viewer 보존
01f7673  feat: 사이드바 collapse + ssh-config 임포트 + Add modal port
9d94bf8  fix: <base href> head 시작에 박기
013d7a7  fix: dark mode CSS 변수 fallback 제거
71c4985  task11: finder/history/file-ops/keyboard-help 통합
780295b  task10: split + splitter 리사이즈
e2f7704  task9: SSH 칩 + Add Host 모달
d465087  task8: 사이드바 Terminals polling
ba4d9b7  task7: 통합 페이지 + layout 8 메서드
4e6c908  task6: FileViewerInstance + csv/xlsx hostEl
611d9a6  task5c: TerminalInstance chat/config
594e219  task5b: TerminalInstance input/upload/vkb
ffe3faf  task5a: TerminalInstance transport
77b9dd6  task4: 라우트 통합 + legacy/
eff7080  task3: SSH 터미널 + slot 마이그
751f69f  task2: hosts API
bba4bce  task1.5: atomic JSON
ccb2a72  task1: 워크스페이스 셋업
```
