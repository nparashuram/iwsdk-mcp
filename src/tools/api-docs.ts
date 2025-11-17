import { getApiDoc } from '../lib/cache-loader.js';

export async function getApiDocumentation(
  packageName: string,
  className: string,
  methodName?: string
) {
  const doc = await getApiDoc(packageName, className);

  if (!doc) {
    return {
      content: [
        {
          type: 'text',
          text: `No documentation found for ${className} in ${packageName}.\n\nAvailable packages:\n- @iwsdk/core\n- @iwsdk/xr-input\n- @iwsdk/glxf\n- @iwsdk/locomotor\n\nTry using the lookup_package_exports tool to see what's available in each package.`,
        },
      ],
    };
  }

  let result = `# ${doc.className}\n\n**Package:** ${doc.packageName}\n\n${doc.description}\n\n`;

  if (methodName && doc.methods?.[methodName]) {
    const method = doc.methods[methodName];
    result += `## Method: ${methodName}\n\n`;
    result += `\`\`\`typescript\n${method.signature}\n\`\`\`\n\n`;
    result += `${method.description}\n\n`;

    if (method.parameters && method.parameters.length > 0) {
      result += `### Parameters\n\n`;
      for (const param of method.parameters) {
        const optional = param.optional ? ' (optional)' : '';
        result += `- **${param.name}**${optional}: \`${param.type}\``;
        if (param.description) {
          result += ` - ${param.description}`;
        }
        result += '\n';
      }
      result += '\n';
    }

    if (method.returns) {
      result += `### Returns\n\n\`${method.returns}\`\n\n`;
    }

    if (method.examples && method.examples.length > 0) {
      result += `### Example\n\n\`\`\`typescript\n${method.examples[0]}\n\`\`\`\n`;
    }
  } else {
    if (doc.constructorDoc) {
      result += `## Constructor\n\n${doc.constructorDoc}\n\n`;
    }

    if (doc.properties && Object.keys(doc.properties).length > 0) {
      result += `## Properties\n\n`;
      for (const [propName, prop] of Object.entries(doc.properties)) {
        const readonly = prop.readonly ? ' (readonly)' : '';
        result += `### ${propName}${readonly}\n\n`;
        result += `**Type:** \`${prop.type}\`\n\n`;
        result += `${prop.description}\n\n`;
      }
    }

    if (doc.methods && Object.keys(doc.methods).length > 0) {
      result += `## Methods\n\n`;
      for (const [name, method] of Object.entries(doc.methods)) {
        result += `### ${name}\n\n`;
        result += `\`\`\`typescript\n${method.signature}\n\`\`\`\n\n`;
        result += `${method.description}\n\n`;
      }
    }

    if (doc.examples && doc.examples.length > 0) {
      result += `## Examples\n\n`;
      for (const example of doc.examples) {
        result += `\`\`\`typescript\n${example}\n\`\`\`\n\n`;
      }
    }
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
