// Terminal picker popover.
//   showPicker(anchorEl, { hostId, currentLeafId, onPick, onCreate, onKill })
//   - onCreate({ hostId }) -> Promise<{name, host_id}>
//   - onPick({ name, host }) -> void   (기존 터미널 선택)
//   - onKill(name) -> Promise<void>    (휴지통 클릭, optional)
//
// 키보드: ↑↓ 이동, Enter 선택, Esc 닫기. 외부 클릭 / blur 시 닫힘.

import { BASE, fetchOpts } from '../core/api.js';
import { getAllTabs } from '../main/tab-store.js';

const JUPYTER = window.__JUPYTER_BASE !== undefined ? window.__JUPYTER_BASE : BASE;

let openPicker = null;

export function closeOpenPicker() {
  if (openPicker) {
    openPicker.close();
    openPicker = null;
  }
}

export async function showPicker(anchorEl, opts) {
  closeOpenPicker();

  const { hostId = 'local', currentLeafId, onPick, onCreate, onKill, showOtherHosts = false } = opts || {};

  let termList = [];
  let termHosts = {};
  try {
    [termList, termHosts] = await Promise.all([
      fetch(`${JUPYTER}/api/terminals`, fetchOpts).then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/api/term-hosts`, fetchOpts).then(r => r.ok ? r.json() : ({})),
    ]);
  } catch (err) {
    console.error('term-picker fetch failed', err);
  }

  // 같은 contentRef 가 몇 개 leaf 에 부착되어 있는지 카운트 — "Attached×N" 라벨용
  const attachCount = {};
  for (const t of getAllTabs()) {
    if (t.kind === 'term' && t.contentRef) {
      attachCount[t.contentRef] = (attachCount[t.contentRef] || 0) + 1;
    }
  }

  const root = document.createElement('div');
  root.className = 'term-picker';
  root.tabIndex = -1;

  root.style.cssText = `
    position: fixed;
    min-width: 280px;
    max-width: 400px;
    max-height: 400px;
    overflow-y: auto;
    background: var(--bg-elevated, #2a2a2a);
    border: 1px solid var(--border, #444);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    z-index: 10000;
    font-size: 13px;
    color: var(--text, #d4d4d4);
    padding: 4px 0;
    visibility: hidden;
  `;

  // header
  const header = document.createElement('div');
  header.style.cssText = 'padding:6px 12px; font-size:11px; color:var(--text-secondary,#888); text-transform:uppercase; letter-spacing:0.5px;';
  header.textContent = 'Open terminal in pane';
  root.appendChild(header);

  // items: [{label, sub, action, isKillable, name}]
  const items = [];

  items.push({
    isNew: true,
    label: `+ New terminal (${hostId})`,
    sub: '',
    action: async () => {
      try {
        const result = await onCreate({ hostId });
        if (result && result.name) {
          onPick({ name: result.name, host: result.host_id || hostId, isNew: true });
        }
      } catch (err) {
        alert('새 터미널 생성 실패: ' + err.message);
        console.error(err);
      }
    },
  });

  // host 필터링 — default 는 current host (hostId) 만. 다른 host 있으면
  // 마지막에 "▶ 다른 host (N)" 토글 row 추가, 클릭 시 picker 재오픈으로 펼침.
  const ownTerms = [];
  const otherTerms = [];
  for (const t of termList) {
    const host = termHosts[t.name] || 'local';
    (host === hostId ? ownTerms : otherTerms).push({ t, host });
  }
  const visibleTerms = showOtherHosts ? [...ownTerms, ...otherTerms] : ownTerms;
  for (const { t, host } of visibleTerms) {
    const name = t.name;
    const cnt = attachCount[name] || 0;
    const isOther = host !== hostId;
    items.push({
      name,
      host,
      label: name,
      sub: cnt > 0 ? `${host} · Attached×${cnt}` : host,
      isOther,
      action: () => onPick({ name, host }),
    });
  }
  if (!showOtherHosts && otherTerms.length > 0) {
    items.push({
      isToggle: true,
      label: `▶ 다른 host 터미널 (${otherTerms.length})`,
      sub: '',
      action: () => {
        showPicker(anchorEl, { ...opts, showOtherHosts: true });
      },
    });
  }

  // 렌더
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const row = document.createElement('div');
    row.className = 'term-picker-row';
    row.dataset.idx = String(i);
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      ${it.isNew ? 'border-bottom: 1px solid var(--border,#444); margin-bottom:2px;' : ''}
    `;

    const main = document.createElement('div');
    main.style.cssText = 'flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'
      + (it.isOther ? ' opacity:0.7;' : '');
    const labelEl = document.createElement('div');
    labelEl.textContent = it.label;
    labelEl.style.cssText = it.isNew ? 'color:var(--accent,#569cd6); font-weight:500;'
      : (it.isToggle ? 'color:var(--text-secondary,#888); font-size:11px; text-transform:uppercase; letter-spacing:0.5px;' : '');
    main.appendChild(labelEl);
    if (it.sub) {
      const subEl = document.createElement('div');
      subEl.textContent = it.sub;
      subEl.style.cssText = 'font-size:11px; color:var(--text-secondary,#888);';
      main.appendChild(subEl);
    }
    row.appendChild(main);

    if (!it.isNew && !it.isToggle && onKill) {
      const kill = document.createElement('button');
      kill.type = 'button';
      kill.textContent = '🗑';
      kill.title = '터미널 종료 (모든 패널에서 사라짐)';
      kill.style.cssText = 'background:transparent; border:0; color:var(--text-secondary,#888); cursor:pointer; font-size:14px; padding:0 4px;';
      kill.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`터미널 "${it.name}" 을 종료할까요? 모든 패널에서 사라집니다.`)) return;
        try {
          await onKill(it.name);
          close();
        } catch (err) {
          alert('종료 실패: ' + err.message);
        }
      });
      row.appendChild(kill);
    }

    row.addEventListener('click', () => {
      it.action();
      close();
    });
    row.addEventListener('mouseenter', () => setSelected(i));
    rows.push(row);
    root.appendChild(row);
  }

  if (visibleTerms.filter(x => !x.isOther).length === 0
      && visibleTerms.length === ownTerms.length) {
    // own host 에 터미널 없음 (다른 host 펼침 모드 제외)
    const empty = document.createElement('div');
    empty.style.cssText = 'padding: 12px; color: var(--text-secondary,#888); font-size:12px; text-align:center;';
    empty.textContent = `${hostId} 에 기존 터미널 없음`;
    root.appendChild(empty);
  }

  const hint = document.createElement('div');
  hint.style.cssText = 'padding:4px 12px; font-size:10px; color:var(--text-secondary,#666); border-top:1px solid var(--border,#444); margin-top:4px;';
  hint.textContent = '↑↓ 이동 · Enter 선택 · Esc 닫기';
  root.appendChild(hint);

  document.body.appendChild(root);

  // viewport 경계 보정 — append 후 실제 크기 측정해서 anchor 기준 배치
  {
    const rect = anchorEl.getBoundingClientRect();
    const pw = root.offsetWidth;
    const ph = root.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
    if (top + ph > vh - 8) {
      // anchor 위로 띄움
      top = Math.max(8, rect.top - ph - 4);
    }
    root.style.top = `${top}px`;
    root.style.left = `${left}px`;
    root.style.visibility = 'visible';
  }

  let selectedIdx = 0;
  function setSelected(i) {
    if (i < 0 || i >= rows.length) return;
    if (rows[selectedIdx]) rows[selectedIdx].style.background = '';
    selectedIdx = i;
    rows[selectedIdx].style.background = 'var(--bg-hover, rgba(255,255,255,0.08))';
    rows[selectedIdx].scrollIntoView({ block: 'nearest' });
  }
  setSelected(0);

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setSelected(Math.min(selectedIdx + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setSelected(Math.max(selectedIdx - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); items[selectedIdx].action(); close(); }
  }
  function onDocClick(e) {
    if (!root.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) close();
  }

  // capture phase 로 전역 단축키 차단
  document.addEventListener('keydown', onKey, true);
  // click 은 capture 안 써도 됨 (root.contains 가 차단). setTimeout 으로
  // anchor click 이 즉시 self-close 되지 않게 다음 tick 에 등록.
  // 등록 전에 close() 가 호출되면 closed 플래그로 등록 자체를 막아 누수 방지.
  let closed = false;
  setTimeout(() => {
    if (!closed) document.addEventListener('mousedown', onDocClick);
  }, 0);

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onDocClick);
    if (root.parentNode) root.parentNode.removeChild(root);
    if (openPicker?.root === root) openPicker = null;
  }

  openPicker = { root, close };
  root.focus();
}
