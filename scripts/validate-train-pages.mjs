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
