import { Client, Collection, Interaction, Message } from 'discord.js';
import { DJSNextClientOptions, FileCommand, FileComponent, DJSNextConfig } from './types.js';
import { loadAndDeployCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { loadComponents } from './handlers/componentHandler.js';
import { loadTasks } from './handlers/taskHandler.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

import { loadConfig } from './utils/configLoader.js';
import { loadLocales, translate } from './utils/i18n.js';
import { handleDNXT } from './plugins/dnxt.js';

export class DJSNextClient<DB = any> extends Client {
  public commands: Collection<string, FileCommand>;
  public components: Collection<string, FileComponent>;
  public cooldowns: Collection<string, Collection<string, number>>;
  public config: DJSNextConfig = {};
  public t = translate;
  public db!: DB;
  
  private _commandsDir?: string;
  private _eventsDir?: string;
  private _componentsDir?: string;
  private _tasksDir?: string;
  private _localesDir?: string;
  private _clientId?: string;
  private _guildId?: string;
  private _developers: string[];
  private _middleware?: (interaction: Interaction | Message, client: Client) => Promise<boolean> | boolean;
  private _prefixes: string[];
  private _enableSlashCommands: boolean;
  private _enableTextCommands: boolean;
  private _enableMentionPrefix: boolean | string[];
  private _enableNoPrefix: boolean | string[];

  constructor(options: DJSNextClientOptions) {
    super(options);
    this.commands = new Collection();
    this.components = new Collection();
    this.cooldowns = new Collection();
    
    this._commandsDir = options.commandsDir ? path.resolve(process.cwd(), options.commandsDir) : undefined;
    this._eventsDir = options.eventsDir ? path.resolve(process.cwd(), options.eventsDir) : undefined;
    this._componentsDir = options.componentsDir ? path.resolve(process.cwd(), options.componentsDir) : undefined;
    this._tasksDir = options.tasksDir ? path.resolve(process.cwd(), options.tasksDir) : undefined;
    this._clientId = options.clientId;
    this._guildId = options.guildId;
    this._developers = options.developers || [];
    this._middleware = options.middleware as any;
    
    const prefs = options.prefixes || [];
    this._prefixes = Array.isArray(prefs) ? prefs : [prefs];
    this._prefixes = this._prefixes.filter(p => p !== ''); // Remove empty strings, handle explicitly via enableNoPrefix

    this._enableSlashCommands = options.enableSlashCommands ?? true;
    this._enableTextCommands = options.enableTextCommands ?? true;
    this._enableMentionPrefix = options.enableMentionPrefix ?? true;
    this._enableNoPrefix = options.enableNoPrefix ?? false;
    if (options.db) this.db = options.db as any;

    this.attachCoreListeners();
  }

  private attachCoreListeners() {
    this.on('interactionCreate', async (interaction: Interaction) => {
      // 1. Global Middleware execution
      if (this._middleware) {
        try {
          const shouldContinue = await this._middleware(interaction, this);
          if (!shouldContinue) return; // Middleware halted execution
        } catch (error) {
          console.error(`[djs-next] Middleware error:`, error);
          return;
        }
      }

      // 2. Chat Input Commands Execution
      if (interaction.isChatInputCommand()) {
        if (!this._enableSlashCommands) return;
        
        let commandKey = interaction.commandName;
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand(false);

        if (group) commandKey += ` ${group}`;
        if (sub) commandKey += ` ${sub}`;

        const command = this.commands.get(commandKey);
        if (!command || !command.execute) return;

        if (!(await this.handlePreconditions(command, interaction, commandKey))) return;

        try {
          await command.execute(interaction, this);
        } catch (error) {
          await this.handleCommandError(error, commandKey, interaction);
        }
      }

      // 3. Autocomplete Routing
      if (interaction.isAutocomplete()) {
        let commandKey = interaction.commandName;
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand(false);

        if (group) commandKey += ` ${group}`;
        if (sub) commandKey += ` ${sub}`;

        const command = this.commands.get(commandKey);
        if (command && command.autocomplete) {
          try {
            await command.autocomplete(interaction, this);
          } catch (error) {
            console.error(`[djs-next] Error executing autocomplete for: "${commandKey}"`, error);
          }
        }
      }

      // 4. Component Routing (Buttons, Modals, Menus)
      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        // Skip pagination built-in buttons
        if (interaction.customId === 'djs_prev' || interaction.customId === 'djs_next') return;

        let component = this.components.get(interaction.customId);
        let params: Record<string, string> = {};

        if (!component) {
          for (const [key, comp] of this.components) {
            if (!key.includes('[')) continue;
            // Escape regex chars except brackets
            const escapedKey = key.replace(/[.*+?^${}()|\\-]/g, '\\$&');
            // Transform \[id\] into (?<id>.+)
            const regexStr = '^' + escapedKey.replace(/\\\[([^\]]+)\\\]/g, '(?<$1>.+)') + '$';
            const match = interaction.customId.match(new RegExp(regexStr));
            if (match) {
              component = comp;
              if (match.groups) params = match.groups;
              break;
            }
          }
        }
        if (component) {
          if (!(await this.handlePreconditions(component, interaction, interaction.customId))) return;

          try {
            await component.execute(interaction, this, params);
          } catch (error) {
            await this.handleCommandError(error, interaction.customId, interaction);
          }
        }
      }
    });

    this.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;
      if (!this._enableTextCommands) return;

      // Global Middleware execution for Messages
      if (this._middleware) {
        try {
          const shouldContinue = await this._middleware(message, this);
          if (!shouldContinue) return;
        } catch (error) {
          console.error(`[djs-next] Middleware error (Message):`, error);
          return;
        }
      }

      let content = message.content.trim();
      let matchedPrefix = '';
      let isCommand = false;

      // 1. Check Mention Prefix
      const mentionRegex = new RegExp(`^<@!?${this.user?.id}>\\s*`);
      const canUseMention = this._enableMentionPrefix === true || (Array.isArray(this._enableMentionPrefix) && this._enableMentionPrefix.includes(message.author.id));
      
      if (canUseMention && mentionRegex.test(content)) {
        matchedPrefix = content.match(mentionRegex)![0];
        isCommand = true;
      } else {
        // 2. Check Standard Prefixes
        const sortedPrefs = [...this._prefixes].sort((a, b) => b.length - a.length);
        
        for (const p of sortedPrefs) {
          if (content.startsWith(p)) {
            matchedPrefix = p;
            isCommand = true;
            break;
          }
        }

        // 3. Check No Prefix
        const canUseNoPrefix = this._enableNoPrefix === true || (Array.isArray(this._enableNoPrefix) && this._enableNoPrefix.includes(message.author.id));
        if (!isCommand && canUseNoPrefix) {
          isCommand = true;
          matchedPrefix = '';
        }
      }

      if (!isCommand) return;

      const args = content.slice(matchedPrefix.length).trim().split(/ +/g);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      // Find the command
      let command = this.commands.get(commandName);
      if (!command) {
        // Check aliases
        command = this.commands.find(c => c.aliases?.includes(commandName) || false);
      }

      if (!command || !command.executeText) return;

      if (!(await this.handlePreconditions(command, message, commandName))) return;

      // Execute Text Command
      try {
        await command.executeText(message, args, this);
      } catch (error) {
        await this.handleCommandError(error, commandName, message);
      }
    });
  }

  public async start(token: string): Promise<void> {
    if (!token) throw new Error("[djs-next] A token must be provided to start the bot.");

    this.config = await loadConfig();

    // Fallback options to config, then to default 'src' folders
    this._guildId = this._guildId || this.config.devGuildId;
    
    if (!this._commandsDir) this._commandsDir = path.resolve(process.cwd(), this.config.directories?.commands || 'src/commands');
    if (!this._eventsDir) this._eventsDir = path.resolve(process.cwd(), this.config.directories?.events || 'src/events');
    if (!this._componentsDir) this._componentsDir = path.resolve(process.cwd(), this.config.directories?.components || 'src/components');
    if (!this._tasksDir) this._tasksDir = path.resolve(process.cwd(), this.config.directories?.tasks || 'src/tasks');
    if (!this._localesDir) this._localesDir = path.resolve(process.cwd(), this.config.directories?.locales || 'src/locales');

    // Only load if the directories actually exist
    if (fs.existsSync(this._localesDir)) loadLocales(this._localesDir, this.config.defaultLocale);

    // Load middleware from root
    if (!this._middleware) {
      const exts = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
      const cwd = process.cwd();
      for (const ext of exts) {
        const mwPath = path.join(cwd, `middleware${ext}`);
        if (fs.existsSync(mwPath)) {
          try {
            const mwModule = await import(pathToFileURL(mwPath).href);
            this._middleware = mwModule.default?.middleware || mwModule.middleware || mwModule.default || mwModule;
            if (this._middleware) {
              console.log(`[djs-next] Loaded global middleware.`);
              break;
            }
          } catch (err) {
            console.error(`[djs-next] Error loading middleware file ${mwPath}:`, err);
          }
        }
      }
    }

    if (fs.existsSync(this._eventsDir)) await loadEvents(this, this._eventsDir);
    if (fs.existsSync(this._componentsDir)) this.components = await loadComponents(this._componentsDir);
    if (fs.existsSync(this._tasksDir)) await loadTasks(this, this._tasksDir);

    await this.login(token);
    console.log(`[djs-next] Bot is ready and logged in as ${this.user?.tag}!`);

    // Load and deploy commands AFTER login so we can automatically use this.user.id
    if (fs.existsSync(this._commandsDir)) {
      this._clientId = this._clientId || this.user!.id;
      this.commands = await loadAndDeployCommands(this._commandsDir, token, this._clientId, this._guildId);
    }
  }

  public enableDevTools(prefix: 'dnxt' | 'nxt' = 'dnxt'): void {
    if (prefix !== 'dnxt' && prefix !== 'nxt') {
      throw new Error(`[djs-next] Developer Tools prefix must be either 'dnxt' or 'nxt'. Received: ${prefix}`);
    }

    this.on('messageCreate', async (message) => {
      await handleDNXT(message, this, prefix);
    });

    console.log(`[djs-next] 🛠️ Developer Tools enabled. Use "${prefix}" in chat. Ensure MessageContent intent is enabled!`);
  }

  public async enableHMR(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      console.log(`[djs-next] 🔄 HMR Enabled. Watching for file changes...`);

      const watcher = chokidar.watch([
        this._commandsDir, 
        this._eventsDir, 
        this._componentsDir, 
        this._localesDir
      ].filter(Boolean) as string[], { ignoreInitial: true });

      watcher.on('change', async (filePath) => {
        console.log(`[djs-next] ♻️ File changed: ${filePath}. Reloading...`);
        // We will just naively re-run the loaders. 
        // For events, we need to remove all listeners first to avoid memory leaks.
        this.removeAllListeners();
        this.commands.clear();
        this.components.clear();
        
        // Re-attach core listener
        this.attachCoreListeners();

        // Reload
        if (this._eventsDir) await loadEvents(this, this._eventsDir);
        if (this._componentsDir) this.components = await loadComponents(this._componentsDir);
        if (this._commandsDir && this._clientId) {
           this.commands = await loadAndDeployCommands(this._commandsDir, this.token!, this._clientId, this._guildId);
        }
        if (this._localesDir) loadLocales(this._localesDir, this.config.defaultLocale);
        
        console.log(`[djs-next] ✅ Hot Reload complete.`);
      });
    } catch (e) {
      console.warn(`[djs-next] chokidar not installed. HMR is disabled. Please run "npm install chokidar" to use this feature.`);
    }
  }

  private async handleCommandError(error: any, commandKey: string, context: Interaction | Message) {
    console.error(`[djs-next] Error executing command/component: "${commandKey}"`, error);
    const djs = require('discord.js');
    if (this.config.responses?.errorBoundary === null) {
      // Developer explicitly opted out of error boundary user messages
    } else {
      try {
        const errorContent = this.config.responses?.errorBoundary || `### ⚠️ Execution Error\n> The framework encountered a fatal error while executing \`${commandKey}\`.`;
        const codeBlock = `\`\`\`js\n${String(error.stack || error.message).substring(0, 1500)}\n\`\`\``;

        if ('commandName' in context || 'customId' in context) {
          const container = new djs.ContainerBuilder()
            .setAccentColor(0xED4245)
            .addTextDisplayComponents(new djs.TextDisplayBuilder().setContent(errorContent))
            .addSeparatorComponents(new djs.SeparatorBuilder())
            .addTextDisplayComponents(new djs.TextDisplayBuilder().setContent(codeBlock));
            
          const payload = { components: [container], flags: 32768, ephemeral: true };
          const i = context as Interaction;
          if (i.isRepliable()) {
            if (i.replied || i.deferred) await i.followUp(payload);
            else await i.reply(payload);
          }
        } else {
          const embed = new djs.EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(`${errorContent}\n\n${codeBlock}`);
            
          const m = context as Message;
          await m.reply({ embeds: [embed] });
        }
      } catch (e) {
        // Fallback ignore if channel is dead
      }
    }

    if (this.config.errorLogChannelId) {
      try {
        const channel = await this.channels.fetch(this.config.errorLogChannelId);
        if (channel && channel.isTextBased()) {
          const userId = 'user' in context ? context.user.id : context.author.id;
          await (channel as any).send(`🚨 **Global Error Boundary Caught Exception**\n**Context:** \`${commandKey}\`\n**User:** <@${userId}>\n\`\`\`js\n${String(error.stack || error.message).substring(0, 1900)}\n\`\`\``);
        }
      } catch (e) {
        console.error(`[djs-next] Failed to send error to log channel:`, e);
      }
    }
  }

  private async handlePreconditions(command: FileCommand | FileComponent, context: Interaction | Message, commandKey: string): Promise<boolean> {
    const userId = 'user' in context ? context.user.id : context.author.id;
    const isGuild = 'guild' in context && context.guild !== null;
    const member = context.member as any;

    const sendErr = async (msg: string | null) => {
      if (msg === null) return;
      if ('reply' in context && typeof context.reply === 'function') {
        try {
          if ('replied' in context && (context as any).isRepliable() && ((context as any).replied || (context as any).deferred)) {
            await (context as any).followUp({ content: msg, ephemeral: true });
          } else {
            await (context as any).reply({ content: msg, ephemeral: true, allowedMentions: { repliedUser: false } });
          }
        } catch(e) {}
      }
    };

    if ('developerOnly' in command && command.developerOnly && !this._developers.includes(userId)) {
      await sendErr(this.config.responses?.developerOnly !== undefined ? this.config.responses.developerOnly : 'Only developers can use this command.');
      return false;
    }
    if ('guildOnly' in command && command.guildOnly && !isGuild) {
      await sendErr(this.config.responses?.guildOnly !== undefined ? this.config.responses.guildOnly : 'This command can only be used in a server.');
      return false;
    }
    if ('userPermissions' in command && command.userPermissions && member?.permissions) {
      const missing = member.permissions.missing(command.userPermissions);
      if (missing.length > 0) {
        await sendErr(this.config.responses?.missingPerms !== undefined ? (this.config.responses.missingPerms === null ? null : this.config.responses.missingPerms.replace('{perms}', missing.join(', '))) : `You are missing permissions: \`${missing.join(', ')}\``);
        return false;
      }
    }
    if ('botPermissions' in command && command.botPermissions && context.guild?.members.me?.permissions) {
      const missing = context.guild.members.me.permissions.missing(command.botPermissions);
      if (missing.length > 0) {
        await sendErr(this.config.responses?.missingPerms !== undefined ? (this.config.responses.missingPerms === null ? null : this.config.responses.missingPerms.replace('{perms}', missing.join(', '))) : `I am missing permissions to run this: \`${missing.join(', ')}\``);
        return false;
      }
    }

    let totalCooldown = 'cooldown' in command && command.cooldown ? command.cooldown * 1000 : 0;

    if (command.preconditions) {
      for (const pre of command.preconditions) {
        const parts = pre.split(':');
        const type = parts[0].toLowerCase();
        const val = parts.slice(1).join(':');

        if (type === 'owneronly' || type === 'developeronly') {
          if (!this._developers.includes(userId)) {
            await sendErr(this.config.responses?.developerOnly !== undefined ? this.config.responses.developerOnly : 'Only developers can use this command.');
            return false;
          }
        } else if (type === 'guildonly') {
          if (!isGuild) {
            await sendErr(this.config.responses?.guildOnly !== undefined ? this.config.responses.guildOnly : 'This command can only be used in a server.');
            return false;
          }
        } else if (type === 'requireperms') {
          const perms = val.split(',').map(p => p.trim());
          if (member?.permissions) {
            const missing = member.permissions.missing(perms);
            if (missing.length > 0) {
              await sendErr(this.config.responses?.missingPerms !== undefined ? (this.config.responses.missingPerms === null ? null : this.config.responses.missingPerms.replace('{perms}', missing.join(', '))) : `You are missing permissions: \`${missing.join(', ')}\``);
              return false;
            }
          }
        } else if (type === 'cooldown') {
          const match = val.match(/(\d+)(s|m|h)/);
          if (match) {
            let amount = parseInt(match[1]) * 1000;
            if (match[2] === 'm') amount *= 60;
            if (match[2] === 'h') amount *= 3600;
            totalCooldown = Math.max(totalCooldown, amount);
          }
        }
      }
    }

    if (totalCooldown > 0) {
      const now = Date.now();
      
      if (this.config.cooldownAdapter) {
        const lastUsed = await this.config.cooldownAdapter.get(commandKey, userId);
        if (lastUsed) {
          const expirationTime = lastUsed + totalCooldown;
          if (now < expirationTime) {
            const timeStr = `<t:${Math.round(expirationTime / 1000)}:R>`;
            await sendErr(this.config.responses?.cooldown !== undefined ? (this.config.responses.cooldown === null ? null : this.config.responses.cooldown.replace('{time}', timeStr)) : `Please wait, you are on a cooldown. You can use it again ${timeStr}.`);
            return false;
          }
        }
        await this.config.cooldownAdapter.set(commandKey, userId, now);
      } else {
        if (!this.cooldowns.has(commandKey)) this.cooldowns.set(commandKey, new Collection());
        const timestamps = this.cooldowns.get(commandKey)!;

        if (timestamps.has(userId)) {
          const expirationTime = timestamps.get(userId)! + totalCooldown;
          if (now < expirationTime) {
            const timeStr = `<t:${Math.round(expirationTime / 1000)}:R>`;
            await sendErr(this.config.responses?.cooldown !== undefined ? (this.config.responses.cooldown === null ? null : this.config.responses.cooldown.replace('{time}', timeStr)) : `Please wait, you are on a cooldown. You can use it again ${timeStr}.`);
            return false;
          }
        }
        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), totalCooldown);
      }
    }

    return true;
  }
}
