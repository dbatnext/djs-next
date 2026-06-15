#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();

console.log('🚀 Welcome to create-djs-next! Scaffolding your project...\n');

const dirsToCreate = [
  'src/commands',
  'src/events',
  'src/components',
  'src/tasks',
  'src/locales'
];

for (const dir of dirsToCreate) {
  const dirPath = path.join(projectDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
}

const envContent = `DISCORD_TOKEN=your_token_here\nCLIENT_ID=your_client_id\nGUILD_ID=your_dev_guild_id`;
const envPath = path.join(projectDir, '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file');
}

const indexContent = `const { GatewayIntentBits, DJSNextClient } = require('djs-next');

const client = new DJSNextClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  developers: ['YOUR_DISCORD_USER_ID'],
  clientId: process.env.CLIENT_ID,
  
  // Framework Toggles
  enableSlashCommands: true,
  enableTextCommands: true,
  enableMentionPrefix: true, 
  enableNoPrefix: false, 
  prefixes: ['!', '?'], 
  
  // Custom Middleware
  middleware: (interactionOrMessage, client) => {
    return true; // Return false to block execution
  },

  // Configuration
  config: {
    devGuildId: process.env.GUILD_ID,
    locales: ['en'],
    defaultLocale: 'en',
    responses: {
      developerOnly: '⛔ This command is restricted to bot developers.',
      guildOnly: '⛔ This command can only be used inside a server.',
      cooldown: '⏳ You are on cooldown! Please wait {time}.',
      missingPerms: '⛔ You lack permissions.',
      errorBoundary: '❌ An unexpected error occurred.',
    }
  }
});

client.enableHMR();
client.enableDevTools('dnxt'); // Enable 'dnxt' prefix dev commands
client.start(process.env.DISCORD_TOKEN);
\`;

const indexPath = path.join(projectDir, 'index.js');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath, indexContent);
  console.log('✅ Created index.js');
}

console.log('\n🎉 Scaffolding complete! Run \`npm install djs-next\` and start coding!');
