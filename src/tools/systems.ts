import { getSystem, getAllSystems } from '../lib/cache-loader.js';

export async function getSystemInfo(systemName: string) {
  const system = await getSystem(systemName);

  if (!system) {
    const allSystems = await getAllSystems();
    const knownNames = allSystems.map(s => s.name);

    return {
      content: [
        {
          type: 'text',
          text: `System "${systemName}" not found.\n\nKnown systems:\n${knownNames.map(n => `- ${n}`).join('\n')}`,
        },
      ],
    };
  }

  let result = `# ${system.name}\n\n`;

  result += `**Package:** \`${system.package}\`\n`;
  result += `**Category:** ${system.category || 'General'}\n\n`;

  result += `## Import\n\n\`\`\`typescript\n${system.importPath}\n\`\`\`\n\n`;

  result += `## Description\n\n${system.description}\n\n`;

  if (system.remarks) {
    result += `## Remarks\n\n${system.remarks}\n\n`;
  }

  if (system.queriesComponents.length > 0) {
    result += `## Queries Components\n\n`;
    result += `This system queries entities with the following components:\n\n`;
    for (const comp of system.queriesComponents) {
      result += `- ${comp}\n`;
    }
    result += '\n';
  }

  if (system.methods.length > 0) {
    result += `## Methods\n\n`;
    for (const method of system.methods) {
      result += `### ${method.name}\n\n`;
      result += `\`\`\`typescript\n${method.signature}\n\`\`\`\n\n`;
      if (method.description) {
        result += `${method.description}\n\n`;
      }
    }
  }

  if (system.properties.length > 0) {
    result += `## Properties\n\n`;
    for (const prop of system.properties) {
      result += `### ${prop.name}\n\n`;
      result += `**Type:** \`${prop.type}\`\n\n`;
      if (prop.description) {
        result += `${prop.description}\n\n`;
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

export async function generateSystemTemplate(
  systemName: string,
  queries: Array<{ name: string; required: string[]; excluded?: string[] }>,
  configFields?: Array<{ name: string; type: string; default?: any }>
) {
  let result = `# ${systemName} Template\n\n`;
  result += `Below is a TypeScript template for your custom ECS system:\n\n`;
  result += `\`\`\`typescript\n`;
  result += `import { createSystem, Types } from '@iwsdk/core';\n`;

  const componentImports = new Set<string>();
  for (const query of queries) {
    for (const comp of query.required) {
      componentImports.add(comp);
    }
    if (query.excluded) {
      for (const comp of query.excluded) {
        componentImports.add(comp);
      }
    }
  }

  if (componentImports.size > 0) {
    result += `// Import your components\n`;
    result += `// import { ${Array.from(componentImports).join(', ')} } from './components';\n\n`;
  }

  result += `class ${systemName} extends createSystem(\n`;
  result += `  // Queries\n`;
  result += `  {\n`;

  for (const query of queries) {
    result += `    ${query.name}: {\n`;
    result += `      required: [${query.required.join(', ')}]`;
    if (query.excluded && query.excluded.length > 0) {
      result += `,\n      excluded: [${query.excluded.join(', ')}]`;
    }
    result += `\n    },\n`;
  }

  result += `  }`;

  if (configFields && configFields.length > 0) {
    result += `,\n  // Configuration\n`;
    result += `  {\n`;
    for (const field of configFields) {
      const defaultValue = field.default !== undefined ? field.default : getDefaultForType(field.type);
      result += `    ${field.name}: { type: ${field.type}, default: ${JSON.stringify(defaultValue)} },\n`;
    }
    result += `  }`;
  }

  result += `\n) {\n`;
  result += `  init() {\n`;
  result += `    // Called once when system is registered\n`;
  result += `    console.log('${systemName} initialized');\n`;
  result += `  }\n\n`;

  result += `  update(dt: number) {\n`;
  result += `    // Called every frame\n`;

  for (const query of queries) {
    result += `    \n    // Process ${query.name}\n`;
    result += `    for (const entity of this.queries.${query.name}.entities) {\n`;
    result += `      // TODO: Implement logic for ${query.name}\n`;
    for (const comp of query.required) {
      result += `      // const value = entity.getValue(${comp}, 'fieldName');\n`;
    }
    result += `    }\n`;
  }

  result += `  }\n\n`;

  result += `  onEntityAdded(entity: Entity) {\n`;
  result += `    // Called when entity matches any query\n`;
  result += `  }\n\n`;

  result += `  onEntityRemoved(entity: Entity) {\n`;
  result += `    // Called when entity stops matching any query\n`;
  result += `  }\n\n`;

  result += `  destroy() {\n`;
  result += `    // Called when system is removed\n`;
  result += `  }\n`;
  result += `}\n\n`;

  result += `// Register with world\n`;
  result += `// world.registerSystem(${systemName});\n`;
  result += `\`\`\`\n\n`;

  result += `## Usage\n\n`;
  result += `1. Define the components used in the queries\n`;
  result += `2. Register the components with the world\n`;
  result += `3. Register this system with the world\n`;
  result += `4. Implement the update logic for each query\n\n`;

  result += `## Query Details\n\n`;
  for (const query of queries) {
    result += `- **${query.name}**: Entities with ${query.required.join(', ')}`;
    if (query.excluded && query.excluded.length > 0) {
      result += ` (excluding ${query.excluded.join(', ')})`;
    }
    result += '\n';
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

function getDefaultForType(type: string): any {
  if (type.includes('Float') || type.includes('Int') || type.includes('Uint')) {
    return 0;
  }
  if (type.includes('Boolean')) {
    return false;
  }
  if (type.includes('String')) {
    return '';
  }
  return null;
}
