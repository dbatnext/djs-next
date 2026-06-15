export const esmTemplates = {
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

client.start(process.env.DISCORD_TOKEN);
`,

  ping: `/** @type {import('djs-next').FileCommand} */
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
};
`,

  ready: `import { Events } from 'djs-next';

export const event = {
  name: Events.ClientReady,
  once: true,
  execute: (client) => {
    console.log('Ready! Logged in as ' + client.user?.tag);
  }
};
`,

  healthcheck: `export const task = {
  interval: 60000,
  execute: async (client) => {
    console.log('[Task] Healthcheck completed.');
  }
};
`
};
