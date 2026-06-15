export const tsTemplates = {
  index: `import { DJSNextClient, GatewayIntentBits } from 'djs-next';
import 'dotenv/config';

const client = new DJSNextClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  commandsDir: './src/commands',
  eventsDir: './src/events',
  componentsDir: './src/components',
  tasksDir: './src/tasks',
  clientId: process.env.CLIENT_ID
});

client.start(process.env.DISCORD_TOKEN!);
`,

  ping: `import { FileCommand } from 'djs-next';

export default {
  description: 'Replies with the actual bot latency!',
  execute: async (interaction, client) => {
    const sent = await interaction.reply({ content: 'Pinging...', withResponse: true });
    const msg = sent.resource?.message || await interaction.fetchReply();
    await interaction.editReply(\`Pong! 🏓\\nWebsocket Latency: \\\`\${client.ws.ping}ms\\\`\\nAPI Latency: \\\`\${msg.createdTimestamp - interaction.createdTimestamp}ms\\\`\`);
  },
  executeText: async (message, args, client) => {
    const sent = await message.reply('Pinging...');
    await sent.edit(\`Pong! 🏓\\nWebsocket Latency: \\\`\${client.ws.ping}ms\\\`\\nAPI Latency: \\\`\${sent.createdTimestamp - message.createdTimestamp}ms\\\`\`);
  }
} as FileCommand;
`,

  ready: `import { DJSNextEvent, Events } from 'djs-next';

export const event: DJSNextEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute: (client) => {
    console.log('Ready! Logged in as ' + client.user?.tag);
  }
};
`,

  healthcheck: `import { FileTask } from 'djs-next';

export const task: FileTask = {
  interval: 60000,
  execute: async (client) => {
    console.log('[Task] Healthcheck completed.');
  }
};
`
};
