import { BASE, mutFetchOpts } from '../core/api.js';

const STATUS_UI = {
  key_ok:             { color: '🟢', text: 'Auto-login OK' },
  auth_prompt_likely: { color: '🟡', text: '비밀번호 prompt 필요 — 실 연결은 가능' },
  unreachable:        { color: '🔴', text: '호스트 도달 불가' },
  host_key_error:     { color: '🔴', text: '호스트 키 충돌 (~/.ssh/known_hosts)' },
  config_error:       { color: '🔴', text: 'SSH 설정 오류' },
  unknown_error:      { color: '⚠',  text: '알 수 없는 오류' },
};

export function openAddModal({ onAdded } = {}) {
  const m = document.getElementById('add-host-modal');
  if (!m) return;
  m.innerHTML = `
    <div class="modal-box" style="width:520px;max-width:92vw">
      <header class="modal-head">Add SSH host</header>

      <!-- ~/.ssh/config 자동 임포트 영역 -->
      <div class="ssh-config-import" style="padding:12px 18px;border-bottom:1px solid var(--border);background:var(--code-bg)">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:8px">~/.ssh/config 에서 가져오기</div>
        <div class="ssh-config-list" style="max-height:160px;overflow:auto">로딩 중…</div>
      </div>

      <header class="modal-head" style="border-top:0;padding-top:12px">또는 수동 입력</header>
      <div class="modal-body">
        <label>Name (display) <input name="label" placeholder="my-server"></label>
        <label>User <input name="user" placeholder="dami"></label>
        <label>Host <input name="host" placeholder="server.example.com"></label>
        <label>Port <input name="port" placeholder="22" value="22"></label>
      </div>
      <div class="test-result" hidden style="padding:8px 18px;font-size:12px"></div>
      <footer class="modal-foot">
        <button data-act="cancel" type="button">Cancel</button>
        <button data-act="test" type="button">Auto-login test</button>
        <button data-act="add" class="primary" type="button">Add</button>
      </footer>
    </div>
  `;
  m.hidden = false;

  // ~/.ssh/config 자동 임포트
  (async () => {
    const listEl = m.querySelector('.ssh-config-list');
    try {
      const r = await fetch(`${BASE}/api/ssh-config`, { credentials: 'same-origin' });
      const d = await r.json();
      const hosts = (d.hosts || []);
      if (!hosts.length) {
        listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:12px">~/.ssh/config 에 호스트 없음</div>';
        return;
      }
      listEl.innerHTML = hosts.map(h => {
        const target = h.user ? `${h.user}@${h.alias}` : h.alias;
        return `
          <button class="ssh-config-row" type="button" data-alias="${esc(h.alias)}" data-target="${esc(target)}"
                  style="display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer;border-radius:4px">
            <span>🖥</span>
            <span style="flex:1"><strong>${esc(h.alias)}</strong>
              <span style="color:var(--text-secondary);font-size:11px;margin-left:8px">${esc(h.hostname)}${h.port?(':'+esc(h.port)):''}${h.user?(' · '+esc(h.user)):''}</span>
            </span>
            <span style="color:var(--accent);font-size:11px">+ Add</span>
          </button>`;
      }).join('');
      listEl.querySelectorAll('.ssh-config-row').forEach(b => {
        b.addEventListener('click', async () => {
          const alias = b.dataset.alias;
          const target = b.dataset.target;  // user@alias or alias (uses ssh config)
          // Use the alias as connect — ssh resolves via ~/.ssh/config
          const r = await fetch(`${BASE}/api/hosts`, mutFetchOpts({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: alias, connect: alias }),
          }));
          if (!r.ok) { alert('등록 실패: ' + r.status); return; }
          testWasAdded = true;
          onAdded?.();
          close();
        });
        b.addEventListener('mouseenter', () => b.style.background = 'var(--sidebar-hover)');
        b.addEventListener('mouseleave', () => b.style.background = 'transparent');
      });
    } catch (err) {
      listEl.innerHTML = `<div style="color:var(--danger);font-size:12px">로드 실패: ${esc(err.message)}</div>`;
    }
  })();

  let testHostId = null;
  let testWasAdded = false;  // track if user accepts the tested host

  async function close() {
    if (testHostId && !testWasAdded) {
      // cleanup: Test 만 한 후 Cancel → 임시 host 삭제
      try {
        await fetch(`${BASE}/api/hosts/${encodeURIComponent(testHostId)}`, mutFetchOpts({ method: 'DELETE' }));
      } catch (_) {}
    }
    m.hidden = true;
    m.innerHTML = '';
  }

  // outside click
  m.addEventListener('click', e => { if (e.target === m) close(); });
  m.querySelector('[data-act=cancel]').addEventListener('click', close);

  m.querySelector('[data-act=test]').addEventListener('click', async () => {
    const label = m.querySelector('input[name=label]').value.trim();
    const user  = m.querySelector('input[name=user]').value.trim();
    const host  = m.querySelector('input[name=host]').value.trim();
    const port  = m.querySelector('input[name=port]').value.trim();
    // connect = user@host[:port] 조합 — 한 필드라도 없으면 단순화
    let connect = null;
    if (host) {
      connect = user ? `${user}@${host}` : host;
      // ssh 의 -p 옵션은 connect 문자열에 못 넣음 — port 가 22 가 아니면 user@host:port 식으로
      // 표기 (실 연결은 ~/.ssh/config 또는 별도 처리). 단순화: port 무시 (config 사용 권장)
    }
    if (!label) { alert('Name 을 입력하세요'); return; }
    // 기존 testHostId 있으면 변경 가능성 — 매번 새로 등록 (DELETE 후 POST)
    if (testHostId) {
      try { await fetch(`${BASE}/api/hosts/${encodeURIComponent(testHostId)}`, mutFetchOpts({ method: 'DELETE' })); } catch (_) {}
      testHostId = null;
    }
    let r;
    try {
      r = await fetch(`${BASE}/api/hosts`, mutFetchOpts({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, connect }),
      }));
    } catch (err) { alert('네트워크 오류'); return; }
    if (!r.ok) { alert('등록 실패 (status ' + r.status + ')'); return; }
    testHostId = (await r.json()).id;
    let tr;
    try {
      tr = await fetch(`${BASE}/api/hosts/${encodeURIComponent(testHostId)}/test`,
        mutFetchOpts({ method: 'POST' }));
    } catch (err) { alert('테스트 실패'); return; }
    const j = await tr.json();
    const ui = STATUS_UI[j.status] || STATUS_UI.unknown_error;
    const box = m.querySelector('.test-result');
    box.hidden = false;
    box.innerHTML = `<strong>${ui.color} ${ui.text}</strong><pre style="white-space:pre-wrap;font-size:11px;color:#666;margin-top:6px">${esc(j.stderr_excerpt || '')}</pre>`;
  });

  m.querySelector('[data-act=add]').addEventListener('click', async () => {
    const label = m.querySelector('input[name=label]').value.trim();
    const user  = m.querySelector('input[name=user]').value.trim();
    const host  = m.querySelector('input[name=host]').value.trim();
    const port  = m.querySelector('input[name=port]').value.trim();
    // connect = user@host[:port] 조합 — 한 필드라도 없으면 단순화
    let connect = null;
    if (host) {
      connect = user ? `${user}@${host}` : host;
      // ssh 의 -p 옵션은 connect 문자열에 못 넣음 — port 가 22 가 아니면 user@host:port 식으로
      // 표기 (실 연결은 ~/.ssh/config 또는 별도 처리). 단순화: port 무시 (config 사용 권장)
    }
    if (!label) { alert('Name 을 입력하세요'); return; }
    if (!testHostId) {
      // Test 안 한 채로 직접 Add — 등록만
      let r;
      try {
        r = await fetch(`${BASE}/api/hosts`, mutFetchOpts({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, connect }),
        }));
      } catch (err) { alert('네트워크 오류'); return; }
      if (!r.ok) { alert('등록 실패 (status ' + r.status + ')'); return; }
    }
    testWasAdded = true;  // close() 가 cleanup 안 하도록
    onAdded?.();
    close();
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
