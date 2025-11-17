#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getApiDocumentation } from './tools/api-docs.js';
import { searchCodeExamples } from './tools/code-examples.js';
import { explainConcept } from './tools/concepts.js';
import { getComponentSchema } from './tools/components.js';
import { generateSystemTemplate, getSystemInfo } from './tools/systems.js';
import { getSetupGuide } from './tools/setup.js';
import { findImplementationPattern } from './tools/patterns.js';
import { lookupPackageExports } from './tools/packages.js';
import { getBestPractices } from './tools/best-practices.js';
import { scaffoldProject } from './tools/scaffolding.js';
import { explainAssetPipeline } from './tools/assets.js';
import { troubleshootError } from './tools/troubleshooting.js';
import { composeFeature, validateCode, findSimilarCode } from './tools/code-generation.js';
import { getValidationRulesForComponent, checkComponentOrder, getTroubleshootingHelp } from './tools/validation.js';
import { logToolCall } from './telemetry.js';

const server = new Server(
  {
    name: 'iwsdk-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_api_documentation',
        description:
          'Query API documentation for specific IWSDK classes, methods, or components. Returns exact API signatures, parameters, return types, and descriptions.',
        inputSchema: {
          type: 'object',
          properties: {
            packageName: {
              type: 'string',
              description: 'The IWSDK package name (e.g., @iwsdk/core, @iwsdk/xr-input)',
            },
            className: {
              type: 'string',
              description: 'The class or component name to look up',
            },
            methodName: {
              type: 'string',
              description: 'Optional: specific method to query',
            },
          },
          required: ['packageName', 'className'],
        },
      },
      {
        name: 'search_code_examples',
        description:
          'Find relevant code examples from official IWSDK documentation. Returns annotated code snippets with explanations.',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              description: 'Feature or keyword to search for (e.g., "grabbing", "locomotion", "spatial UI")',
            },
            category: {
              type: 'string',
              enum: ['component', 'system', 'interaction', 'setup', 'any'],
              description: 'Category of code example',
            },
          },
          required: ['feature'],
        },
      },
      {
        name: 'explain_concept',
        description:
          'Get detailed explanations of IWSDK concepts including ECS architecture, locomotion, spatial UI, input handling, and more.',
        inputSchema: {
          type: 'object',
          properties: {
            concept: {
              type: 'string',
              enum: [
                'ecs',
                'entities',
                'components',
                'systems',
                'queries',
                'locomotion',
                'slide',
                'teleport',
                'turn',
                'spatial-ui',
                'uikit',
                'uikitml',
                'input',
                'controllers',
                'hand-tracking',
                'pointers',
                'grabbing',
                'physics',
                'audio',
                'scene-understanding',
                'glxf',
                'three-js-integration',
              ],
              description: 'The concept to explain',
            },
          },
          required: ['concept'],
        },
      },
      {
        name: 'get_component_schema',
        description:
          'Get the exact schema definition for an IWSDK component including field names, types, and default values.',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: {
              type: 'string',
              description: 'Name of the component (e.g., Interactable, Health, PhysicsBody)',
            },
          },
          required: ['componentName'],
        },
      },
      {
        name: 'generate_system_template',
        description:
          'Generate TypeScript boilerplate code for creating a custom ECS system with proper typing and query setup.',
        inputSchema: {
          type: 'object',
          properties: {
            systemName: {
              type: 'string',
              description: 'Name for the system (e.g., HealthRegenSystem)',
            },
            queries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Query name',
                  },
                  required: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Required components',
                  },
                  excluded: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Excluded components',
                  },
                },
                required: ['name', 'required'],
              },
              description: 'Entity queries for the system',
            },
            configFields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  default: {},
                },
                required: ['name', 'type'],
              },
              description: 'Configuration fields for the system',
            },
          },
          required: ['systemName', 'queries'],
        },
      },
      {
        name: 'get_setup_guide',
        description:
          'Get step-by-step instructions for setting up an IWSDK project including commands and configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            projectType: {
              type: 'string',
              enum: ['basic', 'vr', 'ar', 'interactive', 'multiplayer'],
              description: 'Type of project to set up',
            },
          },
          required: ['projectType'],
        },
      },
      {
        name: 'find_implementation_pattern',
        description:
          'Get complete implementation guides for common IWSDK features with example code and configuration.',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              enum: [
                'grabbing',
                'locomotion',
                'spatial-ui',
                'audio',
                'physics',
                'input-handling',
                'scene-loading',
                'custom-component',
                'custom-system',
              ],
              description: 'Feature to implement',
            },
          },
          required: ['feature'],
        },
      },
      {
        name: 'lookup_package_exports',
        description:
          'List all exported classes, functions, types, and components from a specific IWSDK package.',
        inputSchema: {
          type: 'object',
          properties: {
            packageName: {
              type: 'string',
              enum: ['@iwsdk/core', '@iwsdk/xr-input', '@iwsdk/glxf', '@iwsdk/locomotor'],
              description: 'Package to query',
            },
          },
          required: ['packageName'],
        },
      },
      {
        name: 'get_best_practices',
        description:
          'Get recommended patterns and anti-patterns for IWSDK development including performance tips and common mistakes.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              enum: [
                'performance',
                'ecs-patterns',
                'input-handling',
                'state-management',
                'asset-loading',
                'testing',
              ],
              description: 'Topic for best practices',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'scaffold_project',
        description:
          'Generate a complete IWSDK project structure including package.json, Vite config, TypeScript setup, and starter code.',
        inputSchema: {
          type: 'object',
          properties: {
            template: {
              type: 'string',
              enum: ['minimal', 'interactive', 'locomotion', 'ui-demo', 'full-featured'],
              description: 'Project template to use',
            },
            projectName: {
              type: 'string',
              description: 'Name for the project',
            },
          },
          required: ['template', 'projectName'],
        },
      },
      {
        name: 'explain_asset_pipeline',
        description:
          'Get guidance on GLXF/GLTF asset handling including import, optimization, and loading.',
        inputSchema: {
          type: 'object',
          properties: {
            assetType: {
              type: 'string',
              enum: ['glxf', 'gltf', 'texture', 'audio'],
              description: 'Type of asset',
            },
            operation: {
              type: 'string',
              enum: ['import', 'optimize', 'load', 'runtime'],
              description: 'Asset operation',
            },
          },
          required: ['assetType', 'operation'],
        },
      },
      {
        name: 'troubleshoot_error',
        description:
          'Get diagnostic steps and solutions for common IWSDK errors and issues.',
        inputSchema: {
          type: 'object',
          properties: {
            errorMessage: {
              type: 'string',
              description: 'Error message or description of the issue',
            },
          },
          required: ['errorMessage'],
        },
      },
      {
        name: 'compose_feature',
        description:
          'Compose a complete feature implementation by providing all necessary components, systems, APIs, and complete working code. Best for requests like "add a grabbable ball", "create a clickable button", etc.',
        inputSchema: {
          type: 'object',
          properties: {
            featureDescription: {
              type: 'string',
              description: 'Description of the feature to implement (e.g., "add a grabbable ball to the scene")',
            },
          },
          required: ['featureDescription'],
        },
      },
      {
        name: 'validate_code',
        description:
          'Validate generated IWSDK code against best practices and common mistakes. Checks for missing components, unregistered systems, and API misuse.',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The IWSDK code to validate',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'find_similar_code',
        description:
          'Find the most similar code examples to a given description. Returns top 3 most relevant examples with relevance scores.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of what you want to find code for',
            },
          },
          required: ['description'],
        },
      },
      {
        name: 'get_system_info',
        description:
          'Get detailed information about an IWSDK system including description, methods, properties, and which components it queries.',
        inputSchema: {
          type: 'object',
          properties: {
            systemName: {
              type: 'string',
              description: 'Name of the system (e.g., PhysicsSystem, GrabSystem, LocomotionSystem)',
            },
          },
          required: ['systemName'],
        },
      },
      {
        name: 'get_validation_rules',
        description:
          'Get validation rules for a specific component or system. Returns checks that should be performed when using that component/system.',
        inputSchema: {
          type: 'object',
          properties: {
            componentOrSystem: {
              type: 'string',
              description: 'Component or system name to get validation rules for (optional - returns all rules if not specified)',
            },
          },
        },
      },
      {
        name: 'check_component_order',
        description:
          'Check the correct ordering for adding components. Returns which components must be added before or after the specified component.',
        inputSchema: {
          type: 'object',
          properties: {
            componentName: {
              type: 'string',
              description: 'Component name to check ordering for',
            },
          },
          required: ['componentName'],
        },
      },
      {
        name: 'get_common_mistakes',
        description:
          'Search for common mistakes and troubleshooting help. Returns wrong/correct code examples for common IWSDK pitfalls.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for common mistakes (e.g., "physics", "grabbable", "entity creation")',
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error('Missing arguments');
    }

    // Log tool usage for telemetry
    await logToolCall(name, args);

    switch (name) {
      case 'get_api_documentation':
        return await getApiDocumentation(
          args.packageName as string,
          args.className as string,
          args.methodName as string | undefined
        );

      case 'search_code_examples':
        return await searchCodeExamples(
          args.feature as string,
          args.category as string | undefined
        );

      case 'explain_concept':
        return await explainConcept(args.concept as string);

      case 'get_component_schema':
        return await getComponentSchema(args.componentName as string);

      case 'generate_system_template':
        return await generateSystemTemplate(
          args.systemName as string,
          args.queries as any[],
          args.configFields as any[] | undefined
        );

      case 'get_setup_guide':
        return await getSetupGuide(args.projectType as string);

      case 'find_implementation_pattern':
        return await findImplementationPattern(args.feature as string);

      case 'lookup_package_exports':
        return await lookupPackageExports(args.packageName as string);

      case 'get_best_practices':
        return await getBestPractices(args.topic as string);

      case 'scaffold_project':
        return await scaffoldProject(
          args.template as string,
          args.projectName as string
        );

      case 'explain_asset_pipeline':
        return await explainAssetPipeline(
          args.assetType as string,
          args.operation as string
        );

      case 'troubleshoot_error':
        return await troubleshootError(args.errorMessage as string);

      case 'compose_feature':
        return await composeFeature(args.featureDescription as string);

      case 'validate_code':
        return await validateCode(args.code as string);

      case 'find_similar_code':
        return await findSimilarCode(args.description as string);

      case 'get_system_info':
        return await getSystemInfo(args.systemName as string);

      case 'get_validation_rules':
        return await getValidationRulesForComponent(args.componentOrSystem as string | undefined);

      case 'check_component_order':
        return await checkComponentOrder(args.componentName as string);

      case 'get_common_mistakes':
        return await getTroubleshootingHelp(args.query as string | undefined);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('IWSDK MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
