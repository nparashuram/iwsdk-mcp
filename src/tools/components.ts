import { getComponent, getAllComponents } from "../lib/cache-loader.js";

export async function getComponentSchema(componentName: string) {
  const component = await getComponent(componentName);

  if (!component) {
    const allComponents = await getAllComponents();
    const knownNames = allComponents.map((c) => c.name).slice(0, 15);

    return {
      content: [
        {
          type: "text",
          text: `Component "${componentName}" not found.\n\nKnown components:\n${knownNames
            .map((n) => `- ${n}`)
            .join("\n")}\n\n... and ${
            allComponents.length - 15
          } more.\n\nUse the search tools to find the component you need.`,
        },
      ],
    };
  }

  let result = `# ${component.name} Component\n\n`;

  result += `**Package:** \`${component.package}\`\n`;
  result += `**Category:** ${component.category || "General"}\n\n`;

  result += `## Import\n\n\`\`\`typescript\n${component.importPath}\n\`\`\`\n\n`;

  result += `## Description\n\n${component.description}\n\n`;

  if (component.remarks) {
    result += `## Remarks\n\n${component.remarks}\n\n`;
  }

  if (component.requires.length > 0) {
    result += `## Requirements\n\n`;
    result += `This component requires the following components to be added first:\n\n`;
    for (const req of component.requires) {
      result += `- **${req}** (must be added before ${component.name})\n`;
    }
    result += "\n";
  }

  if (component.usedBySystems.length > 0) {
    result += `## Used By Systems\n\n`;
    result += `This component is queried by:\n`;
    for (const sys of component.usedBySystems) {
      result += `- ${sys}\n`;
    }
    result += "\n";
  }

  result += `## Fields\n\n`;

  for (const field of component.fields) {
    result += `### ${field.name}\n\n`;
    result += `**Type:** \`${field.type}\`\n`;
    if (field.default !== undefined) {
      result += `**Default:** \`${JSON.stringify(field.default)}\`\n`;
    }
    if (field.description) {
      result += `\n${field.description}\n`;
    }
    result += "\n";
  }

  if (component.jsdocExamples && component.jsdocExamples.length > 0) {
    result += `## Example Usage\n\n`;
    for (const example of component.jsdocExamples) {
      result += `${example}\n\n`;
    }
  }

  if (component.optionalWith.length > 0) {
    result += `## Often Used With\n\n`;
    result += `This component is frequently combined with:\n`;
    for (const opt of component.optionalWith) {
      result += `- ${opt}\n`;
    }
    result += "\n";
  }

  return {
    content: [
      {
        type: "text",
        text: result.trim(),
      },
    ],
  };
}
