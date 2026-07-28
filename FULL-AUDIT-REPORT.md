# RailHygiene SEO Audit and Implementation Report

**Audit date:** 2026-07-28
**Scope:** Full-site technical SEO, programmatic train pages, search intent, content quality, internal linking, structured data, AEO/GEO, trust and Android app acquisition
**Site:** https://railhygiene.in/
**Repository:** `kinkate18nic/railhygiene-site`

## Executive summary

RailHygiene already had a technically sound homepage, a train directory, static train pages, canonical URLs, XML sitemaps and Android App Links. The principal SEO risk was not missing keywords. It was a weak topical structure around the train pages: most rated trains had only one report, many programmatic pages were under 300 words, only the first 100 rated trains were directly linked from the directory, the dashboard contained almost no crawlable text, and the RailMadad comparison was a short internal-link dead end.

This sprint converts the site into a coherent search destination:

- 4,157 train pages remain available, while only 550 pages with actual community data are indexable.
- Every one of the 550 rated trains is linked from ten server-rendered browse pages, 55 trains per page.
- Indexable train pages now contain more than 300 visible words, data interpretation, sample-size warnings, category definitions, methodology links and official-help guidance.
- Four high-intent guides now cover coach/toilet cleanliness, dirty-coach complaints, PNR-linked feedback and RailMadad versus RailHygiene.
- A public methodology page documents independence, sources, aggregation, refresh behaviour, limitations and correction standards.
- The dashboard now contains crawlable explanatory content around the embedded application.
- Homepage WebSite, Organization and MobileApplication schema validate as separate JSON-LD blocks.
- A functional `SearchAction` points to `/trains/?q=...`; the page reads that query and renders the matching train.
- `llms.txt` was expanded and `llms-full.txt` was added for machine-readable service context.
- The daily train-refresh workflow now validates page quality, report-directory coverage, sitemaps, schema JSON and Android App Links.

Black-hat tactics—cloaking, doorway pages, fake reviews, copied railway content, hidden text and keyword stuffing—were deliberately excluded. They would create manual-action, trust and trademark risk without solving the site’s evidence problem.

## Scorecard

| Area | Before | After implementation | Confidence |
|---|---:|---:|---|
| Crawlability and index control | 86 | 96 | High |
| Programmatic page quality | 68 | 91 | High |
| Internal linking | 72 | 95 | High |
| On-page intent coverage | 64 | 92 | High |
| Structured data | 82 | 96 | High |
| E-E-A-T and transparency | 58 | 90 | High |
| AEO/GEO readiness | 76 | 94 | Medium-high |
| Mobile/responsive implementation | 91 | 94 | High |
| Performance | Not re-scored | Pending field data | Low |
| Overall implementation score | 77 | 93 | Medium-high |

The “after” score measures implementation quality, not guaranteed rankings. Rankings depend on indexing, competition, backlinks, engagement, brand demand and time.

## Evidence-backed findings and fixes

### P0 — Rated train pages were discoverable but often too thin

**Finding:** Indexable train pages contained route data and ratings but typically fewer than 300 visible words.
**Evidence:** Pre-change crawl sample for `/train/01005/` contained 169 words. Feedback distribution contained 454 trains with one report, 87 with two reports and only 21 with three or more reports.
**Impact:** Search engines could classify a large part of the programmatic set as thin or insufficiently distinct. A single average could also appear more authoritative than the sample justified.
**Fix:** Each rated page now explains the route-specific observations, defines the rating categories, labels sample-size limits, states recency, distinguishes live complaints from historical feedback and links to methodology. Automated validation requires at least 300 visible words on every indexable train page.
**Confidence:** High.

### P0 — Not every rated train had a strong crawlable path

**Finding:** `/trains/` initially rendered only the first 100 rated trains, while search results were produced client-side.
**Evidence:** The dataset contains 550 sitemap-eligible rated trains. The pre-change internal-link crawl found many pages with only one incoming link.
**Impact:** Sitemap discovery was available, but internal PageRank and reliable crawler paths were weak for hundreds of train pages.
**Fix:** Ten static browse pages now link all 550 rated trains exactly once, with previous/next navigation, self-canonicals and sitemap inclusion. The main directory links the browse series.
**Confidence:** High.

### P1 — Search-intent coverage was too narrow

**Finding:** The homepage tried to explain the product, RailMadad, PNR lookup and train ratings at once. The only supporting guide was a short comparison page.
**Evidence:** Search results show distinct intents around “dirty train toilet complaint,” “RailMadad 139,” “train cleanliness rating,” and “PNR train coach.”
**Impact:** RailHygiene lacked a focused landing page for each legitimate user need and could not demonstrate topical depth.
**Fix:** Added focused guides:

- `/indian-railways-coach-cleanliness.html`
- `/how-to-report-train-cleanliness.html`
- `/pnr-train-cleanliness.html`
- expanded `/railmadad-vs-railhygiene.html`

Each page is 480–615 parsed words, has a unique title/H1/description/canonical, valid Article schema, internal links, source-backed claims and a contextual app CTA.
**Confidence:** High.

### P1 — Trust and methodology were not explicit enough

**Finding:** Train pages displayed aggregates without one canonical explanation of collection, calculation, automation, limitations and correction standards.
**Impact:** Users and search systems could misunderstand one-report pages as representative, and the independent relationship to railway services needed stronger documentation.
**Fix:** Added `/methodology.html`, including category definitions, sample-size guidance, journey linkage, public-source limitations, automatic refresh, index policy, correction principles and independence disclosure. The page names Bareslate Studio as the maintainer, consistent with existing application schema.
**Confidence:** High.

### P1 — Homepage JSON-LD used a top-level graph that failed the local validator

**Finding:** The homepage schema validator warned that the top-level JSON-LD object had no `@type`.
**Evidence:** The prior block used `@graph` containing WebSite and MobileApplication nodes.
**Impact:** The graph was valid JSON-LD in principle, but tooling and downstream parsers handled it inconsistently.
**Fix:** Split WebSite, Organization and MobileApplication into three complete JSON-LD blocks. Added a functional WebSite SearchAction. All tested schema blocks now pass the bundled validator.
**Confidence:** High.

### P1 — Dashboard was effectively thin HTML

**Finding:** The dashboard wrapper exposed only about 16 crawlable words because the useful interface lived in an iframe.
**Impact:** The page had little independent value for search engines and weak context for users before the embed loaded.
**Fix:** Rebuilt the wrapper with explanation, methodology guidance, direct fallback, complaint distinction, search CTA, app CTA and WebPage/Dataset context.
**Confidence:** High.

### P2 — Query URLs did not drive the train search

**Finding:** `/trains/` was a client-side input without a shareable query state.
**Impact:** WebSite SearchAction could not truthfully point to a functional URL template.
**Fix:** `/trains/?q=16526` now pre-fills the search and returns train 16526. Browser verification passed.
**Confidence:** High.

### P2 — AI discovery summary was incomplete

**Finding:** `llms.txt` existed and scored well, but `llms-full.txt` was absent.
**Impact:** Machine consumers lacked one concise statement of service purpose, limitations, canonical resources and rating interpretation.
**Fix:** Expanded `llms.txt` and added `llms-full.txt`. The wildcard robots rule already permits discovery crawlers.
**Confidence:** Medium; these files aid clarity but do not guarantee citations.

### P2 — Social metadata lacked locale

**Finding:** The homepage social-meta audit scored 77/100, with optional Open Graph locale absent.
**Fix:** Added `og:locale=en_IN` to the homepage, train templates, guides, directory and dashboard. Twitter account tags were not added because no verified account identifier was provided.
**Confidence:** High.

## Validation evidence

- Static generator: 4,157 train pages generated successfully.
- Indexing policy: 550 feedback-rich train URLs in `sitemap-trains.xml`; empty pages remain `noindex,follow`.
- Expanded quality gate: validated all 4,157 train pages, all 550 sitemap URLs, all rated-train browse links, required static pages, JSON-LD parsing, canonicals and Android App Links.
- Browser checks:
  - `/trains/?q=16526` returned `16526 · KANYAKUMARI EXP`.
  - representative rated train page contained 339 visible words after the fix.
  - every checked page had no horizontal overflow at the browser viewport.
  - final browse page contained 55 train links and over 500 visible words.
- Broken-link baseline before implementation: zero broken links among checked homepage links; one normal RailMadad redirect.
- `llms.txt` baseline quality: 90/100; expanded content and `llms-full.txt` added.
- PageSpeed API: rate-limited during the audit, so no synthetic performance claim is made.

## Remaining limitations and external dependencies

1. **Google Search Console data is not available in the repository.** Query, country, device, indexing and conversion data are needed to prioritise the next content iteration with evidence.
2. **Backlinks and independent mentions are still limited.** On-site work cannot manufacture authority safely.
3. **Most rated trains still have only one report.** The wording now communicates this, but acquiring more verified passenger feedback remains the strongest product-and-SEO improvement.
4. **GitHub Pages controls response headers.** The security-header audit scored 25/100 because six optional headers are unavailable at source level. This is a trust/security limitation, not a direct reason to migrate hosting today.
5. **Rankings and indexing require time.** Submitting sitemaps and requesting indexing can accelerate discovery but cannot force ranking.

## Data requested for the next optimization cycle

Export or grant access to these Search Console reports after the new pages have collected data:

- last 28 and 90 days of Queries and Pages, split by mobile;
- Indexing → Pages reasons;
- Sitemaps status;
- Core Web Vitals;
- search appearance and country distribution.

Also retain Google Play acquisition reports for the website campaign referrers. Together, these datasets will show which organic searches produce installs rather than only clicks.
