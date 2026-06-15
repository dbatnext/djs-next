import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Client } from 'discord.js';
import { FileTask } from '../types.js';
import { getAllFiles } from './utils.js';

export async function loadTasks(client: Client, tasksDir: string) {
  if (!fs.existsSync(tasksDir)) return;

  const files = getAllFiles(tasksDir);
  let loaded = 0;

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    const taskData: FileTask = module.default || module.task || module;
    if (taskData) taskData.filepath = file;

    if (!taskData || !taskData.interval || !taskData.execute) continue;

    const intervalId = setInterval(async () => {
      try {
        await taskData.execute(client);
      } catch (error) {
        console.error(`[djs-next] Background Task error at ${file}:`, error);
      }
    }, taskData.interval);

    if (!(client as any)._activeTasks) (client as any)._activeTasks = new Map();
    (client as any)._activeTasks.set(file, intervalId);

    loaded++;
  }

  if (loaded > 0) {
    console.log(`[djs-next] Successfully scheduled ${loaded} background tasks.`);
  }
}
