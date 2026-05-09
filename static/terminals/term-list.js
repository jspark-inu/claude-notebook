import { BASE, mutFetchOpts, fetchOpts } from '../core/api.js';
import * as tabStore from '../main/tab-store.js';
import * as layout from '../main/layout.js';

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
        const leafId = layout.getActiveLeafId();
        const tabId = tabStore.openTab({ kind: 'term', contentRef: t.name, leafId });
        layout.activateTab(tabId);
      });

      li.appendChild(link);
      listEl.appendChild(li);
    }
  }

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      try {
        const r = await fetch(`${BASE}/api/terminals/new`, mutFetchOpts({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host_id: window.__currentHostId || 'local' }),
        }));
        if (!r.ok) {
          alert('새 터미널 생성 실패: ' + r.status);
          return;
        }
        const { name } = await r.json();
        await refresh();
        const leafId = layout.getActiveLeafId();
        const tabId = tabStore.openTab({ kind: 'term', contentRef: name, leafId });
        layout.activateTab(tabId);
      } catch (err) {
        console.error('new terminal failed', err);
      }
    });
  }

  refresh();
  return setInterval(refresh, POLL_MS);
}
