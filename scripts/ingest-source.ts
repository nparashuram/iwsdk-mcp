import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as ts from 'typescript';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_OUTPUT = join(__dirname, '..', 'cache', 'iwsdk-cache.json');

interface ComponentDefinition {
  name: string;
  package: string;
  filePath: string;
  description: string;
  remarks?: string;
  category?: string;
  jsdocExamples: string[];
  fields: Array<{
    name: string;
    type: string;
    default?: any;
    description?: string;
  }>;
  sourceCode: string;
  usageExamples: string[];
  requires: string[];
  optionalWith: string[];
  usedBySystems: string[];
  coOccurrences: Record<string, number>;
  importPath: string;
  keywords: string[];
}

interface SystemDefinition {
  name: string;
  package: string;
  filePath: string;
  description: string;
  remarks?: string;
  category?: string;
  methods: Array<{
    name: string;
    signature: string;
    description: string;
    returnType?: string;
  }>;
  properties: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  sourceCode: string;
  queriesComponents: string[];
  importPath: string;
  keywords: string[];
}

interface TypeDefinition {
  name: string;
  package: string;
  filePath: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  definition: string;
  fields?: Array<{
    name: string;
    type: string;
    optional?: boolean;
    description?: string;
  }>;
}

interface ExampleCode {
  title: string;
  filePath: string;
  description: string;
  code: string;
  category: string;
  tags: string[];
  componentsUsed: string[];
  systemsUsed: string[];
  initPattern?: string;
}

interface Relationship {
  from: string;
  to: string;
  type: string;
}

interface ComponentPattern {
  name: string;
  components: string[];
  frequency: number;
  category: string;
}

interface OrderingConstraint {
  before: string;
  after: string;
  reason: string;
}

interface ValidationRule {
  id: string;
  description: string;
  check: string;
  message: string;
  severity: 'error' | 'warning';
}

interface CommonMistake {
  id: string;
  title: string;
  description: string;
  wrongCode: string;
  correctCode: string;
  category: string;
}

interface IngestedCache {
  metadata: {
    ingestDate: string;
    iwsdkVersion: string;
    repository: string;
    commit: string;
  };
  components: Record<string, ComponentDefinition>;
  systems: Record<string, SystemDefinition>;
  types: Record<string, TypeDefinition>;
  examples: ExampleCode[];
  relationships: {
    componentRequires: Relationship[];
    systemQueries: Relationship[];
    typicalCompositions: ComponentPattern[];
  };
  constraints: {
    ordering: OrderingConstraint[];
    validation: ValidationRule[];
  };
  troubleshooting: {
    commonMistakes: CommonMistake[];
  };
  packageExports: Record<string, {
    classes: string[];
    functions: string[];
    types: string[];
    components: string[];
    systems: string[];
  }>;
}

async function findPackageVersion(repoPath: string): Promise<string> {
  try {
    const packageJsonPath = join(repoPath, 'packages', 'core', 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function validateRepoPath(repoPath: string): void {
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const packagesPath = join(repoPath, 'packages');
  if (!existsSync(packagesPath)) {
    throw new Error(`Not a valid IWSDK repository (missing packages/ directory): ${repoPath}`);
  }

  const corePath = join(packagesPath, 'core');
  if (!existsSync(corePath)) {
    throw new Error(`Not a valid IWSDK repository (missing packages/core): ${repoPath}`);
  }

  console.log(`Valid IWSDK repository found at: ${repoPath}`);
}

async function parseComponents(repoPath: string): Promise<Record<string, ComponentDefinition>> {
  console.log('Parsing components...');

  const components: Record<string, ComponentDefinition> = {};
  const packages = ['core', 'xr-input', 'glxf', 'locomotor'];

  for (const pkg of packages) {
    const srcDir = join(repoPath, 'packages', pkg, 'src');

    if (!existsSync(srcDir)) {
      console.log(`Package src directory not found: ${srcDir}`);
      continue;
    }

    await parseComponentsInDir(srcDir, pkg, components, repoPath);
  }

  console.log(`Found ${Object.keys(components).length} components`);
  return components;
}

async function parseComponentsInDir(
  dir: string,
  packageName: string,
  components: Record<string, ComponentDefinition>,
  repoPath: string
) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      await parseComponentsInDir(fullPath, packageName, components, repoPath);
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      const content = await readFile(fullPath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file.name,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const relativePath = fullPath.substring(fullPath.indexOf('packages/'));
      const componentDefs = extractComponentsFromAST(sourceFile, content, `@iwsdk/${packageName}`, relativePath);
      Object.assign(components, componentDefs);
    }
  }
}

function extractComponentsFromAST(
  sourceFile: ts.SourceFile,
  content: string,
  packageName: string,
  filePath: string
): Record<string, ComponentDefinition> {
  const components: Record<string, ComponentDefinition> = {};

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];

      if (declaration && declaration.initializer && ts.isCallExpression(declaration.initializer)) {
        const callExpr = declaration.initializer as ts.CallExpression;
        const funcName = callExpr.expression.getText(sourceFile);

        if (funcName === 'createComponent' && callExpr.arguments.length >= 2) {
          const componentName = callExpr.arguments[0].getText(sourceFile).replace(/['"]/g, '');
          const schemaArg = callExpr.arguments[1];
          const descriptionArg = callExpr.arguments[2];

          const fields = parseComponentSchema(schemaArg, sourceFile);
          const jsdoc = extractJSDoc(node, sourceFile);
          const simpleDescription = descriptionArg
            ? descriptionArg.getText(sourceFile).replace(/['"]/g, '')
            : jsdoc.description || '';

          components[componentName] = {
            name: componentName,
            package: packageName,
            filePath,
            description: simpleDescription,
            remarks: jsdoc.remarks,
            category: jsdoc.category,
            jsdocExamples: jsdoc.examples,
            fields,
            sourceCode: declaration.getText(sourceFile),
            usageExamples: [],
            requires: [],
            optionalWith: [],
            usedBySystems: [],
            coOccurrences: {},
            importPath: `import { ${componentName} } from '${packageName}';`,
            keywords: generateKeywords(componentName, jsdoc)
          };
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return components;
}

function extractJSDoc(node: ts.Node, sourceFile: ts.SourceFile): {
  description: string;
  remarks?: string;
  category?: string;
  examples: string[];
} {
  const result = { description: '', examples: [] as string[] };
  const jsDocTags = ts.getJSDocTags(node);
  const jsDocComments = ts.getJSDocCommentsAndTags(node);

  for (const comment of jsDocComments) {
    if (ts.isJSDoc(comment) && comment.comment) {
      const commentText = typeof comment.comment === 'string'
        ? comment.comment
        : comment.comment.map(c => c.text).join('');
      result.description = commentText.trim();
    }
  }

  for (const tag of jsDocTags) {
    const tagName = tag.tagName.text;
    const tagComment = tag.comment;
    const tagText = typeof tagComment === 'string'
      ? tagComment
      : tagComment?.map(c => c.text).join('') || '';

    if (tagName === 'remarks') {
      result.remarks = tagText;
    } else if (tagName === 'category') {
      result.category = tagText;
    } else if (tagName === 'example') {
      result.examples.push(tagText);
    }
  }

  return result;
}

function generateKeywords(componentName: string, jsdoc: any): string[] {
  const keywords: string[] = [];

  const nameWords = componentName.split(/(?=[A-Z])/).map(w => w.toLowerCase());
  keywords.push(...nameWords);

  if (jsdoc.description) {
    const descWords = jsdoc.description.toLowerCase().match(/\b\w{4,}\b/g) || [];
    keywords.push(...descWords.slice(0, 5));
  }

  if (jsdoc.category) {
    keywords.push(jsdoc.category.toLowerCase());
  }

  return [...new Set(keywords)];
}

function parseComponentSchema(node: ts.Node, sourceFile: ts.SourceFile): Array<{
  name: string;
  type: string;
  default?: any;
  description?: string;
}> {
  const fields: Array<{ name: string; type: string; default?: any; description?: string }> = [];

  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const fieldName = prop.name.getText(sourceFile);
        const fieldValue = prop.initializer;

        const jsDocTags = ts.getJSDocTags(prop);
        let fieldDescription = '';
        const jsDocComments = ts.getJSDocCommentsAndTags(prop);
        for (const comment of jsDocComments) {
          if (ts.isJSDoc(comment) && comment.comment) {
            const commentText = typeof comment.comment === 'string'
              ? comment.comment
              : comment.comment.map(c => c.text).join('');
            fieldDescription = commentText.trim();
          }
        }

        if (ts.isObjectLiteralExpression(fieldValue)) {
          let fieldType = 'unknown';
          let defaultValue: any = undefined;

          for (const fieldProp of fieldValue.properties) {
            if (ts.isPropertyAssignment(fieldProp)) {
              const propName = fieldProp.name.getText(sourceFile);
              const propValue = fieldProp.initializer.getText(sourceFile);

              if (propName === 'type') {
                fieldType = propValue.replace('Types.', '');
              } else if (propName === 'default') {
                defaultValue = propValue;
              }
            }
          }

          fields.push({
            name: fieldName,
            type: fieldType,
            default: defaultValue,
            description: fieldDescription || undefined
          });
        }
      }
    }
  }

  return fields;
}

async function parseSystems(repoPath: string): Promise<Record<string, SystemDefinition>> {
  console.log('Parsing systems...');

  const systems: Record<string, SystemDefinition> = {};
  const packages = ['core', 'xr-input', 'glxf', 'locomotor'];

  for (const pkg of packages) {
    const srcDir = join(repoPath, 'packages', pkg, 'src');

    if (!existsSync(srcDir)) continue;

    await parseSystemsInDir(srcDir, pkg, systems, repoPath);
  }

  console.log(`Found ${Object.keys(systems).length} systems`);
  return systems;
}

async function parseSystemsInDir(
  dir: string,
  packageName: string,
  systems: Record<string, SystemDefinition>,
  repoPath: string
) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      await parseSystemsInDir(fullPath, packageName, systems, repoPath);
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      const content = await readFile(fullPath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file.name,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const relativePath = fullPath.substring(fullPath.indexOf('packages/'));
      const systemDefs = extractSystemsFromAST(sourceFile, content, `@iwsdk/${packageName}`, relativePath);
      Object.assign(systems, systemDefs);
    }
  }
}

function extractSystemsFromAST(
  sourceFile: ts.SourceFile,
  content: string,
  packageName: string,
  filePath: string
): Record<string, SystemDefinition> {
  const systems: Record<string, SystemDefinition> = {};

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;

      if (className.endsWith('System')) {
        const methods: Array<{ name: string; signature: string; description: string; returnType?: string }> = [];
        const properties: Array<{ name: string; type: string; description: string }> = [];
        const systemJsDoc = extractJSDoc(node, sourceFile);

        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.getText(sourceFile);
            const signature = member.getText(sourceFile).split('{')[0].trim();
            const methodJsDoc = extractJSDoc(member, sourceFile);
            const returnType = member.type?.getText(sourceFile);

            methods.push({
              name: methodName,
              signature,
              description: methodJsDoc.description || '',
              returnType
            });
          }

          if (ts.isPropertyDeclaration(member) && member.name) {
            const propName = member.name.getText(sourceFile);
            const propType = member.type?.getText(sourceFile) || 'unknown';
            const propJsDoc = extractJSDoc(member, sourceFile);

            properties.push({
              name: propName,
              type: propType,
              description: propJsDoc.description || ''
            });
          }
        }

        const queriesComponents = extractQueriedComponents(node, sourceFile);

        systems[className] = {
          name: className,
          package: packageName,
          filePath,
          description: systemJsDoc.description || '',
          remarks: systemJsDoc.remarks,
          category: systemJsDoc.category,
          methods,
          properties,
          sourceCode: node.getText(sourceFile).substring(0, 500),
          queriesComponents,
          importPath: `import { ${className} } from '${packageName}';`,
          keywords: generateKeywords(className, systemJsDoc)
        };
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return systems;
}

function extractQueriedComponents(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): string[] {
  const components: string[] = [];

  if (classNode.heritageClauses) {
    for (const heritageClause of classNode.heritageClauses) {
      for (const type of heritageClause.types) {
        if (ts.isExpressionWithTypeArguments(type)) {
          const expr = type.expression;

          if (ts.isCallExpression(expr)) {
            const funcName = expr.expression.getText(sourceFile);

            if (funcName === 'createSystem' && expr.arguments.length > 0) {
              const queriesArg = expr.arguments[0];

              if (ts.isObjectLiteralExpression(queriesArg)) {
                for (const prop of queriesArg.properties) {
                  if (ts.isPropertyAssignment(prop)) {
                    const queryDef = prop.initializer;

                    if (ts.isObjectLiteralExpression(queryDef)) {
                      for (const queryProp of queryDef.properties) {
                        if (ts.isPropertyAssignment(queryProp)) {
                          const propName = queryProp.name.getText(sourceFile);

                          if (propName === 'required') {
                            const requiredValue = queryProp.initializer;

                            if (ts.isArrayLiteralExpression(requiredValue)) {
                              for (const element of requiredValue.elements) {
                                const componentName = element.getText(sourceFile);
                                if (componentName && /^[A-Z]/.test(componentName)) {
                                  components.push(componentName);
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return [...new Set(components)];
}

async function extractComponentRelationships(
  repoPath: string,
  components: Record<string, ComponentDefinition>
): Promise<void> {
  console.log('Extracting component relationships...');

  const knownRelationships: Record<string, string[]> = {
    'OneHandGrabbable': ['Interactable'],
    'TwoHandsGrabbable': ['Interactable'],
    'DistanceGrabbable': ['Interactable'],
    'PhysicsBody': ['PhysicsShape'],
  };

  for (const [componentName, component] of Object.entries(components)) {
    if (knownRelationships[componentName]) {
      component.requires = knownRelationships[componentName];
    }

    const filePath = join(repoPath, component.filePath);
    if (!existsSync(filePath)) continue;

    const content = await readFile(filePath, 'utf-8');

    const requiresMatch = content.match(/\/\*\*[\s\S]*?@requires\s+([\w,\s]+)/);
    if (requiresMatch) {
      const requires = requiresMatch[1].split(',').map(s => s.trim());
      component.requires.push(...requires);
    }

    const sourceFile = ts.createSourceFile(
      componentName,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const text = node.getText(sourceFile);

        if (text.includes('hasComponent') || text.includes('getComponent')) {
          const match = text.match(/(?:hasComponent|getComponent)\s*\(\s*entity\s*,\s*(\w+)/);
          if (match && match[1] !== componentName) {
            const requiredComp = match[1];
            if (!component.requires.includes(requiredComp)) {
              component.requires.push(requiredComp);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    component.requires = [...new Set(component.requires)];
  }
}

async function parseTypes(repoPath: string): Promise<Record<string, TypeDefinition>> {
  console.log('Parsing types...');

  const types: Record<string, TypeDefinition> = {};
  const packages = ['core', 'xr-input', 'glxf', 'locomotor'];

  for (const pkg of packages) {
    const srcDir = join(repoPath, 'packages', pkg, 'src');

    if (!existsSync(srcDir)) continue;

    await parseTypesInDir(srcDir, `@iwsdk/${pkg}`, types);
  }

  console.log(`Found ${Object.keys(types).length} types`);
  return types;
}

async function parseTypesInDir(dir: string, packageName: string, types: Record<string, TypeDefinition>) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      await parseTypesInDir(fullPath, packageName, types);
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      const content = await readFile(fullPath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file.name,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const relativePath = fullPath.substring(fullPath.indexOf('packages/'));
      extractTypesFromAST(sourceFile, packageName, relativePath, types);
    }
  }
}

function extractTypesFromAST(
  sourceFile: ts.SourceFile,
  packageName: string,
  filePath: string,
  types: Record<string, TypeDefinition>
) {
  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      const fields = node.members.map(member => {
        if (ts.isPropertySignature(member) && member.name) {
          return {
            name: member.name.getText(sourceFile),
            type: member.type?.getText(sourceFile) || 'unknown',
            optional: !!member.questionToken
          };
        }
        return null;
      }).filter((f): f is { name: string; type: string; optional?: boolean } => f !== null);

      types[name] = {
        name,
        package: packageName,
        filePath,
        kind: 'interface',
        definition: node.getText(sourceFile),
        fields
      };
    }

    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      types[name] = {
        name,
        package: packageName,
        filePath,
        kind: 'type',
        definition: node.getText(sourceFile)
      };
    }

    if (ts.isEnumDeclaration(node)) {
      const name = node.name.text;
      types[name] = {
        name,
        package: packageName,
        filePath,
        kind: 'enum',
        definition: node.getText(sourceFile)
      };
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function parseExamples(repoPath: string): Promise<ExampleCode[]> {
  console.log('Parsing examples...');

  const examples: ExampleCode[] = [];
  const examplesDir = join(repoPath, 'examples');

  if (!existsSync(examplesDir)) {
    console.log('Examples directory not found');
    return examples;
  }

  const dirs = await readdir(examplesDir, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const examplePath = join(examplesDir, dir.name);
    const srcPath = join(examplePath, 'src');

    if (!existsSync(srcPath)) continue;

    const possibleFiles = [
      join(srcPath, 'index.js'),
      join(srcPath, 'index.ts'),
      join(srcPath, 'main.ts'),
      join(srcPath, 'main.js')
    ];

    let mainFile: string | null = null;
    let filePath = '';

    for (const file of possibleFiles) {
      if (existsSync(file)) {
        mainFile = file;
        const fileName = file.split('/').pop()!;
        filePath = `examples/${dir.name}/src/${fileName}`;
        break;
      }
    }

    if (!mainFile) continue;

    const code = await readFile(mainFile, 'utf-8');

    const componentsUsed = extractImports(code, 'components');
    const systemsUsed = extractImports(code, 'systems');
    const initPattern = extractWorldCreate(code);

    examples.push({
      title: formatExampleTitle(dir.name),
      filePath,
      description: `Example: ${formatExampleTitle(dir.name)}`,
      code,
      category: inferCategory(code),
      tags: inferTags(code),
      componentsUsed,
      systemsUsed,
      initPattern: initPattern || undefined
    });
  }

  console.log(`Found ${examples.length} examples`);
  return examples;
}

function extractWorldCreate(code: string): string | null {
  const worldCreateRegex = /World\.create\s*\([^)]*\)(?:\s*\.then)?/s;
  const match = code.match(worldCreateRegex);
  return match ? match[0] : null;
}

function extractImports(code: string, type: 'components' | 'systems'): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@iwsdk\/[^'"]+['"]/g;

  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const items = match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const item of items) {
      if (type === 'systems' && item.endsWith('System')) {
        imports.push(item);
      } else if (type === 'components' && !item.endsWith('System') && item.length > 0 && item[0] === item[0].toUpperCase()) {
        imports.push(item);
      }
    }
  }

  return imports;
}

function formatExampleTitle(dirName: string): string {
  return dirName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferCategory(code: string): string {
  if (code.includes('Interactable') || code.includes('onClick')) return 'interaction';
  if (code.includes('PhysicsSystem')) return 'physics';
  if (code.includes('UIKitDocument')) return 'ui';
  if (code.includes('LocomotionSystem')) return 'locomotion';
  return 'setup';
}

function inferTags(code: string): string[] {
  const tags: string[] = [];

  if (code.includes('Interactable')) tags.push('interactable');
  if (code.includes('Grabbable')) tags.push('grabbing');
  if (code.includes('PhysicsBody')) tags.push('physics');
  if (code.includes('UIKit')) tags.push('ui');
  if (code.includes('LocomotionSystem')) tags.push('locomotion');
  if (code.includes('AudioSystem')) tags.push('audio');

  return tags;
}

function analyzeComponentCoOccurrences(
  components: Record<string, ComponentDefinition>,
  examples: ExampleCode[]
): void {
  console.log('Analyzing component co-occurrences...');

  for (const component of Object.values(components)) {
    const examplesWithComponent = examples.filter(ex =>
      ex.componentsUsed.includes(component.name)
    );

    if (examplesWithComponent.length === 0) continue;

    const coOccurrences: Record<string, number> = {};

    for (const example of examplesWithComponent) {
      for (const otherComp of example.componentsUsed) {
        if (otherComp !== component.name) {
          coOccurrences[otherComp] = (coOccurrences[otherComp] || 0) + 1;
        }
      }
    }

    for (const [otherComp, count] of Object.entries(coOccurrences)) {
      component.coOccurrences[otherComp] = count / examplesWithComponent.length;
    }

    const highFrequencyPairs = Object.entries(component.coOccurrences)
      .filter(([_, freq]) => freq > 0.5 && freq < 1.0)
      .map(([comp, _]) => comp);

    component.optionalWith = highFrequencyPairs;
  }
}

function buildSystemComponentRelationships(
  systems: Record<string, SystemDefinition>,
  components: Record<string, ComponentDefinition>
): void {
  console.log('Building system-component relationships...');

  for (const system of Object.values(systems)) {
    for (const componentName of system.queriesComponents) {
      if (components[componentName]) {
        if (!components[componentName].usedBySystems.includes(system.name)) {
          components[componentName].usedBySystems.push(system.name);
        }
      }
    }
  }
}

function extractTypicalCompositions(examples: ExampleCode[]): ComponentPattern[] {
  console.log('Extracting typical component compositions...');

  const patterns: Map<string, { components: string[], count: number, category: string }> = new Map();

  for (const example of examples) {
    if (example.componentsUsed.length < 2) continue;

    const sortedComps = [...example.componentsUsed].sort();
    const key = sortedComps.join('|');

    if (patterns.has(key)) {
      const pattern = patterns.get(key)!;
      pattern.count++;
    } else {
      patterns.set(key, {
        components: sortedComps,
        count: 1,
        category: example.category
      });
    }
  }

  const commonPatterns: ComponentPattern[] = [];
  const totalExamples = examples.length || 1;

  for (const [key, pattern] of patterns.entries()) {
    if (pattern.count >= 2 || (pattern.count / totalExamples) > 0.1) {
      commonPatterns.push({
        name: key.replace(/\|/g, '+'),
        components: pattern.components,
        frequency: pattern.count / totalExamples,
        category: pattern.category
      });
    }
  }

  return commonPatterns.sort((a, b) => b.frequency - a.frequency);
}

function generateOrderingConstraints(
  components: Record<string, ComponentDefinition>
): OrderingConstraint[] {
  console.log('Generating ordering constraints...');

  const constraints: OrderingConstraint[] = [];

  for (const [name, component] of Object.entries(components)) {
    for (const required of component.requires) {
      constraints.push({
        before: name,
        after: required,
        reason: `${name} requires ${required} to be added first`
      });
    }
  }

  return constraints;
}

function generateValidationRules(
  components: Record<string, ComponentDefinition>,
  systems: Record<string, SystemDefinition>
): ValidationRule[] {
  console.log('Generating validation rules...');

  const rules: ValidationRule[] = [];

  for (const [name, component] of Object.entries(components)) {
    if (component.requires.length > 0) {
      rules.push({
        id: `component-${name}-requires`,
        description: `Check if ${name} has required components`,
        check: `entity has ${component.requires.join(', ')} when using ${name}`,
        message: `${name} requires ${component.requires.join(', ')} component(s)`,
        severity: 'error'
      });
    }

    if (component.usedBySystems.length > 0) {
      rules.push({
        id: `component-${name}-system`,
        description: `Check if ${name} has required system`,
        check: `world has ${component.usedBySystems.join(' or ')} registered when using ${name}`,
        message: `${name} requires ${component.usedBySystems.join(' or ')} to be registered`,
        severity: 'warning'
      });
    }
  }

  for (const [name, system] of Object.entries(systems)) {
    if (system.queriesComponents.length > 0) {
      rules.push({
        id: `system-${name}-components`,
        description: `Check if ${name} has entities with required components`,
        check: `entities have ${system.queriesComponents.join(', ')} when using ${name}`,
        message: `${name} queries for ${system.queriesComponents.join(', ')} component(s)`,
        severity: 'warning'
      });
    }
  }

  rules.push({
    id: 'entity-creation',
    description: 'Check entity creation method',
    check: 'use createTransformEntity() for entities that need position/rotation',
    message: 'Use createTransformEntity() instead of createEntity() for 3D positioned entities',
    severity: 'warning'
  });

  return rules;
}

function generateCommonMistakes(): CommonMistake[] {
  console.log('Generating common mistakes guide...');

  return [
    {
      id: 'missing-physics-shape',
      title: 'Missing PhysicsShape with PhysicsBody',
      description: 'PhysicsBody requires PhysicsShape to be added to the same entity',
      wrongCode: `entity.addComponent(PhysicsBody, { state: PhysicsState.Dynamic });`,
      correctCode: `entity.addComponent(PhysicsShape, {
  shape: PhysicsShapeType.Box,
  dimensions: [1, 1, 1]
});
entity.addComponent(PhysicsBody, { state: PhysicsState.Dynamic });`,
      category: 'physics'
    },
    {
      id: 'missing-interactable',
      title: 'Missing Interactable with Grabbable Components',
      description: 'All grabbable components (OneHandGrabbable, TwoHandsGrabbable, DistanceGrabbable) require Interactable',
      wrongCode: `entity.addComponent(OneHandGrabbable, {});`,
      correctCode: `entity.addComponent(Interactable);
entity.addComponent(OneHandGrabbable, {});`,
      category: 'interaction'
    },
    {
      id: 'wrong-entity-creation',
      title: 'Using createEntity() for 3D Positioned Objects',
      description: 'Use createTransformEntity() when entity needs position, rotation, or scale in 3D space',
      wrongCode: `const ball = world.createEntity();
ball.object3D.position.set(0, 1, 0); // Error: object3D doesn't exist`,
      correctCode: `const ball = world.createTransformEntity();
ball.object3D.position.set(0, 1, 0); // Works!`,
      category: 'entity'
    },
    {
      id: 'missing-system-registration',
      title: 'Forgetting to Register System',
      description: 'Systems must be registered with World.create() features or world.addSystem() before use',
      wrongCode: `// Physics components added but PhysicsSystem not enabled
World.create(container, {
  features: { grabbing: true }
});
entity.addComponent(PhysicsBody, {});`,
      correctCode: `World.create(container, {
  features: {
    grabbing: true,
    physics: true  // Enables PhysicsSystem
  }
});
entity.addComponent(PhysicsBody, {});`,
      category: 'system'
    },
    {
      id: 'wrong-import-path',
      title: 'Incorrect Import Statement',
      description: 'Components and systems must be imported from @iwsdk/core or appropriate package',
      wrongCode: `import { OneHandGrabbable } from 'iwsdk';`,
      correctCode: `import { OneHandGrabbable } from '@iwsdk/core';`,
      category: 'import'
    },
    {
      id: 'component-order',
      title: 'Wrong Component Addition Order',
      description: 'Required components must be added before components that depend on them',
      wrongCode: `entity.addComponent(OneHandGrabbable, {});
entity.addComponent(Interactable); // Too late!`,
      correctCode: `entity.addComponent(Interactable); // Add first
entity.addComponent(OneHandGrabbable, {}); // Then dependent component`,
      category: 'component'
    }
  ];
}

function generateBestPractices() {
  return {
    'ecs': {
      title: 'ECS Best Practices',
      content: `# ECS Best Practices

## Component Design
- Keep components as pure data (no methods)
- Use small, focused components over large ones
- Prefer composition over inheritance

## System Design
- Systems should be stateless when possible
- Use queries to efficiently filter entities
- Avoid tight coupling between systems

## Performance
- Use queries instead of iterating all entities
- Batch similar operations together
- Profile with browser DevTools

**See common mistakes:** Use \`get_common_mistakes("component")\` or \`get_common_mistakes("system")\``
    },
    'performance': {
      title: 'Performance Best Practices',
      content: `# Performance Best Practices

## General
- Profile before optimizing
- Use object pooling for frequently created/destroyed objects
- Leverage Web Workers for heavy computation

## ECS-Specific
- Use queries efficiently
- Minimize component additions/removals during runtime
- Batch entity creation

## WebXR
- Maintain 72+ FPS for VR
- Use LOD (Level of Detail) for complex scenes
- Optimize physics bodies

**See common mistakes:** Use \`get_common_mistakes()\` to see all common mistakes`
    },
    'state-management': {
      title: 'State Management Best Practices',
      content: `# State Management Best Practices

## Component State
- Store all state in components
- Use system queries to react to state changes
- Avoid global state when possible

## Initialization
- Initialize components with proper default values
- Use entity creation helpers
- Set up component dependencies correctly

**See validation rules:** Use \`get_validation_rules()\``
    },
    'ecs-patterns': {
      title: 'ECS Pattern Best Practices',
      content: `# ECS Pattern Best Practices

## Entity Composition
- Use typical component patterns (see \`get_validation_rules()\`)
- Follow component ordering constraints
- Always add required dependencies first

## Query Optimization
- Use specific queries rather than broad ones
- Cache query results when appropriate
- Minimize entity iteration

## System Organization
- Group related systems together
- Use system priorities for execution order
- Keep systems focused on single responsibilities`
    },
    'input-handling': {
      title: 'Input Handling Best Practices',
      content: `# Input Handling Best Practices

## Controller Input
- Use XR input system for controller tracking
- Provide fallbacks for desktop testing
- Handle disconnection gracefully

## Hand Tracking
- Design for both controller and hand input
- Provide visual feedback for interactions
- Test with actual headset

## Interaction Design
- Use raycasting for distant objects
- Provide clear hover/selection feedback
- Follow VR interaction guidelines`
    }
  };
}

function generateSetupGuides() {
  return {
    'basic': {
      title: 'Basic IWSDK Project Setup',
      content: `# Basic IWSDK Project Setup

## 1. Install Dependencies

\`\`\`bash
npm create vite@latest my-iwsdk-app -- --template vanilla-ts
cd my-iwsdk-app
npm install @iwsdk/core three
npm install -D @types/three
\`\`\`

## 2. Configure Vite (vite.config.ts)

\`\`\`typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: true,  // REQUIRED for WebXR!
    host: '0.0.0.0'
  },
  optimizeDeps: {
    include: ['@iwsdk/core', 'three']
  }
});
\`\`\`

## 3. Basic App Structure (src/main.ts)

\`\`\`typescript
import { World, SessionMode } from '@iwsdk/core';
import * as THREE from 'three';

// Get container
const container = document.getElementById('app')!;

// Create IWSDK world
const world = await World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR
  }
});

// Create a test cube
const entity = world.createTransformEntity();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.5, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
entity.object3D!.add(mesh);
entity.object3D!.position.set(0, 1.5, -2);

// Add lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
world.scene.add(light);
world.scene.add(new THREE.AmbientLight(0x404040));

console.log('IWSDK app ready!');
\`\`\`

## 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit https://localhost:5173 (accept the self-signed certificate warning).

## 5. Test in VR Headset

- Put on your Meta Quest
- Open browser and visit your local IP (shown in terminal)
- Enter VR mode

**See examples:** Use \`search_code_examples("world.create")\` for more setup patterns`
    },
    'vr': {
      title: 'VR Project Setup with Locomotion',
      content: `# VR Project Setup with Locomotion

Extends basic setup with VR features:

## Additional Setup

\`\`\`typescript
import { World, SessionMode } from '@iwsdk/core';

const world = await World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR
  },
  features: {
    enableLocomotion: true  // Auto-setup locomotion
  }
});
\`\`\`

**See more:** Use \`get_system_info("LocomotionSystem")\` for locomotion details`
    },
    'ar': {
      title: 'AR Project Setup',
      content: `# AR Project Setup

Setup for augmented reality experiences:

\`\`\`typescript
import { World, SessionMode } from '@iwsdk/core';

const world = await World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveAR
  }
});
\`\`\`

**Note:** AR features require supported devices (Quest 3, Quest Pro)`
    },
    'interactive': {
      title: 'Interactive Project Setup',
      content: `# Interactive Project Setup

Includes grabbing and interactions:

\`\`\`typescript
import {
  World,
  Interactable,
  OneHandGrabbable,
  SessionMode
} from '@iwsdk/core';
import * as THREE from 'three';

const world = await World.create(container, {
  xr: { sessionMode: SessionMode.ImmersiveVR }
});

// Create grabbable cube
const cube = world.createTransformEntity();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
cube.object3D!.add(mesh);
cube.object3D!.position.set(0, 1.2, -1);

// Make it interactable and grabbable
cube.addComponent(Interactable);
cube.addComponent(OneHandGrabbable);

cube.onClick = () => console.log('Cube clicked!');
\`\`\`

**See more:**
- \`get_component_schema("OneHandGrabbable")\` for grabbing
- \`find_implementation_pattern("grabbing")\` for complete guide`
    },
    'multiplayer': {
      title: 'Multiplayer Project Setup',
      content: `# Multiplayer Project Setup

Basic multiplayer setup pattern:

\`\`\`typescript
import { World, SessionMode } from '@iwsdk/core';

const world = await World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR
  }
});

// Multiplayer typically requires:
// 1. Networking library (Socket.io, WebRTC, etc.)
// 2. Entity synchronization system
// 3. Authority/ownership model
// 4. Interpolation for smooth movement

// IWSDK doesn't include built-in networking
// Use your preferred networking solution
\`\`\`

**Note:** IWSDK doesn't include built-in networking - use your preferred solution`
    }
  };
}

function generateAssetGuides() {
  return {
    'gltf': {
      'import': {
        title: 'Importing GLTF Assets',
        content: `# Importing GLTF Assets

## Using GLTFLoader from Three.js

\`\`\`typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Setup DRACO loader for compressed models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

// Setup GLTF loader
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Load the model
const gltf = await loader.loadAsync('/models/scene.gltf');
const model = gltf.scene;

// Add to IWSDK entity
const entity = world.createTransformEntity();
entity.object3D!.add(model);
entity.object3D!.position.set(0, 0, -2);
\`\`\`

## Best Practices
- Use .glb format (binary) for better performance
- Enable DRACO compression for smaller files
- Bake lighting when possible
- Optimize texture sizes`
      },
      'optimize': {
        title: 'Optimizing GLTF Assets',
        content: `# Optimizing GLTF Assets

## File Size
- Use DRACO compression
- Reduce texture resolution
- Remove unused materials/geometries
- Use .glb instead of .gltf

## Runtime Performance
- Merge geometries when possible
- Use instances for repeated objects
- Bake lighting
- Compress textures (KTX2 format)

## Tools
- glTF Pipeline: https://github.com/CesiumGS/gltf-pipeline
- Blender GLTF exporter with compression options`
      },
      'load': {
        title: 'Loading GLTF at Runtime',
        content: `# Loading GLTF at Runtime

See 'import' operation for code examples.

## Async Loading
\`\`\`typescript
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/model.glb');
world.scene.add(gltf.scene);
\`\`\`

## Progress Tracking
\`\`\`typescript
loader.load(
  '/model.glb',
  (gltf) => console.log('Loaded!'),
  (progress) => console.log(\`\${(progress.loaded / progress.total * 100).toFixed(0)}%\`)
);
\`\`\``
      },
      'runtime': {
        title: 'GLTF Runtime Operations',
        content: `# GLTF Runtime Operations

## Animations
\`\`\`typescript
const mixer = new THREE.AnimationMixer(gltf.scene);
const action = mixer.clipAction(gltf.animations[0]);
action.play();

// In your update loop:
mixer.update(deltaTime);
\`\`\`

## Material Modifications
\`\`\`typescript
gltf.scene.traverse((child) => {
  if (child.isMesh) {
    child.material.metalness = 0.5;
    child.castShadow = true;
  }
});
\`\`\``
      }
    },
    'texture': {
      'import': {
        title: 'Importing Textures',
        content: `# Importing Textures

\`\`\`typescript
import { TextureLoader } from 'three';

const loader = new TextureLoader();
const texture = await loader.loadAsync('/textures/diffuse.jpg');

const material = new THREE.MeshStandardMaterial({
  map: texture
});
\`\`\`

## Best Practices
- Use power-of-2 dimensions (512, 1024, 2048)
- Compress textures (JPEG for diffuse, PNG for alpha)
- Use mipmaps for distant objects
- Consider KTX2 format for WebXR`
      },
      'optimize': {
        title: 'Optimizing Textures',
        content: `# Optimizing Textures

## Resolution
- Use smallest size that looks good
- 1024x1024 for most objects
- 2048x2048 for important/close objects
- 512x512 or lower for distant objects

## Format
- JPEG for photos/diffuse (lossy)
- PNG for transparency
- KTX2 for GPU compression (best for VR)

## Tools
- Use texture atlases to reduce draw calls
- Generate mipmaps
- Compress with Basis Universal`
      }
    },
    'audio': {
      'import': {
        title: 'Importing Audio',
        content: `# Importing Audio

\`\`\`typescript
import { AudioLoader, Audio, AudioListener } from 'three';

// Create listener (typically attached to camera)
const listener = new AudioListener();
world.camera.add(listener);

// Load and create audio
const audioLoader = new AudioLoader();
const buffer = await audioLoader.loadAsync('/sounds/effect.mp3');

const sound = new Audio(listener);
sound.setBuffer(buffer);
sound.play();
\`\`\`

**IWSDK Alternative:** Use \`AudioSource\` component for spatial audio`
      },
      'optimize': {
        title: 'Optimizing Audio',
        content: `# Optimizing Audio

## Format
- Use MP3 or OGG for compression
- Lower bitrate for effects (96-128 kbps)
- Higher bitrate for music (192-256 kbps)

## Performance
- Use spatial audio (positional) sparingly
- Limit concurrent audio sources
- Unload unused audio buffers

## Best Practices
- Pre-load frequently used sounds
- Use audio sprites for short effects
- Adjust volume for VR (lower than desktop)`
      }
    }
  };
}

function generateTroubleshootingGuides() {
  return {
    solutions: [
      {
        keywords: ['webxr', 'not supported', 'immersive', 'not available'],
        title: 'WebXR Not Supported',
        problem: 'The browser or device doesn\'t support WebXR.',
        solutions: [
          'Check Browser Compatibility - Quest Browser, Chrome, Edge, Firefox support WebXR',
          'Ensure HTTPS - WebXR requires secure context (set server.https: true in vite.config)',
          'Check Device Permissions - Allow VR/AR permissions in browser',
          'Detect XR Support - Use navigator.xr.isSessionSupported() to check',
          'Provide Fallback - IWSDK automatically falls back to desktop mode'
        ],
        code: `if ('xr' in navigator) {
  const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
  console.log('VR supported:', isSupported);
}`
      },
      {
        keywords: ['https', 'ssl', 'certificate', 'secure context'],
        title: 'HTTPS Required Error',
        problem: 'WebXR APIs require a secure context (HTTPS).',
        solutions: [
          'Configure Vite for HTTPS - Add https: true to server config',
          'Accept Self-Signed Certificate - Browser will show warning on localhost',
          'Use mkcert - Generate trusted local certificates',
          'Test on Device - Use your local IP address with HTTPS'
        ]
      },
      {
        keywords: ['component', 'not found', 'undefined', 'addComponent'],
        title: 'Component Not Found',
        problem: 'Component is undefined or not imported correctly.',
        solutions: [
          'Check Import - Verify component is imported from correct package',
          'Use Correct Name - Component names are case-sensitive',
          'Check IWSDK Version - Some components may be in different packages',
          'Verify Component Exists - Use get_component_schema() to verify'
        ]
      },
      {
        keywords: ['component', 'requires', 'dependency', 'missing'],
        title: 'Missing Component Dependency',
        problem: 'Component requires another component that isn\'t added.',
        solutions: [
          'Check Requirements - Use get_component_schema() to see required components',
          'Add Dependencies First - Add required components before dependent ones',
          'Check Component Order - Some components have ordering constraints',
          'Use Validation - Run get_validation_rules() to check setup'
        ]
      },
      {
        keywords: ['physics', 'not working', 'collision', 'rigidbody'],
        title: 'Physics Not Working',
        problem: 'Physics bodies don\'t collide or fall.',
        solutions: [
          'Enable Physics System - Ensure PhysicsSystem is registered',
          'Add PhysicsBody - Entity needs PhysicsBody component',
          'Add PhysicsShape - Collision shape must be defined',
          'Check Body Type - Use "dynamic" for moveable objects',
          'Verify Scale - Physics works best at real-world scale (meters)'
        ]
      },
      {
        keywords: ['grabbing', 'not working', 'cant grab', 'not grabbable'],
        title: 'Grabbing Not Working',
        problem: 'Objects can\'t be grabbed.',
        solutions: [
          'Add Interactable First - Required for all interactive objects',
          'Add Grabbable Component - OneHandGrabbable, TwoHandGrabbable, or DistanceGrabbable',
          'Enable Grab System - Check that GrabSystem is registered',
          'Check Object Scale - Very small/large objects may be hard to grab',
          'Add Physics - PhysicsBody makes grabbing feel more natural'
        ]
      },
      {
        keywords: ['controller', 'not detected', 'input', 'hand'],
        title: 'Controllers Not Detected',
        problem: 'VR controllers don\'t appear or work.',
        solutions: [
          'Check Headset Connection - Controllers must be paired and turned on',
          'Enable VR Mode - Controllers only work in immersive VR session',
          'Check InputSystem - Verify InputSystem is registered',
          'Test in Headset - Controllers don\'t work in desktop mode',
          'Check Permissions - Browser may need controller permissions'
        ]
      },
      {
        keywords: ['performance', 'fps', 'lag', 'slow', 'stuttering'],
        title: 'Performance Issues',
        problem: 'App runs slowly or has low FPS.',
        solutions: [
          'Profile First - Use browser DevTools Performance tab',
          'Reduce Draw Calls - Merge geometries, use instancing',
          'Optimize Textures - Reduce resolution, use compression',
          'Simplify Physics - Fewer dynamic bodies, simpler shapes',
          'Use LOD - Level of Detail for distant objects',
          'Batch Operations - Group entity creation/updates',
          'Target 72 FPS - Minimum for VR comfort'
        ]
      },
      {
        keywords: ['world', 'not created', 'create', 'initialization'],
        title: 'World Creation Failed',
        problem: 'World.create() fails or returns error.',
        solutions: [
          'Check Container Element - DOM element must exist',
          'Verify IWSDK Import - Check @iwsdk/core is installed',
          'Use Await - World.create() is async',
          'Check Console - Error message shows specific issue',
          'Verify Configuration - Check xr.sessionMode and features'
        ]
      },
      {
        keywords: ['entity', 'not visible', 'invisible', 'not showing'],
        title: 'Entity Not Visible',
        problem: 'Created entity doesn\'t appear in scene.',
        solutions: [
          'Add Mesh - Entity needs Three.js mesh (geometry + material)',
          'Check Position - Entity might be behind camera or too far',
          'Add Lighting - Scene needs lights to see standard materials',
          'Check Scale - Entity might be too small',
          'Verify Object3D - Check entity.object3D exists'
        ]
      },
      {
        keywords: ['locomotion', 'movement', 'cant move', 'teleport'],
        title: 'Locomotion Not Working',
        problem: 'Can\'t move around the scene.',
        solutions: [
          'Enable Locomotion - Set enableLocomotion: true in features',
          'Register System - Or manually register LocomotionSystem',
          'Check Controllers - Thumbsticks control movement',
          'Verify Config - Check slidingSpeed, turningMethod settings',
          'Test in VR - Locomotion requires VR controllers'
        ]
      },
      {
        keywords: ['click', 'onclick', 'not firing', 'interaction'],
        title: 'Click Events Not Firing',
        problem: 'entity.onClick doesn\'t trigger.',
        solutions: [
          'Add Interactable - Required for all click events',
          'Set onClick Handler - Assign function to entity.onClick',
          'Check Raycast - Object must be hit by controller ray',
          'Enable Input System - InputSystem must be active',
          'Test Hit Area - Use larger collider if needed'
        ]
      }
    ]
  };
}

async function generateCache(repoPath: string, version: string): Promise<void> {
  console.log('Generating cache...');

  const components = await parseComponents(repoPath);
  const systems = await parseSystems(repoPath);
  const types = await parseTypes(repoPath);
  const examples = await parseExamples(repoPath);

  await extractComponentRelationships(repoPath, components);
  buildSystemComponentRelationships(systems, components);
  analyzeComponentCoOccurrences(components, examples);
  const typicalCompositions = extractTypicalCompositions(examples);

  const componentRequires: Relationship[] = [];
  for (const component of Object.values(components)) {
    for (const required of component.requires) {
      componentRequires.push({
        from: component.name,
        to: required,
        type: 'REQUIRES'
      });
    }
  }

  const systemQueries: Relationship[] = [];
  for (const system of Object.values(systems)) {
    for (const componentName of system.queriesComponents) {
      systemQueries.push({
        from: system.name,
        to: componentName,
        type: 'QUERIES'
      });
    }
  }

  const orderingConstraints = generateOrderingConstraints(components);
  const validationRules = generateValidationRules(components, systems);
  const commonMistakes = generateCommonMistakes();

  // Write split cache files for better readability
  const cacheDir = dirname(CACHE_OUTPUT);

  // Ensure cache directory exists
  await mkdir(cacheDir, { recursive: true });

  // 1. Metadata
  await writeFile(
    join(cacheDir, 'metadata.json'),
    JSON.stringify({
      ingestDate: new Date().toISOString(),
      iwsdkVersion: version,
      repository: 'meta-quest/immersive-web-sdk',
      commit: 'local'
    }, null, 2)
  );

  // 2. Components
  await writeFile(
    join(cacheDir, 'components.json'),
    JSON.stringify(components, null, 2)
  );

  // 3. Systems
  await writeFile(
    join(cacheDir, 'systems.json'),
    JSON.stringify(systems, null, 2)
  );

  // 4. Types
  await writeFile(
    join(cacheDir, 'types.json'),
    JSON.stringify(types, null, 2)
  );

  // 5. Examples
  await writeFile(
    join(cacheDir, 'examples.json'),
    JSON.stringify(examples, null, 2)
  );

  // 6. Relationships
  await writeFile(
    join(cacheDir, 'relationships.json'),
    JSON.stringify({
      componentRequires,
      systemQueries,
      typicalCompositions,
      ordering: orderingConstraints,
      validation: validationRules
    }, null, 2)
  );

  // 7. Common Mistakes
  await writeFile(
    join(cacheDir, 'common-mistakes.json'),
    JSON.stringify(commonMistakes, null, 2)
  );

  // 8. Package Exports
  await writeFile(
    join(cacheDir, 'exports.json'),
    JSON.stringify({
      '@iwsdk/core': {
        classes: Object.keys(systems),
        functions: ['createComponent', 'createSystem'],
        types: Object.keys(types).filter(t => types[t].package === '@iwsdk/core'),
        components: Object.keys(components),
        systems: Object.keys(systems)
      }
    }, null, 2)
  );

  // 9. Best Practices
  const bestPractices = generateBestPractices();
  await writeFile(
    join(cacheDir, 'best-practices.json'),
    JSON.stringify(bestPractices, null, 2)
  );

  // 10. Setup Guides
  const setupGuides = generateSetupGuides();
  await writeFile(
    join(cacheDir, 'setup-guides.json'),
    JSON.stringify(setupGuides, null, 2)
  );

  // 11. Asset Guides
  const assetGuides = generateAssetGuides();
  await writeFile(
    join(cacheDir, 'asset-guides.json'),
    JSON.stringify(assetGuides, null, 2)
  );

  // 12. Troubleshooting Guides
  const troubleshootingGuides = generateTroubleshootingGuides();
  await writeFile(
    join(cacheDir, 'troubleshooting.json'),
    JSON.stringify(troubleshootingGuides, null, 2)
  );

  // 13. Copy official IWSDK documentation guides
  const guidesSourceDir = join(repoPath, 'docs', 'guides');
  const guidesDestDir = join(cacheDir, 'docs', 'guides');

  let guidesCopied = 0;
  if (existsSync(guidesSourceDir)) {
    await mkdir(guidesDestDir, { recursive: true });
    const guideFiles = await readdir(guidesSourceDir);

    for (const file of guideFiles) {
      if (file.endsWith('.md')) {
        const sourcePath = join(guidesSourceDir, file);
        const destPath = join(guidesDestDir, file);
        await copyFile(sourcePath, destPath);
        guidesCopied++;
      }
    }
  }

  console.log(`\n✓ Cache written to ${cacheDir}/`);
  console.log(`\n📊 JSON Data Files (12 files):`);
  console.log(`  • metadata.json`);
  console.log(`  • components.json (${Object.keys(components).length} components)`);
  console.log(`  • systems.json (${Object.keys(systems).length} systems)`);
  console.log(`  • types.json (${Object.keys(types).length} types)`);
  console.log(`  • examples.json (${examples.length} examples)`);
  console.log(`  • relationships.json (${componentRequires.length} dependencies, ${systemQueries.length} queries)`);
  console.log(`  • common-mistakes.json (${commonMistakes.length} mistakes)`);
  console.log(`  • exports.json`);
  console.log(`  • best-practices.json (${Object.keys(bestPractices).length} topics)`);
  console.log(`  • setup-guides.json (${Object.keys(setupGuides).length} guides)`);
  console.log(`  • asset-guides.json`);
  console.log(`  • troubleshooting.json (${troubleshootingGuides.solutions.length} solutions)`);
  console.log(`\n📚 Documentation Files:`);
  console.log(`  • docs/guides/ (${guidesCopied} official IWSDK guides)`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
IWSDK Source Code Ingestion Tool

Usage:
  npm run ingest <path-to-iwsdk-repo>

Example:
  npm run ingest ~/projects/immersive-web-sdk

This will:
  1. Parse all components, systems, types from the IWSDK source code
  2. Extract code examples from the examples/ directory
  3. Analyze component relationships and system queries
  4. Generate a comprehensive cache in cache/iwsdk-cache.json

Requirements:
  - Path must point to a cloned immersive-web-sdk repository
  - Repository must have packages/core directory
    `);
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const repoPath = resolve(args[0]);

  try {
    console.log('IWSDK Source Code Ingestion\n');

    validateRepoPath(repoPath);
    const version = await findPackageVersion(repoPath);

    console.log(`Repository version: ${version}\n`);

    await generateCache(repoPath, version);

    console.log('\nIngestion complete!');
    console.log(`Cache generated in ${dirname(CACHE_OUTPUT)}/ (8 JSON files)`);
  } catch (error) {
    console.error('\nIngestion failed:', error);
    process.exit(1);
  }
}

main();
