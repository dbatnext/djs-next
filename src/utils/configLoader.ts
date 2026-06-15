import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { DJSNextConfig } from '../types.js';

export async function loadConfig(): Promise<DJSNextConfig> {
  const exts = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
  const cwd = process.cwd();
  
  for (const ext of exts) {
    const configPath = path.join(cwd, `djs-next.config${ext}`);
    if (fs.existsSync(configPath)) {
      try {
        const configModule = await import(pathToFileURL(configPath).href);
        return configModule.default || configModule;
      } catch (err) {
        console.error(`[djs-next] Error loading config file ${configPath}:`, err);
        return {};
      }
    }
  }
  return {};
}

export function defineConfig(config: DJSNextConfig): DJSNextConfig {
  return config;
}
