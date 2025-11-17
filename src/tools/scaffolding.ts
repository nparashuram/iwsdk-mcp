export async function scaffoldProject(template: string, projectName: string) {
  const templates: Record<string, any> = {
    minimal: {
      description: 'Minimal IWSDK project with basic world setup',
      files: {
        'package.json': `{
  "name": "${projectName}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@iwsdk/core": "^0.1.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`,
        'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}`,
        'vite.config.ts': `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: true,
    port: 3000
  }
});`,
        'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <style>
      body {
        margin: 0;
        overflow: hidden;
        font-family: system-ui, sans-serif;
      }
      #app {
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
        'src/main.ts': `import { World, SessionMode } from '@iwsdk/core';
import * as THREE from 'three';

async function main() {
  const container = document.getElementById('app')!;

  const world = await World.create(container, {
    xr: {
      sessionMode: SessionMode.ImmersiveVR
    }
  });

  // Add a simple cube
  const cube = world.createTransformEntity();
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshStandardMaterial({ color: 0x4488ff });
  const mesh = new THREE.Mesh(geometry, material);
  cube.object3D!.add(mesh);
  cube.object3D!.position.set(0, 1.5, -2);

  // Add lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  world.scene.add(light);
  world.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  console.log('IWSDK World initialized!');
}

main().catch(console.error);`
      }
    },

    interactive: {
      description: 'Interactive VR project with grabbing and UI',
      files: {
        'package.json': `{
  "name": "${projectName}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@iwsdk/core": "^0.1.0",
    "@iwsdk/xr-input": "^0.1.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`,
        'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}`,
        'vite.config.ts': `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: true,
    port: 3000
  }
});`,
        'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <style>
      body { margin: 0; overflow: hidden; }
      #app { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
        'src/main.ts': `import {
  World,
  SessionMode,
  Interactable,
  OneHandGrabbable,
  UIKitDocument,
  PanelUISystem
} from '@iwsdk/core';
import * as THREE from 'three';

async function main() {
  const world = await World.create(document.getElementById('app')!, {
    xr: { sessionMode: SessionMode.ImmersiveVR },
    features: {
      enableGrabbing: true
    }
  });

  // Register UI system
  world.registerSystem(PanelUISystem);

  // Create grabbable cube
  const cube = world.createTransformEntity();
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
  const mesh = new THREE.Mesh(geometry, material);
  cube.object3D!.add(mesh);
  cube.object3D!.position.set(-0.5, 1.2, -1);

  cube.addComponent(Interactable);
  cube.addComponent(OneHandGrabbable, {
    rotate: true,
    translate: true
  });

  // Create UI panel
  const panel = world.createTransformEntity();
  panel.object3D!.position.set(0.5, 1.5, -1.5);

  const doc = panel.addComponent(UIKitDocument, {
    source: \`
      <view style="width: 400px; height: 300px; padding: 20px; background-color: #222222dd;">
        <text style="font-size: 36px; color: #ffffff;">Interactive Demo</text>
        <button id="colorBtn" style="margin-top: 20px;">Change Color</button>
      </view>
    \`
  });

  const button = doc.getElementById('colorBtn')!;
  button.onClick = () => {
    material.color.setHex(Math.random() * 0xffffff);
  };

  // Environment
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x336633 })
  );
  ground.rotation.x = -Math.PI / 2;
  world.scene.add(ground);

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  world.scene.add(light);
  world.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  console.log('Interactive world ready!');
}

main().catch(console.error);`
      }
    },

    locomotion: {
      description: 'VR project with full locomotion system',
      files: {
        'package.json': `{
  "name": "${projectName}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@iwsdk/core": "^0.1.0",
    "@iwsdk/xr-input": "^0.1.0",
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`,
        'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}`,
        'vite.config.ts': `import { defineConfig } from 'vite';

export default defineConfig({
  server: { https: true, port: 3000 }
});`,
        'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${projectName}</title>
    <style>
      body { margin: 0; overflow: hidden; }
      #app { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
        'src/main.ts': `import { World, SessionMode, LocomotionSystem } from '@iwsdk/core';
import * as THREE from 'three';

async function main() {
  const world = await World.create(document.getElementById('app')!, {
    xr: { sessionMode: SessionMode.ImmersiveVR },
    features: { enableLocomotion: true }
  });

  world.registerSystem(LocomotionSystem, {
    configData: {
      slidingSpeed: 5,
      turningMethod: 1,  // Snap turn
      turningAngle: 45,
      teleportEnabled: true,
      useWorker: true
    }
  });

  // Create environment
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x336633 })
  );
  ground.rotation.x = -Math.PI / 2;
  world.scene.add(ground);

  // Add some obstacles
  for (let i = 0; i < 5; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: 0x8888ff })
    );
    box.position.set(
      Math.random() * 10 - 5,
      1,
      Math.random() * 10 - 5
    );
    world.scene.add(box);
  }

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  world.scene.add(light);
  world.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  console.log('Locomotion demo ready! Use thumbsticks to move and turn.');
}

main().catch(console.error);`
      }
    }
  };

  const tmpl = templates[template];

  if (!tmpl) {
    return {
      content: [
        {
          type: 'text',
          text: `Template "${template}" not found.\n\nAvailable templates:\n- minimal: Basic IWSDK setup\n- interactive: Grabbing and UI\n- locomotion: Full movement system\n- ui-demo: Spatial UI showcase\n- full-featured: All systems enabled`,
        },
      ],
    };
  }

  let result = `# ${projectName} - ${tmpl.description}\n\n`;
  result += `## Project Structure\n\n\`\`\`\n`;
  result += `${projectName}/\n`;

  const fileKeys = Object.keys(tmpl.files).sort();
  for (const file of fileKeys) {
    const indent = file.startsWith('src/') ? '  ' : '';
    result += `${indent}├── ${file}\n`;
  }

  result += `\`\`\`\n\n`;
  result += `## Setup Instructions\n\n`;
  result += `1. Create project directory:\n\`\`\`bash\nmkdir ${projectName} && cd ${projectName}\n\`\`\`\n\n`;
  result += `2. Create the following files:\n\n`;

  for (const [filename, content] of Object.entries(tmpl.files)) {
    result += `### ${filename}\n\n\`\`\`${getFileExtension(filename)}\n${content}\n\`\`\`\n\n`;
  }

  result += `## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n`;
  result += `## Development\n\n\`\`\`bash\nnpm run dev\n\`\`\`\n\n`;
  result += `Visit https://localhost:3000 in a WebXR-compatible browser!\n`;

  return {
    content: [
      {
        type: 'text',
        text: result,
      },
    ],
  };
}

function getFileExtension(filename: string): string {
  if (filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.html')) return 'html';
  return '';
}
