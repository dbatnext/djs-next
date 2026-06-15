import { Message, EmbedBuilder, version as djsVersion } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import { DJSNextClient } from '../client.js';
import { loadEvents } from '../handlers/eventHandler.js';
import { loadComponents } from '../handlers/componentHandler.js';
import { loadAndDeployCommands } from '../handlers/commandHandler.js';
import { loadTasks } from '../handlers/taskHandler.js';
import { loadLocales } from '../utils/i18n.js';

const execAsync = util.promisify(exec);

export function buildDisplayMessage(content: string, color = 0x525AF1) {
  const djs = require('discord.js');
  const container = new djs.ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new djs.TextDisplayBuilder().setContent(content)
    );
  return { components: [container], flags: 32768 };
}

export async function handleDNXT(message: Message, client: Client, devPrefix: 'dnxt' | 'nxt'): Promise<void> {
  if (message.author.bot) return;
  if (!(client as any)._developers.includes(message.author.id)) return;
  if ((client as any).config?.devGuildId && message.guildId !== (client as any).config.devGuildId) return;

  const originalReply = message.reply.bind(message);
  message.reply = (async (content: any) => {
    if (typeof content === 'string') {
      return await originalReply({ ...buildDisplayMessage(content), allowedMentions: { repliedUser: false } });
    }
    if (!content.allowedMentions) content.allowedMentions = { repliedUser: false };
    return await originalReply(content);
  }) as any;

  const content = message.content.trim();
  
  // Build a list of valid dev command triggers: e.g. "dnxt", "!dnxt", "?dnxt", "nxt", "!nxt", etc.
  const validTriggers = [devPrefix];
  const clientPrefixes = (client as any)._prefixes || [];
  for (const p of clientPrefixes) {
    if (p !== '') validTriggers.push(`${p}${devPrefix}`);
  }

  let matchedTrigger = validTriggers.find(t => content === t || content.startsWith(`${t} `));
  if (!matchedTrigger) return;

  const args = content.slice(matchedTrigger.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();

  if (command === 'help') {
    const djs = require('discord.js');
    
    const container = new djs.ContainerBuilder()
      .setAccentColor(0x525AF1)
      .addTextDisplayComponents(
        new djs.TextDisplayBuilder().setContent(`# 📖 DNXT Toolkit Reference\n> Current prefix trigger: \`${matchedTrigger}\``)
      )
      .addSeparatorComponents(new djs.SeparatorBuilder())
      .addTextDisplayComponents(
        new djs.TextDisplayBuilder().setContent(`### 📊 Core Framework\n- \`${matchedTrigger}\` — Developer system dashboard\n- \`${matchedTrigger} help\` — Shows this reference menu`),
        new djs.TextDisplayBuilder().setContent(`### 💻 Execution & Diagnostics\n- \`${matchedTrigger} js <code>\` — Evaluates raw JS code\n- \`${matchedTrigger} sh <cmd>\` — Runs terminal shell script\n- \`${matchedTrigger} debug <code>\` — Evaluates JS with precise memory deltas`),
        new djs.TextDisplayBuilder().setContent(`### 📂 File System & Network\n- \`${matchedTrigger} cat <file>\` — Reads file contents\n- \`${matchedTrigger} curl <url>\` — Fetches remote URL data\n- \`${matchedTrigger} git <cmd>\` — Executes git repository commands`),
        new djs.TextDisplayBuilder().setContent(`### 🧰 Utilities\n- \`${matchedTrigger} <load|unload|reload> <target>\` — Manages system modules\n- \`${matchedTrigger} sync\` — Forces global slash command sync\n- \`${matchedTrigger} in <channel> <cmd>\` — Executes command in target channel\n- \`${matchedTrigger} restart\` — Restarts the bot completely\n- \`${matchedTrigger} shutdown\` — Stops the bot completely`)
      );

    await message.reply({ components: [container], flags: 32768, allowedMentions: { repliedUser: false } });
    return;
  }

  // Root dnxt command (Stats)
  if (!command) {
    const mem = process.memoryUsage();
    const botPing = client.ws.ping;
    const djs = require('discord.js');
    
    const container = new djs.ContainerBuilder()
      .setAccentColor(0x525AF1)
      .addTextDisplayComponents(
        new djs.TextDisplayBuilder().setContent(`# 🛠️ Developer System Dashboard\n> **DNXT Framework Engine**`)
      )
      .addSeparatorComponents(new djs.SeparatorBuilder())
      .addTextDisplayComponents(
        new djs.TextDisplayBuilder().setContent(`### 📡 Network Status\n- **System Uptime:** <t:${Math.floor((Date.now() - client.uptime!) / 1000)}:R>\n- **WebSocket Latency:** \`${botPing}ms\``),
        new djs.TextDisplayBuilder().setContent(`### 📦 Host Environment\n- **Discord.js Library:** \`v${djsVersion}\`\n- **Node.js Runtime:** \`${process.version}\`\n- **Operating System:** \`${os.type()}\` (\`${os.cpus().length}\` thread cores, \`${(os.uptime() / 60 / 60).toFixed(2)}\` hrs uptime)`),
        new djs.TextDisplayBuilder().setContent(`### 🧠 Resource Utilization\n- **Physical Memory:** \`${(mem.rss / 1024 / 1024).toFixed(2)} MB\`\n- **Heap Allocated:** \`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\``)
      );

    await message.reply({
      components: [container],
      flags: 32768, // MessageFlags.IsComponentsV2
      allowedMentions: { repliedUser: false }
    });
    return;
  }

  // Evaluation (js, eval, py)
  if (command === 'js' || command === 'eval' || command === 'py') {
    let code = args.join(' ');
    if (code.startsWith('```js') || code.startsWith('```py')) code = code.replace(/^```[a-z]*|```$/g, '');
    else if (code.startsWith('```')) code = code.replace(/^```|```$/g, '');

    if (!code) return void await message.reply('❌ Please provide code to evaluate.');

    try {
      const start = process.hrtime.bigint();
      const { commands, components, config } = client;
      
      // eslint-disable-next-line no-eval
      let evaled = await eval(`(async () => { ${code} })()`);
      const end = process.hrtime.bigint();
      const timeMs = Number(end - start) / 1e6;

      if (typeof evaled !== 'string') evaled = util.inspect(evaled, { depth: 1, colors: true });

      await sendPaginatedText(message, `✅ **Evaluated in ${timeMs.toFixed(3)}ms**\n`, evaled, 'ansi');
    } catch (err: any) {
      await sendPaginatedText(message, `❌ **Evaluation Error**\n`, err.message, 'ansi');
    }
    return;
  }

  // Execute Shell (sh, shell, git)
  if (command === 'sh' || command === 'shell' || command === 'git') {
    const cmd = command === 'git' ? 'git ' + args.join(' ') : args.join(' ');
    if (!cmd) return void await message.reply('❌ Please provide a command to execute.');

    try {
      const start = process.hrtime.bigint();
      let stdout = '', stderr = '', code = 0;
      try {
        const result = await execAsync(cmd);
        stdout = result.stdout;
        stderr = result.stderr;
      } catch (err: any) {
        stdout = err.stdout || '';
        stderr = err.stderr || err.message || '';
        code = err.code || 1;
      }
      const end = process.hrtime.bigint();
      const timeMs = Number(end - start) / 1e6;

      let resultText = `$ ${cmd}\n`;
      if (stdout) resultText += `${stdout}\n`;
      if (stderr) resultText += `${stderr}\n`;
      resultText += `\n[status] Return code ${code}`;

      await sendPaginatedText(message, `✅ **Executed in ${timeMs.toFixed(3)}ms**\n`, resultText, 'ansi');
    } catch (err: any) {
      await sendPaginatedText(message, `❌ **Shell Error**\n`, err.message, 'ansi');
    }
    return;
  }

  // Load / Unload / Reload
  if (command === 'load' || command === 'unload' || command === 'reload') {
    const target = args[0]?.toLowerCase();
    try {
      if (target === 'commands' && client['_commandsDir']) {
        if (command === 'unload' || command === 'reload') client.commands.clear();
        if (command === 'load' || command === 'reload') client.commands = await loadAndDeployCommands(client['_commandsDir'], client.token!, client['_clientId']!, client['_guildId']);
        await message.reply(`✅ Successfully ${command}ed commands.`);
      } else if (target === 'events' && client['_eventsDir']) {
        if (command === 'unload' || command === 'reload') {
          client.removeAllListeners();
          client['attachCoreListeners']();
        }
        if (command === 'load' || command === 'reload') await loadEvents(client, client['_eventsDir']);
        await message.reply(`✅ Successfully ${command}ed events.`);
      } else if (target === 'components' && client['_componentsDir']) {
        if (command === 'unload' || command === 'reload') client.components.clear();
        if (command === 'load' || command === 'reload') client.components = await loadComponents(client['_componentsDir']);
        await message.reply(`✅ Successfully ${command}ed components.`);
      } else if (target === 'locales' && client['_localesDir']) {
        if (command === 'load' || command === 'reload') loadLocales(client['_localesDir'], client.config.defaultLocale);
        await message.reply(`✅ Successfully ${command}ed locales.`);
      } else if (target === 'all' || !target) {
        if (command === 'unload' || command === 'reload') {
          client.removeAllListeners();
          client['attachCoreListeners']();
          client.commands.clear();
          client.components.clear();
        }
        if (command === 'load' || command === 'reload') {
          if (client['_eventsDir']) await loadEvents(client, client['_eventsDir']);
          if (client['_componentsDir']) client.components = await loadComponents(client['_componentsDir']);
          if (client['_localesDir']) loadLocales(client['_localesDir'], client.config.defaultLocale);
          if (client['_commandsDir']) client.commands = await loadAndDeployCommands(client['_commandsDir'], client.token!, client['_clientId']!, client['_guildId']);
        }
        await message.reply(`✅ Successfully ${command}ed all framework modules.`);
      } else {
        await message.reply('❌ Unknown target. Valid targets: `commands, events, components, locales, all`');
      }
    } catch (err: any) {
      await message.reply(`❌ **${command.toUpperCase()} Error:** ${err.message}`);
    }
    return;
  }

  // Cat (Read File)
  if (command === 'cat') {
    const fs = await import('fs');
    const path = await import('path');
    const file = args.join(' ');
    if (!file) return void await message.reply('❌ Please provide a file to read.');
    
    try {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      await sendPaginatedText(message, `📄 **${file}**\n`, content, file.split('.').pop() || '');
    } catch (e: any) {
      await message.reply(`❌ **Error reading file:** ${e.message}`);
    }
    return;
  }





  // Curl (dnxt curl <url>)
  if (command === 'curl') {
    const url = args[0];
    if (!url) return void await message.reply('❌ Please provide a URL.');
    try {
      const res = await fetch(url);
      const text = await res.text();
      await sendPaginatedText(message, `🌐 **Fetched from \`${url}\`**\n`, text, 'html');
    } catch (e: any) {
      await message.reply(`❌ **Curl Error:** ${e.message}`);
    }
    return;
  }

  // Debug Command (dnxt debug <command>)
  // In discord.py DNXT debug measures execution of a command.
  // In our case we will run a js eval and time it explicitly with heap usage.
  if (command === 'debug') {
    let code = args.join(' ');
    if (code.startsWith('```js') || code.startsWith('```py')) code = code.replace(/^```[a-z]*|```$/g, '');
    else if (code.startsWith('```')) code = code.replace(/^```|```$/g, '');
    if (!code) return void await message.reply('❌ Please provide code to debug.');
    
    try {
      const startMem = process.memoryUsage().heapUsed;
      const start = process.hrtime.bigint();
      const { commands, components, config } = client;
      
      // eslint-disable-next-line no-eval
      let evaled = await eval(`(async () => { ${code} })()`);
      
      const end = process.hrtime.bigint();
      const endMem = process.memoryUsage().heapUsed;
      const timeMs = Number(end - start) / 1e6;
      const memDiff = (endMem - startMem) / 1024 / 1024;
      
      if (typeof evaled !== 'string') evaled = util.inspect(evaled, { depth: 1, colors: true });
      
      await sendPaginatedText(message, `⏱️ **Debug Execution**\nTime: \`${timeMs.toFixed(3)}ms\` | Heap Delta: \`${memDiff.toFixed(3)}MB\`\n`, evaled, 'ansi');
    } catch (err: any) {
      await sendPaginatedText(message, `❌ **Debug Error**\n`, err.message, 'ansi');
    }
    return;
  }

  // In Command (dnxt in <channel_id> <command>)
  if (command === 'in') {
    const channelId = args.shift()?.replace(/<#|>/g, '');
    const cmd = args.join(' ');
    if (!channelId || !cmd) return void await message.reply(`❌ Usage: ${matchedTrigger} in <#channel|id> <command>`);
    try {
      const targetChannel = await client.channels.fetch(channelId);
      if (!targetChannel || !targetChannel.isTextBased()) throw new Error('Invalid Text Channel.');
      
      const mockMessage = Object.assign(Object.create(Object.getPrototypeOf(message)), message);
      Object.defineProperty(mockMessage, 'client', { value: client, configurable: true });
      if (message.guild) {
        Object.defineProperty(mockMessage, 'guild', { value: message.guild, configurable: true });
        Object.defineProperty(mockMessage, 'guildId', { value: message.guildId, configurable: true });
      }
      Object.defineProperty(mockMessage, 'channel', { value: targetChannel, configurable: true });
      Object.defineProperty(mockMessage, 'channelId', { value: targetChannel.id, configurable: true });
      Object.defineProperty(mockMessage, 'content', { value: cmd, configurable: true });
      client.emit('messageCreate', mockMessage as Message);
    } catch (e: any) {
      await message.reply(`❌ **In Error:** ${e.message}`);
    }
    return;
  }

  // Sync Command (dnxt sync)
  if (command === 'sync') {
    try {
      await message.reply('🔄 Force syncing slash commands...');
      await loadAndDeployCommands((client as any)._commandsDir, client.token!, (client as any)._clientId, (client as any)._guildId);
      await message.reply('✅ Slash commands synchronized globally/locally.');
    } catch (e: any) {
      await message.reply(`❌ **Sync Error:** ${e.message}`);
    }
    return;
  }

  // Restart Command (dnxt restart)
  if (command === 'restart') {
    await message.reply('🔄 Restarting framework...');
    client.destroy();
    
    const { spawn } = require('child_process');
    const child = spawn(process.argv[0], process.argv.slice(1), {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });
    child.unref();
    process.exit(0);
    return;
  }

  // Shutdown Command (dnxt shutdown | stop)
  if (command === 'shutdown' || command === 'stop') {
    await message.reply('🛑 Shutting down framework...');
    client.destroy();
    process.exit(0);
    return;
  }

  await message.reply(`❓ Unknown ${matchedTrigger} command. Available: \`js, sh, git, cat, curl, in, debug, reload, sync, restart, shutdown\``);
}

async function sendPaginatedText(message: Message, header: string, content: string, language: string = '') {
  const maxLength = 800;
  if (content.length <= maxLength) {
    await message.reply(buildDisplayMessage(`### ${header.replace(/\\*\\*/g, '')}\n\`\`\`${language}\n${content}\n\`\`\``));
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += maxLength) {
    chunks.push(content.substring(i, i + maxLength));
  }

  let index = 0;
  const djs = require('discord.js');
  
  function buildPage(idx: number) {
    const text = `### ${header.replace(/\\*\\*/g, '')}\n\`\`\`${language}\n${chunks[idx]}\n\`\`\`\n> *Page ${idx + 1} of ${chunks.length}*`;
    const container = new djs.ContainerBuilder()
      .setAccentColor(0x525AF1)
      .addTextDisplayComponents(
        new djs.TextDisplayBuilder().setContent(text)
      );
      
    const row1 = new djs.ActionRowBuilder().addComponents(
      new djs.ButtonBuilder().setCustomId('first').setLabel('≪').setStyle(2),
      new djs.ButtonBuilder().setCustomId('prev').setLabel('＜').setStyle(2),
      new djs.ButtonBuilder().setCustomId('goto').setLabel('⎘').setStyle(1),
      new djs.ButtonBuilder().setCustomId('next').setLabel('＞').setStyle(2),
      new djs.ButtonBuilder().setCustomId('last').setLabel('≫').setStyle(2)
    );

    const row2 = new djs.ActionRowBuilder().addComponents(
      new djs.ButtonBuilder().setCustomId('stop').setLabel('✖ Close').setStyle(4)
    );
    
    container.addActionRowComponents(row1, row2);
    return { components: [container], flags: 32768 };
  }

  const reply = await message.reply(buildPage(index));

  const collector = reply.createMessageComponentCollector({
    filter: (i) => ['first', 'prev', 'goto', 'stop', 'next', 'last'].includes(i.customId) && i.user.id === message.author.id,
    time: 120000
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'first') {
      index = 0;
    } else if (i.customId === 'prev') {
      index = index > 0 ? index - 1 : index;
    } else if (i.customId === 'next') {
      index = index < chunks.length - 1 ? index + 1 : index;
    } else if (i.customId === 'last') {
      index = chunks.length - 1;
    } else if (i.customId === 'goto') {
      const modal = new djs.ModalBuilder()
        .setCustomId('goto_modal')
        .setTitle('Go to Page');
      const input = new djs.TextInputBuilder()
        .setCustomId('page_num')
        .setLabel(`Page Number (1-${chunks.length})`)
        .setStyle(1)
        .setRequired(true);
      modal.addComponents(new djs.ActionRowBuilder().addComponents(input));
      await i.showModal(modal);
      try {
        const modalSubmit = await i.awaitModalSubmit({ filter: (mi) => mi.user.id === message.author.id && mi.customId === 'goto_modal', time: 60000 });
        const targetPage = parseInt(modalSubmit.fields.getTextInputValue('page_num'), 10);
        if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= chunks.length) {
          index = targetPage - 1;
        }
        await modalSubmit.update(buildPage(index));
      } catch {}
      return;
    } else if (i.customId === 'stop') {
      await reply.delete().catch(() => null);
      collector.stop();
      return;
    }

    await i.update(buildPage(index));
  });

  collector.on('end', () => {
    reply.edit({ components: [] }).catch(() => null);
  });
}
