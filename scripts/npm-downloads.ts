import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const NPM_API = "https://api.npmjs.org/downloads/point/last-week";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface NpmDownloadResponse {
  downloads: number;
  package: string;
}

type BulkResponse = Record<string, NpmDownloadResponse | null>;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch with retry + exponential backoff.
 */
async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && attempt <= MAX_RETRIES) {
    const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
    console.log(`  ⏳ Rate-limited, retrying in ${delay / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`);
    await sleep(delay);
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

/**
 * Bulk-fetch non-scoped packages using comma-separated endpoint.
 * e.g. /downloads/point/last-week/react,react-dom,vite
 */
async function fetchBulk(packages: string[]): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  if (packages.length === 0) return results;

  const url = `${NPM_API}/${packages.join(",")}`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      // If bulk fails, mark all as null
      for (const p of packages) results.set(p, null);
      return results;
    }
    // Single-package bulk returns the object directly, multi returns keyed object
    if (packages.length === 1) {
      const data = (await res.json()) as NpmDownloadResponse;
      results.set(packages[0], data.downloads ?? null);
    } else {
      const data = (await res.json()) as BulkResponse;
      for (const p of packages) {
        results.set(p, data[p]?.downloads ?? null);
      }
    }
  } catch {
    for (const p of packages) results.set(p, null);
  }
  return results;
}

/**
 * Fetch scoped packages one-by-one (bulk API doesn't support @scope/pkg).
 */
async function fetchScoped(pkg: string): Promise<number | null> {
  try {
    const res = await fetchWithRetry(`${NPM_API}/${encodeURIComponent(pkg)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as NpmDownloadResponse;
    return data.downloads ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const pkgPath = resolve(import.meta.dirname!, "..", "package.json");
  const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

  const deps = Object.keys(pkg.dependencies ?? {});
  const devDeps = Object.keys(pkg.devDependencies ?? {});
  const allPackages = [...deps, ...devDeps];

  console.log(`Fetching weekly npm downloads for ${allPackages.length} packages...\n`);

  // Separate scoped (@org/pkg) from non-scoped packages
  const scoped = allPackages.filter((p) => p.startsWith("@"));
  const nonScoped = allPackages.filter((p) => !p.startsWith("@"));

  const downloadMap = new Map<string, number | null>();

  // Bulk-fetch non-scoped in batches of 128 (npm API limit is generous for bulk)
  const batchSize = 128;
  for (let i = 0; i < nonScoped.length; i += batchSize) {
    const batch = nonScoped.slice(i, i + batchSize);
    console.log(`  Fetching batch ${Math.floor(i / batchSize) + 1} (${batch.length} non-scoped packages)...`);
    const batchResults = await fetchBulk(batch);
    for (const [k, v] of batchResults) downloadMap.set(k, v);
  }

  // Fetch scoped packages individually with a small delay between each
  if (scoped.length > 0) {
    console.log(`  Fetching ${scoped.length} scoped packages individually...`);
    for (const pkg of scoped) {
      const dl = await fetchScoped(pkg);
      downloadMap.set(pkg, dl);
      await sleep(100); // gentle pacing
    }
  }

  // Build results
  const results = allPackages.map((name) => ({
    name,
    downloads: downloadMap.get(name) ?? null,
    type: deps.includes(name) ? "dep" : "dev",
  }));

  // Sort by downloads descending
  results.sort((a, b) => (b.downloads ?? -1) - (a.downloads ?? -1));

  // Print table
  const nameWidth = Math.max(...results.map((r) => r.name.length), 7);
  const dlWidth = 15;
  const typeWidth = 4;

  const header = `${"Package".padEnd(nameWidth)}  ${"Downloads/wk".padStart(dlWidth)}  ${"Type".padEnd(typeWidth)}`;
  console.log(`\n${header}`);
  console.log("-".repeat(header.length));

  let totalDownloads = 0;

  for (const r of results) {
    const dl = r.downloads !== null ? r.downloads.toLocaleString("en-US") : "N/A";
    totalDownloads += r.downloads ?? 0;
    console.log(`${r.name.padEnd(nameWidth)}  ${dl.padStart(dlWidth)}  ${r.type.padEnd(typeWidth)}`);
  }

  console.log("-".repeat(header.length));
  console.log(
    `${"TOTAL".padEnd(nameWidth)}  ${totalDownloads.toLocaleString("en-US").padStart(dlWidth)}`
  );
}

main();
