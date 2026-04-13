// ========== KEYBOARD / VIEWPORT GUARD ==========
// Keeps the focused input visible when the mobile virtual keyboard opens,
// for both the file-browser (index.html) and the terminal page — the
// only assumption is that the root layout element has class "layout".
//
// Strategy (layered, most-capable API first):
//   1. VirtualKeyboard API (Chromium 94+) — keyboard overlays content;
//      CSS env(keyboard-inset-height) on .layout reserves space so the
//      internal scroll container (.preview-body / terminal) still sees
//      the focused input above the keyboard.
//   2. visualViewport fallback — resize .layout to the visual viewport
//      height so internal scroll containers shrink to fit above the
//      keyboard. Required for Safari / non-Chromium browsers.
//   3. On focus, nudge the focused element into the visible area of
//      whatever scroll container it lives in (block:'nearest' so the
//      viewport isn't yanked around when the input is already visible).
//
// History: an earlier version pinned window.scrollY to 0 on every scroll
// event. That fought the browser's native "scroll-focused-input-into-
// view" behaviour and left inputs hidden behind the keyboard on touch
// devices. Body is position:fixed now (see style.css / terminal.css),
// so there's nothing left for the window to scroll — the pin is gone.
(function initKeyboardGuard() {
    const layout = document.querySelector('.layout');

    // ---- VirtualKeyboard API (Chromium) ----
    if ('virtualKeyboard' in navigator) {
        navigator.virtualKeyboard.overlaysContent = true;
        // CSS env(keyboard-inset-height) on .layout handles the spacing.
    }

    // ---- Focus-into-view ----
    // When an input / textarea / contenteditable gets focus, give the
    // keyboard a beat to open, then scroll the element into view inside
    // its nearest scrollable ancestor.
    function scrollFocusIntoView(el) {
        if (!el || typeof el.scrollIntoView !== 'function') return;
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    }
    document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (!el) return;
        // Two-stage nudge: once right away, once after the keyboard
        // animation finishes so the final layout is what we measure.
        requestAnimationFrame(() => scrollFocusIntoView(el));
        setTimeout(() => scrollFocusIntoView(el), 350);
    });

    // ---- visualViewport fallback (browsers without VirtualKeyboard API) ----
    if (window.visualViewport && !('virtualKeyboard' in navigator)) {
        const vv = window.visualViewport;
        let rafId = null;

        function onViewportChange() {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (layout) layout.style.height = Math.round(vv.height) + 'px';
                // After resize, re-scroll the focused element into view
                // (keyboard may have just opened/closed).
                const focused = document.activeElement;
                if (focused && focused !== document.body) scrollFocusIntoView(focused);
            });
        }

        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);
    }
})();
