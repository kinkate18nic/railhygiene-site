import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const TRAIN_ROOT = path.join(ROOT, "train");
const TRAINS_DIRECTORY = path.join(ROOT, "trains");
const REPORTS_DIRECTORY = path.join(TRAINS_DIRECTORY, "reports");
const TRAIN_CACHE = path.join(DATA_DIR, "train-directory.json");
const SUMMARY_CACHE = path.join(DATA_DIR, "dashboard-summary.json");

const TRAIN_LIST_URL =
  process.env.TRAIN_LIST_URL ||
  "https://gist.githubusercontent.com/kinkate18nic/f0ca9c369833451bb2940bcafe6dfe21/raw/train_list.json";
const DASHBOARD_SUMMARY_URL =
  process.env.DASHBOARD_SUMMARY_URL ||
  "https://firestore.googleapis.com/v1/projects/railhygienemvp/databases/(default)/documents/dashboard/summary";
const SITE_URL = "https://railhygiene.in";
const GA4_TAG = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6328SPQDYL"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-6328SPQDYL');
  </script>
  <script defer src="/assets/analytics-events.js"></script>`;
const MIN_TRAIN_COUNT = 3_000;
const MAX_TRAIN_COUNT = 10_000;
const offline = process.argv.includes("--offline");

const STATIC_SITEMAP_URLS = [
  ["", "index.html"],
  ["indian-railways-coach-cleanliness.html", "indian-railways-coach-cleanliness.html"],
  ["how-to-report-train-cleanliness.html", "how-to-report-train-cleanliness.html"],
  ["pnr-train-cleanliness.html", "pnr-train-cleanliness.html"],
  ["railmadad-vs-railhygiene.html", "railmadad-vs-railhygiene.html"],
  ["methodology.html", "methodology.html"],
  ["dashboard.html", "dashboard.html"],
  ["privacy.html", "privacy.html"],
  ["terms.html", "terms.html"],
  ["trains/", "trains/index.html"],
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function cleanGeneratedHtml(value) {
  return value.replace(/[ \t]+$/gm, "");
}

function clampRating(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(5, Math.max(0, numeric)) : 0;
}

function formatRating(value) {
  return clampRating(value).toFixed(1);
}

function hasReportedRating(stats, component, value) {
  const count = stats?.ratingCounts?.[component];
  if (typeof count === "number") return count > 0;
  return clampRating(value) > 0;
}

function formatScopedRating(stats, component, value) {
  return hasReportedRating(stats, component, value)
    ? formatRating(value)
    : "N/A";
}

function truncate(value, maxLength) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeTrain(raw) {
  return {
    number: String(raw?.number ?? "").trim(),
    name: String(raw?.name ?? "").trim(),
    src: String(raw?.src ?? "").trim(),
    dest: String(raw?.dest ?? "").trim(),
  };
}

function validateTrains(rawTrains) {
  if (!Array.isArray(rawTrains)) {
    throw new Error("Train directory must be a JSON array.");
  }

  const unique = new Map();
  for (const raw of rawTrains) {
    const train = normalizeTrain(raw);
    if (!/^\d{5}$/.test(train.number)) {
      throw new Error(`Invalid train number: ${train.number || "(empty)"}`);
    }
    if (!train.name || !train.src || !train.dest) {
      throw new Error(`Train ${train.number} is missing name, source, or destination.`);
    }
    if (unique.has(train.number)) {
      throw new Error(`Duplicate train number: ${train.number}`);
    }
    unique.set(train.number, train);
  }

  if (unique.size < MIN_TRAIN_COUNT || unique.size > MAX_TRAIN_COUNT) {
    throw new Error(
      `Train directory has ${unique.size} records; expected ${MIN_TRAIN_COUNT}-${MAX_TRAIN_COUNT}.`,
    );
  }

  return [...unique.values()].sort((a, b) => a.number.localeCompare(b.number));
}

async function fetchJson(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "RailHygiene-GitHub-Pages-Generator/1.0",
        },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }
  }
  throw new Error(`Unable to download ${label}: ${lastError?.message || lastError}`);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadTrains() {
  if (!offline) {
    try {
      const remote = await fetchJson(TRAIN_LIST_URL, "train directory");
      const trains = validateTrains(remote);
      await writeJson(TRAIN_CACHE, trains);
      console.log(`Downloaded ${trains.length} trains from the maintained Gist.`);
      return trains;
    } catch (error) {
      console.warn(`${error.message} Falling back to the committed snapshot.`);
    }
  }

  if (!existsSync(TRAIN_CACHE)) {
    throw new Error("No cached train directory is available.");
  }
  const trains = validateTrains(await readJson(TRAIN_CACHE));
  console.log(`Loaded ${trains.length} trains from the committed snapshot.`);
  return trains;
}

function normalizeFirestoreSummary(document) {
  const fields = document?.fields;
  const rawStats = fields?.statsByTrain?.stringValue;
  if (!rawStats) {
    throw new Error("Firestore dashboard summary does not contain statsByTrain.");
  }

  const statsByTrain = JSON.parse(rawStats);
  if (!statsByTrain || typeof statsByTrain !== "object" || Array.isArray(statsByTrain)) {
    throw new Error("Firestore statsByTrain is not an object.");
  }

  return {
    lastUpdated:
      fields?.lastUpdated?.timestampValue ||
      document.updateTime ||
      new Date(0).toISOString(),
    statsByTrain,
  };
}

function validateCachedSummary(summary) {
  if (
    !summary ||
    typeof summary !== "object" ||
    !summary.statsByTrain ||
    typeof summary.statsByTrain !== "object" ||
    Array.isArray(summary.statsByTrain)
  ) {
    throw new Error("Cached dashboard summary is invalid.");
  }
  return summary;
}

async function loadSummary() {
  if (!offline) {
    try {
      const document = await fetchJson(DASHBOARD_SUMMARY_URL, "dashboard summary");
      const summary = normalizeFirestoreSummary(document);
      await writeJson(SUMMARY_CACHE, summary);
      console.log(
        `Downloaded aggregated ratings for ${Object.keys(summary.statsByTrain).length} trains.`,
      );
      return summary;
    } catch (error) {
      console.warn(`${error.message} Falling back to the committed snapshot.`);
    }
  }

  if (!existsSync(SUMMARY_CACHE)) {
    throw new Error("No cached dashboard summary is available.");
  }
  const summary = validateCachedSummary(await readJson(SUMMARY_CACHE));
  console.log(
    `Loaded aggregated ratings for ${Object.keys(summary.statsByTrain).length} trains from cache.`,
  );
  return summary;
}

function latestFeedbackDate(stats, fallback) {
  const dates = Object.keys(stats?.feedbacksByDate || {}).filter((date) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date),
  );
  return dates.sort().at(-1) || fallback.slice(0, 10);
}

function coachEntries(stats) {
  return Object.entries(stats?.coachStats || {}).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function ratingMeter(label, value, stats, component) {
  const hasRating = hasReportedRating(stats, component, value);
  const rating = hasRating ? `${formatRating(value)}/5` : "Not rated";
  const percentage = hasRating ? `${(clampRating(value) / 5) * 100}%` : "0%";
  return `
    <div class="rating-row">
      <span>${escapeHtml(label)}</span>
      <div class="meter" aria-hidden="true"><span style="width:${percentage}"></span></div>
      <strong>${rating}</strong>
    </div>`;
}

function ratingLabel(value) {
  const rating = clampRating(value);
  if (rating >= 4) return "rated highly";
  if (rating >= 3) return "rated mixed to good";
  if (rating > 0) return "rated below average";
  return "not yet rated";
}

function renderInterpretation(train, stats, feedbackCount, lastReport) {
  if (!feedbackCount) return "";
  const sampleNote =
    feedbackCount === 1
      ? "This result comes from one passenger report, so treat it as an early signal rather than a reliable prediction."
      : feedbackCount < 5
        ? `This is still a small sample of ${feedbackCount} reports. Conditions can differ by coach, date and cleaning cycle.`
        : `This summary combines ${feedbackCount} passenger reports, but conditions can still vary by coach, date and cleaning cycle.`;
  return `
    <section class="panel" aria-labelledby="interpretation-heading">
      <p class="eyebrow">What the data means</p>
      <h2 id="interpretation-heading">How to read these ${escapeHtml(train.number)} ratings</h2>
      <p>Passengers have ${ratingLabel(stats.avgGeneralRating)} the overall coach condition, while the floor is ${ratingLabel(stats.avgFloorRating)} and the toilets are ${ratingLabel(stats.avgToiletRating)}. These are historical community observations for ${escapeHtml(train.name)} between ${escapeHtml(train.src)} and ${escapeHtml(train.dest)}; they are not a live inspection or a guarantee of today’s condition.</p>
      <p><strong>Sample-size note:</strong> ${sampleNote} The latest journey represented in this snapshot is dated <time datetime="${lastReport}">${escapeHtml(lastReport)}</time>.</p>
      <p>Use this page to understand past passenger experience. If you are currently travelling and need cleaning or official assistance, use <a href="/how-to-report-train-cleanliness.html">RailMadad or railway helpline 139</a>. After the journey, adding an anonymous rating in RailHygiene makes this estimate more useful for the next passenger.</p>
      <p>The four category scores answer different questions: overall coach covers the general condition, floor focuses on the coach floor, toilets cover the reported washroom areas, and dustbins reflect availability and usability where passengers supplied that detail. Compare categories instead of treating one average as the complete story.</p>
      <p><a href="/methodology.html">Read how RailHygiene collects, aggregates and limits its cleanliness data.</a></p>
    </section>`;
}

function renderCoachTable(stats) {
  const coaches = coachEntries(stats);
  if (!coaches.length) return "";

  const rows = coaches
    .map(
      ([coach, values]) => `
        <tr>
          <th scope="row">${escapeHtml(coach)}</th>
          <td>${Number(values.feedbackCount || 0)}</td>
          <td>${formatScopedRating(values, "generalCoach", values.avgGeneralRating)}</td>
          <td>${formatScopedRating(values, "coachFloor", values.avgFloorRating)}</td>
          <td>${formatScopedRating(values, "toilet", values.avgToiletRating)}</td>
        </tr>`,
    )
    .join("");

  return `
    <section class="panel" aria-labelledby="coach-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Coach breakdown</p>
          <h2 id="coach-heading">Reported coach cleanliness</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Reports</th>
              <th>Overall</th>
              <th>Floor</th>
              <th>Toilets</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function renderRelatedTrains(related) {
  if (!related.length) return "";
  return `
    <section class="panel related" aria-labelledby="related-heading">
      <p class="eyebrow">Keep exploring</p>
      <h2 id="related-heading">Related trains</h2>
      <div class="related-grid">
        ${related
          .map(
            (train) => `
              <a href="/train/${train.number}/">
                <strong>${escapeHtml(train.number)} · ${escapeHtml(train.name)}</strong>
                <span>${escapeHtml(train.src)} → ${escapeHtml(train.dest)}</span>
              </a>`,
          )
          .join("")}
      </div>
    </section>`;
}

function renderTrainPage(train, stats, related, summaryLastUpdated) {
  const feedbackCount = Number(stats?.feedbackCount || 0);
  const hasFeedback = feedbackCount > 0;
  const canonical = `${SITE_URL}/train/${train.number}/`;
  const title = truncate(
    `${train.number} ${train.name} Cleanliness Ratings | RailHygiene`,
    60,
  );
  const description = truncate(
    hasFeedback
      ? `Check ${feedbackCount} community cleanliness ${
          feedbackCount === 1 ? "report" : "reports"
        } for train ${train.number} ${train.name}, from ${train.src} to ${train.dest}, including coach, floor and toilet ratings.`
      : `Find route details and contribute the first community coach cleanliness report for train ${train.number} ${train.name}, travelling from ${train.src} to ${train.dest}.`,
    160,
  );
  const lastReport = hasFeedback
    ? latestFeedbackDate(stats, summaryLastUpdated)
    : null;
  const robots = hasFeedback ? "index,follow" : "noindex,follow";

  const webPageSchema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "RailHygiene",
          url: `${SITE_URL}/`,
        },
        about: {
          "@type": "TrainTrip",
          trainNumber: train.number,
          trainName: train.name,
          departureStation: { "@type": "TrainStation", name: train.src },
          arrivalStation: { "@type": "TrainStation", name: train.dest },
        },
      };
  const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Trains",
            item: `${SITE_URL}/trains/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `Train ${train.number}`,
            item: canonical,
          },
        ],
      };

  const dataPanel = hasFeedback
    ? `
      <section class="panel ratings" aria-labelledby="ratings-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Community snapshot</p>
            <h2 id="ratings-heading">Cleanliness ratings</h2>
          </div>
          <div class="report-count">
            <strong>${feedbackCount}</strong>
            <span>${feedbackCount === 1 ? "report" : "reports"}</span>
          </div>
        </div>
        ${ratingMeter("Overall coach", stats.avgGeneralRating, stats, "generalCoach")}
        ${ratingMeter("Coach floor", stats.avgFloorRating, stats, "coachFloor")}
        ${ratingMeter("Toilets", stats.avgToiletRating, stats, "toilet")}
        ${ratingMeter("Dustbins", stats.avgDustbinRating, stats, "dustbin")}
        <p class="updated">Most recent recorded journey: <time datetime="${lastReport}">${escapeHtml(
          lastReport,
        )}</time></p>
      </section>
      ${renderCoachTable(stats)}`
    : `
      <section class="panel empty" aria-labelledby="empty-heading">
        <span class="empty-icon" aria-hidden="true">✦</span>
        <p class="eyebrow">Community data</p>
        <h2 id="empty-heading">No cleanliness reports yet</h2>
        <p>RailHygiene does not have a passenger report for this train yet. If you travel on it, your anonymous coach feedback can help the next passenger know what to expect.</p>
      </section>`;

  return `<!doctype html>
<html lang="en">
<head>
${GA4_TAG}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_IN">
  <meta property="og:site_name" content="RailHygiene">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/assets/android-chrome-512x512.png">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/assets/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">${safeJson(webPageSchema)}</script>
  <script type="application/ld+json">${safeJson(breadcrumbSchema)}</script>
  <style>
    :root{color-scheme:light;--ink:#102a43;--muted:#52677b;--line:#d8e2ec;--blue:#0067a8;--blue-dark:#004f82;--sky:#e8f4ff;--surface:#fff;--bg:#f6f9fc;--gold:#f5b700;font-family:"Outfit",system-ui,sans-serif}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}a{color:inherit}.site-header{background:rgba(255,255,255,.94);border-bottom:1px solid var(--line)}.nav{width:min(1120px,calc(100% - 32px));margin:auto;min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{min-height:44px;display:flex;align-items:center;gap:12px;text-decoration:none;font-size:1.2rem;font-weight:700}.brand img{width:40px;height:40px;border-radius:10px}.nav-links{display:flex;gap:18px}.nav-links a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none;color:var(--muted);font-weight:600}.wrap{width:min(980px,calc(100% - 32px));margin:auto}.crumbs{padding:12px 0 4px;color:var(--muted);font-size:.92rem}.crumbs a{min-width:44px;min-height:44px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.hero{position:relative;overflow:hidden;padding:42px;border-radius:28px;background:linear-gradient(135deg,#004f82,#0879bb);color:#fff;box-shadow:0 22px 55px rgba(0,79,130,.18)}.hero:after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-90px;top:-110px;background:rgba(255,255,255,.1)}.eyebrow{margin:0 0 8px;text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;font-weight:700;color:#3f6580}.hero .eyebrow{color:#fff}.hero h1{position:relative;margin:0;font-size:clamp(2rem,6vw,3.5rem);line-height:1.05;max-width:760px}.route{position:relative;margin:18px 0 0;font-size:1.2rem;color:#fff}.route span{padding:0 8px}.actions{position:relative;display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.button{min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;border-radius:13px;text-decoration:none;font-weight:700}.button.primary{background:#fff;color:var(--blue-dark)}.button.secondary{border:1px solid rgba(255,255,255,.65);color:#fff}.notice{margin:18px 0 0;color:#fff;font-size:.9rem}.grid{min-width:0;display:grid;gap:22px;margin:24px 0}.panel{min-width:0;max-width:100%;padding:28px;border-radius:22px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 30px rgba(16,42,67,.06)}.section-heading{display:flex;align-items:start;justify-content:space-between;gap:20px}.panel h2{margin:0 0 18px;font-size:1.55rem}.report-count{min-width:86px;padding:10px 14px;border-radius:16px;background:var(--sky);text-align:center}.report-count strong,.report-count span{display:block}.report-count strong{font-size:1.45rem;color:var(--blue)}.rating-row{display:grid;grid-template-columns:minmax(110px,1fr) minmax(120px,2fr) 56px;align-items:center;gap:14px;padding:12px 0;border-top:1px solid #edf2f7}.meter{height:9px;border-radius:999px;background:#e7edf3;overflow:hidden}.meter span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--gold),#ffd866)}.rating-row strong{text-align:right}.updated{margin:16px 0 0;color:var(--muted);font-size:.9rem}.table-wrap{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch}table{width:100%;border-collapse:collapse;min-width:620px}th,td{padding:13px 12px;border-bottom:1px solid #e8eef3;text-align:right}th:first-child,td:first-child{text-align:left}thead th{font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.empty{text-align:center;padding:44px 28px}.empty-icon{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 18px;border-radius:18px;background:var(--sky);color:var(--blue);font-size:1.7rem}.empty p:last-child{max-width:620px;margin:0 auto;color:var(--muted);line-height:1.65}.related-grid{min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.related-grid a{display:block;min-height:44px;padding:16px;border:1px solid var(--line);border-radius:15px;text-decoration:none}.related-grid a:hover{border-color:#79b7dd;background:#f7fbff}.related-grid strong,.related-grid span{display:block}.related-grid span{margin-top:5px;color:var(--muted);font-size:.9rem}.disclaimer{padding:22px;border-radius:18px;background:#fff8e7;border:1px solid #f0d899;color:#644d12;line-height:1.6}.site-footer{margin-top:40px;padding:18px 16px;text-align:center;color:var(--muted);border-top:1px solid var(--line);background:#fff}.site-footer a{min-width:44px;min-height:44px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;margin:0 4px}@media(max-width:680px){.nav-links{display:none}.hero{padding:30px 24px;border-radius:22px}.panel{padding:22px}.rating-row{grid-template-columns:minmax(0,1fr) 50px}.meter{grid-column:1/-1;grid-row:2}.related-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="site-header">
    <nav class="nav" aria-label="Primary navigation">
      <a class="brand" href="/"><img src="/assets/logo.png" alt="" width="40" height="40">RailHygiene</a>
      <div class="nav-links"><a href="/trains/">Find a train</a><a href="/dashboard.html">Live data</a></div>
    </nav>
  </header>
  <main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/trains/">Trains</a> / ${escapeHtml(
      train.number,
    )}</nav>
    <section class="hero">
      <p class="eyebrow">Indian Railways cleanliness reports</p>
      <h1>${escapeHtml(train.number)} · ${escapeHtml(train.name)}</h1>
      <p class="route">${escapeHtml(train.src)} <span aria-hidden="true">→</span> ${escapeHtml(train.dest)}</p>
      <div class="actions">
        <a class="button primary" href="/open?train=${train.number}" data-ga-event="open_app_click" data-ga-location="train_page_hero" data-train-number="${train.number}">Open in RailHygiene</a>
        <a class="button secondary" href="/trains/">Search another train</a>
      </div>
      <p class="notice">Community-submitted historical data. RailHygiene is independent and is not affiliated with Indian Railways or IRCTC.</p>
    </section>
    <div class="grid">
      ${dataPanel}
      ${renderInterpretation(train, stats, feedbackCount, lastReport)}
      ${renderRelatedTrains(related)}
      <aside class="disclaimer"><strong>Need cleaning help now?</strong> Use the official <a href="https://railmadad.indianrailways.gov.in/" rel="nofollow noopener" data-ga-event="railmadad_click" data-ga-location="train_page_help" data-train-number="${train.number}">RailMadad service</a> or call railway helpline 139. RailHygiene records anonymous historical feedback for future passengers and does not resolve complaints.</aside>
    </div>
  </main>
  <footer class="site-footer">© RailHygiene · <a href="/methodology.html">Methodology</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></footer>
</body>
</html>`;
}

function renderDirectoryPage(trains, feedbackTrainNumbers, lastUpdated) {
  const featured = trains
    .filter((train) => feedbackTrainNumbers.has(train.number))
    .slice(0, 100);
  const featuredMarkup = featured
    .map(
      (train) => `
        <li>
          <a href="/train/${train.number}/" data-ga-event="select_content" data-ga-location="featured_train_results" data-ga-content-type="train" data-ga-content-id="train_${train.number}" data-train-number="${train.number}">
            <strong>${escapeHtml(train.number)} · ${escapeHtml(train.name)}</strong>
            <span>${escapeHtml(train.src)} → ${escapeHtml(train.dest)}</span>
          </a>
        </li>`,
    )
    .join("");
  const directorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/trains/#webpage`,
    url: `${SITE_URL}/trains/`,
    name: "Search Indian Train Cleanliness Ratings",
    description:
      "Search Indian Railways services and browse community-reported coach, floor, toilet and dustbin cleanliness information.",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return `<!doctype html>
<html lang="en">
<head>
${GA4_TAG}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Search Indian Train Cleanliness Ratings | RailHygiene</title>
  <meta name="description" content="Search Indian Railways trains by number or name and view community-reported coach, floor, toilet and dustbin cleanliness information on RailHygiene.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}/trains/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_IN">
  <meta property="og:site_name" content="RailHygiene">
  <meta property="og:title" content="Search Indian Train Cleanliness Ratings">
  <meta property="og:description" content="Find community cleanliness ratings for Indian Railways trains and coaches.">
  <meta property="og:url" content="${SITE_URL}/trains/">
  <meta property="og:image" content="${SITE_URL}/assets/android-chrome-512x512.png">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/assets/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">${safeJson(directorySchema)}</script>
  <style>
    :root{font-family:"Outfit",system-ui,sans-serif;color:#102a43;background:#f6f9fc;--blue:#0067a8;--line:#d8e2ec;--muted:#52677b}*{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid var(--line)}nav,main{width:min(980px,calc(100% - 32px));margin:auto}.top{min-height:72px;display:flex;align-items:center;justify-content:space-between}.brand{min-height:44px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;font-size:1.2rem;font-weight:700}.brand img{width:40px;height:40px;border-radius:10px}.back{min-width:44px;min-height:44px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;color:var(--blue);font-weight:600;text-decoration:none}.hero{padding:64px 0 30px}.hero h1{margin:0;font-size:clamp(2.2rem,7vw,4rem);line-height:1}.hero p{max-width:680px;color:var(--muted);font-size:1.08rem;line-height:1.65}.search{position:relative;margin:24px 0}.search label{display:block;margin-bottom:8px;font-weight:600}.search input{width:100%;min-height:60px;padding:0 20px;border:2px solid #9db2c5;border-radius:16px;background:#fff;font:inherit;font-size:1.08rem}.search input:focus{outline:3px solid #bde3ff;border-color:var(--blue)}.status{min-height:24px;color:var(--muted)}ul{list-style:none;margin:20px 0 60px;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}li a{display:block;min-height:44px;padding:18px;border:1px solid var(--line);border-radius:16px;background:#fff;color:inherit;text-decoration:none}li a:hover{border-color:#67add7;box-shadow:0 8px 20px rgba(16,42,67,.07)}a:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}li strong,li span{display:block}li span{margin-top:6px;color:var(--muted);font-size:.92rem}.empty{grid-column:1/-1;padding:30px;text-align:center;color:var(--muted)}footer{padding:28px;text-align:center;background:#fff;border-top:1px solid var(--line);color:var(--muted)}@media(max-width:650px){ul{grid-template-columns:1fr}.hero{padding-top:44px}}
  </style>
</head>
<body>
  <header><nav class="top"><a class="brand" href="/"><img src="/assets/logo.png" alt="" width="40" height="40">RailHygiene</a><a class="back" href="/">Home</a></nav></header>
  <main>
    <section class="hero">
      <h1>Find your train</h1>
      <p>Search ${trains.length.toLocaleString("en-IN")} maintained Indian Railways services. Trains with community reports include coach, floor, toilet and dustbin cleanliness details.</p>
      <div class="search"><label for="train-search">Train number or name</label><input id="train-search" type="search" inputmode="search" autocomplete="off" placeholder="Try 16526 or train name"></div>
      <p id="status" class="status" aria-live="polite">Showing trains with available community reports.</p>
      <p><a class="back" href="/trains/reports/1/">Browse every train with a community cleanliness report</a></p>
    </section>
    <ul id="results">${featuredMarkup}</ul>
  </main>
  <footer>Directory data refreshed automatically. Rating snapshot: <time datetime="${escapeHtml(
    lastUpdated,
  )}">${escapeHtml(lastUpdated.slice(0, 10))}</time>.</footer>
  <script>
    const input = document.getElementById("train-search");
    const results = document.getElementById("results");
    const status = document.getElementById("status");
    let trains = [];

    const render = (items) => {
      results.replaceChildren();
      if (!items.length) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "No matching train was found in the maintained directory.";
        results.append(item);
        return;
      }
      for (const train of items.slice(0, 50)) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        const title = document.createElement("strong");
        const route = document.createElement("span");
        link.href = "/train/" + encodeURIComponent(train.number) + "/";
        link.dataset.gaEvent = "select_content";
        link.dataset.gaLocation = "train_search_results";
        link.dataset.gaContentType = "train";
        link.dataset.gaContentId = "train_" + String(train.number || "");
        link.dataset.trainNumber = String(train.number || "");
        title.textContent = String(train.number || "") + " · " + String(train.name || "");
        route.textContent = String(train.src || "") + " → " + String(train.dest || "");
        link.append(title, route);
        item.append(link);
        results.append(item);
      }
    };

    fetch("/data/train-directory.json")
      .then((response) => {
        if (!response.ok) throw new Error("Train directory unavailable");
        return response.json();
      })
      .then((data) => {
        trains = data;
        const query = new URLSearchParams(location.search).get("q");
        if (query) {
          input.value = query;
          input.dispatchEvent(new Event("input"));
        }
      })
      .catch(() => {
        status.textContent = "Live search is temporarily unavailable. Please try again later.";
      });

    let searchTimer;
    let lastTrackedQuery = "";

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      window.clearTimeout(searchTimer);
      if (!query) {
        status.textContent = "Enter a train number or name.";
        results.replaceChildren();
        return;
      }
      const matches = trains.filter((train) =>
        [train.number, train.name, train.src, train.dest]
          .some((value) => String(value).toLowerCase().includes(query))
      );
      status.textContent = matches.length
        ? "Found " + matches.length + " matching " + (matches.length === 1 ? "train." : "trains.")
        : "No matching train found.";
      render(matches);

      searchTimer = window.setTimeout(() => {
        if (query === lastTrackedQuery) return;
        lastTrackedQuery = query;
        window.rhTrack?.("search", {
          search_term: query,
          search_location: "train_directory",
          search_results_count: matches.length,
        });
      }, 800);
    });
  </script>
</body>
</html>`;
}

function renderReportsPage(trains, page, pageCount, lastUpdated) {
  const canonical = `${SITE_URL}/trains/reports/${page}/`;
  const items = trains
    .map(
      (train) => `<li><a href="/train/${train.number}/"><strong>${escapeHtml(
        train.number,
      )} · ${escapeHtml(train.name)}</strong><span>${escapeHtml(
        train.src,
      )} → ${escapeHtml(train.dest)}</span></a></li>`,
    )
    .join("");
  const previous =
    page > 1
      ? `<a rel="prev" href="/trains/reports/${page - 1}/">← Previous</a>`
      : "<span></span>";
  const next =
    page < pageCount
      ? `<a rel="next" href="/trains/reports/${page + 1}/">Next →</a>`
      : "<span></span>";
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: canonical,
    name: `Indian train cleanliness reports – page ${page}`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
  return `<!doctype html>
<html lang="en">
<head>
${GA4_TAG}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Indian Train Cleanliness Reports – Page ${page} | RailHygiene</title>
  <meta name="description" content="Browse Indian Railways trains with community coach, floor and toilet cleanliness reports on RailHygiene. Results page ${page} of ${pageCount}.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  ${page > 1 ? `<link rel="prev" href="${SITE_URL}/trains/reports/${page - 1}/">` : ""}
  ${page < pageCount ? `<link rel="next" href="${SITE_URL}/trains/reports/${page + 1}/">` : ""}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_IN">
  <meta property="og:site_name" content="RailHygiene">
  <meta property="og:title" content="Indian Train Cleanliness Reports – Page ${page}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/assets/android-chrome-512x512.png">
  <link rel="icon" href="/assets/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">${safeJson(schema)}</script>
  <style>
    :root{font-family:"Outfit",system-ui,sans-serif;color:#102a43;background:#f6f9fc;--blue:#0067a8;--line:#d8e2ec;--muted:#52677b}*{box-sizing:border-box}body{margin:0}header,footer{background:#fff;border-bottom:1px solid var(--line)}nav,main{width:min(980px,calc(100% - 32px));margin:auto}.top{min-height:72px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:10px;min-height:44px;color:inherit;text-decoration:none;font-weight:700}.brand img{width:40px;height:40px;border-radius:10px}.top>a:last-child,.pager a{min-height:44px;display:inline-flex;align-items:center;color:var(--blue);font-weight:700}.hero{padding:54px 0 22px}.hero h1{font-size:clamp(2rem,7vw,3.5rem);line-height:1.05;margin:0}.hero p{max-width:720px;color:var(--muted);line-height:1.65}.list{list-style:none;padding:0;margin:18px 0 42px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.list a{display:block;min-height:44px;padding:17px;border:1px solid var(--line);border-radius:15px;background:#fff;color:inherit;text-decoration:none}.list a:hover{border-color:#67add7}.list strong,.list span{display:block}.list span{margin-top:5px;color:var(--muted);font-size:.9rem}.pager{display:flex;justify-content:space-between;align-items:center;margin:0 0 50px}.pager a{padding:0 8px}footer{padding:24px;text-align:center;color:var(--muted);border-top:1px solid var(--line)}@media(max-width:650px){.list{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header><nav class="top"><a class="brand" href="/"><img src="/assets/logo.png" alt="" width="40" height="40">RailHygiene</a><a href="/trains/">Search trains</a></nav></header>
  <main>
    <section class="hero"><p>Community data directory</p><h1>Indian train cleanliness reports</h1><p>Every train listed below has at least one historical passenger cleanliness report. Browse page ${page} of ${pageCount}, or use the <a href="/trains/">train search</a> to find a service by number, name, source or destination.</p></section>
    <ul class="list">${items}</ul>
    <nav class="pager" aria-label="Report directory pages">${previous}<span>Page ${page} of ${pageCount}</span>${next}</nav>
  </main>
  <footer>Community rating snapshot updated <time datetime="${escapeHtml(lastUpdated)}">${escapeHtml(lastUpdated.slice(0, 10))}</time>. <a href="/methodology.html">Methodology</a></footer>
</body>
</html>`;
}

function gitLastModified(relativeFile) {
  try {
    const dirty = execFileSync(
      "git",
      ["status", "--porcelain", "--", relativeFile],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (dirty) return new Date().toISOString().slice(0, 10);

    return execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relativeFile],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}

function renderUrlSet(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    ({ loc, lastmod }) => `  <url>
    <loc>${escapeHtml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

async function generate() {
  const [trains, summary] = await Promise.all([loadTrains(), loadSummary()]);
  const trainNumbers = new Set(trains.map((train) => train.number));
  const feedbackTrainNumbers = new Set(
    Object.entries(summary.statsByTrain)
      .filter(
        ([number, stats]) =>
          trainNumbers.has(number) && Number(stats?.feedbackCount || 0) > 0,
      )
      .map(([number]) => number),
  );

  const bySource = new Map();
  const byDestination = new Map();
  for (const train of trains) {
    const sourceKey = train.src.toLowerCase();
    const destinationKey = train.dest.toLowerCase();
    if (!bySource.has(sourceKey)) bySource.set(sourceKey, []);
    if (!byDestination.has(destinationKey)) byDestination.set(destinationKey, []);
    bySource.get(sourceKey).push(train);
    byDestination.get(destinationKey).push(train);
  }

  await rm(TRAIN_ROOT, { recursive: true, force: true });
  await rm(REPORTS_DIRECTORY, { recursive: true, force: true });
  await mkdir(TRAIN_ROOT, { recursive: true });
  await mkdir(TRAINS_DIRECTORY, { recursive: true });
  await mkdir(REPORTS_DIRECTORY, { recursive: true });

  for (const train of trains) {
    const relatedCandidates = [
      ...(bySource.get(train.src.toLowerCase()) || []),
      ...(byDestination.get(train.dest.toLowerCase()) || []),
    ];
    const related = [
      ...new Map(
        relatedCandidates
          .filter((candidate) => candidate.number !== train.number)
          .sort(
            (a, b) =>
              Number(feedbackTrainNumbers.has(b.number)) -
                Number(feedbackTrainNumbers.has(a.number)) ||
              a.number.localeCompare(b.number),
          )
          .map((candidate) => [candidate.number, candidate]),
      ).values(),
    ].slice(0, 4);

    const directory = path.join(TRAIN_ROOT, train.number);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "index.html"),
      cleanGeneratedHtml(
        renderTrainPage(
          train,
          summary.statsByTrain[train.number],
          related,
          summary.lastUpdated,
        ),
      ),
      "utf8",
    );
  }

  await writeFile(
    path.join(TRAINS_DIRECTORY, "index.html"),
    cleanGeneratedHtml(
      renderDirectoryPage(trains, feedbackTrainNumbers, summary.lastUpdated),
    ),
    "utf8",
  );

  const ratedTrains = trains.filter((train) =>
    feedbackTrainNumbers.has(train.number),
  );
  const reportPageSize = 55;
  const reportPageCount = Math.ceil(ratedTrains.length / reportPageSize);
  for (let page = 1; page <= reportPageCount; page += 1) {
    const directory = path.join(REPORTS_DIRECTORY, String(page));
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "index.html"),
      cleanGeneratedHtml(
        renderReportsPage(
          ratedTrains.slice(
            (page - 1) * reportPageSize,
            page * reportPageSize,
          ),
          page,
          reportPageCount,
          summary.lastUpdated,
        ),
      ),
      "utf8",
    );
  }

  const staticEntries = STATIC_SITEMAP_URLS.map(([urlPath, file]) => ({
    loc: `${SITE_URL}/${urlPath}`,
    lastmod: gitLastModified(file),
  }));
  const trainEntries = trains
    .filter((train) => feedbackTrainNumbers.has(train.number))
    .map((train) => ({
      loc: `${SITE_URL}/train/${train.number}/`,
      lastmod: latestFeedbackDate(
        summary.statsByTrain[train.number],
        summary.lastUpdated,
      ),
    }));
  const reportEntries = Array.from({ length: reportPageCount }, (_, index) => ({
    loc: `${SITE_URL}/trains/reports/${index + 1}/`,
    lastmod: summary.lastUpdated.slice(0, 10),
  }));

  await writeFile(
    path.join(ROOT, "sitemap-pages.xml"),
    renderUrlSet([...staticEntries, ...reportEntries]),
    "utf8",
  );
  await writeFile(
    path.join(ROOT, "sitemap-trains.xml"),
    renderUrlSet(trainEntries),
    "utf8",
  );
  await writeFile(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-pages.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-trains.xml</loc>
  </sitemap>
</sitemapindex>
`,
    "utf8",
  );

  console.log(
    `Generated ${trains.length} train pages; ${trainEntries.length} feedback-rich pages are indexable.`,
  );
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
