/* === Claude Notebook — viewers/file-instance.js ===
 *
 * FileViewerInstance: per-instance file viewer that renders into any
 * arbitrary hostEl rather than the legacy singleton #previewBody.
 *
 * Supports text (md, csv, xlsx, code), images, and media. Each instance
 * owns its own DOM, path, mode (preview|source), and lifecycle state.
 * Used by the multi-tab unified page; legacy/index.html is unaffected
 * (it keeps calling csv.js / xlsx.js directly with no hostEl arg).
 */

import { BASE, fetchOpts, apiRawUrl } from '../core/api.js';
import { renderCsvViewer } from '../views/csv.js';
import { renderXlsxViewer } from '../views/xlsx.js';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
const MEDIA_EXTS = ['.mp4', '.mp3', '.wav', '.webm', '.ogg'];

export class FileViewerInstance {
    constructor() {
        this.path = null;
        this.dom = null;
        this.mode = 'preview';   // 'preview' | 'source'
        this.dirty = false;
        this.unsavedBuffer = '';
        this.cursorPos = 0;
        this.scrollPos = 0;
        this.disposed = false;
        this._currentFile = null;
    }

    async mount(hostEl, path) {
        this.dom = hostEl;
        this.path = path;
        await this._load();
    }

    async _load() {
        if (!this.dom || !this.path) return;
        const ext = '.' + this.path.split('.').pop().toLowerCase();

        if (IMAGE_EXTS.includes(ext) || MEDIA_EXTS.includes(ext)) {
            this._renderMedia(ext);
            return;
        }

        const r = await fetch(
            `${BASE}/api/file?path=${encodeURIComponent(this.path)}`,
            fetchOpts
        );
        if (!r.ok) {
            this.dom.innerHTML = `<div class="error" style="padding:20px;color:var(--danger,#c33)">Load failed: ${r.status}</div>`;
            return;
        }
        const j = await r.json();
        if (j.too_large) {
            this.dom.innerHTML = `<div class="too-large" style="padding:20px;color:var(--text-secondary)">파일 너무 큼 (${j.size} bytes) — 미리보기 생략</div>`;
            return;
        }
        this._currentFile = j;
        this._render();
    }

    _renderMedia(ext) {
        const url = apiRawUrl(this.path);
        if (IMAGE_EXTS.includes(ext)) {
            this.dom.innerHTML = `<img src="${url}" alt="${this.path}" style="max-width:100%;display:block">`;
        } else {
            const tag = ['.mp4', '.webm'].includes(ext) ? 'video' : 'audio';
            this.dom.innerHTML = `<${tag} src="${url}" controls style="max-width:100%"></${tag}>`;
        }
    }

    _render() {
        if (!this._currentFile || !this.dom) return;
        const ext = (this._currentFile.extension || '').toLowerCase();
        const text = this._currentFile.content || '';

        if (this.mode === 'source') {
            this.dom.innerHTML = '<pre class="source"><code></code></pre>';
            this.dom.querySelector('code').textContent = text;
            return;
        }

        if (ext === '.md' || ext === '.markdown') {
            this.dom.innerHTML = '<div class="md-rendered"></div>';
            const md = this.dom.querySelector('.md-rendered');
            md.innerHTML = window.marked ? window.marked.parse(text) : text;
            if (window.hljs) {
                md.querySelectorAll('pre code').forEach(b => {
                    try { window.hljs.highlightElement(b); } catch (_) {}
                });
            }
        } else if (ext === '.csv') {
            this.dom.innerHTML = '';
            renderCsvViewer(text, this.dom);
        } else if (ext === '.xlsx' || ext === '.xls') {
            this.dom.innerHTML = '';
            renderXlsxViewer(this.path, this.dom);
        } else {
            // Code / plain text — same as source
            this.dom.innerHTML = '<pre class="source"><code></code></pre>';
            this.dom.querySelector('code').textContent = text;
        }
    }

    setMode(m) {
        if (this.mode === m) return;
        this.mode = m;
        this._render();
    }

    async flushUnsaved() {
        // 통합 페이지의 auto-save 모듈이 path 별로 dirty 관리.
        // 인스턴스는 dirty를 직접 추적하지 않음.
        // Future: hook into auto-save flush
    }

    dispose() {
        this.disposed = true;
        this.dom = null;
        this._currentFile = null;
    }
}
