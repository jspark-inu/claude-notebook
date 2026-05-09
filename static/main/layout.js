import * as tabStore from './tab-store.js';

let nextLeafId = 1;
const state = {
  leaves: [{ id: `leaf-${nextLeafId++}`, size: 1, activeTabId: null }],
  activeLeafId: null,
};
state.activeLeafId = state.leaves[0].id;

let mountEl;
const subs = [];
export function onChange(fn) { subs.push(fn); }
function fire() { for (const fn of subs) fn(); render(); }

function attachVDrag(sp) {
  sp.addEventListener('pointerdown', e => {
    e.preventDefault();
    sp.setPointerCapture(e.pointerId);
    sp.classList.add('dragging');

    const leftId = sp.dataset.leftId;
    const rightId = sp.dataset.rightId;
    const L = state.leaves.find(l => l.id === leftId);
    const R = state.leaves.find(l => l.id === rightId);
    if (!L || !R) return;

    const startX = e.clientX;
    const totalSize = L.size + R.size;
    const startLSize = L.size;
    const Lel = mountEl.querySelector(`[data-leaf-id="${leftId}"]`);
    const Rel = mountEl.querySelector(`[data-leaf-id="${rightId}"]`);
    const rect = mountEl.getBoundingClientRect();

    const onMove = ev => {
      const dx = (ev.clientX - startX) / rect.width;
      const newL = Math.max(0.1, Math.min(totalSize - 0.1, startLSize + dx * state.leaves.length));
      L.size = newL;
      R.size = totalSize - newL;
      // DOM 재생성 X — inline style 만 갱신
      if (Lel) Lel.style.flex = `${L.size} 1 0`;
      if (Rel) Rel.style.flex = `${R.size} 1 0`;
    };

    const cleanup = () => {
      sp.removeEventListener('pointermove', onMove);
      sp.removeEventListener('pointerup', cleanup);
      sp.removeEventListener('pointercancel', cleanup);
      sp.classList.remove('dragging');
      // 최종 1회 fire — subs 에게만 알림 (render 호출 안 함)
      for (const fn of subs) fn();
    };
    sp.addEventListener('pointermove', onMove);
    sp.addEventListener('pointerup', cleanup);
    sp.addEventListener('pointercancel', cleanup);
  });
}

export function init(mainEl) {
  mountEl = mainEl;
  tabStore.onChange(render);
  render();
}

export function getLeavesInVisualOrder() { return [...state.leaves]; }
export function getActiveLeafId() { return state.activeLeafId; }
export function activateLeaf(id) { state.activeLeafId = id; fire(); }

export function activateTab(tabId) {
  const t = tabStore.getTab(tabId);
  if (!t) return;
  const leaf = state.leaves.find(l => l.id === t.leafId);
  if (leaf) { leaf.activeTabId = tabId; state.activeLeafId = leaf.id; }
  fire();
}

export function addLeafAfter(id, opts = {}) {
  if (window.matchMedia('(max-width: 720px)').matches) return null;
  if (state.leaves.length >= 4) return null;
  const i = state.leaves.findIndex(l => l.id === id);
  if (i < 0) return null;
  const leaf = { id: `leaf-${nextLeafId++}`, size: 1, activeTabId: null };
  state.leaves.splice(i + 1, 0, leaf);
  state.activeLeafId = leaf.id;
  if (opts.kind && opts.contentRef) {
    const tabId = tabStore.openTab({ kind: opts.kind, contentRef: opts.contentRef, leafId: leaf.id });
    leaf.activeTabId = tabId;
  }
  fire();
  return leaf;
}

export function removeLeaf(id) {
  if (state.leaves.length <= 1) return;
  const i = state.leaves.findIndex(l => l.id === id);
  if (i < 0) return;
  for (const t of tabStore.tabsForLeaf(id)) tabStore.closeTab(t.id);
  state.leaves.splice(i, 1);
  if (state.activeLeafId === id) state.activeLeafId = state.leaves[Math.max(0, i - 1)].id;
  fire();
}

export function setLeafSize(idOrEdge, size) {
  if (typeof idOrEdge === 'string') {
    const l = state.leaves.find(x => x.id === idOrEdge);
    if (l) l.size = size;
  } else {
    const { leftId, rightId } = idOrEdge;
    const L = state.leaves.find(x => x.id === leftId);
    const R = state.leaves.find(x => x.id === rightId);
    if (L && R) {
      const total = L.size + R.size;
      L.size = total * size;
      R.size = total - L.size;
    }
  }
  fire();
}

export function serializeLayout() {
  return JSON.stringify({ leaves: state.leaves, activeLeafId: state.activeLeafId });
}
export function restoreLayout(json) {
  try {
    const o = JSON.parse(json);
    state.leaves = o.leaves;
    state.activeLeafId = o.activeLeafId;
    nextLeafId = Math.max(...state.leaves.map(l => parseInt(l.id.split('-')[1]))) + 1;
    fire();
  } catch (_) {}
}

function render() {
  if (!mountEl) return;
  // Reuse existing leaf DOM where possible (avoid re-render churn)
  const existing = new Map();
  mountEl.querySelectorAll('.leaf').forEach(el => existing.set(el.dataset.leafId, el));
  mountEl.innerHTML = '';
  state.leaves.forEach((leaf, i) => {
    let sec = existing.get(leaf.id);
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'leaf';
      sec.dataset.leafId = leaf.id;
      sec.innerHTML = '<div class="tabbar"></div><div class="leaf-body"></div>';
      sec.addEventListener('mousedown', () => activateLeaf(leaf.id));
    }
    sec.classList.toggle('active', leaf.id === state.activeLeafId);
    sec.style.flex = `${leaf.size} 1 0`;

    const bar = sec.querySelector('.tabbar');
    bar.innerHTML = '';
    for (const t of tabStore.tabsForLeaf(leaf.id)) {
      const tEl = document.createElement('button');
      tEl.type = 'button';
      tEl.className = 'tab' + (t.id === leaf.activeTabId ? ' active' : '');
      tEl.innerHTML = '<span class="tab-name"></span><span class="tab-close" title="닫기">×</span>';
      tEl.querySelector('.tab-name').textContent = t.contentRef;
      tEl.addEventListener('click', e => {
        if (e.target.classList.contains('tab-close')) {
          tabStore.closeTab(t.id);
          // 이 leaf 가 비었으면 자동으로 leaf 도 닫기 (단, 마지막 leaf 는 유지)
          if (tabStore.tabsForLeaf(leaf.id).length === 0 && state.leaves.length > 1) {
            removeLeaf(leaf.id);
          } else if (leaf.activeTabId === t.id) {
            // 다른 탭으로 활성화 이동
            const remaining = tabStore.tabsForLeaf(leaf.id);
            leaf.activeTabId = remaining.length ? remaining[0].id : null;
            fire();
          }
        } else {
          leaf.activeTabId = t.id;
          activateLeaf(leaf.id);
        }
      });
      bar.appendChild(tEl);
    }
    // 패널마다 + 버튼 — 클릭 시 이 leaf 에 새 터미널 탭 추가
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tab-add';
    addBtn.textContent = '+';
    addBtn.title = '이 패널에 새 터미널 추가';
    addBtn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        const r = await fetch(`${window.__VIEWER_BASE || ''}/api/terminals/new`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-XSRFToken': window.__XSRF_TOKEN || '' },
          body: JSON.stringify({ host_id: window.__currentHostId || 'local' }),
        });
        if (!r.ok) { console.error('new terminal failed', r.status); return; }
        const { name } = await r.json();
        const tabId = tabStore.openTab({ kind: 'term', contentRef: name, leafId: leaf.id });
        leaf.activeTabId = tabId;
        state.activeLeafId = leaf.id;
        fire();
      } catch (err) { console.error(err); }
    });
    bar.appendChild(addBtn);

    if (state.leaves.length > 1) {
      const closeLeaf = document.createElement('button');
      closeLeaf.type = 'button';
      closeLeaf.className = 'leaf-close';
      closeLeaf.textContent = '✕';
      closeLeaf.title = '이 패널 닫기';
      closeLeaf.addEventListener('click', e => { e.stopPropagation(); removeLeaf(leaf.id); });
      bar.appendChild(closeLeaf);
    }

    const body = sec.querySelector('.leaf-body');
    const activeTab = tabStore.tabsForLeaf(leaf.id).find(t => t.id === leaf.activeTabId);
    const newTabId = activeTab ? activeTab.id : null;
    // Idempotency: 활성 탭이 바뀌었을 때만 mount-tab dispatch (xterm/file 깜빡임 방지)
    if (sec._lastTabId !== newTabId) {
      sec._lastTabId = newTabId;
      if (activeTab) {
        body.innerHTML = '';
        sec.dispatchEvent(new CustomEvent('mount-tab', {
          detail: { tab: activeTab, hostEl: body, leafId: leaf.id },
          bubbles: true,
        }));
      } else {
        body.innerHTML = '<div class="leaf-empty" style="padding:40px;text-align:center;color:var(--text-secondary,#888);font-style:italic">사이드바에서 터미널이나 파일을 선택하세요</div>';
      }
    }
    mountEl.appendChild(sec);

    // 다음 leaf 와의 사이에 splitter 삽입
    if (i < state.leaves.length - 1) {
      const sp = document.createElement('div');
      sp.className = 'splitter v';
      sp.dataset.leftId = leaf.id;
      sp.dataset.rightId = state.leaves[i + 1].id;
      attachVDrag(sp);
      mountEl.appendChild(sp);
    }
  });
}
