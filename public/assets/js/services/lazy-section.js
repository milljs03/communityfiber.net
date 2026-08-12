/**
 * Run an expensive loader only once its section is about to be seen.
 *
 * Some Firestore collections carry images stored as base64 data URIs, so a
 * single collection read can be over a megabyte (install_steps is ~1.06MB,
 * business_logos ~541KB). Fetching those during page load puts them on the
 * critical path and pushes LCP past 9 seconds even though the content sits
 * well below the fold.
 *
 * Deferring the read until the section approaches the viewport keeps the
 * bytes off the critical path. The loader still runs for anyone who scrolls,
 * and runs immediately where IntersectionObserver is unavailable.
 *
 * @param {string} selector  Section to watch.
 * @param {() => any} loader Called at most once.
 * @param {string} rootMargin How early to start (default: one viewport ahead).
 */
export function loadWhenVisible(selector, loader, rootMargin = '400px 0px') {
    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        loader();
    };

    const run = () => {
        const target = document.querySelector(selector);

        // No target, or no observer support: just load it.
        if (!target || typeof IntersectionObserver === 'undefined') {
            start();
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    start();
                    return;
                }
            }
        }, { rootMargin });

        observer.observe(target);

        // Deep links land mid-page, where the section may already be on screen
        // before the observer's first callback fires.
        const box = target.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
            observer.disconnect();
            start();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
}
