/* === Claude Notebook — core/api.js ===
 *
 * Server-injected globals + fetch helpers + URL builders for the workspace
 * file API. Everything that needs to know about BASE / XSRF should funnel
 * through here so the rest of the app stays transport-agnostic.
 */

/** Mount path of the Jupyter extension (empty string when standalone). */
export const BASE = window.__VIEWER_BASE || '';

/** XSRF token injected by the server template; required by Jupyter for
 *  any state-mutating request. */
export const XSRF = window.__XSRF_TOKEN || '';

/** Default fetch options for safe (GET) requests. */
export const fetchOpts = {
    headers: { 'ngrok-skip-browser-warning': '1' },
    credentials: 'same-origin',
};

/** Merge XSRF + ngrok bypass headers into a fetch init for mutating
 *  requests (POST/PUT/DELETE). Caller-provided headers win on collision. */
export function mutFetchOpts(extra) {
    return {
        ...extra,
        credentials: 'same-origin',
        headers: {
            'ngrok-skip-browser-warning': '1',
            'X-XSRFToken': XSRF,
            ...(extra && extra.headers),
        },
    };
}

/** Spec 3-b: 현재 페이지 host (LegacyFilesHandler 가 inject __HOST). 없으면 'local'. */
function _hostParam() {
    const h = window.__HOST || window.__currentHostId;
    return (h && h !== 'local') ? `&host=${encodeURIComponent(h)}` : '';
}

/** Build the raw-stream URL for a workspace-absolute path (used by
 *  <img>/<audio>/<video> src and direct download links). */
export function apiRawUrl(workspacePath) {
    return `${BASE}/api/file?path=${encodeURIComponent(workspacePath)}&raw=1${_hostParam()}`;
}

/** Append host param to any /api/file or /api/tree URL. */
export function withHost(url) {
    return url + (url.includes('?') ? _hostParam() : _hostParam().replace('&', '?'));
}

/** Normalize backslashes to forward slashes (Windows-side paths). */
export function normPath(p) {
    return p ? p.replace(/\\/g, '/') : p;
}

/** Fetch one tree level (children of `dirPath`) from the workspace API. */
export async function fetchTreeLevel(dirPath) {
    const params = new URLSearchParams();
    if (dirPath) params.set('path', dirPath);
    const h = window.__HOST || window.__currentHostId;
    if (h && h !== 'local') params.set('host', h);
    const qs = params.toString();
    const url = qs ? `${BASE}/api/tree?${qs}` : `${BASE}/api/tree`;
    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error('Failed to load tree');
    const items = await res.json();
    items.forEach(item => { item.path = normPath(item.path); });
    return items;
}
