// Google Analytics setup and conversion tracking

// Initialize Google Analytics 4
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-XXXXXXXXXX'); // Replace with your GA4 property ID

// Track page views (happens automatically with gtag config)

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
