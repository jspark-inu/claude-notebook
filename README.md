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

## 알파 단계

`v0.1.0` — public alpha. API/UI 변경 가능. 실험적.

## 라이선스

MIT — 원본 [Harry24k/claude-notebook](https://github.com/Harry24k/claude-notebook) 의 fork. 기존 Hoki Kim 의 copyright + 이 fork 의 contribution copyright 둘 다 [LICENSE](LICENSE) 에 명시.

## 기여

Issue / PR 환영. 다만 단일 사용자 dev 도구라는 핵심 가정 유지.
