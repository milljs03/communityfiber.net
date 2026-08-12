// Conversion tracking helpers.
//
// GA4 itself is loaded by Firebase Analytics (measurement ID G-RZ8QH0W95G, see
// config/firebase-config.js), which is started once the page is idle. These
// helpers only queue events onto the shared dataLayer, so they are safe to call
// before gtag.js has finished loading — the queue is drained on arrival.
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

// Page views are tracked automatically by the GA4 config in firebase-config.js.

/**
 * Track form submissions
 */
function trackFormSubmission(formName) {
    gtag('event', 'form_submission', {
        'form_name': formName,
        'timestamp': new Date().toISOString()
    });
}

/**
 * Track CTA clicks
 */
function trackCTAClick(ctaName) {
    gtag('event', 'cta_click', {
        'cta_name': ctaName,
        'timestamp': new Date().toISOString()
    });
}

/**
 * Track availability check
 */
function trackAvailabilityCheck(source) {
    gtag('event', 'availability_check', {
        'source': source,
        'timestamp': new Date().toISOString()
    });
}

/**
 * Track service page views
 */
function trackServiceView(serviceName) {
    gtag('event', 'service_view', {
        'service': serviceName,
        'timestamp': new Date().toISOString()
    });
}

/**
 * Track pricing plan view
 */
function trackPlanView(planName) {
    gtag('event', 'plan_view', {
        'plan': planName,
        'timestamp': new Date().toISOString()
    });
}

/**
 * Track external link clicks
 */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', () => {
            gtag('event', 'external_link_click', {
                'url': link.href,
                'timestamp': new Date().toISOString()
            });
        });
    });
});

// Export functions for use in other scripts
window.Analytics = {
    trackFormSubmission,
    trackCTAClick,
    trackAvailabilityCheck,
    trackServiceView,
    trackPlanView
};
