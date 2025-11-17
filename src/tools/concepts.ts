import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OVERVIEW_PATH = join(__dirname, '..', '..', 'cache', 'docs', 'overview.md');

export async function explainConcept(concept: string) {
  try {
    // Load official IWSDK overview from Meta
    const overview = await readFile(OVERVIEW_PATH, 'utf-8');

    // Return overview for high-level concepts
    if (['iwsdk', 'overview', 'introduction', 'getting-started'].includes(concept.toLowerCase())) {
      return {
        content: [{ type: 'text', text: overview }],
      };
    }

    // For specific concepts, provide guidance on which tool to use
    const conceptGuide: Record<string, string> = {
      'ecs': 'Use get_system_info for system details or get_component_schema for component schemas',
      'entities': 'Use search_code_examples with query="createEntity" to see entity creation examples',
      'components': 'Use get_component_schema to get detailed component information',
      'systems': 'Use get_system_info to get detailed system information',
      'queries': 'Use get_system_info to see how systems use queries',
      'locomotion': 'Use get_system_info with systemName="LocomotionSystem"',
      'grabbing': 'Use get_component_schema for OneHandGrabbable, TwoHandGrabbable, or DistanceGrabbable',
      'physics': 'Use get_component_schema for PhysicsBody and PhysicsShape',
      'audio': 'Use get_component_schema for AudioSource',
      'scene-understanding': 'Use get_component_schema for SceneUnderstanding components',
      'spatial-ui': 'Use search_code_examples with query="UIElement"',
      'input': 'Use search_code_examples with query="input" or "controller"',
    };

    const guide = conceptGuide[concept.toLowerCase()];
    if (guide) {
      return {
        content: [{
          type: 'text',
          text: `# ${concept}\n\n${guide}\n\n## Overview\n\n${overview}`,
        }],
      };
    }

    // Fallback: return overview with available concepts
    return {
      content: [{
        type: 'text',
        text: `Concept "${concept}" not found.\n\n**Available concepts:**\n- iwsdk, overview, introduction\n- ecs, entities, components, systems, queries\n- locomotion, grabbing, physics, audio\n- scene-understanding, spatial-ui, input\n\n**For detailed information:**\n- Use \`get_component_schema\` for component details\n- Use \`get_system_info\` for system details\n- Use \`search_code_examples\` for code examples\n\n## IWSDK Overview\n\n${overview}`,
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `Error loading documentation: ${error.message}\n\nPlease run: npm run setup-cache /path/to/immersive-web-sdk`,
      }],
    };
  }
}
