import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, "..", "..", "cache");

interface SetupGuideCache {
  [projectType: string]: {
    title: string;
    content: string;
  };
}

async function loadSetupGuideCache(): Promise<SetupGuideCache> {
  try {
    const cachePath = join(CACHE_DIR, "setup-guides.json");
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      "Setup guides cache not found. Run: npm run prepare-rag <path-to-iwsdk>"
    );
  }
}

export async function getSetupGuide(projectType: string) {
  const lowerType = projectType.toLowerCase();

  try {
    const cache = await loadSetupGuideCache();
    const guide = cache[lowerType];

    if (guide) {
      return {
        content: [{ type: "text", text: guide.content }],
      };
    }

    // Default response
    const availableTypes = Object.keys(cache).join(", ");
    return {
      content: [
        {
          type: "text",
          text: `Setup guide for "${projectType}" not found.

**Available guides:**
${availableTypes}

**For more help:**
- \`search_code_examples("world.create")\` - See setup examples
- \`explain_concept("iwsdk")\` - Get IWSDK overview
- \`scaffold_project("${projectType}")\` - Generate complete project structure`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error loading setup guide: ${error.message}`,
        },
      ],
    };
  }
}
