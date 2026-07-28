import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trains = JSON.parse(
  await readFile(path.join(ROOT, "data", "train-directory.json"), "utf8"),
);
const summary = JSON.parse(
  await readFile(path.join(ROOT, "data", "dashboard-summary.json"), "utf8"),
);

const feedbackTrainNumbers = new Set(
  Object.entries(summary.statsByTrain)
    .filter(([, stats]) => Number(stats?.feedbackCount || 0) > 0)
    .map(([number]) => number),
);
const validTrainNumbers = new Set(trains.map((train) => train.number));
const expectedIndexable = new Set(
  [...feedbackTrainNumbers].filter((number) => validTrainNumbers.has(number)),
);

for (const train of trains) {
  const file = path.join(ROOT, "train", train.number, "index.html");
  const html = await readFile(file, "utf8");
  const shouldIndex = expectedIndexable.has(train.number);
  const expectedRobots = shouldIndex ? "index,follow" : "noindex,follow";

  if (!html.includes(`<meta name="robots" content="${expectedRobots}">`)) {
    throw new Error(`Train ${train.number} has the wrong robots directive.`);
  }
  if (
    !html.includes(
      `<link rel="canonical" href="https://railhygiene.in/train/${train.number}/">`,
    )
  ) {
    throw new Error(`Train ${train.number} has the wrong canonical URL.`);
  }
  if (!html.includes(`href="/open?train=${train.number}"`)) {
    throw new Error(`Train ${train.number} is missing its Android App Link.`);
  }
  if (!html.includes(`<h1>${train.number} · `)) {
    throw new Error(`Train ${train.number} is missing its unique heading.`);
  }
  if (shouldIndex) {
    const visibleWords = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ").length;
    if (visibleWords < 300) {
      throw new Error(
        `Indexable train ${train.number} has only ${visibleWords} visible words.`,
      );
    }
  }
}

const trainSitemap = await readFile(
  path.join(ROOT, "sitemap-trains.xml"),
  "utf8",
);
const sitemapNumbers = new Set(
  [...trainSitemap.matchAll(/\/train\/(\d{5})\//g)].map((match) => match[1]),
);

if (sitemapNumbers.size !== expectedIndexable.size) {
  throw new Error(
    `Train sitemap has ${sitemapNumbers.size} URLs; expected ${expectedIndexable.size}.`,
  );
}
for (const number of expectedIndexable) {
  if (!sitemapNumbers.has(number)) {
    throw new Error(`Train ${number} is indexable but absent from the sitemap.`);
  }
}

const reportDirectoryNumbers = new Set();
const reportPageSize = 55;
const reportPageCount = Math.ceil(expectedIndexable.size / reportPageSize);
for (let page = 1; page <= reportPageCount; page += 1) {
  const html = await readFile(
    path.join(ROOT, "trains", "reports", String(page), "index.html"),
    "utf8",
  );
  if (
    !html.includes(
      `<link rel="canonical" href="https://railhygiene.in/trains/reports/${page}/">`,
    )
  ) {
    throw new Error(`Report directory page ${page} has the wrong canonical.`);
  }
  for (const match of html.matchAll(/href="\/train\/(\d{5})\//g)) {
    if (reportDirectoryNumbers.has(match[1])) {
      throw new Error(`Train ${match[1]} is duplicated in report directories.`);
    }
    reportDirectoryNumbers.add(match[1]);
  }
}
if (reportDirectoryNumbers.size !== expectedIndexable.size) {
  throw new Error(
    `Report directories link ${reportDirectoryNumbers.size} rated trains; expected ${expectedIndexable.size}.`,
  );
}

const requiredStaticPages = [
  "index.html",
  "indian-railways-coach-cleanliness.html",
  "how-to-report-train-cleanliness.html",
  "pnr-train-cleanliness.html",
  "railmadad-vs-railhygiene.html",
  "methodology.html",
  "dashboard.html",
];
const pagesSitemap = await readFile(path.join(ROOT, "sitemap-pages.xml"), "utf8");
for (const page of requiredStaticPages) {
  const html = await readFile(path.join(ROOT, page), "utf8");
  if (!html.includes("<h1")) {
    throw new Error(`${page} is missing an H1.`);
  }
  for (const match of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    JSON.parse(match[1]);
  }
  const url = page === "index.html" ? "https://railhygiene.in/" : `https://railhygiene.in/${page}`;
  if (!pagesSitemap.includes(`<loc>${url}</loc>`)) {
    throw new Error(`${page} is absent from the page sitemap.`);
  }
}

const assetLinks = JSON.parse(
  await readFile(path.join(ROOT, ".well-known", "assetlinks.json"), "utf8"),
);
const appTarget = assetLinks.find(
  (statement) => statement?.target?.package_name === "com.nish.railhygiene",
);
if (!appTarget?.target?.sha256_cert_fingerprints?.length) {
  throw new Error("Digital Asset Links does not authorize RailHygiene.");
}

console.log(
  `Validated ${trains.length} train pages and ${sitemapNumbers.size} indexable sitemap URLs.`,
);
