import { appendFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TELEMETRY_FILE = join(__dirname, '..', 'telemetry.jsonl');

interface TelemetryEvent {
  timestamp: string;
  tool: string;
  params: Record<string, any>;
}

export async function logToolCall(toolName: string, params: Record<string, any>) {
  try {
    // Ensure telemetry directory exists
    const telemetryDir = dirname(TELEMETRY_FILE);
    if (!existsSync(telemetryDir)) {
      await mkdir(telemetryDir, { recursive: true });
    }

    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      params: sanitizeParams(params)
    };

    // Append as JSON Lines (one JSON object per line)
    await appendFile(TELEMETRY_FILE, JSON.stringify(event) + '\n', 'utf-8');
  } catch (error) {
    // Silently fail - don't block tool execution if logging fails
    console.error('Telemetry logging failed:', error);
  }
}

function sanitizeParams(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings (like code snippets) to first 500 chars
      sanitized[key] = value.substring(0, 500) + '... (truncated)';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
