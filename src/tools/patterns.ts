import { searchExamples } from '../lib/cache-loader.js';

export async function findImplementationPattern(feature: string) {
  const lowerFeature = feature.toLowerCase();

  // Map features to relevant components and systems
  const featureMapping: Record<string, { components: string[]; systems: string[]; query: string }> = {
    'grabbing': {
      components: ['OneHandGrabbable', 'TwoHandGrabbable', 'DistanceGrabbable', 'GrabSource'],
      systems: ['GrabSystem'],
      query: 'grab'
    },
    'locomotion': {
      components: ['CharacterController', 'SnapTurn', 'SmoothTurn'],
      systems: ['LocomotionSystem', 'CharacterControllerSystem'],
      query: 'locomotion'
    },
    'physics': {
      components: ['PhysicsBody', 'PhysicsShape', 'PhysicsConstraint'],
      systems: ['PhysicsSystem'],
      query: 'physics'
    },
    'audio': {
      components: ['AudioSource', 'AudioListener'],
      systems: ['AudioSystem'],
      query: 'audio'
    },
    'spatial-ui': {
      components: ['UIElement', 'UICanvas'],
      systems: [],
      query: 'ui'
    },
    'input': {
      components: ['HandTrackingSource', 'ControllerSource'],
      systems: ['InputSystem'],
      query: 'input'
    },
  };

  const mapping = featureMapping[lowerFeature];

  if (!mapping) {
    return {
      content: [{
        type: 'text',
        text: `Implementation pattern for "${feature}" not found.\n\n**Available patterns:**\n- grabbing\n- locomotion\n- physics\n- audio\n- spatial-ui\n- input\n\n**Recommended approach:**\n1. Use \`get_component_schema\` to understand component fields\n2. Use \`get_system_info\` to understand system behavior\n3. Use \`search_code_examples\` to find relevant examples\n4. Use \`compose_feature\` to generate complete implementations`,
      }],
    };
  }

  // Build comprehensive pattern documentation from cache data
  let response = `# ${feature.charAt(0).toUpperCase() + feature.slice(1)} Implementation Pattern\n\n`;

  // Add component information
  if (mapping.components.length > 0) {
    response += `## Components\n\n`;
    response += `Use these components for ${feature}:\n\n`;
    for (const componentName of mapping.components) {
      response += `- **${componentName}** - Use \`get_component_schema("${componentName}")\` for details\n`;
    }
    response += '\n';
  }

  // Add system information
  if (mapping.systems.length > 0) {
    response += `## Systems\n\n`;
    response += `These systems handle ${feature} logic:\n\n`;
    for (const systemName of mapping.systems) {
      response += `- **${systemName}** - Use \`get_system_info("${systemName}")\` for details\n`;
    }
    response += '\n';
  }

  // Add code examples
  response += `## Code Examples\n\n`;
  const examples = await searchExamples(mapping.query, 'any');

  if (examples.length > 0) {
    response += `Found ${examples.length} examples. Use \`search_code_examples("${mapping.query}")\` to see detailed code.\n\n`;
    response += `**Example files:**\n`;
    for (const ex of examples.slice(0, 5)) {
      response += `- ${ex.title}\n`;
    }
  } else {
    response += `No code examples found. Try \`search_code_examples("${mapping.query}")\`\n`;
  }

  response += `\n## Quick Start\n\n`;
  response += `1. Get component details: \`get_component_schema("${mapping.components[0] || 'ComponentName'}")\`\n`;
  if (mapping.systems.length > 0) {
    response += `2. Understand the system: \`get_system_info("${mapping.systems[0]}")\`\n`;
  }
  response += `3. Find examples: \`search_code_examples("${mapping.query}")\`\n`;
  response += `4. Generate code: \`compose_feature("${feature}")\`\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
