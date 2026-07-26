# RailHygiene Website SEO Audit

Audit date: 2026-07-26
Scope: pre-push full-site review of `https://railhygiene.in/` and the local static website source.

## A) Audit Summary

The live site had solid basic on-page SEO but lacked crawl-discovery files, social metadata, eligible app schema, secondary-page canonicals, descriptive screenshot metadata, and layout dimensions. The local pre-push version now addresses those findings.

Post-fix score: **91/100**
Score confidence: **Medium** because Google PageSpeed Insights rate-limited the mobile lab test and no Search Console or CrUX data was provided.

### Page Score Card

| Area | Score | Evidence summary |
|---|---:|---|
| On-page SEO | 100/100 | Five positive signals: focused title, descriptive meta description, one H1, self-canonical, and descriptive internal links. No confirmed deficit. |
| Content quality | 75/100 | Four positive signals: 501 parsed words, task-focused copy, visible FAQs, and clear RailMadad/139 guidance. One warning: live readability was 41.3 Flesch / grade 10.9. Base 80 minus one warning (5) = 75. |
| Technical SEO | 78/100 | Five positive signals: HTTPS, canonical, social metadata, crawler files, and healthy checked links. One warning: the live GitHub Pages response lacked six security headers. Base 83 minus one warning (5) = 78. |
| Structured data | 100/100 | Two positive signals: valid JSON-LD for `WebSite` and `MobileApplication`. No confirmed deficit after removing restricted FAQ schema. |
| Images | 100/100 | Four positive signals: descriptive alt text, explicit dimensions, each audited image below 200 KB, and lazy loading for non-initial carousel images. No confirmed deficit. |

Overall score is the rounded mean of the five category scores. Scores are directional, not ranking predictions.

### Top issues found

1. The live site returned 404 for both `robots.txt` and `llms.txt`, and no sitemap was declared.
2. The homepage had no Open Graph or Twitter metadata and used restricted `FAQPage` schema.
3. Eleven screenshots used generic alt text and all 14 homepage images lacked explicit dimensions.

### Top opportunities implemented

1. Added `robots.txt`, `sitemap.xml`, and `llms.txt`.
2. Added share metadata and replaced FAQ schema with `WebSite` plus `MobileApplication` JSON-LD.
3. Added descriptive screenshot alt text, intrinsic dimensions, decoding hints, and below-fold lazy loading.

## B) Findings Table

| Area | Severity | Confidence | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| Crawlability | Warning | Confirmed | Crawl-discovery files were absent on the live site. | Audit scripts returned 404 for `/robots.txt` and `/llms.txt`; no sitemap was declared. | Added `robots.txt`, `sitemap.xml`, and `llms.txt`. |
| Structured data | Warning | Confirmed | The live homepage used restricted FAQ rich-result markup. | Parsed JSON-LD reported `FAQPage` with status `restricted`. | Kept visible FAQs but replaced their schema with eligible `WebSite` and `MobileApplication` markup. |
| Social metadata | Warning | Confirmed | Shared links had no defined social preview. | Live parse returned empty `open_graph` and `twitter_card` objects. | Added Open Graph and Twitter summary metadata to the homepage and comparison page. |
| Duplicate control | Warning | Confirmed | `indextest.html` duplicated the homepage without canonical or robots controls. | Local source used the homepage title and assets on a separate public URL. | Added `noindex,follow` and canonicalized it to the homepage. |
| Canonicals | Warning | Confirmed | Secondary pages lacked canonical tags. | Source inspection found a canonical only on the homepage. | Added self-canonicals to the comparison, dashboard, privacy, terms, and deletion pages. |
| Images | Warning | Confirmed | Screenshot alt text and dimensions were not useful to crawlers or assistive technology. | Live parse showed `Screenshot 1` through `Screenshot 11`; all image dimensions were null. | Added accurate alt text, width/height, async decoding, and lazy loading where appropriate. |
| Links | Pass | Confirmed | Homepage links were healthy. | Live broken-link audit checked six URLs: six healthy, zero broken, zero redirected. | No corrective action required. |
| Asset weight | Pass | Confirmed | Audited raster assets were within the 200 KB warning threshold. | Largest asset was `phone-frame.png` at 168,163 bytes; screenshots ranged from 47,544 to 72,316 bytes. | Preserve this budget when replacing assets. |
| Readability | Info | Confirmed | Homepage copy is moderately difficult but acceptable for the subject. | Live readability: Flesch 41.3, grade 10.9, 21.4% complex words. | Simplify future copy where it does not reduce accuracy; not a launch blocker. |
| Security headers | Warning | Confirmed | Live responses lacked common browser security headers. | Header audit score 25; HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, and Permissions-Policy were absent. | Configure headers through a host/CDN that supports them; GitHub Pages source files cannot set response headers. |
| Core Web Vitals | Info | Unknown | Mobile lab and field performance could not be verified. | PageSpeed API returned a rate-limit error; no field data was available. | Re-run PageSpeed after deployment or inspect Search Console Core Web Vitals. |

## C) Prioritized Action Plan

1. **Completed quick wins:** crawler files, canonical tags, social metadata, eligible schema, image metadata, and duplicate-page control.
2. **After deployment:** submit `https://railhygiene.in/sitemap.xml` in Google Search Console and request re-indexing of the homepage and comparison page.
3. **After deployment:** validate `MobileApplication` JSON-LD and the Android asset-links URL against the public domain.
4. **Strategic:** publish useful, original train-hygiene content only when supported by real aggregated app data; avoid mass-generated thin pages.
5. **Hosting maintenance:** consider a CDN/host capable of response security headers if stronger browser hardening becomes a priority.

## D) Unknowns and Follow-ups

- Google Search Console indexing, query, CTR, and sitemap data were not available.
- Google Play acquisition and retention data were not available to correlate website visits with installs or active users.
- PageSpeed mobile lab data was rate-limited, and CrUX field data was unavailable.
- Post-deployment live validation remains necessary because the audit fixes currently exist only in the local repository.
