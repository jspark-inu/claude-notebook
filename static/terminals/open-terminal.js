// 세 진입점(사이드바 +, 탭바 +, future) 공통 adapter.
// picker 를 띄우고 결과(새로 만들기 or 기존 선택) 에 따라 leaf 에 attach.

import { BASE, mutFetchOpts } from '../core/api.js';
import * as tabStore from '../main/tab-store.js';
import * as layout from '../main/layout.js';
import { showPicker } from './term-picker.js?v=toggle1';

const JUPYTER = window.__JUPYTER_BASE !== undefined ? window.__JUPYTER_BASE : BASE;

async function createNewTerminal({ hostId }) {
  const r = await fetch(`${BASE}/api/terminals/new`, mutFetchOpts({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host_id: hostId || 'local' }),
  }));
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
  }
  return await r.json();
}

async function killTerminal(name) {
  const r = await fetch(`${JUPYTER}/api/terminals/${encodeURIComponent(name)}`, mutFetchOpts({
    method: 'DELETE',
  }));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  // 모든 leaf 에서 이 터미널 탭 즉시 제거 — server 죽었는데 stale 탭 남는 거 방지
  for (const t of tabStore.getAllTabs()) {
    if (t.kind === 'term' && t.contentRef === name) tabStore.closeTab(t.id);
  }
}

export function openTerminalInLeaf(leafId, anchorEl) {
  const hostId = window.__currentHostId || 'local';

  showPicker(anchorEl, {
    hostId,
    currentLeafId: leafId,
    onCreate: createNewTerminal,
    onKill: killTerminal,
    onPick: ({ name, host }) => {
      // 같은 leaf 에 이미 이 터미널이 떠있으면 그것만 활성화
      const existingInLeaf = tabStore.tabsForLeaf(leafId)
        .find(t => t.kind === 'term' && t.contentRef === name);
      if (existingInLeaf) {
        layout.activateTab(existingInLeaf.id);
        return;
      }
      // 다른 leaf 에는 떠있을 수 있음 (미러링) — allowDuplicate
      const tabId = tabStore.openTab({
        kind: 'term',
        contentRef: name,
        leafId,
        allowDuplicate: true,
        host: host || hostId,
      });
      layout.activateTab(tabId);
    },
  });
}
