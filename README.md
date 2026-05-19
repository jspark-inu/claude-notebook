# claude-notebook

> 단일 사용자용 web 워크스페이스 — claude code 를 web 에서 풀세트로 쓰기 위한 도구. 다중 SSH 호스트, 파일 viewer, 드래그앤드롭 첨부, 영구 터미널.

[Original by Hoki Kim](https://github.com/Harry24k/claude-notebook) · 이 fork (v0.1.0) 의 큰 변경: multi-host SSH 원격 워크스페이스 (Spec 3), 호스트별 chrome 탭 분리, 탭 DnD, lost-update 보호.

## 한 줄 요약

브라우저에서 claude code 를 띄우는 web shell. 로컬/원격 SSH 호스트를 chrome 탭별로 분리하고, 그 안에서 파일 트리 / 미리보기 / 터미널 (chat 모드 + 파일 첨부) 을 다 한 페이지에 모음.

## 주요 기능

### 파일 viewer
- markdown / code / csv / xlsx / image / **PDF** / **HTML** 인라인 미리보기
- 글자 크기 / 이미지 확대 (Ctrl+휠 / Ctrl + / − / 0)
- 자동 저장 + 스냅샷 히스토리 + **lost-update 보호** (mtime+size precondition, 409 Conflict)

### 터미널 (chat 토글 + 파일 첨부)
- xterm 기반 + WebSocket
- 입력바에 **drag-drop** / **Ctrl+V 이미지 paste** → 임시 저장 → claude 가 path 인식
- chat 모드 (iMessage 식)
- 가상 키보드 (모바일)

### 다중 SSH 호스트 (가장 큰 변경)
- `~/.ssh/config` 의 Host alias 자동 import
- ssh chip 으로 host 선택 → **새 chrome 탭** 으로 그 host 환경 boot
- 각 chrome 탭 = 한 host (sessionStorage 격리)
- 원격 호스트의 파일 트리 / read / write / upload / drag-drop 다 동작 (subprocess + ssh ControlMaster + flock)

### 영속성
- 탭/leaf 구성 + 활성 파일 → F5 후 자동 복원
- `uploads/` 7일 TTL 자동 정리
- 사라진 터미널 → 자동 새 PTY fallback

### 멀티 split + DnD
- 수직 분할 (drag splitter)
- 탭 reorder + 다른 leaf 로 이동 (DnD)

## 설치

```bash
git clone https://github.com/wj926/claude-notebook
cd claude-notebook
pip install -e .
```

> **`-e` (editable) 권장**: 정적 자원 (`static/`, `images/`) 이 repo 디렉토리에서 직접 read 됩니다. 일반 `pip install .` 도 동작하지만 데이터 파일 위치 차이로 일부 자원 못 찾을 수 있음.

## 실행

```bash
claude-notebook --workspace ~/myproject
```

브라우저에서 `http://127.0.0.1:8888/claude-notebook` 접속.

처음이면 Jupyter 가 토큰 출력 — 그 URL 열기. 아니면 `~/.jupyter/jupyter_notebook_config.json` 의 password 사용.

### CLI 옵션
```
claude-notebook --workspace ~/proj   # 워크스페이스 (default: 현재 dir)
                --port 8888           # default 8888
                --ip 127.0.0.1        # default localhost
```

## SSH 호스트 추가

`~/.ssh/config` 에 표준 SSH 형식으로 추가:
```
Host myserver
    HostName 1.2.3.4
    User myname
    IdentityFile ~/.ssh/myserver_key
```

→ ssh chip 드롭다운에 `myserver` 자동 표시 → 클릭하면 새 chrome 탭으로 그 호스트 환경 진입.

ProxyJump 를 쓰는 경우 → 우리 머신 자체가 jump 역할이면 ProxyJump 라인 빼고 직접 연결.

## ⚠ 보안 (반드시 읽기)

- **default `--ip 127.0.0.1`** (localhost only). 사용자 본인 외엔 접근 불가.
- **`--ip 0.0.0.0`** 은 같은 네트워크 누구나 SSH 권한 가진 워크스페이스에 접근 가능 → **Tailscale / VPN** 같은 신뢰 네트워크에서만 + 강한 jupyter token/password 필수.
- **jupyter token / password 끄지 말 것**. 기본 보호 layer.
- **원격 SSH 기능** = 사용자 본인의 SSH 키 + agent 사용. 권한 범위 최소화 권장.
- **uploads/** 폴더 (드래그/paste 첨부) → 워크스페이스 또는 원격 home 에 저장. 비밀 정보 첨부 금지.
- **public 환경 배포 금지** — 단일 사용자 dev 도구.

## 트러블슈팅

- **`/raw/...` 가 404**: 원격 host 클릭 후 캐시된 옛 JS 일 수 있음. **Ctrl + Shift + R** (hard reload).
- **터미널 빈 화면**: 서버 재기동 후 백엔드 PTY 사라짐. 자동 새 터미널 fallback 으로 복구.
- **SSH host 드롭다운에 안 뜸**: `~/.ssh/config` 의 Host alias 가 정확한지 확인. install dir 의 `config/hosts.json` 도 확인.
- **`claude` 명령이 원격에 없음**: 원격 host 에서 `npm i -g @anthropic-ai/claude-code` 같은 별도 설치 필요.

## Changelog

### 2026-05-19 — host-aware 터미널 UX

| 커밋 | 내용 |
|---|---|
| [`7f9f3c5`](../../commit/7f9f3c5) | feat(layout): 터미널 탭 라벨에 host 항상 표시 (local 포함) |
| [`57ef800`](../../commit/57ef800) | feat(tree): focus/visibility 자동 새로고침 + 펼침/스크롤/active 보존 |
| [`3627700`](../../commit/3627700) | fix(safari/ipad): 정적 캐시 헤더 강화 + 외장 키보드 + 한글 IME + D2Coding 폰트 |
| [`085507a`](../../commit/085507a) | feat(terminal): legacy host 토글 + 업로드 host 라우팅 |
| [`432828d`](../../commit/432828d) | feat(terminal): host별 터미널 목록 토글/필터링 |

핵심 변화:
- **사이드바/picker 모두 host 별 그룹 토글**. 현재 SSH host (= 현 chrome 탭의 `?host=`) 의 터미널만 기본 표시, 다른 host 는 `▶ 다른 host (N)` 로 접어둠. 메인 사이드바와 legacy `/terminal` 페이지 양쪽에 동일 패턴.
- **업로드 host-aware 라우팅 fix**. legacy 페이지의 `uploadPendingFiles` 가 항상 local 로 가던 버그 — `?host=` 쿼리 추가. 서버는 이미 host-aware (`ssh_fs.upload_file`) 였음, 클라가 host 안 보낸 게 원인.
- **트리 자동 새로고침**. 외부에서 파일 변경 시 사이드바가 stale 해지던 문제. window focus / visibilitychange 시 자동 refresh + 펼친 디렉토리/스크롤/active file 보존.
- **iOS Safari 정적 캐시 회귀 fix**. 응답에 `Cache-Control: no-store` + ETag 비활성. BFCache/module cache 가 304 로 옛 JS 계속 주던 문제.
- **iPad 외장 키보드 Shortcut Bar 가림 fix**. 입력바 padding-bottom 56px, Send/첨부 버튼 상단 정렬.
- **한글 IME 조합 중 Enter 전송 차단** (`!e.isComposing`) + xterm 폰트에 `'D2Coding'` 추가.
- **터미널 탭 라벨에 host 항상 표시** (`Terminal 6 · rtx4090_hs`, `Terminal 1 · local` 등). 어떤 서버 터미널인지 한눈에.

### 2026-05 중후반 — 안정화 + DnD

| 커밋 | 내용 |
|---|---|
| [`061baf0`](../../commit/061baf0) | fix(terminal): tmux 래핑 비활성화 + wheel 스크롤 캡처 + paste/drop 복구 |
| [`e0d5ae1`](../../commit/e0d5ae1) | feat(terminal): tmux 래핑 — 새로고침/재시작에도 스크롤백 + claude 세션 유지 (이후 회귀로 비활성) |
| [`6a0bf2e`](../../commit/6a0bf2e) | feat: 탭/leaf 영속화 강화 + MD 뷰/편집 모드 분리 + 모바일 스크롤바 확대 |
| [`61ad7cd`](../../commit/61ad7cd) | feat(finder+terminal): 다중파일 드래그 / 폴더 핀 / 상위이동 / 모바일 long-press / 터미널 자동 재접속 |
| [`10e2846`](../../commit/10e2846) | feat(terminal): + 버튼에 picker 추가 (새 터미널 / 기존 선택) |

### v0.1.0a1 — 보안/안정성 라운드

| 커밋 | 내용 |
|---|---|
| [`67e33e4`](../../commit/67e33e4) | release: claude-notebook v0.1.0a1 패키지화 (CLI + 문서 + extension shim) |
| [`e98eb7c`](../../commit/e98eb7c) | feat: 파일 미리보기 zoom — md/text 글자 크기 + 이미지 확대 |
| [`75edbe8`](../../commit/75edbe8) | fix(audit): symlink escape 차단 (realpath HOME-prefix) + 텍스트 한도 통합 (2MB → 10MB) |
| [`d1ff924`](../../commit/d1ff924) | feat(audit): lost-update 보호 — version (mtime_ns:size) precondition + 409 + force flag |
| [`5e81fc0`](../../commit/5e81fc0) | fix(audit): host param validation — `hosts.json` 등록된 alias 만 허용, injection 차단 |

### Spec 3 — 다중 SSH 호스트 (이 fork 의 가장 큰 변경)

| 커밋 | 내용 |
|---|---|
| [`dc3db99`](../../commit/dc3db99) | feat(spec3-a): SSH 원격 파일 트리 PoC — ssh chip 으로 host 전환 시 좌측 트리 reload |
| [`405c6e1`](../../commit/405c6e1) | feat(spec3-b): 원격 파일 read — 트리에서 파일 클릭 시 iframe 미리보기 |
| [`4f2011c`](../../commit/4f2011c) | feat(spec3-b 보완): 원격 binary read — PDF / 이미지 / HTML 미리보기 |
| [`6fdd424`](../../commit/6fdd424) | feat(spec3-c): 원격 파일 save / upload / drag-drop / Ctrl+V — 풀 원격 워크플로 |
| [`0f744ac`](../../commit/0f744ac) | feat(spec3): 호스트 별 chrome 탭 분리 — ssh chip 클릭 시 새 탭으로 |
| [`d2e24eb`](../../commit/d2e24eb) | fix(spec3): 새 탭 안 열림 + local 진입이 다른 host 로 가는 회귀 |
| [`e680898`](../../commit/e680898) | feat: 터미널 탭 라벨에 호스트 표시 — `Terminal N · <host>` |

### Spec 2 — 탭 DnD + 영속화

| 커밋 | 내용 |
|---|---|
| [`14dfbf7`](../../commit/14dfbf7) | feat(spec2): 탭 DnD — 같은 leaf reorder + 다른 leaf 로 이동 |
| [`aa6161a`](../../commit/aa6161a) | fix: 사라진 터미널 이름 자동 fallback — F5 시 빈 화면 회귀 차단 |
| [`a52a2b1`](../../commit/a52a2b1) | feat: `uploads/` 7일 TTL 자동 정리 + symlink 보존 |

### 터미널 입력바 첨부

| 커밋 | 내용 |
|---|---|
| [`4e3e774`](../../commit/4e3e774) | feat: 터미널 입력바 Ctrl+V 이미지 paste 첨부 (ChatGPT 식, `paste-{ts}.png`) |
| [`64d3805`](../../commit/64d3805) | feat: 터미널 입력바 drag-drop 파일 첨부 |
| [`536de22`](../../commit/536de22) | feat: 터미널 iframe 사이드바 ↔ 외부 탭 라벨 자동 동기화 |

전체 history 는 [`git log`](../../commits/main) 또는 GitHub Insights 탭 참조.

## 알파 단계

`v0.1.0` — public alpha. API/UI 변경 가능. 실험적.

## 라이선스

MIT — 원본 [Harry24k/claude-notebook](https://github.com/Harry24k/claude-notebook) 의 fork. 기존 Hoki Kim 의 copyright + 이 fork 의 contribution copyright 둘 다 [LICENSE](LICENSE) 에 명시.

## 기여

Issue / PR 환영. 다만 단일 사용자 dev 도구라는 핵심 가정 유지.
