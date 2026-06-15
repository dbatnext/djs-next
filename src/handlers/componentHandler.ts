import { Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { FileComponent } from '../types.js';
import { getAllFiles } from './utils.js';

export async function loadComponents(componentsDir: string): Promise<Collection<string, FileComponent>> {
  const components = new Collection<string, FileComponent>();
  
  if (!fs.existsSync(componentsDir)) return components;

  const files = getAllFiles(componentsDir);

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    const componentData: FileComponent = module.default || module.component || module;
    if (componentData) componentData.filepath = file;

    if (!componentData || !componentData.execute) continue;

    // Infer customId from filename if not explicitly provided
    const parsed = path.parse(file);
    const customId = componentData.customId || parsed.name;

    components.set(customId, componentData);
  }

  console.log(`[djs-next] Successfully loaded ${components.size} components.`);
  return components;
}
