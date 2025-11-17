import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, "..", "..", "cache");

interface AssetGuideCache {
  [assetType: string]: {
    [operation: string]: {
      title: string;
      content: string;
    };
  };
}

async function loadAssetGuideCache(): Promise<AssetGuideCache> {
  try {
    const cachePath = join(CACHE_DIR, "asset-guides.json");
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      "Asset guides cache not found. Run: npm run prepare-rag <path-to-iwsdk>"
    );
  }
}

export async function explainAssetPipeline(
  assetType: string,
  operation: string
) {
  const lowerType = assetType.toLowerCase();
  const lowerOp = operation.toLowerCase();

  try {
    const cache = await loadAssetGuideCache();
    const guidance = cache[lowerType]?.[lowerOp];

    if (guidance) {
      return {
        content: [{ type: "text", text: guidance.content }],
      };
    }

    // Build available options from cache
    let available = "";
    if (cache[lowerType]) {
      available = Object.keys(cache[lowerType])
        .map((op) => `- ${lowerType} ${op}`)
        .join("\n");
    } else {
      available = Object.keys(cache)
        .map(
          (type) =>
            `- ${type} (operations: ${Object.keys(cache[type]).join(", ")})`
        )
        .join("\n");
    }

    return {
      content: [
        {
          type: "text",
          text: `Asset pipeline guide for "${assetType}" - "${operation}" not available.

**Available:**
${available}

**For more help:**
- Use \`search_code_examples("gltf")\` for working examples
- Use \`search_code_examples("loader")\` for loading patterns
- Check Three.js documentation: https://threejs.org/docs/#examples/en/loaders/GLTFLoader`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error loading asset guide: ${error.message}`,
        },
      ],
    };
  }
}
