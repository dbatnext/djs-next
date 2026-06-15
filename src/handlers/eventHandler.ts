import { Client } from 'discord.js';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { Event } from '../types.js';
import { getAllFiles } from './utils.js';

export async function loadEvents(client: Client, eventsDir: string) {
  if (!fs.existsSync(eventsDir)) {
    console.warn(`[djs-next] Events directory "${eventsDir}" does not exist.`);
    return;
  }

  const eventFiles = getAllFiles(eventsDir);
  let loadedEvents = 0;

  for (const file of eventFiles) {
    const eventModule = await import(pathToFileURL(file).href);
    const eventData: Event<any> = eventModule.default?.event || eventModule.event || eventModule.default || eventModule;
    if (eventData) eventData.filepath = file;

    if (!eventData || !eventData.name || !eventData.execute) {
      console.warn(`[djs-next] The event at ${file} is missing a required "name" or "execute" property.`);
      continue;
    }

    if (eventData.once) {
      client.once(eventData.name, (...args) => eventData.execute(client, ...args));
    } else {
      client.on(eventData.name, (...args) => eventData.execute(client, ...args));
    }
    loadedEvents++;
  }

  if (loadedEvents > 0) {
    console.log(`[djs-next] Successfully loaded ${loadedEvents} events.`);
  }
}
