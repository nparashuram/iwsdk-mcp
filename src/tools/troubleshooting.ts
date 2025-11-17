import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, "..", "..", "cache");

interface TroubleshootingSolution {
  keywords: string[];
  title: string;
  problem: string;
  solutions: string[];
  code?: string;
}

interface TroubleshootingCache {
  solutions: TroubleshootingSolution[];
}

async function loadTroubleshootingCache(): Promise<TroubleshootingCache> {
  try {
    const cachePath = join(CACHE_DIR, "troubleshooting.json");
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      "Troubleshooting cache not found. Run: npm run prepare-rag <path-to-iwsdk>"
    );
  }
}

export async function troubleshootError(errorMessage: string) {
  const lowerError = errorMessage.toLowerCase();

  try {
    const cache = await loadTroubleshootingCache();

    // Find matching solution based on keywords
    const matchedSolution = cache.solutions.find((solution) =>
      solution.keywords.some((keyword) =>
        lowerError.includes(keyword.toLowerCase())
      )
    );

    if (matchedSolution) {
      let response = `# ${matchedSolution.title}\n\n`;
      response += `## Problem\n${matchedSolution.problem}\n\n`;
      response += `## Solutions\n\n`;

      matchedSolution.solutions.forEach((sol, idx) => {
        response += `### ${idx + 1}. ${sol}\n\n`;
      });

      if (matchedSolution.code) {
        response += `\n## Code Example\n\n\`\`\`typescript\n${matchedSolution.code}\n\`\`\`\n`;
      }

      return {
        content: [{ type: "text", text: response }],
      };
    }

    // No specific match found - provide general guidance
    return {
      content: [
        {
          type: "text",
          text: `No specific solution found for: "${errorMessage}"

**General troubleshooting steps:**
1. Check browser console for detailed error messages
2. Ensure HTTPS is enabled (required for WebXR)
3. Verify component dependencies are met
4. Check that systems are properly registered
5. Review component initialization order

**Available resources:**
- \`get_common_mistakes()\` - See common IWSDK mistakes
- \`get_validation_rules()\` - Understand component requirements
- \`search_code_examples("error handling")\` - Find error handling patterns

**Available troubleshooting topics:**
${cache.solutions
  .map((s) => `- ${s.title}`)
  .slice(0, 10)
  .join("\n")}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error loading troubleshooting guide: ${error.message}`,
        },
      ],
    };
  }
}
