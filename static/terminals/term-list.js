import { BASE, mutFetchOpts, fetchOpts } from '../core/api.js';
import * as tabStore from '../main/tab-store.js';
import * as layout from '../main/layout.js';
import { openTerminalInLeaf } from './open-terminal.js';

const JUPYTER = window.__JUPYTER_BASE !== undefined ? window.__JUPYTER_BASE : BASE;
const POLL_MS = 5000;

export function init({ listEl, addBtn }) {

  async function refresh() {
    let termList = [];
    let termHosts = {};
    let pending = {};
    try {
      [termList, termHosts, pending] = await Promise.all([
        fetch(`${JUPYTER}/api/terminals`, fetchOpts).then(r => r.ok ? r.json() : []),
        fetch(`${BASE}/api/term-hosts`, fetchOpts).then(r => r.ok ? r.json() : ({})),
        fetch(`${BASE}/api/pending-commands`, fetchOpts).then(r => r.ok ? r.json() : ({})),
      ]);
    } catch (err) {
      console.error('term-list refresh failed', err);
      return;
    }

    listEl.innerHTML = '';
    for (const t of termList) {
      const host = termHosts[t.name] || 'local';
      const isPending = !!pending[t.name];
      const li = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'term-link';
      link.dataset.name = t.name;
      link.innerHTML = `
        <span class="dot"></span>
        <span class="term-name"></span>
        <span class="term-host"></span>
      `;
      link.querySelector('.term-name').textContent = t.name;
      link.querySelector('.term-host').textContent = host;

      if (isPending) {
        const pin = document.createElement('span');
        pin.className = 'pending';
        pin.title = 'startup command 보류 — 클릭해서 실행';
        pin.textContent = '⏸';
        pin.addEventListener('click', async (e) => {
          e.stopPropagation();
          await fetch(`${BASE}/api/pending-commands/${encodeURIComponent(t.name)}`,
            mutFetchOpts({ method: 'POST' }));
          await refresh();
        });
        link.appendChild(pin);
      }

      link.addEventListener('click', () => {
        // 활성 leaf 에 이미 있으면 활성화, 없으면 거기로 attach (다른 leaf 에
        // 있어도 미러링 허용 — picker 의 onPick 과 같은 정책).
        const leafId = layout.getActiveLeafId();
        const existingInLeaf = tabStore.tabsForLeaf(leafId)
          .find(tt => tt.kind === 'term' && tt.contentRef === t.name);
        if (existingInLeaf) {
          layout.activateTab(existingInLeaf.id);
          return;
        }
        const tabId = tabStore.openTab({
          kind: 'term', contentRef: t.name, leafId,
          allowDuplicate: true, host,
        });
        layout.activateTab(tabId);
      });

      li.appendChild(link);
      listEl.appendChild(li);
    }
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const leafId = layout.getActiveLeafId();
      openTerminalInLeaf(leafId, addBtn);
    });
  }

  refresh();
  return setInterval(refresh, POLL_MS);
}
