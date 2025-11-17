import { getPackageExports } from '../lib/cache-loader.js';

export async function lookupPackageExports(packageName: string) {
  const exports = await getPackageExports(packageName);

  if (!exports) {
    return {
      content: [
        {
          type: 'text',
          text: `Package "${packageName}" not found.\n\nAvailable packages:\n- @iwsdk/core (main runtime)\n- @iwsdk/xr-input (input handling)\n- @iwsdk/glxf (scene format)\n- @iwsdk/locomotor (movement physics)`,
        },
      ],
    };
  }

  let result = `# ${exports.packageName}\n\n`;

  if (exports.classes.length > 0) {
    result += `## Classes\n\n`;
    for (const className of exports.classes) {
      result += `- **${className}**\n`;
    }
    result += '\n';
  }

  if (exports.functions.length > 0) {
    result += `## Functions\n\n`;
    for (const funcName of exports.functions) {
      result += `- **${funcName}**\n`;
    }
    result += '\n';
  }

  if (exports.components.length > 0) {
    result += `## Components\n\n`;
    for (const comp of exports.components) {
      result += `- **${comp}**\n`;
    }
    result += '\n';
  }

  if (exports.systems.length > 0) {
    result += `## Systems\n\n`;
    for (const sys of exports.systems) {
      result += `- **${sys}**\n`;
    }
    result += '\n';
  }

  if (exports.types.length > 0) {
    result += `## Types\n\n`;
    for (const type of exports.types) {
      result += `- **${type}**\n`;
    }
    result += '\n';
  }

  result += `\n---\n\n`;
  result += `Use \`get_api_documentation\` to get detailed information about specific classes.\n`;
  result += `Use \`get_component_schema\` to get field definitions for components.\n`;

  return {
    content: [
      {
        type: 'text',
        text: result.trim(),
      },
    ],
  };
}
