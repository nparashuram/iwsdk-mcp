#!/usr/bin/env tsx
/**
 * Fetches official IWSDK documentation from Meta's developer portal
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DOCS_BASE =
  "https://developers.meta.com/horizon/llmstxt/documentation/web";
const CACHE_DOCS_DIR = join(process.cwd(), "cache", "docs");

// Official IWSDK documentation pages
// Note: As of 2025-11-17, only overview is available. More docs will be added as Meta publishes them.
const OFFICIAL_DOCS = [
  { path: "iwsdk-overview.md", name: "overview.md" },
  // Coming soon (currently return 404):
  // { path: 'iwsdk-ecs.md', name: 'ecs.md' },
  // { path: 'iwsdk-grabbing.md', name: 'grabbing.md' },
  // { path: 'iwsdk-physics.md', name: 'physics.md' },
];

async function fetchDoc(path: string, name: string): Promise<boolean> {
  const url = `${DOCS_BASE}/${path}/`;
  console.log(`  Fetching ${name}...`);

  try {
    // Use curl since it works reliably with Meta's servers
    const { stdout, stderr } = await execAsync(`curl -sL "${url}"`);

    if (stderr) {
      console.log(`  WARNING: ${name}: ${stderr}`);
    }

    if (
      stdout.includes("<!DOCTYPE html>") &&
      stdout.includes("<title>Error</title>")
    ) {
      console.log(`  ${name} not found (returned error page)`);
      return false;
    }

    if (!stdout || stdout.length < 100) {
      console.log(`  ${name} returned empty or invalid content`);
      return false;
    }

    const outputPath = join(CACHE_DOCS_DIR, name);

    // Add header with source attribution
    const header = `<!--
Source: Meta Developers - Official IWSDK Documentation
URL: ${url}
Fetched: ${new Date().toISOString()}
License: Check Meta's developer documentation license
-->

`;

    await writeFile(outputPath, header + stdout);
    console.log(`  ${name} (${stdout.length} bytes)`);
    return true;
  } catch (error: any) {
    console.log(`  ${name} failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("Fetching Official IWSDK Docs\n");

  // Ensure cache/docs directory exists
  if (!existsSync(CACHE_DOCS_DIR)) {
    await mkdir(CACHE_DOCS_DIR, { recursive: true });
    console.log(`Created ${CACHE_DOCS_DIR}\n`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const doc of OFFICIAL_DOCS) {
    const success = await fetchDoc(doc.path, doc.name);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\nFetched ${successCount}/${OFFICIAL_DOCS.length} documents\n`);

  if (failCount > 0) {
    console.log(`WARNING: ${failCount} documents could not be fetched`);
    console.log(
      "They may not exist yet or the URL structure may have changed.\n"
    );
  }

  console.log("Documentation cached in cache/docs/\n");
}

main().catch((error) => {
  console.error("Failed to fetch documentation:", error);
  process.exit(1);
});
