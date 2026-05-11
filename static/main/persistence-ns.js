// Shared namespace selector for tab-store + layout.
//
// 두 모듈이 각자 "가장 최근 namespace" 를 골라버리면 서로 다른 chromeTabId 의
// snapshot 을 섞어 복원할 수 있다 (codex P1 — 탭 leafId 와 layout 의 leafId 가
// 어긋남). 그래서 namespace 선택은 한 번만 수행하고, 두 모듈 모두 같은
// chromeTabId 를 공유해서 같은 snapshot 쌍을 읽도록 한다.

const _h = (typeof window !== 'undefined' && window.__INITIAL_HOST) || 'local';
const _ss = (typeof sessionStorage !== 'undefined') ? sessionStorage : null;
const _ls = (typeof localStorage   !== 'undefined') ? localStorage   : null;
const _CHROME_TAB_ID_KEY = 'cn-v2-chrome-tab-id';

const _HB_PREFIX = 'cn-v2-hb-';
const _HB_FRESH_MS = 60 * 1000;
function _aliveChromeTabIds(selfId) {
  if (!_ls) return new Set();
  const alive = new Set();
  const now = Date.now();
  try {
    for (let i = 0; i < _ls.length; i++) {
      const k = _ls.key(i);
      if (!k || !k.startsWith(_HB_PREFIX)) continue;
      const ts = parseInt(_ls.getItem(k) || '0', 10);
      if (!ts || now - ts > _HB_FRESH_MS) continue;
      alive.add(k.slice(_HB_PREFIX.length));
    }
  } catch (_) {}
  if (selfId) alive.delete(selfId);
  return alive;
}

function _newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : (`ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
}

function _readJson(store, key) {
  try {
    const raw = store ? store.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// chromeTabId 후보들의 (tab _ts, layout _ts) 중 최대치를 기준으로 가장 최근에
// 활동했던 chromeTabId 를 찾는다. 살아있는 다른 탭의 namespace 는 제외.
function _findAdoptableChromeTabId() {
  if (!_ls) return null;
  const alive = _aliveChromeTabIds(null);
  const tabPrefix    = `cn-v2-tabs-${_h}-`;
  const layoutPrefix = `cn-v2-layout-${_h}-`;
  const candidates = new Map();   // chromeTabId -> max(_ts)
  try {
    for (let i = 0; i < _ls.length; i++) {
      const k = _ls.key(i);
      if (!k) continue;
      let id = null;
      if (k.startsWith(tabPrefix))         id = k.slice(tabPrefix.length);
      else if (k.startsWith(layoutPrefix)) id = k.slice(layoutPrefix.length);
      if (!id || alive.has(id)) continue;
      const v = _readJson(_ls, k);
      const ts = (v && typeof v._ts === 'number') ? v._ts : 0;
      if (!ts) continue;
      const prev = candidates.get(id) || 0;
      if (ts > prev) candidates.set(id, ts);
    }
  } catch (_) {}
  let best = null, bestTs = 0;
  for (const [id, ts] of candidates) {
    if (ts > bestTs) { bestTs = ts; best = id; }
  }
  return best;
}

// Safari private mode 등에서 storage 접근 자체가 throw 할 수 있어 try/catch.
let _chromeTabId = null;
let _ssAccessible = false;
try {
  _chromeTabId = _ss ? _ss.getItem(_CHROME_TAB_ID_KEY) : null;
  _ssAccessible = !!_ss;
} catch (_) { _chromeTabId = null; _ssAccessible = false; }

let _adopted = false;
if (!_chromeTabId) {
  // sessionStorage 가 비었다 → 새 chrome 탭 OR mobile eviction 복귀.
  // 살아있는 다른 탭이 없는 namespace 중 가장 최근 것을 adopt → eviction 회복.
  // 후보 없으면 새 id 발급 → 진짜 새 탭.
  const adopt = _findAdoptableChromeTabId();
  if (adopt) {
    _chromeTabId = adopt;
    _adopted = true;
  } else {
    _chromeTabId = _newId();
  }
  if (_ssAccessible) {
    try { _ss.setItem(_CHROME_TAB_ID_KEY, _chromeTabId); }
    catch (_) { _ssAccessible = false; }
  }
  // sessionStorage 가 아예 안 되면 매 reload 마다 새 id 가 되므로 고정 id 로
  if (!_ssAccessible) _chromeTabId = 'default';
}

export const chromeTabId = _chromeTabId;
export const host        = _h;
export const adopted     = _adopted;
export function tabKey(hostId)    { return `cn-v2-tabs-${hostId || _h}-${_chromeTabId}`; }
export function layoutKey(hostId) { return `cn-v2-layout-${hostId || _h}-${_chromeTabId}`; }
