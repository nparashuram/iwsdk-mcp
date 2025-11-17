import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getCommonMistakes } from "../lib/cache-loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, "..", "..", "cache");

interface BestPracticesCache {
  [topic: string]: {
    title: string;
    content: string;
  };
}

async function loadBestPracticesCache(): Promise<BestPracticesCache> {
  try {
    const cachePath = join(CACHE_DIR, "best-practices.json");
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      "Best practices cache not found. Run: npm run prepare-rag <path-to-iwsdk>"
    );
  }
}

export async function getBestPractices(topic: string) {
  const lowerTopic = topic.toLowerCase();

  try {
    const cache = await loadBestPracticesCache();
    const guidance = cache[lowerTopic];

    if (guidance) {
      // Append relevant common mistakes
      const mistakes = await getCommonMistakes();
      let mistakesText = "\n\n---\n\n## Common Mistakes\n\n";
      for (const mistake of mistakes.slice(0, 5)) {
        mistakesText += `### ${mistake.title}\n\n`;
        mistakesText += `${mistake.description}\n\n`;
        if (mistake.wrongCode) {
          mistakesText += `**Wrong:**\n\`\`\`typescript\n${mistake.wrongCode}\n\`\`\`\n\n`;
        }
        if (mistake.correctCode) {
          mistakesText += `**Correct:**\n\`\`\`typescript\n${mistake.correctCode}\n\`\`\`\n\n`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `${guidance.content}${mistakesText}`,
          },
        ],
      };
    }

    // Default response
    const availableTopics = Object.keys(cache).join(", ");
    return {
      content: [
        {
          type: "text",
          text: `Best practices for "${topic}" not found.\n\n**Available topics:**\n${availableTopics}\n\n**More resources:**\n- \`get_common_mistakes()\` - See common mistakes and how to fix them\n- \`get_validation_rules()\` - See validation rules\n- \`search_code_examples("${topic}")\` - Find examples`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error loading best practices: ${error.message}`,
        },
      ],
    };
  }
}
