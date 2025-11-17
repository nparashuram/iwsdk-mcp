# IWSDK MCP Server

RAG-powered Model Context Protocol server for Immersive Web SDK development

## Setup

### Prepare the RAG System

```bash
# Clone the IWSDK repository (if you don't have it)
git clone https://github.com/meta-quest/immersive-web-sdk.git

# Prepare the RAG system (single command)
npm run prepare /path/to/immersive-web-sdk
```

This single command prepares the complete RAG (Retrieval Augmented Generation) system by:

1. **Ingesting IWSDK source code** - Extracts components, systems, types, examples from the SDK
2. **Fetching official documentation** - Downloads official IWSDK docs from Meta's developer portal
3. **Building the project** - Compiles TypeScript to JavaScript

## Telemetry

The MCP server automatically logs all tool calls to `telemetry.jsonl` for usage tracking and debugging. Each line contains:

- `timestamp` - ISO 8601 timestamp
- `tool` - Tool name that was called
- `params` - Parameters passed to the tool (long strings truncated to 500 chars)

The telemetry file is excluded from git via `.gitignore`.

Example telemetry entry:

```json
{
  "timestamp": "2025-11-15T21:18:25.883Z",
  "tool": "get_component_schema",
  "params": { "componentName": "OneHandGrabbable" }
}
```

## Configuration

After running `npm run prepare`, configure the MCP server in your client:

```json
{
  "mcpServers": {
    "iwsdk": {
      "command": "node",
      "args": ["/absolute/path/to/iwsdk-mcp/build/index.js"]
    }
  }
}
```

## Tools

The MCP server provides 18 tools organized by category:

**Documentation & Reference:**

- `get_api_documentation` - Query API documentation for classes/methods
- `get_component_schema` - Get component field definitions with JSDoc, requirements, and relationships
- `get_system_info` - Get system documentation with methods, properties, and queried components
- `search_code_examples` - Find relevant code examples
- `explain_concept` - Get explanations of IWSDK concepts
- `lookup_package_exports` - List all exports from a package

**Code Generation:**

- `generate_system_template` - Generate boilerplate for custom ECS systems
- `scaffold_project` - Generate complete project structure
- `compose_feature` - Compose complete feature implementations with all necessary components/systems
- `find_similar_code` - Find similar code examples by description

**Validation & Troubleshooting:**

- `validate_code` - Validate code against best practices and detect missing components/systems
- `get_validation_rules` - Get validation rules for components/systems
- `check_component_order` - Check correct component ordering constraints
- `get_common_mistakes` - Search common mistakes with wrong/correct code examples

**Implementation Guides:**

- `find_implementation_pattern` - Get implementation guides for common features
- `get_setup_guide` - Get project setup instructions
- `explain_asset_pipeline` - Get asset handling guidance
- `get_best_practices` - Get recommended patterns and anti-patterns
- `troubleshoot_error` - Get diagnostic steps for errors
