/**
 * build-city-pages.js
 * Generates the city landing pages (public/<slug>.html) for every community
 * Community Fiber serves, and keeps sitemap.xml in sync.
 *
 * The pages reuse the residential page's element IDs so assets/js/residential.js
 * powers the live pricing grid, add-ons, install timeline, and testimonials
 * without modification.
 *
 * Usage: node scripts/build-city-pages.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SITEMAP = path.join(PUBLIC_DIR, 'sitemap.xml');
const SITE_URL = 'https://communityfiber.net';
const TODAY = new Date().toISOString().slice(0, 10);

// Mirrors the fallback plan data in assets/js/residential.js and the
// residential.html structured data. Update here if base pricing changes.
const PLANS = [
  { name: 'Basic', speed: '100 Mbps', price: '35' },
  { name: 'Standard', speed: '200 Mbps', price: '65' },
  { name: 'Advanced', speed: '500 Mbps', price: '80' },
  { name: 'Premium', speed: '1 Gbps', price: '70' }
];

const CITIES = [
  {
    slug: 'goshen',
    name: 'Goshen',
    county: 'Elkhart County',
    zips: ['46526', '46528'],
    metaDescription: 'Community Fiber brings symmetrical gigabit fiber internet to Goshen, Indiana. No contracts, no data caps, and local support. Check availability at your Goshen address today.',
    heroSub: 'We are building 100% fiber-to-the-home internet across the Maple City, supported by real people just down the road in New Paris.',
    intro: [
      'Goshen is the heart of Elkhart County — a county seat with a thriving Main Street, First Fridays that draw crowds from every corner of the county, and neighborhoods that stretch from Goshen College to the newest subdivisions on the edge of town. Life here moves quickly, and your internet connection should keep up.',
      'Community Fiber delivers 100% fiber-to-the-home internet in Goshen with symmetrical speeds up to 1 gigabit. Unlike cable, fiber uploads as fast as it downloads — so video calls from your home office, cloud backups for your business, and live streams from the ballpark all feel instant.',
      'And we are not a faraway national conglomerate. Community Fiber is powered by NPTech, a local team headquartered just down State Road 15 in New Paris. When a Goshen customer calls, a neighbor answers.'
    ],
    highlights: [
      'Serving Goshen ZIP codes 46526 and 46528',
      'Symmetrical gigabit speeds for remote work, streaming, and gaming',
      'Local install crews based minutes away in New Paris',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Can I get fiber near downtown Goshen or Goshen College?',
      a: 'Our Goshen network is expanding in phases, and central neighborhoods are a priority. Enter your address in the availability checker on this page for an instant answer — and if construction has not reached your street yet, your address submission tells us exactly where demand is so we can prioritize it.'
    }
  },
  {
    slug: 'bristol',
    name: 'Bristol',
    county: 'Elkhart County',
    zips: ['46507'],
    metaDescription: 'Fast fiber internet in Bristol, Indiana from Community Fiber. Symmetrical speeds up to 1 Gig, no contracts, no data caps, local Elkhart County support. Check your Bristol address.',
    heroSub: 'True fiber-to-the-home internet on the St. Joseph River, built and supported from right here in Elkhart County.',
    intro: [
      'Bristol sits where the St. Joseph River meets small-town Indiana at its best — historic downtown blocks, Bonneyville Mill grinding away in the county park, and quiet streets minutes from the Indiana Toll Road. Small town does not have to mean slow internet.',
      'Community Fiber is bringing symmetrical fiber-optic speeds up to 1 gigabit to Bristol homes. Whether you commute to Elkhart and work from home a few days a week, run a business from your kitchen table, or just want streaming that never buffers, fiber delivers the same speed up and down — something cable lines simply cannot do.',
      'We are your neighbors, too. Community Fiber is powered by NPTech in New Paris, so installs, service calls, and support all come from people who live and work in Elkhart County.'
    ],
    highlights: [
      'Serving Bristol ZIP code 46507',
      'Symmetrical speeds for work-from-home commuters',
      'Reliable glass fiber that shrugs off Michiana weather',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'I live outside Bristol town limits — can I still get Community Fiber?',
      a: 'Possibly! Our network reaches beyond town limits in many areas, and rural buildout is a core part of our mission. Enter your address in the availability checker above for an instant answer, and if service is not at your road yet, your submission helps us plan the next phase of construction.'
    }
  },
  {
    slug: 'middlebury',
    name: 'Middlebury',
    county: 'Elkhart County',
    zips: ['46540'],
    metaDescription: 'Community Fiber offers symmetrical gigabit fiber internet in Middlebury, Indiana. No contracts, no data caps, and hometown support. Check availability at your Middlebury address.',
    heroSub: 'Real fiber-to-the-home internet for Crystal Valley, from downtown Middlebury to the countryside beyond the Pumpkinvine.',
    intro: [
      'Middlebury blends Crystal Valley charm with real momentum — families sharing a meal at Das Dutchman Essenhaus, cyclists rolling down the Pumpkinvine Nature Trail, and manufacturers building world-class RVs on the edge of town. A community this connected deserves a connection to match.',
      'Community Fiber brings 100% fiber-optic internet to Middlebury with symmetrical speeds up to 1 gigabit. Fiber uploads as fast as it downloads, so cloud software for the shop, homework for Northridge students, and video calls with family all run without a hiccup — even with the whole household online at once.',
      'Best of all, the company behind your connection is local. Community Fiber is powered by NPTech in New Paris, and our install and support teams live right here in Elkhart County.'
    ],
    highlights: [
      'Serving Middlebury ZIP code 46540',
      'Symmetrical speeds for households, farms, and home businesses',
      'Fiber reliability for work, school, and streaming',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Does Community Fiber serve rural areas around Middlebury?',
      a: 'Rural buildout is central to what we do. Coverage around Middlebury expands in phases, so the best step is to enter your address in the availability checker on this page. If your road is not serviceable yet, your submission registers demand in your area and helps us prioritize future construction.'
    }
  },
  {
    slug: 'new-paris',
    name: 'New Paris',
    county: 'Elkhart County',
    zips: ['46553'],
    metaDescription: 'Community Fiber is headquartered in New Paris, Indiana — and delivers symmetrical gigabit fiber internet to its hometown. No contracts, no data caps. Check your New Paris address.',
    heroSub: 'New Paris is not just a town we serve — it is home. We are headquartered right here on Market Street.',
    intro: [
      'For most internet providers, New Paris is a dot on a coverage map. For us, it is home. Community Fiber is powered by NPTech, headquartered at 19066 Market Street — which means the people who build, install, and support your connection are the same people you see at Fairfield ballgames and the New Paris Speedway.',
      'Our 100% fiber-optic network delivers symmetrical speeds up to 1 gigabit to New Paris homes. Uploads as fast as downloads mean smooth video calls, instant cloud backups, and lag-free gaming — no matter how many devices your household throws at it.',
      'We have been connecting our neighbors for decades, and fiber is the next chapter. No contracts, no data caps, and no call centers three time zones away — just hometown service from people with a stake in this community.'
    ],
    highlights: [
      'Serving New Paris ZIP code 46553 — our hometown',
      'Headquartered at 19066 Market Street, New Paris',
      'Symmetrical gigabit speeds on 100% glass fiber',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Is Community Fiber really based in New Paris?',
      a: 'Yes! Community Fiber is powered by NPTech, headquartered at 19066 Market Street in New Paris, with a mailing address of PO Box 47. When you call support, you reach a team member in town — not an out-of-state call center.'
    }
  },
  {
    slug: 'syracuse',
    name: 'Syracuse',
    county: 'Kosciusko County',
    zips: ['46567'],
    metaDescription: 'Fiber internet in Syracuse, Indiana from Community Fiber. Symmetrical gigabit speeds for lake homes and year-round residents. No contracts, no data caps. Check your address.',
    heroSub: 'Real fiber for lake country, from Syracuse Lake to the shores of Wawasee — with no contracts to tie down a seasonal home.',
    intro: [
      'Syracuse is Indiana lake country at its finest — summer evenings on Syracuse Lake, weekends on Lake Wawasee, and a downtown that comes alive when the lake season does. More and more of us are working from the lake, streaming at the cottage, and running businesses year-round, and that takes real bandwidth.',
      'Community Fiber delivers 100% fiber-to-the-home internet in Syracuse with symmetrical speeds up to 1 gigabit. Fiber is not affected by the weekend crowds the way shared cable lines are — your speed stays your speed, whether it is a quiet February morning or the Fourth of July.',
      'And because we never require contracts, seasonal residents are not locked into paying for twelve months to enjoy the summer ones. Local crews from our New Paris headquarters handle every install, and local people answer every call.'
    ],
    highlights: [
      'Serving Syracuse ZIP code 46567 in lake country',
      'Symmetrical gigabit speeds for lake homes and year-round residents',
      'No contracts — ideal for seasonal lake residents',
      'Consistent speeds even during peak summer weekends',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Can I get fiber at my lake house on Syracuse Lake or Lake Wawasee?',
      a: 'Many lake-area addresses are already serviceable, and more are added with each construction phase. Enter your address in the availability checker above for an instant answer. Since Community Fiber has no contracts, a lake home connection can be started without committing to a long-term agreement.'
    }
  },
  {
    slug: 'nappanee',
    name: 'Nappanee',
    county: 'Elkhart County',
    zips: ['46550'],
    metaDescription: 'Community Fiber brings symmetrical gigabit fiber internet to Nappanee, Indiana. No contracts, no data caps, and local support. Check availability at your Nappanee address today.',
    heroSub: 'A town built on craftsmanship deserves internet built the same way — 100% glass fiber, straight to your home.',
    intro: [
      'Nappanee knows quality craftsmanship — from generations of Amish woodworking to the RVs rolling off local lines to the crowds at the Nappanee Apple Festival every fall. That same standard should apply to your internet, and old copper cable does not meet it.',
      'Community Fiber builds with 100% glass fiber straight to your home, delivering symmetrical speeds up to 1 gigabit. NorthWood students streaming lectures, families video-calling relatives, and home businesses moving big files all get the same instant, reliable connection — with no data caps, ever.',
      'We are a local operation, powered by NPTech in New Paris just up State Road 15. Our installers and support team live here in Michiana, so help is a local call away, not a ticket in a national queue.'
    ],
    highlights: [
      'Serving Nappanee ZIP code 46550',
      'Symmetrical speeds for families, shops, and home businesses',
      'Built with weather-resistant, future-proof glass fiber',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Which parts of Nappanee can get Community Fiber?',
      a: 'Construction rolls out zone by zone, so availability varies street to street as the network grows. The availability checker on this page gives an instant answer for your exact address — and if your street is not live yet, your submission registers demand and helps us plan the next construction phase.'
    }
  },
  {
    slug: 'wakarusa',
    name: 'Wakarusa',
    county: 'Elkhart County',
    zips: ['46573'],
    metaDescription: 'Fast fiber internet in Wakarusa, Indiana from Community Fiber. Symmetrical gigabit speeds, no contracts, no data caps, hometown support. Check your Wakarusa address today.',
    heroSub: 'Big-league internet for a real hometown, built and supported from ten miles up the road in New Paris.',
    intro: [
      'Wakarusa may be best known for the Maple Syrup Festival and the jumbo jelly beans at the Dime Store, but the people who live here know it as something better: a hometown. And hometowns deserve the same internet the big cities get — without big-city providers.',
      'Community Fiber delivers 100% fiber-to-the-home internet in Wakarusa with symmetrical speeds up to 1 gigabit. Remote work, NorthWood e-learning nights, security cameras, streaming in every room — fiber handles all of it at once, with uploads just as fast as downloads.',
      'Your provider is local, too. Community Fiber is powered by NPTech in New Paris, about ten miles up the road. Local crews build the network, local techs install it, and local people answer the phone when you need a hand.'
    ],
    highlights: [
      'Serving Wakarusa ZIP code 46573',
      'Symmetrical gigabit speeds on 100% glass fiber',
      'Local installs and support from nearby New Paris',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Is fiber really worth it in a small town like Wakarusa?',
      a: 'Absolutely. Fiber is not just about raw speed — it is about reliability, symmetrical uploads for things like video calls and camera systems, and infrastructure that will not be obsolete in a decade. It also adds real value to your home. Small towns are exactly where we believe fiber matters most.'
    }
  },
  {
    slug: 'milford',
    name: 'Milford',
    county: 'Kosciusko County',
    zips: ['46542'],
    metaDescription: 'Community Fiber brings symmetrical gigabit fiber internet to Milford, Indiana. No contracts, no data caps, local support. Check availability at your Milford address today.',
    heroSub: 'True fiber-to-the-home internet from downtown Milford to the shores of Waubee Lake.',
    intro: [
      'Milford sits at the top of Kosciusko County with the kind of community feel that is getting harder to find — a walkable downtown, summer days on Waubee Lake, and campers arriving at Camp Mack every season. What has been harder to find here is internet that actually keeps up.',
      'Community Fiber is changing that with 100% fiber-optic internet delivering symmetrical speeds up to 1 gigabit to Milford homes. Fiber means your upload speed matches your download speed, so working from home, backing up photos, and streaming in 4K all happen without the slowdowns cable customers know too well.',
      'And when you call us, you will not reach a national call center. Community Fiber is powered by NPTech, headquartered a few miles north in New Paris — local people building local infrastructure that will serve Milford for decades.'
    ],
    highlights: [
      'Serving Milford ZIP code 46542',
      'Symmetrical gigabit speeds for homes and lake properties',
      'Local install crews from nearby New Paris',
      'Service designed for modern eero mesh networks'
    ],
    uniqueFaq: {
      q: 'Does Community Fiber serve homes around Waubee Lake?',
      a: 'Lake-area coverage expands with each construction phase. Enter your address in the availability checker on this page for an instant answer — and if your street is not serviceable yet, your submission registers interest so we can notify you the moment service reaches you.'
    }
  }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cityUrl(city) {
  return `${SITE_URL}/${city.slug}.html`;
}

function buildFaqs(city) {
  const n = city.name;
  return [
    {
      q: `Is Community Fiber available in ${n} yet?`,
      a: `Fiber construction in ${n} is rolling out neighborhood by neighborhood. The fastest way to find out is the availability checker on this page — enter your address and you will see instantly whether your home is serviceable. If we have not reached your street yet, submitting your address registers your interest so we can notify you as soon as service arrives.`
    },
    {
      q: `What internet speeds can I get in ${n}?`,
      a: `Community Fiber offers symmetrical plans from 100 Mbps up to 1 gigabit (1,000 Mbps) in ${n}. Symmetrical means your upload speed matches your download speed — something cable cannot do — so video calls, cloud backups, and gaming feel just as fast as streaming.`
    },
    {
      q: `How much does fiber internet cost in ${n}?`,
      a: `Plans start at $35/mo for 100 Mbps, and our 1 Gig plan is currently $70/mo for new customers. Every plan includes unlimited data and local support, with service designed to work well with modern eero mesh networks. There are no contracts and no promo rates that jump after a year.`
    },
    city.uniqueFaq,
    {
      q: `Do I have to sign a contract for internet in ${n}?`,
      a: `No. Community Fiber never requires long-term contracts for any speed tier. Your rate stays steady, there are no data caps or overage fees, and you can change or cancel service without penalty.`
    }
  ];
}

function buildJsonLd(city) {
  const url = cityUrl(city);
  const faqs = buildFaqs(city);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: `Fiber Internet in ${city.name}, IN`, item: url }
        ]
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: `${city.name} Residential Fiber Internet`,
        serviceType: 'Fiber Internet Service',
        description: `Residential fiber internet in ${city.name}, Indiana with symmetrical speeds up to 1 Gbps, no annual contracts, unlimited data, and local support.`,
        provider: {
          '@type': 'InternetServiceProvider',
          '@id': `${SITE_URL}/#organization`,
          name: 'Community Fiber',
          url: `${SITE_URL}/`,
          telephone: '+1-574-831-2176'
        },
        areaServed: {
          '@type': 'City',
          name: city.name,
          containedInPlace: { '@type': 'AdministrativeArea', name: `${city.county}, Indiana` }
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `Community Fiber plans in ${city.name}`,
          itemListElement: PLANS.map((plan) => ({
            '@type': 'Offer',
            name: `${plan.name} — ${plan.speed} symmetrical fiber internet`,
            price: plan.price,
            priceCurrency: 'USD',
            url: `${url}#plans-pricing`,
            availability: 'https://schema.org/InStock'
          }))
        }
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a }
        }))
      }
    ]
  };
}

function renderFaqSection(city) {
  const items = buildFaqs(city).map((faq) => `
                <details class="faq-item">
                    <summary>${escapeHtml(faq.q)}</summary>
                    <div class="faq-content">
                        <p>${escapeHtml(faq.a)}</p>
                    </div>
                </details>`).join('');

  return `        <section id="city-faq" class="faq-section" data-animate="fade-up">
            <h2>${escapeHtml(city.name)} Fiber Internet FAQs</h2>
            <div class="faq-category">${items}
            </div>
        </section>`;
}

function renderNearby(city) {
  const links = CITIES
    .filter((c) => c.slug !== city.slug)
    .map((c) => `                <a href="${c.slug}.html">${escapeHtml(c.name)}</a>`)
    .join('\n');

  return `        <section id="nearby-communities" class="city-nearby-section" data-animate="fade-up">
            <h2>Also Serving Nearby Communities</h2>
            <p class="city-nearby-desc">Hometown fiber across Elkhart and Kosciusko counties.</p>
            <nav class="city-nearby-links" aria-label="Nearby communities">
${links}
            </nav>
        </section>`;
}

function renderPage(city) {
  const url = cityUrl(city);
  const name = escapeHtml(city.name);
  const title = `Fiber Internet in ${city.name}, IN | Community Fiber`;
  const keywords = [
    `fiber internet ${city.name} Indiana`,
    `internet provider ${city.name} IN`,
    ...city.zips.map((zip) => `gigabit internet ${zip}`),
    `high speed internet ${city.name}`,
    `${city.name} fiber optic internet`
  ].join(', ');

  const introHtml = city.intro
    .map((p) => `                    <p>${escapeHtml(p)}</p>`)
    .join('\n');

  const highlightsHtml = city.highlights
    .map((h) => `                        <li>${escapeHtml(h)}</li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(city.metaDescription)}">
    <meta name="keywords" content="${escapeHtml(keywords)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(city.metaDescription)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITE_URL}/assets/images/community-fiber-logo.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(city.metaDescription)}">
    <meta name="twitter:image" content="${SITE_URL}/assets/images/community-fiber-logo.png">
    <link rel="canonical" href="${url}">
    <link rel="icon" type="image/png" href="assets/images/favicon.png">
    <script type="application/ld+json">
${JSON.stringify(buildJsonLd(city), null, 2)}
    </script>

    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self';
                   script-src 'self' 'unsafe-inline' https://www.gstatic.com https://maps.googleapis.com https://apis.google.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
                   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
                   font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com;
                   img-src 'self' data: https://maps.gstatic.com https://lh3.googleusercontent.com;
                   frame-src https://accounts.google.com/ https://content-firebaseappcheck.googleapis.com https://search.np-tech.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/;
                   connect-src 'self' https://firestore.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://residential-fiber.web.app https://www.google-analytics.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com;">

    <!-- Fonts & Icons -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <!-- CSS -->
    <link rel="stylesheet" href="assets/css/global.css">
    <link rel="stylesheet" href="assets/css/components.css">
    <link rel="stylesheet" href="assets/css/animations.css">
    <link rel="stylesheet" href="assets/css/residential.css">
    <link rel="stylesheet" href="assets/css/city.css">
</head>
<body>

    <!-- Standard Header Placeholder -->
    <div id="master-header"></div>

    <main class="plans-wrapper">

        <!-- City Hero -->
        <header class="city-hero">
            <nav class="city-breadcrumb" aria-label="Breadcrumb">
                <a href="index.html">Home</a> &rsaquo; <span>Fiber Internet in ${name}, IN</span>
            </nav>
            <h1>Fiber internet, built for <span class="city-hero-accent">${name}</span>.</h1>
            <p class="city-hero-sub">${escapeHtml(city.heroSub)}</p>
            <div class="city-hero-actions">
                <a href="#availability-check" class="city-btn">Check Availability</a>
                <a href="#plans-pricing" class="city-btn city-btn-secondary">View Plans</a>
            </div>
            <p class="city-hero-meta">Up to 1 Gig symmetrical&nbsp;&nbsp;&middot;&nbsp;&nbsp;No contracts&nbsp;&nbsp;&middot;&nbsp;&nbsp;No data caps</p>
        </header>

        <!-- Pricing Grid Section (powered by assets/js/residential.js) -->
        <section id="plans-pricing" class="city-plans-section">
            <div class="pricing-intro">
                <h2>Fiber Internet Plans in ${name}</h2>
                <p>Every plan includes unlimited data, local support, and fiber service designed for modern eero mesh networks.</p>
            </div>

            <!-- Loading State -->
            <div id="loading-indicator" class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading plans...</p>
            </div>

            <!-- Error State -->
            <div id="error-message" class="hidden error-box" style="text-align:center; color:red;">
                <p>Unable to load plans at the moment. Please call us for pricing.</p>
            </div>

            <!-- Dynamic Pricing Grid (single row on desktop, swipeable carousel on mobile) -->
            <div class="pricing-carousel">
                <button class="pricing-nav prev" id="pricing-prev" type="button" aria-label="Previous plan"><i class="fa-solid fa-chevron-left"></i></button>
                <div id="plans-grid" class="pricing-container hidden">
                    <!-- Cards injected via JS -->
                </div>
                <button class="pricing-nav next" id="pricing-next" type="button" aria-label="Next plan"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </section>

        <!-- Availability Checker Embed -->
        <section id="availability-check" class="availability-embed-section" data-animate="fade-up">
            <div class="container">
                <h2 class="section-title">Check Fiber Availability in ${name}</h2>
                <p class="section-desc">Enter your ${name} address for an instant answer. If we haven&rsquo;t reached your street yet, you&rsquo;ll be the first to know when we do.</p>
                <!-- NPT site (matches residential.html embed styling) -->
                <div style="max-width:900px;margin:0 auto;">
                  <iframe
                    src="https://search.np-tech.com/cfnembeded.html?source_site=cfn_embed"
                    title="Check Community Fiber availability at your ${name} address"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    style="width:100%;min-height:420px;border:0;display:block;"
                  ></iframe>
                </div>
            </div>
        </section>

        <!-- Local Content -->
        <section id="fiber-in-${city.slug}" class="city-local-section" data-animate="fade-up">
            <div class="city-local-inner">
                <div class="city-local-copy">
                    <h2>Hometown Fiber, Built for ${name}</h2>
${introHtml}
                </div>
                <aside class="city-highlights-card">
                    <img src="assets/images/indiana-green.png" alt="Community Fiber serves ${name}, Indiana" class="city-highlights-map">
                    <h3>Why ${name} Chooses Community Fiber</h3>
                    <ul>
${highlightsHtml}
                    </ul>
                </aside>
            </div>
        </section>

        <!-- Fiber vs Cable Comparison -->
        <section id="fiber-comparison" class="comparison-section" data-animate="fade-up">
            <h2>Fiber vs. Cable in ${name}</h2>
            <div class="table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th class="highlight-col">Community Fiber</th>
                            <th>Traditional Cable</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Download Speed</td>
                            <td class="highlight-col">Up to 1,000 Mbps (1 Gig)</td>
                            <td>Varies; often slower during peak hours</td>
                        </tr>
                        <tr>
                            <td>Upload Speed</td>
                            <td class="highlight-col">Symmetrical (Same as download)</td>
                            <td>Typically 10x&ndash;20x slower than download</td>
                        </tr>
                        <tr>
                            <td>Technology</td>
                            <td class="highlight-col">Advanced Light-Based Glass Fiber</td>
                            <td>Aging Copper Coax Cable</td>
                        </tr>
                        <tr>
                            <td>Reliability</td>
                            <td class="highlight-col">Weather-resistant &amp; stable</td>
                            <td>Prone to interference and outages</td>
                        </tr>
                        <tr>
                            <td>Gaming &amp; Video</td>
                            <td class="highlight-col">Ultra-low latency (No lag)</td>
                            <td>Higher latency (Buffering/jitter)</td>
                        </tr>
                        <tr>
                            <td>Contracts</td>
                            <td class="highlight-col">No Contracts</td>
                            <td>Often requires 1&ndash;2 year commitment</td>
                        </tr>
                        <tr>
                            <td>Pricing</td>
                            <td class="highlight-col">No "Promo" traps or hidden fees</td>
                            <td>Prices often jump $20+ after year one</td>
                        </tr>
                        <tr>
                            <td>Data Caps</td>
                            <td class="highlight-col">Truly Unlimited</td>
                            <td>Often capped with overage charges</td>
                        </tr>
                        <tr>
                            <td>Support</td>
                            <td class="highlight-col">Local neighbors in New Paris</td>
                            <td>Large, impersonal call centers</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Install Process Timeline (powered by assets/js/residential.js) -->
        <section id="installation-process" class="timeline-section" data-animate="fade-up">
            <div class="container">
                <h2 class="section-title">Getting Fiber Installed in ${name}</h2>
                <div class="timeline-container">
                    <!-- Progress Bubbles -->
                    <div class="timeline-nav-wrapper">
                         <div id="timeline-progress-bar" class="timeline-progress-line"></div>
                         <div id="timeline-bubbles" class="timeline-bubbles">
                             <!-- Bubbles injected here -->
                         </div>
                    </div>

                    <!-- Step Content -->
                    <div id="timeline-content-area" class="timeline-content-card">
                        <button class="nav-arrow prev-arrow" id="timeline-prev"><i class="fa-solid fa-chevron-left"></i></button>

                        <div class="step-content-inner">
                            <div class="step-image-wrapper">
                                <img id="step-image" src="" alt="Step Image">
                            </div>
                            <div class="step-text-wrapper">
                                <span class="step-badge" id="step-badge">Step 1</span>
                                <h3 id="step-title">Loading Process...</h3>
                                <p id="step-desc">Please wait while we load the installation steps.</p>
                            </div>
                        </div>

                        <button class="nav-arrow next-arrow" id="timeline-next"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>
        </section>

${renderFaqSection(city)}

        <!-- Testimonials Section (powered by assets/js/residential.js) -->
        <section id="customer-reviews" class="testimonials-section" style="padding: 60px 20px; background-color: #f8fafc;">
            <div class="container">
                <h2 class="section-title">What Your Neighbors Say</h2>
                <div id="testimonials-grid" class="testimonials-grid" data-animate="stagger">
                    <div class="testimonial-card" style="display:none;" id="testimonial-fallback">
                        <div class="quote-icon">&#10077;</div>
                        <p class="quote-text" style="color: #334155;">Loading customer testimonials...</p>
                        <div class="author-info">
                            <h4 style="margin: 10px 0; color: #1e293b;">Community Fiber Customer</h4>
                            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Elkhart County, Indiana</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

${renderNearby(city)}

        <!-- Bottom CTA -->
        <section class="city-cta-band" data-animate="fade-up">
            <h2>Ready to bring fiber home to ${name}?</h2>
            <p>Checking your address takes less than a minute.</p>
            <a href="#availability-check" class="city-btn">Check My Address</a>
        </section>

    </main>

    <footer class="site-footer">
        <div class="footer-content">
            <div class="footer-links">
                <a href="footer/privacy-policy.html">Privacy Policy</a>
                <a href="footer/terms-of-service.html">Terms of Service</a>
                <a href="footer/acceptable-user-policy.html">Acceptable Use Policy</a>
                <a href="footer/open-internet-policy.html">Open Internet Policy</a>
            </div>
            <address class="footer-address">
                <strong>NPTech</strong>
                Physical: 19066 Market ST, New Paris, IN 46553<br>
                Mailing: PO Box 47, New Paris, IN 46553
            </address>
            <p>&copy; 2026 Community Fiber. All rights reserved.</p>
        </div>
    </footer>

    <!-- Scripts -->
    <script src="assets/js/standard-header.js"></script>
    <script type="module" src="assets/js/residential.js"></script>
    <script type="module" src="assets/js/main.js"></script>
    <script type="module" src="assets/js/announcement.js"></script>
    <script type="module" src="assets/js/traffic-logger.js"></script>
</body>
</html>
`;
}

function replaceBetween(value, start, end, replacement) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not find markers ${start} / ${end}`);
  }
  return value.slice(0, startIndex + start.length) + replacement + value.slice(endIndex);
}

function updateSitemap(cities) {
  let xml = fs.readFileSync(SITEMAP, 'utf8');
  const start = '  <!-- GENERATED_CITIES_SITEMAP_START -->';
  const end = '  <!-- GENERATED_CITIES_SITEMAP_END -->';

  if (!xml.includes(start)) {
    xml = xml.replace('</urlset>', `${start}\n${end}\n</urlset>`);
  }

  const entries = cities.map((city) => `  <url>
    <loc>${cityUrl(city)}</loc>
    <lastmod>${TODAY}</lastmod>
  </url>`).join('\n');

  xml = replaceBetween(xml, start, end, `\n${entries}\n`);
  fs.writeFileSync(SITEMAP, xml);
}

function main() {
  for (const city of CITIES) {
    const outFile = path.join(PUBLIC_DIR, `${city.slug}.html`);
    fs.writeFileSync(outFile, renderPage(city));
    console.log(`wrote public/${city.slug}.html`);
  }
  updateSitemap(CITIES);
  console.log('updated public/sitemap.xml');
}

main();
