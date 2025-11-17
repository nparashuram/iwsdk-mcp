import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiDocumentation, CodeExample, ConceptDoc, ComponentSchema, PackageExports } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

interface EnhancedCacheData {
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

interface CacheData {
  apiDocs: Record<string, Record<string, ApiDocumentation>>;
  codeExamples: CodeExample[];
  concepts: Record<string, ConceptDoc>;
  componentSchemas: Record<string, ComponentSchema>;
  packageExports: Record<string, PackageExports>;
}

let enhancedCache: EnhancedCacheData | null = null;
let cache: CacheData | null = null;

export async function loadEnhancedCache(): Promise<EnhancedCacheData> {
  if (enhancedCache) {
    return enhancedCache;
  }

  const cacheDir = join(__dirname, '..', '..', 'cache');

  // Load all split cache files
  const [metadata, components, systems, types, examples, relationships, commonMistakes, exports] = await Promise.all([
    readFile(join(cacheDir, 'metadata.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'components.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'systems.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'types.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'examples.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'relationships.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'common-mistakes.json'), 'utf-8').then(JSON.parse),
    readFile(join(cacheDir, 'exports.json'), 'utf-8').then(JSON.parse)
  ]);

  // Reconstruct enhanced cache from split files
  enhancedCache = {
    metadata,
    components,
    systems,
    types,
    examples,
    relationships: {
      componentRequires: relationships.componentRequires,
      systemQueries: relationships.systemQueries,
      typicalCompositions: relationships.typicalCompositions
    },
    constraints: {
      ordering: relationships.ordering,
      validation: relationships.validation
    },
    troubleshooting: {
      commonMistakes
    },
    packageExports: exports
  };

  return enhancedCache!;
}

export async function loadCache(): Promise<CacheData> {
  if (cache) {
    return cache;
  }

  const enhanced = await loadEnhancedCache();

  const componentSchemas: Record<string, ComponentSchema> = {};
  for (const [name, comp] of Object.entries(enhanced.components)) {
    componentSchemas[name] = {
      name: comp.name,
      description: comp.description,
      fields: comp.fields,
      examples: comp.jsdocExamples
    };
  }

  const codeExamples: CodeExample[] = enhanced.examples.map(ex => ({
    title: ex.title,
    description: ex.description,
    code: ex.code,
    category: ex.category,
    tags: ex.tags
  }));

  cache = {
    apiDocs: {},
    codeExamples,
    concepts: {},
    componentSchemas,
    packageExports: enhanced.packageExports as any
  };

  return cache!;
}

export async function getApiDoc(
  packageName: string,
  className: string
): Promise<ApiDocumentation | null> {
  const data = await loadCache();
  return data.apiDocs[packageName]?.[className] || null;
}

export async function searchExamples(
  query: string,
  category?: string
): Promise<CodeExample[]> {
  const data = await loadCache();
  const lowerQuery = query.toLowerCase();

  return data.codeExamples.filter((example) => {
    const matchesQuery =
      example.title.toLowerCase().includes(lowerQuery) ||
      example.description.toLowerCase().includes(lowerQuery) ||
      example.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
      example.code.toLowerCase().includes(lowerQuery);

    const matchesCategory =
      !category || category === 'any' || example.category === category;

    return matchesQuery && matchesCategory;
  });
}

export async function getConcept(concept: string): Promise<ConceptDoc | null> {
  const data = await loadCache();
  return data.concepts[concept] || null;
}

export async function getComponentSchema(
  name: string
): Promise<ComponentSchema | null> {
  const data = await loadCache();
  return data.componentSchemas[name] || null;
}

export async function getPackageExports(
  packageName: string
): Promise<PackageExports | null> {
  const data = await loadCache();
  return data.packageExports[packageName] || null;
}

export async function getAllCodeExamples(): Promise<CodeExample[]> {
  const data = await loadCache();
  return data.codeExamples;
}

export async function getComponent(name: string): Promise<ComponentDefinition | null> {
  const cache = await loadEnhancedCache();
  return cache.components[name] || null;
}

export async function getSystem(name: string): Promise<SystemDefinition | null> {
  const cache = await loadEnhancedCache();
  return cache.systems[name] || null;
}

export async function getAllComponents(): Promise<ComponentDefinition[]> {
  const cache = await loadEnhancedCache();
  return Object.values(cache.components);
}

export async function getAllSystems(): Promise<SystemDefinition[]> {
  const cache = await loadEnhancedCache();
  return Object.values(cache.systems);
}

export async function getValidationRules(componentOrSystem?: string): Promise<ValidationRule[]> {
  const cache = await loadEnhancedCache();

  if (!componentOrSystem) {
    return cache.constraints.validation;
  }

  return cache.constraints.validation.filter(
    rule =>
      rule.id.includes(componentOrSystem) ||
      rule.description.includes(componentOrSystem) ||
      rule.check.includes(componentOrSystem)
  );
}

export async function getOrderingConstraints(component?: string): Promise<OrderingConstraint[]> {
  const cache = await loadEnhancedCache();

  if (!component) {
    return cache.constraints.ordering;
  }

  return cache.constraints.ordering.filter(
    c => c.before === component || c.after === component
  );
}

export async function getCommonMistakes(category?: string): Promise<CommonMistake[]> {
  const cache = await loadEnhancedCache();

  if (!category) {
    return cache.troubleshooting.commonMistakes;
  }

  return cache.troubleshooting.commonMistakes.filter(m => m.category === category);
}

export async function searchCommonMistakes(query: string): Promise<CommonMistake[]> {
  const cache = await loadEnhancedCache();
  const lowerQuery = query.toLowerCase();

  return cache.troubleshooting.commonMistakes.filter(
    m =>
      m.title.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.category.toLowerCase().includes(lowerQuery)
  );
}

export async function getRelationships() {
  const cache = await loadEnhancedCache();
  return cache.relationships;
}

export async function getComponentRequirements(componentName: string): Promise<string[]> {
  const cache = await loadEnhancedCache();
  const component = cache.components[componentName];
  return component?.requires || [];
}

export async function getSystemComponents(systemName: string): Promise<string[]> {
  const cache = await loadEnhancedCache();
  const system = cache.systems[systemName];
  return system?.queriesComponents || [];
}

export { ComponentDefinition, SystemDefinition, TypeDefinition, ExampleCode, ValidationRule, OrderingConstraint, CommonMistake, Relationship, ComponentPattern };
