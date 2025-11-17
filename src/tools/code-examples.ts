import { searchExamples } from '../lib/cache-loader.js';

export async function searchCodeExamples(feature: string, category?: string) {
  const examples = await searchExamples(feature, category);

  if (examples.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No code examples found for "${feature}"${category ? ` in category "${category}"` : ''}.\n\nTry searching for:\n- grabbing\n- locomotion\n- spatial-ui\n- interactable\n- physics\n- component\n- system\n- input`,
        },
      ],
    };
  }

  let result = `# Code Examples for "${feature}"\n\n`;
  result += `Found ${examples.length} example${examples.length > 1 ? 's' : ''}:\n\n`;

  for (const example of examples) {
    result += `## ${example.title}\n\n`;
    result += `${example.description}\n\n`;
    result += `**Category:** ${example.category}\n`;
    result += `**Tags:** ${example.tags.join(', ')}\n\n`;
    result += `\`\`\`typescript\n${example.code}\n\`\`\`\n\n`;
    result += `---\n\n`;
  }

  return {
    content: [
      {
        type: 'text',
        text: result.trim(),
      },
    ],
  };
}
