/* === Claude Notebook — ui/tree.js ===
 *
 * Lazy-loaded sidebar tree. Each directory fetches its children only on
 * first expansion so big workspaces don't pay an upfront cost.
 *
 * Forward dependencies on app-level navigation (open a file's preview,
 * navigate the finder grid) are injected via `initTree({...})` so this
 * module stays free of app state.
 *
 * Refresh: 헤더의 ↻ 버튼 / window focus / visibilitychange 시 트리를
 * 다시 가져온다. 펼친 디렉토리 경로(`expandedPaths`), 스크롤 위치,
 * active file 을 보존했다가 재펼침 후 복원한다 (외부 파일 추가/삭제 시
 * 사이드바가 stale 해지는 문제 해결).
 */

import { fetchTreeLevel } from '../core/api.js';
import { escHtml, getFileIcon, isMobile } from '../core/utils.js';
import { closeSidebar } from './sidebar.js';

const treeEl = document.getElementById('tree');

let onOpenFile = (_path) => {};
let onOpenDir = (_path) => {};

// 펼친 디렉토리 경로 — refresh 후 자동 재펼침에 사용.
const expandedPaths = new Set();
let activeFilePath = null;

// refresh in-flight lock. 동시 발화 방지.
let isRefreshing = false;
let queuedRefresh = false;

function renderTree(items, parent, depth) {
    items.forEach((item) => {
        if (item.type === 'directory') {
            renderDirectoryNode(item, parent, depth);
        } else {
            renderFileNode(item, parent, depth);
        }
    });
}

function renderDirectoryNode(item, parent, depth) {
    const dirEl = document.createElement('div');
    dirEl.dataset.path = item.path;
    dirEl.dataset.kind = 'dir';

    const label = document.createElement('div');
    label.className = 'tree-item';
    label.dataset.depth = depth;
    label.dataset.path = item.path;
    label.innerHTML = `<span class="icon">&#9654;</span><span class="name">${escHtml(item.name)}</span>`;
    if (item.repo_url) label.appendChild(buildRepoLink(item.repo_url));

    const children = document.createElement('div');
    children.className = 'tree-children';
    let loaded = false;

    async function expand() {
        if (children.classList.contains('open')) return;
        children.classList.add('open');
        label.querySelector('.icon').innerHTML = '&#9660;';
        expandedPaths.add(item.path);
        if (!loaded) {
            loaded = true;
            try {
                const subItems = await fetchTreeLevel(item.path);
                renderTree(subItems, children, depth + 1);
            } catch (_) {
                children.innerHTML = '<div class="tree-item" style="opacity:0.5">Error loading</div>';
                loaded = false;
            }
        }
        onOpenDir(item.path);
    }

    function collapse() {
        children.classList.remove('open');
        label.querySelector('.icon').innerHTML = '&#9654;';
        expandedPaths.delete(item.path);
    }

    label.addEventListener('click', async () => {
        if (children.classList.contains('open')) collapse();
        else await expand();
    });

    dirEl.appendChild(label);
    dirEl.appendChild(children);
    parent.appendChild(dirEl);

    // refresh 시 DFS 로 재펼침할 때 사용
    dirEl._expand = expand;
    dirEl._childrenEl = children;
}

function renderFileNode(item, parent, depth) {
    const fileEl = document.createElement('div');
    fileEl.className = 'tree-item';
    fileEl.dataset.depth = depth;
    fileEl.dataset.path = item.path;
    fileEl.dataset.kind = 'file';
    fileEl.innerHTML = `<span class="icon">${getFileIcon(item.name)}</span><span class="name">${escHtml(item.name)}</span>`;
    if (activeFilePath === item.path) fileEl.classList.add('active');
    fileEl.addEventListener('click', () => {
        document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
        fileEl.classList.add('active');
        activeFilePath = item.path;
        onOpenFile(item.path);
        if (isMobile()) closeSidebar();
    });
    parent.appendChild(fileEl);
}

function buildRepoLink(repoUrl) {
    const repoLink = document.createElement('a');
    repoLink.href = repoUrl;
    repoLink.target = '_blank';
    repoLink.rel = 'noopener noreferrer';
    repoLink.className = 'repo-link';
    repoLink.title = repoUrl;
    repoLink.innerHTML = '<svg class="github-icon" viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
    repoLink.addEventListener('click', (e) => e.stopPropagation());
    return repoLink;
}

// 부모 컨테이너 안의 디렉토리 노드들 중 expandedPaths 에 있는 것을 재귀로 펼친다.
async function reExpandDirs(parent) {
    const dirEls = [...parent.children].filter(el => el.dataset?.kind === 'dir');
    for (const dirEl of dirEls) {
        if (expandedPaths.has(dirEl.dataset.path) && typeof dirEl._expand === 'function') {
            await dirEl._expand();
            if (dirEl._childrenEl) await reExpandDirs(dirEl._childrenEl);
        }
    }
}

/** Fetch the workspace root and (re-)render the tree. preserveState 가 false 면
 *  펼침 상태도 초기화. true 면 펼침/스크롤/active 보존. */
export async function refreshTree({ preserveState = true } = {}) {
    if (isRefreshing) {
        queuedRefresh = true;
        return;
    }
    isRefreshing = true;
    const btn = document.getElementById('treeRefreshBtn');
    btn?.classList.add('spinning');

    const savedScroll = treeEl.scrollTop;
    if (!preserveState) {
        expandedPaths.clear();
        activeFilePath = null;
    }

    try {
        const data = await fetchTreeLevel('');
        treeEl.innerHTML = '';
        renderTree(data, treeEl, 0);
        if (preserveState) {
            await reExpandDirs(treeEl);
            treeEl.scrollTop = savedScroll;
        }
    } catch (_) {
        treeEl.innerHTML = '<div class="loading">Error loading files.</div>';
    } finally {
        btn?.classList.remove('spinning');
        isRefreshing = false;
        if (queuedRefresh) {
            queuedRefresh = false;
            setTimeout(() => refreshTree({ preserveState: true }), 50);
        }
    }
}

/** 첫 로딩 — 펼침 상태 초기화 후 렌더. */
export async function loadTree() {
    return refreshTree({ preserveState: false });
}

let debounceTimer = null;
function autoRefreshDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => refreshTree({ preserveState: true }), 500);
}

/** Wire app-level callbacks. Must be called once before `loadTree()`. */
export function initTree({ openFile, openDir }) {
    if (typeof openFile === 'function') onOpenFile = openFile;
    if (typeof openDir === 'function') onOpenDir = openDir;

    const btn = document.getElementById('treeRefreshBtn');
    if (btn) btn.addEventListener('click', () => refreshTree({ preserveState: true }));

    // 탭 포커스 / 다시 보일 때 자동 갱신 — 외부에서 파일 추가/삭제된 경우 반영.
    window.addEventListener('focus', autoRefreshDebounced);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') autoRefreshDebounced();
    });
}
