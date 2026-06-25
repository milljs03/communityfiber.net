# Blog Post Content

Each JSON file in this folder generates one crawlable article page under `public/blog/`.

Required fields:
- `slug`: URL filename without `.html`
- `title`
- `description`
- `summary`
- `category`
- `datePublished`
- `dateModified`
- `readTime`
- `body`

Supported body block types:
- `paragraph`: `{ "type": "paragraph", "text": "..." }`
- `heading`: `{ "type": "heading", "text": "..." }`
- `list`: `{ "type": "list", "items": ["..."] }`
- `callout`: `{ "type": "callout", "title": "...", "text": "..." }`
- `cta`: `{ "type": "cta", "title": "...", "text": "...", "href": "../residential.html", "label": "Check availability" }`

After editing posts, run:

```powershell
node scripts/build-posts.js
```
