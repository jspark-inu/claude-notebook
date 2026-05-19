import { BASE, mutFetchOpts, fetchOpts } from '../core/api.js';
import * as tabStore from '../main/tab-store.js';
import * as layout from '../main/layout.js';
import { openTerminalInLeaf } from './open-terminal.js';

const JUPYTER = window.__JUPYTER_BASE !== undefined ? window.__JUPYTER_BASE : BASE;
const POLL_MS = 5000;

// 호스트 그룹 펼침 상태 — 5초 polling refresh 시에도 사용자 토글 보존.
// 처음 보는 host 는 isCurrent 면 펼침, 아니면 접힘.
const openState = new Map();

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

    // 호스트별로 그룹화 — 사이드바에서 "어떤 서버 터미널인지" 한눈에.
    // local 을 항상 위, 나머지는 알파벳 순. 호스트가 1종류면 header 생략.
    const byHost = new Map();
    for (const t of termList) {
      const host = termHosts[t.name] || 'local';
      if (!byHost.has(host)) byHost.set(host, []);
      byHost.get(host).push({ t, isPending: !!pending[t.name], host });
    }
    const hosts = [...byHost.keys()].sort((a, b) => {
      if (a === 'local') return -1;
      if (b === 'local') return 1;
      return a.localeCompare(b);
    });
    const currentHost = window.__currentHostId || 'local';
    for (const host of hosts) {
      const items = byHost.get(host);
      const isCurrent = host === currentHost;
      if (!openState.has(host)) openState.set(host, isCurrent);

      const groupLi = document.createElement('li');
      groupLi.className = 'term-host-group';

      const details = document.createElement('details');
      details.className = 'term-host-details';
      details.dataset.host = host;
      if (openState.get(host)) details.open = true;
      details.addEventListener('toggle', () => openState.set(host, details.open));

      const summary = document.createElement('summary');
      summary.className = 'term-host-summary' + (isCurrent ? ' is-current' : '');
      summary.innerHTML = `
        <span class="term-host-label"></span>
        <span class="term-host-count"></span>
        <span class="term-host-badge"></span>
      `;
      summary.querySelector('.term-host-label').textContent = host;
      summary.querySelector('.term-host-count').textContent = `(${items.length})`;
      if (isCurrent) summary.querySelector('.term-host-badge').textContent = 'current';
      details.appendChild(summary);

      const inner = document.createElement('ul');
      inner.className = 'term-host-inner';

      for (const { t, isPending, host: thost } of items) {
        const li = document.createElement('li');
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'term-link';
        link.dataset.name = t.name;
        link.dataset.host = thost;
        link.innerHTML = `
          <span class="dot"></span>
          <span class="term-name"></span>
          <span class="term-host"></span>
        `;
        link.querySelector('.term-name').textContent = t.name;
        // 그룹 헤더가 host 를 표시하므로 행마다 중복 텍스트는 생략.
        link.querySelector('.term-host').textContent = '';

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
            allowDuplicate: true, host: thost,
          });
          layout.activateTab(tabId);
        });

        li.appendChild(link);
        inner.appendChild(li);
      }

      details.appendChild(inner);
      groupLi.appendChild(details);
      listEl.appendChild(groupLi);
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
