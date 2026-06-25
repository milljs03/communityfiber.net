const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BLOG_DIR = path.join(PUBLIC_DIR, 'blog');
const BLOG_INDEX = path.join(PUBLIC_DIR, 'blog.html');
const SITEMAP = path.join(PUBLIC_DIR, 'sitemap.xml');
const SITE_URL = 'https://communityfiber.net';

const REQUIRED_FIELDS = [
  'slug',
  'title',
  'description',
  'summary',
  'category',
  'datePublished',
  'dateModified',
  'readTime',
  'body'
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validatePost(post, file) {
  for (const field of REQUIRED_FIELDS) {
    if (post[field] === undefined || post[field] === null || post[field] === '') {
      throw new Error(`${path.basename(file)} is missing required field: ${field}`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    throw new Error(`${path.basename(file)} has an invalid slug: ${post.slug}`);
  }

  if (!Array.isArray(post.body) || post.body.length === 0) {
    throw new Error(`${path.basename(file)} must include at least one body block.`);
  }
}

function loadPosts() {
  return fs.readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(POSTS_DIR, file);
      const post = readJson(fullPath);
      validatePost(post, fullPath);
      return post;
    })
    .sort((a, b) => {
      const dateCompare = String(b.datePublished).localeCompare(String(a.datePublished));
      return dateCompare || String(a.title).localeCompare(String(b.title));
    });
}

function renderBlock(block) {
  if (block.type === 'paragraph') {
    return `<p>${escapeHtml(block.text)}</p>`;
  }

  if (block.type === 'heading') {
    return `<h2>${escapeHtml(block.text)}</h2>`;
  }

  if (block.type === 'list') {
    const items = Array.isArray(block.items) ? block.items : [];
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  if (block.type === 'callout') {
    return `
      <aside class="article-callout">
        <strong>${escapeHtml(block.title)}</strong>
        <p>${escapeHtml(block.text)}</p>
      </aside>
    `;
  }

  if (block.type === 'cta') {
    return `
      <aside class="article-cta">
        <div>
          <h2>${escapeHtml(block.title)}</h2>
          <p>${escapeHtml(block.text)}</p>
        </div>
        <a href="${escapeAttr(block.href)}">${escapeHtml(block.label)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </aside>
    `;
  }

  throw new Error(`Unsupported body block type: ${block.type}`);
}

function postUrl(post) {
  return `${SITE_URL}/blog/${post.slug}.html`;
}

function renderArticlePage(post, posts) {
  const relatedPosts = posts
    .filter((candidate) => candidate.slug !== post.slug)
    .slice(0, 3);
  const relatedHtml = relatedPosts.map((related) => `
    <a class="related-card" href="${escapeAttr(related.slug)}.html">
      <span>${escapeHtml(related.category)}</span>
      <strong>${escapeHtml(related.title)}</strong>
      <small>${escapeHtml(related.readTime)}</small>
    </a>
  `).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: postUrl(post),
    headline: post.title,
    description: post.description,
    image: post.image || `${SITE_URL}/assets/images/community-fiber-logo.png`,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: {
      '@type': 'Organization',
      name: 'Community Fiber',
      url: SITE_URL
    },
    publisher: {
      '@type': 'Organization',
      name: 'Community Fiber',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/assets/images/community-fiber-logo.png`
      }
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(post.title)} | Community Fiber</title>
    <meta name="description" content="${escapeAttr(post.description)}">
    <meta property="og:title" content="${escapeAttr(post.title)} | Community Fiber">
    <meta property="og:description" content="${escapeAttr(post.description)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${postUrl(post)}">
    <meta property="og:image" content="${escapeAttr(post.image || `${SITE_URL}/assets/images/community-fiber-logo.png`)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(post.title)} | Community Fiber">
    <meta name="twitter:description" content="${escapeAttr(post.description)}">
    <meta name="twitter:image" content="${escapeAttr(post.image || `${SITE_URL}/assets/images/community-fiber-logo.png`)}">
    <link rel="canonical" href="${postUrl(post)}">
    <link rel="icon" type="image/png" href="../assets/images/favicon.png">
    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
    </script>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self';
                   script-src 'self' 'unsafe-inline' https://www.gstatic.com https://maps.googleapis.com https://apis.google.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
                   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
                   font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com;
                   img-src 'self' data: https://maps.gstatic.com https://lh3.googleusercontent.com;
                   frame-src https://accounts.google.com/ https://content-firebaseappcheck.googleapis.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/;
                   connect-src 'self' https://firestore.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://residential-fiber.web.app https://www.google-analytics.com https://firebaseappcheck.googleapis.com https://content-firebaseappcheck.googleapis.com;
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../assets/css/global.css">
    <link rel="stylesheet" href="../assets/css/components.css">
    <link rel="stylesheet" href="../assets/css/animations.css">
    <link rel="stylesheet" href="../assets/css/blog.css">
</head>
<body>
    <div id="master-header"></div>
    <main>
        <article class="article-page">
            <header class="article-hero">
                <div class="article-breadcrumb"><a href="../blog.html">Community Fiber Blog</a> / ${escapeHtml(post.category)}</div>
                <span class="article-category">${escapeHtml(post.category)}</span>
                <h1>${escapeHtml(post.title)}</h1>
                <p>${escapeHtml(post.summary)}</p>
                <div class="article-meta">
                    <span>${escapeHtml(post.readTime)}</span>
                    <span>Updated ${escapeHtml(post.dateModified)}</span>
                </div>
            </header>
            <div class="article-body">
                ${post.body.map(renderBlock).join('\n')}
            </div>
            <nav class="related-posts" aria-label="Related articles">
                <h2>Keep reading</h2>
                <div class="related-grid">
                    ${relatedHtml}
                </div>
            </nav>
        </article>
    </main>
    <footer class="site-footer">
        <div class="footer-content">
            <div class="footer-links">
                <a href="../footer/privacy-policy.html">Privacy Policy</a>
                <a href="../footer/terms-of-service.html">Terms of Service</a>
                <a href="../footer/acceptable-user-policy.html">Acceptable Use Policy</a>
                <a href="../footer/open-internet-policy.html">Open Internet Policy</a>
            </div>
            <address class="footer-address">
                <strong>NPTech</strong>
                Physical: 19066 Market ST, New Paris, IN 46553<br>
                Mailing: PO Box 47, New Paris, IN 46553
            </address>
            <p>&copy; 2026 Community Fiber. All rights reserved.</p>
        </div>
    </footer>
    <script type="module" src="../assets/js/main.js"></script>
    <script src="../assets/js/standard-header.js"></script>
    <script type="module" src="../assets/js/announcement.js"></script>
    <script type="module" src="../assets/js/traffic-logger.js"></script>
</body>
</html>
`;
}

function renderIndexCards(posts) {
  return posts.map((post) => `
                    <article class="guide-card post-card">
                        <span class="guide-kicker">${escapeHtml(post.category)}</span>
                        <h3><a href="blog/${escapeAttr(post.slug)}.html">${escapeHtml(post.title)}</a></h3>
                        <p>${escapeHtml(post.summary)}</p>
                        <div class="post-card-meta">
                            <span>${escapeHtml(post.readTime)}</span>
                            <span>Updated ${escapeHtml(post.dateModified)}</span>
                        </div>
                        <a class="guide-link" href="blog/${escapeAttr(post.slug)}.html">Read article <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                    </article>`).join('\n');
}

function updateBlogIndex(posts) {
  let html = fs.readFileSync(BLOG_INDEX, 'utf8');
  const cards = renderIndexCards(posts);
  const start = '<!-- GENERATED_POSTS_START -->';
  const end = '<!-- GENERATED_POSTS_END -->';
  html = replaceBetween(html, start, end, `\n${cards}\n                `);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog.html#blog`,
    name: 'Community Fiber News and Guides',
    url: `${SITE_URL}/blog.html`,
    description: 'Local fiber internet guides, Community Fiber updates, and practical resources for homes, businesses, builders, and neighborhoods.',
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Community Fiber',
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/assets/images/community-fiber-logo.png`
      }
    },
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: postUrl(post),
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified
    }))
  };

  html = html.replace(
    /<script type="application\/ld\+json" id="blog-jsonld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="blog-jsonld">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>`
  );

  fs.writeFileSync(BLOG_INDEX, html);
}

function updateSitemap(posts) {
  let xml = fs.readFileSync(SITEMAP, 'utf8');
  const start = '  <!-- GENERATED_POSTS_SITEMAP_START -->';
  const end = '  <!-- GENERATED_POSTS_SITEMAP_END -->';
  const entries = posts.map((post) => `  <url>
    <loc>${postUrl(post)}</loc>
    <lastmod>${escapeHtml(post.dateModified)}</lastmod>
  </url>`).join('\n');
  xml = replaceBetween(xml, start, end, `\n${entries}\n`);
  fs.writeFileSync(SITEMAP, xml);
}

function replaceBetween(value, start, end, replacement) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing generated content markers: ${start} / ${end}`);
  }

  return `${value.slice(0, startIndex + start.length)}${replacement}${value.slice(endIndex)}`;
}

function main() {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  const posts = loadPosts();
  for (const post of posts) {
    fs.writeFileSync(path.join(BLOG_DIR, `${post.slug}.html`), renderArticlePage(post, posts));
  }
  updateBlogIndex(posts);
  updateSitemap(posts);
  console.log(`Generated ${posts.length} blog article page(s).`);
}

main();
