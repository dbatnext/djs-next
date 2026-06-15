export const cjsTemplates = {
  index: `const { DJSNextClient, GatewayIntentBits } = require('djs-next');
require('dotenv/config');

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
module.exports = {
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

  ready: `const { Events } = require('djs-next');

module.exports = {
  event: {
    name: Events.ClientReady,
    once: true,
    execute: (client) => {
      console.log('Ready! Logged in as ' + client.user?.tag);
    }
  }
};
`,

  healthcheck: `module.exports = {
  task: {
    interval: 60000,
    execute: async (client) => {
      console.log('[Task] Healthcheck completed.');
    }
  }
};
`
};
