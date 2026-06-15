import {
  ClientOptions,
  ClientEvents,
  ChatInputCommandInteraction,
  Client,
  ApplicationCommandOptionData,
  PermissionResolvable,
  AutocompleteInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  Interaction,
  Message
} from 'discord.js';

export interface CooldownAdapter {
  get(commandId: string, userId: string): Promise<number | null> | number | null;
  set(commandId: string, userId: string, expirationTime: number): Promise<void> | void;
}

export interface DJSNextConfig {
  devGuildId?: string;
  errorLogChannelId?: string;
  responses?: {
    developerOnly?: string | null;
    guildOnly?: string | null;
    cooldown?: string | null;
    missingPerms?: string | null;
    errorBoundary?: string | null;
  };
  locales?: string[];
  defaultLocale?: string;
  directories?: {
    commands?: string;
    events?: string;
    components?: string;
    tasks?: string;
    locales?: string;
  };
  cooldownAdapter?: CooldownAdapter;
}

export interface DJSNextClientOptions extends ClientOptions {
  commandsDir?: string;
  eventsDir?: string;
  componentsDir?: string;
  tasksDir?: string;
  clientId?: string;
  guildId?: string;
  developers?: string[];
  prefixes?: string[] | string;
  enableSlashCommands?: boolean;
  enableTextCommands?: boolean;
  enableMentionPrefix?: boolean | string[];
  enableNoPrefix?: boolean | string[];
  middleware?: (interaction: Interaction | Message, client: Client) => Promise<boolean> | boolean;
  config?: DJSNextConfig;
  db?: any;
}

export interface FileTask<DB = any> {
  filepath?: string;
  interval: number;
  execute: (client: Client & { db: DB; t: Function; config: DJSNextConfig }) => Promise<void> | void;
}

export interface FileCommand<DB = any> {
  filepath?: string;
  description: string;
  options?: ApplicationCommandOptionData[];
  cooldown?: number;
  userPermissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  developerOnly?: boolean;
  guildOnly?: boolean;
  aliases?: string[];
  preconditions?: string[];
  execute?: (interaction: ChatInputCommandInteraction, client: Client & { db: DB; t: Function; config: DJSNextConfig }) => Promise<void> | void;
  executeText?: (message: Message, args: string[], client: Client & { db: DB; t: Function; config: DJSNextConfig }) => Promise<void> | void;
  autocomplete?: (interaction: AutocompleteInteraction, client: Client & { db: DB; t: Function; config: DJSNextConfig }) => Promise<void> | void;
}

export interface FileComponent<DB = any> {
  filepath?: string;
  customId?: string;
  preconditions?: string[];
  execute: (interaction: MessageComponentInteraction | ModalSubmitInteraction, client: Client & { db: DB; t: Function; config: DJSNextConfig }, params?: Record<string, string>) => Promise<void> | void;
}

export interface Event<K extends keyof ClientEvents = keyof ClientEvents, DB = any> {
  filepath?: string;
  name: K;
  once?: boolean;
  execute: (client: Client & { db: DB; t: Function; config: DJSNextConfig }, ...args: ClientEvents[K]) => Promise<void> | void;
}
