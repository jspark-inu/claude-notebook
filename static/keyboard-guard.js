// ========== KEYBOARD / VIEWPORT GUARD ==========
// Prevents body-level scroll when the mobile virtual keyboard appears.
// Shared by both the file-browser (index.html) and the terminal page
// (terminal.html) — the behaviour is identical, the only assumption is
// that the root layout element has class "layout".
//
// Strategy (layered, most-capable API first):
//   1. VirtualKeyboard API (Chromium 94+) — keyboard overlays content;
//      CSS env(keyboard-inset-height) on .layout handles the spacing.
//   2. visualViewport fallback — resize .layout to the visual viewport
//      height when the keyboard resizes the page.
//   3. Scroll pin — html/body are position:fixed, so any non-zero scroll
//      is a browser quirk; snap it back to (0,0).
(function initKeyboardGuard() {
    const layout = document.querySelector('.layout');

    // ---- VirtualKeyboard API (Chromium) ----
    if ('virtualKeyboard' in navigator) {
        navigator.virtualKeyboard.overlaysContent = true;
        // CSS env(keyboard-inset-height) on .layout handles the rest.
        // We still pin scroll as a safety net below.
    }

    // ---- Scroll pin ----
    function pinScroll() {
        if (window.scrollY !== 0 || window.scrollX !== 0) {
            window.scrollTo(0, 0);
        }
    }
    window.addEventListener('scroll', pinScroll);

    // On input focus, browsers may auto-scroll to the focused element.
    // Undo that on the next frame.
    document.addEventListener('focusin', () => {
        requestAnimationFrame(pinScroll);
    });

    // ---- visualViewport fallback (for browsers without VirtualKeyboard API) ----
    if (window.visualViewport && !('virtualKeyboard' in navigator)) {
        const vv = window.visualViewport;
        let rafId = null;

        function onViewportChange() {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (layout) layout.style.height = Math.round(vv.height) + 'px';
                pinScroll();
            });
        }

        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);
    }
})();
