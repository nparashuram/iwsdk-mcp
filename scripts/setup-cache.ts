#!/usr/bin/env tsx
/**
 * Complete cache setup script
 * Runs all ingestion and extraction tasks
 */

import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";

const execAsync = promisify(exec);

async function run(command: string, description: string) {
  console.log(`\n${description}...`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log(`${description} complete`);
  } catch (error: any) {
    console.error(`${description} failed:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const iwsdkPath = args[0];

  if (!iwsdkPath) {
    console.error(`

Usage:
  npm run prepare <path-to-iwsdk-repo>

Example:
  npm run prepare ~/projects/immersive-web-sdk
  npm run prepare /home/user/immersive-web-sdk

This prepares the RAG (Retrieval Augmented Generation) system by:
  1. Ingesting IWSDK source code (components, systems, types, examples)
  2. Fetching official IWSDK documentation from Meta
  3. Building the TypeScript project
`);
    process.exit(1);
  }

  if (!existsSync(iwsdkPath)) {
    console.error(`Error: Path does not exist: ${iwsdkPath}`);
    process.exit(1);
  }

  const packageCorePath = `${iwsdkPath}/packages/core`;
  if (!existsSync(packageCorePath)) {
    console.error(
      `Error: Not a valid IWSDK repository (missing packages/core)`
    );
    console.error(`   Path: ${iwsdkPath}`);
    process.exit(1);
  }

  console.log(`\nIWSDK Repository: ${iwsdkPath}`);
  console.log("=".repeat(50));

  try {
    await run(
      `tsx scripts/ingest-source.ts "${iwsdkPath}"`,
      "Ingesting IWSDK source code"
    );

    await run(
      "tsx scripts/fetch-docs.ts",
      "Fetching official IWSDK documentation"
    );

    await run("npm run build", "Building TypeScript");

    console.log("\nRAG Preparation Complete!");
    console.log("\nRAG Data Generated:");
    console.log("  - Components, systems, types (cache/*.json)");
    console.log("  - Code examples & relationships");
    console.log("  - Official Meta documentation (cache/docs/)");
    console.log("  - Common mistakes & validation rules");
    console.log("\nNext Steps:");
    console.log("  1. Configure MCP server in your client");
    console.log("  2. Run: npm run inspector (to test)");
    console.log(
      "\nThe RAG system is ready to provide accurate IWSDK assistance!\n"
    );
  } catch (error) {
    console.error(
      "\nRAG preparation failed. Please fix the errors above and try again.\n"
    );
    process.exit(1);
  }
}

main();
