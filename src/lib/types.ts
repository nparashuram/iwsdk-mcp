export interface ApiDocumentation {
  packageName: string;
  className: string;
  description: string;
  methods?: Record<string, MethodDoc>;
  properties?: Record<string, PropertyDoc>;
  constructorDoc?: string;
  examples?: string[];
}

export interface MethodDoc {
  signature: string;
  description: string;
  parameters?: Parameter[];
  returns?: string;
  examples?: string[];
}

export interface PropertyDoc {
  type: string;
  description: string;
  readonly?: boolean;
}

export interface Parameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

export interface CodeExample {
  title: string;
  description: string;
  code: string;
  category: string;
  tags: string[];
}

export interface ConceptDoc {
  title: string;
  description: string;
  sections: {
    heading: string;
    content: string;
    code?: string;
  }[];
  relatedConcepts?: string[];
}

export interface ComponentSchema {
  name: string;
  description: string;
  fields: {
    name: string;
    type: string;
    default?: any;
    description?: string;
  }[];
  examples?: string[];
}

export interface PackageExports {
  packageName: string;
  classes: string[];
  functions: string[];
  types: string[];
  components: string[];
  systems: string[];
}
