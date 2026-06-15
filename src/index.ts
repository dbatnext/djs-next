import 'dotenv/config';
export * from './client.js';
export { DJSNextClientOptions, FileCommand, FileComponent, FileTask, Event as DJSNextEvent, DJSNextConfig, CooldownAdapter } from './types.js';
export * from './utils/paginate.js';
export * from './utils/prompts.js';
export * from './utils/configLoader.js';
export * from './utils/i18n.js';
export * from './utils/PaginationBuilder.js';
// Re-export everything from discord.js so users don't need to install it explicitly
export * from 'discord.js';
