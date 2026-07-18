# Rover Consultancy Services — Website

Static, dependency-free website for Rover Consultancy Services (Dhaka, Bangladesh):
visa consultation, air tickets, hotel booking, and tour packages for 50+ countries.

**Live:** https://omaar-x.github.io/Rover-consultancy-website-Main/

## Project structure

```
├── index.html              Homepage
├── html/                   All inner pages (about, contact, visa, air, hotel, tours, hajj, umrah, legal)
├── css/
│   ├── variables.css       Design tokens (colors, spacing, type scale)
│   ├── base.css            Reset + utilities
│   ├── components.css      Shared components (buttons, badges, forms, cards)
│   ├── header.css          Header + navigation
│   ├── footer.css          Footer
│   ├── pages.css           Page-specific sections
│   ├── theme.css           Light/dark theme variables + overrides (data-theme attr)
│   └── premium.css         Premium look: animations, hero, visa module, device polish
├── js/
│   ├── config.js           SINGLE config file — API/webhook URLs, contact info, paths
│   ├── theme.js            Dark/light toggle, scroll reveal, counters, particles
│   ├── main.js             UI behaviors + JSON rendering + form submission
│   ├── visa.js             Visa catalog module (list/detail/filters/PDF checklist)
│   └── schema.js           SEO structured data (JSON-LD)
├── data/                   Content as JSON — edit these, not the JS
│   ├── countries.json      Visa catalog (fees, processing, categories, checklists)
│   ├── services.json       Homepage service cards
│   ├── testimonials.json   Testimonial slider
│   ├── faq.json            FAQ accordion
│   └── settings.json       Site-wide settings/stats
├── images/                 destinations/, hero/, logo/, partners/
├── fonts/                  Self-hosted variable fonts (Inter, Playfair Display)
├── apps-script/script.gs   Google Apps Script backend (forms → Sheet + email)
└── .github/workflows/      GitHub Pages deploy (auto on push to main)
```

## How to add things (scalability guide)

| Task | Where |
|---|---|
| Add a visa country | Add an object in `data/countries.json` + photo in `images/destinations/<id>.jpg` — the catalog, search, and PDF checklist pick it up automatically |
| Change fees/processing | `data/countries.json` only |
| Add a page | Copy an existing file in `html/`, keep the shared header/footer, add nav links |
| Change phone/email | `js/config.js` (`contact`) + `data/settings.json` |
| Connect the forms | Deploy `apps-script/script.gs` as a Web App, paste its URL into `contactWebhookUrl` in `js/config.js` (steps are documented inside script.gs) |
| Brand colors | `css/variables.css` + theme values in `css/theme.css` |

## Conventions

- **No build step, no frameworks** — plain HTML/CSS/JS; deploys as-is to GitHub Pages or any static host (cPanel `.htaccess` included).
- **Content lives in `data/*.json`**, never hardcoded in JS.
- **Both themes always**: any new component must use `--t-*` variables from `theme.css` so text stays readable in light and dark mode.
- **Images**: local under `images/`; remote photos must have a local `onerror` fallback.
- Flag emojis render as bare letters on Windows — use country photo thumbnails instead.

## Local development

Any static server works:

```bash
npx serve .          # or: python -m http.server 8080
```

Note: `npx serve` rewrites clean URLs and drops query strings — test visa detail
deep-links (`html/visa-services.html?country=x`) with `python -m http.server` or on the live site.
