import { Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { FileCommand } from '../types.js';
import { getAllFiles } from './utils.js';

interface CommandNode {
  name: string;
  description: string;
  options: any[];
  execute?: Function;
  children: Map<string, CommandNode>;
}

export async function loadAndDeployCommands(
  commandsDir: string, 
  token: string, 
  clientId: string,
  guildId?: string
): Promise<Collection<string, FileCommand>> {
  const flatCommands = new Collection<string, FileCommand>();
  
  if (!fs.existsSync(commandsDir)) {
    console.warn(`[djs-next] Commands directory "${commandsDir}" does not exist.`);
    return flatCommands;
  }

  const commandFiles = getAllFiles(commandsDir);
  const rootNodes = new Map<string, CommandNode>();

  function getOrCreateNode(pathParts: string[]): CommandNode {
    let currentMap = rootNodes;
    let currentNode: CommandNode | undefined;

    for (const part of pathParts) {
      if (!currentMap.has(part)) {
        currentMap.set(part, {
          name: part,
          description: `${part} command`, // Fallback description
          options: [],
          children: new Map()
        });
      }
      currentNode = currentMap.get(part)!;
      currentMap = currentNode.children;
    }
    return currentNode!;
  }

  for (const file of commandFiles) {
    const relativePath = path.relative(commandsDir, file);
    const parsed = path.parse(relativePath);
    
    // Normalize path separators
    const dirParts = parsed.dir ? parsed.dir.split(path.sep) : [];
    const name = parsed.name;
    
    const pathParts = [...dirParts];
    if (name !== 'index') {
      pathParts.push(name);
    }

    if (pathParts.length === 0) continue;
    if (pathParts.length > 3) {
      console.warn(`[djs-next] Command path too deep (Discord allows max 3 levels): ${relativePath}`);
      continue;
    }

    const module = await import(pathToFileURL(file).href);
    const commandData: FileCommand = module.default || module.command || module;
    if (commandData) commandData.filepath = file;

    const node = getOrCreateNode(pathParts);
    if (commandData.description) node.description = commandData.description;
    if (commandData.options) node.options = commandData.options;
    if (commandData.execute) {
      node.execute = commandData.execute;
      // Map entire FileCommand object to a space-separated string (e.g. "economy balance")
      flatCommands.set(pathParts.join(' '), commandData);
    }
  }

  // Build JSON payloads for Discord
  function buildCommandJSON(node: CommandNode, depth: number): any {
    const json: any = {
      name: node.name,
      description: node.description,
    };

    if (node.children.size > 0) {
      json.options = [];
      for (const [_, childNode] of node.children) {
        const childJson = buildCommandJSON(childNode, depth + 1);
        
        // 1 = SUB_COMMAND, 2 = SUB_COMMAND_GROUP
        if (depth === 0) {
          childJson.type = childNode.children.size > 0 ? 2 : 1;
        } else if (depth === 1) {
          childJson.type = 1;
        }
        
        json.options.push(childJson);
      }
    } else if (node.options && node.options.length > 0) {
      json.options = node.options;
    }
    
    return json;
  }

  const commandsData = Array.from(rootNodes.values()).map(node => buildCommandJSON(node, 0));

  // Deploy commands
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`[djs-next] Started refreshing ${commandsData.length} File-System application (/) commands.`);

    let data: any;
    if (guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsData },
      );
    } else {
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData },
      );
    }

    console.log(`[djs-next] Successfully reloaded ${data.length} File-System application (/) commands.`);
  } catch (error) {
    console.error(`[djs-next] Failed to deploy commands:`, error);
  }

  return flatCommands;
}
