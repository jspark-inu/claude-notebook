# Claude Notebook

[English](README.md)

Jupyter Notebook에 **Notion 스타일 파일 브라우저**와 **터미널 관리 UI**를 얹은 확장입니다. 별도 서버 없이 내 컴퓨터에서 바로 돌릴 수 있는 가벼운 Claude Code Remote 대안입니다.

> **블로그 글**: [English](https://trustworthyai.co.kr/article/2026/claude-notebook-eng/) | [한국어](https://trustworthyai.co.kr/article/2026/claude-notebook/)

## 빠른 시작

```bash
Git 설치
Claude Code 설치
Claude Code에게 "https://github.com/Harry24k/claude-notebook/" clone하고 jupyter notebook 실행해서 claude-notebook 켜줘.
```
```

실행 후 브라우저에서 `http://localhost:8888/claude-notebook`에 접속하면 됩니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| **파일 브라우저** | Notion처럼 워크스페이스를 탐색할 수 있습니다. 구문 강조, 마크다운 렌더링, 이미지 미리보기, 인라인 편집을 지원합니다. |
| **CSV 뷰어** | 정렬, 필터, 컬럼 크기 조절, 행 색상, 셀 복사까지 되는 인터랙티브 테이블입니다. |
| **터미널 관리** | 터미널을 여러 개 만들어서 이름도 바꾸고, 설정도 따로 하고, 자유롭게 전환할 수 있습니다. |
| **채팅 모드** | 터미널 출력을 iMessage 스타일 말풍선으로 보여줍니다. ANSI 컬러도 그대로 표시됩니다. |
| **파일 업로드** | 파일이나 폴더를 드래그 앤 드롭으로 올릴 수 있고, 이름이 겹치면 자동으로 처리해 줍니다. |
| **서버 설정 저장** | 터미널 이름, 시작 명령어, 채팅 모드, CSV 설정 등이 서버에 저장되어 다시 접속해도 유지됩니다. |
| **모바일 지원** | 터치에 최적화된 반응형 UI로, 모바일에서도 사이드바 토글과 터미널 복사가 가능합니다. |
| **Claude Code 지원** | 각 터미널에서 Claude Code를 동시에 여러 개 실행할 수 있습니다. |
| **설정 불필요** | Jupyter의 `notebook_dir`을 자동으로 워크스페이스 경로로 사용합니다. |

## 스크린샷

#### 파일 브라우저 (데스크톱 / 모바일)

<p>
  <img src="images/viewer_desktop.png" width="600">
  <img src="images/viewer_mobile.png" width="200">
</p>

#### 터미널 관리 (데스크톱 / 모바일)

<p>
  <img src="images/terminal_desktop.png" width="600">
  <img src="images/terminal_mobile.png" width="200">
</p>

## 요구사항

- Python 3
- Jupyter Notebook 6.x
- Tornado

모든 패키지는 `requirements.txt`로 한 번에 설치할 수 있습니다.

## 라이선스

[LICENSE](LICENSE)를 참고해 주세요.
