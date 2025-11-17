import { searchExamples, getAllCodeExamples, getValidationRules, getComponentRequirements } from '../lib/cache-loader.js';

export async function composeFeature(featureDescription: string) {
  const lower = featureDescription.toLowerCase();

  const compositions: Array<{
    keywords: string[];
    components: string[];
    systems: string[];
    apis: Array<{ class: string; method: string }>;
    codeStructure: string;
    fullExample: string;
  }> = [
    {
      keywords: ['ball', 'sphere', 'grabbable', 'grab', 'pick up', 'hold'],
      components: ['Interactable', 'OneHandGrabbable'],
      systems: ['GrabSystem (auto-enabled with enableGrabbing feature)'],
      apis: [
        { class: 'World', method: 'createTransformEntity()' },
        { class: 'Entity', method: 'addComponent()' },
        { class: 'THREE.Mesh', method: 'constructor()' },
        { class: 'THREE.SphereGeometry', method: 'constructor()' },
      ],
      codeStructure: `
1. Create transform entity
2. Create Three.js sphere geometry and material
3. Create mesh and add to entity
4. Position the entity
5. Add Interactable component
6. Add OneHandGrabbable component with configuration
`,
      fullExample: `import { Interactable, OneHandGrabbable } from '@iwsdk/core';
import * as THREE from 'three';

// Create entity with 3D transform
const ball = world.createTransformEntity();

// Create sphere geometry and material
const geometry = new THREE.SphereGeometry(0.15);  // 15cm radius
const material = new THREE.MeshStandardMaterial({
  color: 0xff4444,
  metalness: 0.3,
  roughness: 0.7
});

// Create mesh and add to entity
const mesh = new THREE.Mesh(geometry, material);
ball.object3D!.add(mesh);

// Position the ball in the scene
ball.object3D!.position.set(0, 1.2, -1);  // At eye level, 1m forward

// Make it interactable (required for all interactive objects)
ball.addComponent(Interactable);

// Make it grabbable with one hand
ball.addComponent(OneHandGrabbable, {
  rotate: true,      // Allow rotation while grabbed
  translate: true    // Allow position changes
});

console.log('Grabbable ball created!');`
    },
    {
      keywords: ['clickable', 'button', 'click', 'interact', 'press'],
      components: ['Interactable'],
      systems: ['InputSystem (always active)'],
      apis: [
        { class: 'World', method: 'createTransformEntity()' },
        { class: 'Entity', method: 'addComponent()' },
        { class: 'Entity', method: 'onClick property' },
      ],
      codeStructure: `
1. Create transform entity
2. Create Three.js geometry (box/sphere for button)
3. Add mesh to entity
4. Position appropriately (comfortable distance)
5. Add Interactable component
6. Set onClick event handler
7. Optional: Add visual feedback (hover, press)
`,
      fullExample: `import { Interactable } from '@iwsdk/core';
import * as THREE from 'three';

// Create button entity
const button = world.createTransformEntity();

// Create button geometry
const geometry = new THREE.BoxGeometry(0.3, 0.15, 0.05);
const material = new THREE.MeshStandardMaterial({ color: 0x4444ff });
const mesh = new THREE.Mesh(geometry, material);
button.object3D!.add(mesh);

// Position at comfortable distance
button.object3D!.position.set(0, 1.5, -2);

// Make it interactable
button.addComponent(Interactable);

// Add click handler
button.onClick = () => {
  console.log('Button clicked!');
  // Change color on click
  material.color.setHex(0xff4444);
};

// Add hover feedback
button.onHoverEnter = () => {
  button.setValue(Interactable, 'glowIntensity', 1.5);
};

button.onHoverExit = () => {
  button.setValue(Interactable, 'glowIntensity', 0);
};`
    },
    {
      keywords: ['physics', 'falling', 'gravity', 'bounce', 'collide', 'dynamic'],
      components: ['PhysicsBody', 'PhysicsShape'],
      systems: ['PhysicsSystem'],
      apis: [
        { class: 'World', method: 'createTransformEntity()' },
        { class: 'World', method: 'registerSystem()' },
        { class: 'Entity', method: 'addComponent()' },
      ],
      codeStructure: `
1. Register PhysicsSystem if not already registered
2. Create transform entity
3. Create and add visual mesh
4. Position entity above ground
5. Add PhysicsBody component (type: dynamic)
6. Add PhysicsShape component (matching visual geometry)
7. Configure physics properties (mass, friction, restitution)
`,
      fullExample: `import { PhysicsSystem, PhysicsBody, PhysicsShape } from '@iwsdk/core';
import * as THREE from 'three';

// Register physics system (only needed once)
world.registerSystem(PhysicsSystem, {
  gravity: [0, -9.81, 0],
  useWorker: true
});

// Create entity
const ball = world.createTransformEntity();

// Visual representation
const geometry = new THREE.SphereGeometry(0.2);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geometry, material);
ball.object3D!.add(mesh);

// Position above ground
ball.object3D!.position.set(0, 3, 0);

// Add physics body (dynamic = affected by forces)
ball.addComponent(PhysicsBody, {
  type: 'dynamic',
  mass: 1.0,
  friction: 0.5,
  restitution: 0.6  // Bounciness (0-1)
});

// Add collision shape (must match visual size)
ball.addComponent(PhysicsShape, {
  shape: 'sphere',
  radius: 0.2  // Same as geometry radius
});

console.log('Physics ball created - will fall and bounce!');`
    },
    {
      keywords: ['ui', 'panel', 'menu', 'text', 'spatial ui', 'uikit'],
      components: ['UIKitDocument'],
      systems: ['PanelUISystem'],
      apis: [
        { class: 'World', method: 'registerSystem()' },
        { class: 'World', method: 'createTransformEntity()' },
        { class: 'Entity', method: 'addComponent()' },
        { class: 'UIKitDocument', method: 'getElementById()' },
      ],
      codeStructure: `
1. Register PanelUISystem if not already registered
2. Create transform entity for panel
3. Position panel at comfortable viewing distance
4. Add UIKitDocument component with UIKitML markup
5. Get element references using getElementById
6. Attach event handlers (onClick, etc.)
7. Update content dynamically as needed
`,
      fullExample: `import { PanelUISystem, UIKitDocument } from '@iwsdk/core';

// Register UI system (only needed once)
world.registerSystem(PanelUISystem);

// Create panel entity
const panel = world.createTransformEntity();
panel.object3D!.position.set(0, 1.5, -2);  // Comfortable reading distance

// Add UI with UIKitML
const doc = panel.addComponent(UIKitDocument, {
  source: \`
    <view style="width: 500px; height: 300px; padding: 20px; background-color: #222222dd; flex-direction: column;">
      <text style="font-size: 36px; color: #ffffff; margin-bottom: 20px;">
        Hello VR!
      </text>
      <button id="myButton" style="padding: 10px; background-color: #4444ff;">
        Click Me
      </button>
      <text id="status" style="margin-top: 20px; color: #aaaaaa;">
        Status: Ready
      </text>
    </view>
  \`
});

// Get element references
const button = doc.getElementById('myButton')!;
const status = doc.getElementById('status')!;

// Add interactivity
let clickCount = 0;
button.onClick = () => {
  clickCount++;
  status.textContent = \`Clicked \${clickCount} times\`;
  status.style.color = '#00ff00';
};`
    },
    {
      keywords: ['movement', 'locomotion', 'walking', 'teleport', 'move'],
      components: ['LocomotionCollider (for walkable surfaces)'],
      systems: ['LocomotionSystem'],
      apis: [
        { class: 'World', method: 'registerSystem()' },
        { class: 'Entity', method: 'addComponent()' },
      ],
      codeStructure: `
1. Register LocomotionSystem with configuration
2. Create ground/floor entities
3. Add LocomotionCollider to walkable surfaces
4. Configure slide speed, turn method, teleport
5. Enable Web Worker for performance
`,
      fullExample: `import { LocomotionSystem, LocomotionCollider } from '@iwsdk/core';
import * as THREE from 'three';

// Register locomotion system
world.registerSystem(LocomotionSystem, {
  configData: {
    slidingSpeed: 5,          // 5 m/s
    turningMethod: 1,         // 1 = snap turn, 0 = smooth
    turningAngle: 45,         // Degrees for snap turn
    teleportEnabled: true,
    useWorker: true           // Run physics on worker
  }
});

// Create ground
const ground = world.createTransformEntity();
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x336633 })
);
groundMesh.rotation.x = -Math.PI / 2;
ground.object3D!.add(groundMesh);

// Make ground walkable for locomotion
ground.addComponent(LocomotionCollider, {
  type: 'static',
  walkable: true  // Can teleport to this surface
});

console.log('Locomotion enabled! Use thumbsticks to move.');`
    }
  ];

  for (const comp of compositions) {
    if (comp.keywords.some(keyword => lower.includes(keyword))) {
      let result = `# Feature Composition: ${featureDescription}\n\n`;

      result += `## Required Components\n\n`;
      for (const component of comp.components) {
        result += `- **${component}**\n`;
      }
      result += '\n';

      result += `## Required Systems\n\n`;
      for (const system of comp.systems) {
        result += `- **${system}**\n`;
      }
      result += '\n';

      result += `## Key APIs Used\n\n`;
      for (const api of comp.apis) {
        result += `- **${api.class}.${api.method}**\n`;
      }
      result += '\n';

      result += `## Implementation Steps\n${comp.codeStructure}\n`;

      result += `## Complete Working Code\n\n\`\`\`typescript\n${comp.fullExample}\n\`\`\`\n`;

      return {
        content: [{ type: 'text', text: result }]
      };
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `# Feature Composition: ${featureDescription}

I couldn't find a specific composition for this feature. Here's how to break it down:

## General Approach

1. **Identify Components**: What data does this feature need?
   - Use \`search_code_examples\` to find similar features
   - Use \`get_component_schema\` to see available components

2. **Identify Systems**: What behavior is needed?
   - Use \`find_implementation_pattern\` for common patterns
   - Use \`lookup_package_exports\` to see available systems

3. **Find Examples**: Get working code to adapt
   - Use \`search_code_examples\` with relevant keywords
   - Use \`get_api_documentation\` for exact APIs

## Recommended Queries

Try these MCP tools:
- \`search_code_examples\` with keywords from your feature
- \`find_implementation_pattern\` for similar functionality
- \`get_best_practices\` for "ecs-patterns"

Common feature types:
- **Interactive objects**: Require Interactable component
- **Movement**: Use LocomotionSystem
- **Physics**: Use PhysicsSystem + PhysicsBody + PhysicsShape
- **UI**: Use PanelUISystem + UIKitDocument
- **Manipulation**: Use grabbing components`
      }
    ]
  };
}

export async function validateCode(code: string) {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (code.includes('world.createEntity()') && code.includes('.object3D')) {
    issues.push('Using createEntity() but accessing object3D - use createTransformEntity() instead');
    suggestions.push('Change world.createEntity() to world.createTransformEntity()');
  }

  if (code.includes('addComponent(Interactable)') &&
      !code.includes('onClick') &&
      !code.includes('onHover') &&
      !code.includes('OneHandGrabbable') &&
      !code.includes('TwoHandsGrabbable')) {
    suggestions.push('Interactable component added but no event handlers or grabbing. Add onClick/onHoverEnter handlers or grabbing components.');
  }

  if (code.includes('PhysicsBody') && !code.includes('PhysicsShape')) {
    issues.push('PhysicsBody without PhysicsShape - both are required for physics');
    suggestions.push('Add PhysicsShape component with appropriate shape (box, sphere, capsule)');
  }

  if (code.includes('PhysicsSystem') && !code.includes('registerSystem')) {
    issues.push('Using physics components but PhysicsSystem not registered');
    suggestions.push('Add: world.registerSystem(PhysicsSystem);');
  }

  if (code.includes('UIKitDocument') && !code.includes('PanelUISystem')) {
    issues.push('Using UIKitDocument but PanelUISystem not registered');
    suggestions.push('Add: world.registerSystem(PanelUISystem);');
  }

  if (code.includes('LocomotionSystem') && !code.includes('enableLocomotion') && !code.includes('registerSystem(LocomotionSystem')) {
    suggestions.push('Consider using features.enableLocomotion: true in World.create() for simpler setup');
  }

  if (code.includes('new THREE.Mesh') && !code.includes('object3D!.add')) {
    issues.push('Created THREE.Mesh but not added to entity or scene');
    suggestions.push('Add mesh to entity: entity.object3D!.add(mesh);');
  }

  const allRules = await getValidationRules();
  for (const rule of allRules) {
    const componentMatch = rule.id.match(/component-(\w+)-requires/);
    if (componentMatch) {
      const componentName = componentMatch[1];
      if (code.includes(componentName)) {
        const requirements = await getComponentRequirements(componentName);
        for (const req of requirements) {
          if (!code.includes(req)) {
            if (rule.severity === 'error') {
              issues.push(`${rule.message} - Missing ${req}`);
            } else {
              suggestions.push(rule.message);
            }
          }
        }
      }
    }
  }

  let result = `# Code Validation Results\n\n`;

  if (issues.length === 0 && suggestions.length === 0) {
    result += `**No issues found!** The code looks good.\n\n`;
    result += `The code follows IWSDK best practices and should work correctly.\n`;
  } else {
    if (issues.length > 0) {
      result += `## Issues Found\n\n`;
      for (let i = 0; i < issues.length; i++) {
        result += `${i + 1}. ${issues[i]}\n`;
      }
      result += '\n';
    }

    if (suggestions.length > 0) {
      result += `## Suggestions\n\n`;
      for (let i = 0; i < suggestions.length; i++) {
        result += `${i + 1}. ${suggestions[i]}\n`;
      }
      result += '\n';
    }
  }

  return {
    content: [{ type: 'text', text: result }]
  };
}

export async function findSimilarCode(description: string) {
  const examples = await getAllCodeExamples();
  const lower = description.toLowerCase();

  const scored = examples.map(example => {
    let score = 0;

    if (example.title.toLowerCase().includes(lower)) score += 10;
    if (example.description.toLowerCase().includes(lower)) score += 5;

    for (const tag of example.tags) {
      if (lower.includes(tag.toLowerCase())) score += 3;
    }

    if (example.code.toLowerCase().includes(lower)) score += 2;

    return { example, score };
  });

  const topExamples = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (topExamples.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No similar code examples found for "${description}".\n\nTry using \`search_code_examples\` with specific keywords or \`find_implementation_pattern\` for common features.`
        }
      ]
    };
  }

  let result = `# Similar Code Examples for "${description}"\n\n`;
  result += `Found ${topExamples.length} relevant example${topExamples.length > 1 ? 's' : ''}:\n\n`;

  for (let i = 0; i < topExamples.length; i++) {
    const { example, score } = topExamples[i];
    result += `## ${i + 1}. ${example.title}\n\n`;
    result += `**Relevance**: ${score} points\n`;
    result += `**Description**: ${example.description}\n`;
    result += `**Category**: ${example.category}\n`;
    result += `**Tags**: ${example.tags.join(', ')}\n\n`;
    result += `\`\`\`typescript\n${example.code}\n\`\`\`\n\n`;
    result += `---\n\n`;
  }

  return {
    content: [{ type: 'text', text: result }]
  };
}
