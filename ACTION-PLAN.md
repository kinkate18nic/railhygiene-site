# RailHygiene Website SEO Action Plan

## Completed before push

- [x] Focus the homepage title on Indian Railways coach cleanliness.
- [x] Add Open Graph and Twitter share metadata.
- [x] Replace restricted FAQ schema with `WebSite` and `MobileApplication` JSON-LD.
- [x] Add descriptive screenshot alt text and explicit image dimensions.
- [x] Lazy-load non-initial carousel screenshots.
- [x] Add self-canonical tags to secondary pages.
- [x] Add `noindex,follow` and a homepage canonical to the duplicate test page.
- [x] Add `robots.txt` with a sitemap declaration.
- [x] Add `sitemap.xml` for the public indexable pages.
- [x] Add `llms.txt` with an accurate app summary and key links.
- [x] Use the clean root URL for homepage navigation.

## Required immediately after deployment

- [ ] Verify `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/.well-known/assetlinks.json` return HTTP 200 publicly.
- [ ] Validate the homepage JSON-LD with a public structured-data validator.
- [ ] Submit `https://railhygiene.in/sitemap.xml` in Google Search Console.
- [ ] Request indexing for `/` and `/railmadad-vs-railhygiene.html`.
- [ ] Re-run mobile PageSpeed after the API rate limit clears.

## Strategic content work

- [ ] Use Search Console queries to choose content topics instead of guessing keywords.
- [ ] Publish data-backed coach-cleanliness insights only when there is enough anonymous sample data.
- [ ] Track website-to-Play-Store clicks and compare campaigns using the added Play referrer parameters.
- [ ] Review title/description CTR after at least 28 days of meaningful Search Console data.

## Not a source-level fix

- [ ] If required, move behind a CDN or host that supports HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. GitHub Pages does not expose per-site response-header configuration through these static files.
