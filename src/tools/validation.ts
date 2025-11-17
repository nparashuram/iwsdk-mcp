import {
  getValidationRules,
  getOrderingConstraints,
  getCommonMistakes,
  searchCommonMistakes,
} from "../lib/cache-loader.js";

export async function getValidationRulesForComponent(
  componentOrSystem?: string
) {
  const rules = await getValidationRules(componentOrSystem);

  if (rules.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: componentOrSystem
            ? `No validation rules found for "${componentOrSystem}".`
            : `No validation rules available.`,
        },
      ],
    };
  }

  let result = componentOrSystem
    ? `# Validation Rules for ${componentOrSystem}\n\n`
    : `# All Validation Rules\n\n`;

  result += `Found ${rules.length} validation rule(s):\n\n`;

  for (const rule of rules) {
    result += `## ${rule.id}\n\n`;
    result += `**Severity:** ${rule.severity}\n\n`;
    result += `**Description:** ${rule.description}\n\n`;
    result += `**Check:** ${rule.check}\n\n`;
    result += `**Message:** ${rule.message}\n\n`;
    result += "---\n\n";
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

export async function checkComponentOrder(componentName: string) {
  const constraints = await getOrderingConstraints(componentName);

  if (constraints.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No ordering constraints found for "${componentName}".\n\nThis component has no specific ordering requirements.`,
        },
      ],
    };
  }

  let result = `# Component Ordering for ${componentName}\n\n`;

  const mustAddBefore = constraints.filter((c) => c.before === componentName);
  const mustAddAfter = constraints.filter((c) => c.after === componentName);

  if (mustAddBefore.length > 0) {
    result += `## Must Add These Components BEFORE ${componentName}:\n\n`;
    for (const constraint of mustAddBefore) {
      result += `- **${constraint.after}**\n`;
      result += `  - Reason: ${constraint.reason}\n\n`;
    }
  }

  if (mustAddAfter.length > 0) {
    result += `## These Components Must Be Added AFTER ${componentName}:\n\n`;
    for (const constraint of mustAddAfter) {
      result += `- **${constraint.before}**\n`;
      result += `  - Reason: ${constraint.reason}\n\n`;
    }
  }

  result += `## Correct Order Example\n\n\`\`\`typescript\n`;

  if (mustAddBefore.length > 0) {
    for (const constraint of mustAddBefore) {
      result += `entity.addComponent(${constraint.after});\n`;
    }
  }

  result += `entity.addComponent(${componentName});\n`;

  if (mustAddAfter.length > 0) {
    for (const constraint of mustAddAfter) {
      result += `entity.addComponent(${constraint.before});\n`;
    }
  }

  result += `\`\`\`\n`;

  return {
    content: [
      {
        type: "text",
        text: result.trim(),
      },
    ],
  };
}

export async function getTroubleshootingHelp(query?: string) {
  const mistakes = query
    ? await searchCommonMistakes(query)
    : await getCommonMistakes();

  if (mistakes.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: query
            ? `No common mistakes found for "${query}".`
            : `No troubleshooting information available.`,
        },
      ],
    };
  }

  let result = query
    ? `# Troubleshooting: ${query}\n\n`
    : `# Common Mistakes Guide\n\n`;

  result += `Found ${mistakes.length} common mistake(s):\n\n`;

  for (const mistake of mistakes) {
    result += `## ${mistake.title}\n\n`;
    result += `**Category:** ${mistake.category}\n\n`;
    result += `${mistake.description}\n\n`;

    result += `### Wrong\n\n\`\`\`typescript\n${mistake.wrongCode}\n\`\`\`\n\n`;

    result += `### Correct\n\n\`\`\`typescript\n${mistake.correctCode}\n\`\`\`\n\n`;

    result += "---\n\n";
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
