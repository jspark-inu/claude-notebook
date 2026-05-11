import { chromeTabId as _chromeTabId, host as _h, tabKey } from './persistence-ns.js';

let nextTabId = 1;
const tabs = new Map();
const subs = [];

const _ss = (typeof sessionStorage !== 'undefined') ? sessionStorage : null;
const _ls = (typeof localStorage   !== 'undefined') ? localStorage   : null;

const STORAGE_KEY = tabKey();
const LEGACY_KEYS = [`cn-v2-tabs-${_h}`];   // pre-namespace storage

function _readKey(store, key) {
  try { return store ? store.getItem(key) : null; } catch (_) { return null; }
}

// Heartbeat 상수는 GC 와 heartbeat 모듈이 같이 쓰므로 위에서 한 번에 선언.
const _HB_PREFIX  = 'cn-v2-hb-';
const _HB_TICK_MS = 25 * 1000;
const _HB_FRESH_MS = 60 * 1000;

// chrome 탭마다 새 namespace 가 생기므로 오래된 항목은 주기적으로 제거하지 않으면
// localStorage 가 무한히 누적된다 (codex P2). 14일보다 오래된 cn-v2-tabs/layout
// 항목은 모듈 로드 시점에 1회 정리한다.
const _GC_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const _GC_PREFIXES = ['cn-v2-tabs-', 'cn-v2-layout-'];
// 현재 chrome 탭 + 살아있는 다른 chrome 탭들의 namespace 는 모두 GC 예외.
// (heartbeat 가 fresh 인 chrome 탭의 데이터는 14일 이상 안 변했어도 보존해야
// 그 탭이 reload 됐을 때 복원 가능.)
function _liveNamespaceKeys() {
  const ids = new Set([_chromeTabId]);
  if (_ls) {
    const now = Date.now();
    try {
      for (let i = 0; i < _ls.length; i++) {
        const k = _ls.key(i);
        if (!k || !k.startsWith(_HB_PREFIX)) continue;
        const ts = parseInt(_ls.getItem(k) || '0', 10);
        if (!ts || now - ts > _HB_FRESH_MS) continue;
        ids.add(k.slice(_HB_PREFIX.length));
      }
    } catch (_) {}
  }
  const keys = new Set();
  for (const id of ids) {
    keys.add(`cn-v2-tabs-${_h}-${id}`);
    keys.add(`cn-v2-layout-${_h}-${id}`);
  }
  return keys;
}
function _gcOldNamespaces() {
  if (!_ls) return;
  const live = _liveNamespaceKeys();
  const cutoff = Date.now() - _GC_MAX_AGE_MS;
  try {
    const stale = [];
    for (let i = 0; i < _ls.length; i++) {
      const k = _ls.key(i);
      if (!k) continue;
      if (!_GC_PREFIXES.some(p => k.startsWith(p))) continue;
      if (live.has(k)) continue;  // 살아있는 chrome 탭의 namespace 보존
      try {
        const v = JSON.parse(_ls.getItem(k) || 'null');
        const ts = (v && typeof v._ts === 'number') ? v._ts : 0;
        // _ts 가 없는 엔트리는 구 버전 (혹은 마이그레이션 대상) 이므로 보존.
        // restoreFromStorage 가 한 번 읽고 새 키로 옮겨 적은 뒤에야 정리 대상이 된다.
        if (ts && ts < cutoff) stale.push(k);
      } catch (_) {}
    }
    for (const k of stale) { try { _ls.removeItem(k); } catch (_) {} }
  } catch (_) {}
}
_gcOldNamespaces();

// localStorage 가 우선이지만 막혀있는 환경 (엄격한 privacy 모드) 에서는
// sessionStorage 로라도 reload 시 복원되게 fallback 한다.
const _persistStore = _ls || _ss;
function persist() {
  if (!_persistStore) return;
  try {
    _persistStore.setItem(STORAGE_KEY, JSON.stringify({
      tabs: [...tabs.values()],
      nextTabId,
      _ts: Date.now(),
    }));
  } catch (_) {}
}

// Heartbeat: 살아있는 chrome 탭은 자신의 chromeTabId 로 localStorage 에 주기적
// 으로 timestamp 를 갱신해둔다. persistence-ns.js 가 부팅 시 이 heartbeat 를
// 읽어 "현재 살아있는 다른 탭의 namespace" 를 fallback 후보에서 제외한다.
function _hbKey(id) { return `${_HB_PREFIX}${id}`; }
function _writeHeartbeat() {
  if (!_ls) return;
  try { _ls.setItem(_hbKey(_chromeTabId), String(Date.now())); } catch (_) {}
}
_writeHeartbeat();
if (typeof setInterval !== 'undefined') setInterval(_writeHeartbeat, _HB_TICK_MS);
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', _writeHeartbeat);
  window.addEventListener('pageshow', _writeHeartbeat);
  window.addEventListener('beforeunload', () => {
    if (_ls) { try { _ls.removeItem(_hbKey(_chromeTabId)); } catch (_) {} }
  });
}

export function restoreFromStorage() {
  // persistence-ns 가 adopt 된 chromeTabId 로 STORAGE_KEY 를 이미 정해줬으므로
  // 여기선 그 키만 읽으면 된다 (sessionStorage 가 비었던 경우에도 같은 키).
  // localStorage 가 막힌 환경에서는 sessionStorage 도 시도.
  let raw = _readKey(_ls, STORAGE_KEY) || _readKey(_ss, STORAGE_KEY);
  // Legacy migration: pre-namespace storage
  if (!raw) {
    for (const k of LEGACY_KEYS) {
      raw = _readKey(_ss, k) || _readKey(_ls, k);
      if (raw) break;
    }
  }
  if (!raw) return 0;
  try {
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.tabs)) return 0;
    tabs.clear();
    for (const t of o.tabs) tabs.set(t.id, t);
    if (o.nextTabId) nextTabId = o.nextTabId;
    // 첫 복원 후 즉시 새 키로 다시 써둬서 다음 부팅부터는 1) 경로로 곧장 잡힘
    persist();
    return tabs.size;
  } catch (_) { return 0; }
}

export function onChange(fn) { subs.push(fn); }
function fire() { persist(); for (const fn of subs) fn(); }

export function openTab({ kind, contentRef, leafId, allowDuplicate = false, ...extra }) {
  // 같은 kind+contentRef 가 이미 어느 leaf 에든 열려있으면 거기서 활성화 (이동 X)
  // — 사용자가 사이드바 터미널 클릭 시 split 구조가 망가지지 않게.
  // allowDuplicate=true 면 (terminal picker 의 미러링) 중복 허용.
  if (!allowDuplicate) {
    for (const t of tabs.values()) {
      if (t.kind === kind && t.contentRef === contentRef) {
        fire();
        return t.id;
      }
    }
  }
  const id = `tab-${nextTabId++}`;
  // extra (currentFile, displayName 등) 는 생성 시점에 같이 설정해서 fire()
  // 직후 mount-tab 핸들러가 그 값을 볼 수 있게 한다 (file-per-tab 케이스).
  tabs.set(id, { id, kind, contentRef, leafId, ...extra });
  fire();
  return id;
}

export function closeTab(id) { tabs.delete(id); fire(); }
export function getTab(id) { return tabs.get(id); }
export function updateTab(id, patch) {
  const t = tabs.get(id); if (!t) return;
  Object.assign(t, patch);
  // persist 만 — fire() 호출하면 layout.render 가 mountEl.innerHTML='' 으로
  // iframe 을 잠시 detach 하면서 in-flight fetch 가 ERR_ABORTED 됨 (회귀
  // 발견). currentFile 같은 메타데이터 변경은 시각적 재렌더 불필요.
  persist();
}
export function moveTab(id, targetLeafId, targetIndex) {
  const t = tabs.get(id);
  if (!t) return;
  // Map 은 insertion order — 새 위치로 옮기려면 entries reordering
  const arr = [...tabs.values()];
  const movedIdx = arr.findIndex(x => x.id === id);
  if (movedIdx < 0) return;
  arr.splice(movedIdx, 1);
  t.leafId = targetLeafId;
  // targetIndex 는 같은 leaf 안의 위치 (다른 leaf 의 탭들은 카운트 안 함)
  if (typeof targetIndex !== 'number' || targetIndex < 0) {
    arr.push(t);  // 끝에
  } else {
    // 같은 leaf 의 N 번째 위치 = arr 에서 leaf 의 N 번째 entry 위치
    let inserted = false;
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].leafId === targetLeafId) {
        if (count === targetIndex) {
          arr.splice(i, 0, t);
          inserted = true;
          break;
        }
        count++;
      }
    }
    if (!inserted) arr.push(t);
  }
  tabs.clear();
  for (const x of arr) tabs.set(x.id, x);
  fire();
}
export function tabsForLeaf(leafId) {
  return [...tabs.values()].filter(t => t.leafId === leafId);
}
export function getAllTabs() { return [...tabs.values()]; }
