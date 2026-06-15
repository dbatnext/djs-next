<div align="center">
  <img src="https://raw.githubusercontent.com/dbatnext/djs-next/main/assets/djs-next.png" alt="djs-next logo" width="300" />
  <h1>djs-next</h1>
  <p><b>Discord Bots at Next.</b></p>
  <p>A hyper-modern, production-ready framework for Discord.js featuring file-based routing, native DNXT developer tools, Hot Module Replacement (HMR), and built-in safety nets.</p>

  <p>
    <b>📖 Official Documentation: <a href="https://dnext.vercel.app/djs-next">dnext.vercel.app/djs-next</a></b>
  </p>

  [![npm version](https://img.shields.io/npm/v/djs-next.svg?style=flat-square)](https://www.npmjs.org/package/djs-next)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

<br />

## ✨ Features

- 📁 **Next.js File-Based Routing**: Auto-loads commands, events, components, and tasks natively. Supports Regex dynamic routes (e.g., `[id].ts` for components).
- 🛠️ **Native Developer Tools (`dnxt`)**: A comprehensive, built-in developer suite. Live JS evaluation, remote shell execution, and instant Hot-Module Reloading!
- 🔄 **Hot Module Replacement (HMR)**: Live-reload your commands, events, and logic on save without ever dropping your Discord Gateway connection.
- 🗄️ **Strict Database Interop**: Connect your ORM (Prisma, Mongoose) securely.
- 🌍 **Localization (i18n)**: Out-of-the-box native string translations.
- 🛡️ **Middleware Routing**: Global `beforeExecute` hooks for overarching permission checks and analytics.
- 🚦 **Persistent Cooldowns**: Connect custom cache adapters (like Redis) for global persistent cooldown tracking.
- 📄 **PaginationBuilder**: A built-in class for creating robust interactive pagination menus.

## 📦 Installation

```bash
npm install djs-next
```
*(Or use `pnpm`, `yarn`, or `bun`)*

## 🚀 Quick Start

The fastest way to start building is to use our powerful scaffolding tool. Open your terminal and run:

```bash
npx djs-next init
```
This interactive CLI will instantly bootstrap a fully-configured **TypeScript**, **ESModule**, or **CommonJS** repository!

---

## 💻 Manual Setup

If you prefer to start manually, here's how to bootstrap `djs-next`:

### 1. The Entry Point (`index.js`)
```javascript
const { GatewayIntentBits, DJSNextClient } = require('djs-next');
const { PrismaClient } = require('@prisma/client'); // Optional Database

const db = new PrismaClient();

const client = new DJSNextClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  developers: ['YOUR_DISCORD_ID'], // Required for Developer Tools
  
  // Explicit Framework Toggles
  enableSlashCommands: true,
  enableTextCommands: true,
  enableMentionPrefix: true, 
  enableNoPrefix: false, 
  prefixes: ['!', '?'], // Standard prefixes
  
  // Connect your database (Mongoose, Prisma, etc.)
  db: db,
});


// Enable Hot-Module Reloading (HMR) for dev
client.enableHMR();

// Enable the Native Developer Tools (Prefix must be exactly 'dnxt' or 'nxt')
client.enableDevTools('nxt'); 

// Boot!
client.start(process.env.DISCORD_TOKEN);
```

### 2. Creating a Command
Drop a file into `src/commands/ping.js`. The framework reads it and registers it for **both** Slash Commands AND normal text prefixes!
```javascript
/** @type {import('djs-next').FileCommand} */
module.exports = {
  description: 'Replies with Pong!',
  aliases: ['p'], // Works for text commands (e.g. !p)
  cooldown: 5, // Automatically intercepts spammers
  
  // Triggers on Slash Command: /ping
  execute: async (interaction, client) => {
    await interaction.reply('Pong! 🏓');
  },
  
  // Triggers on Text Prefix: !ping, @Bot ping, or no-prefix ping
  executeText: async (message, args, client) => {
    await message.reply('Pong from text! 🏓');
  }
};
```

### 3. Dynamic Component Routing
Have a button with a custom ID like `ban_user_12345`? You don't need a massive switch statement. Just create `src/components/ban_user_[id].js`:
```javascript
/** @type {import('djs-next').FileComponent} */
module.exports = {
  // Matches "ban_user_12345" and extracts the param dynamically!
  customId: 'ban_user_[id]', 
  execute: async (interaction, client, params) => {
    const targetId = params.id; // '12345'
    await interaction.reply(`Banning user ${targetId}...`);
  }
};
```

  }
};
```

### 4. Interactive Pagination
You no longer need to write complex collectors for simple pagination menus. `djs-next` ships with a `PaginationBuilder`:
```javascript
const { PaginationBuilder } = require('djs-next');
const { EmbedBuilder } = require('discord.js');

// Inside a command execute function:
const paginator = new PaginationBuilder()
  .addPage(new EmbedBuilder().setDescription('Page 1'))
  .addPage(new EmbedBuilder().setDescription('Page 2'))
  .setTimeout(60000);

await paginator.build(interaction);
```

---

## 🗄️ Database Integrations

Because `djs-next` uses a global `<DB>` generic, you can natively bind any popular database (like MongoDB Atlas, Supabase, Prisma, or PostgreSQL) directly into the framework core. It will propagate 100% type-safety to all your commands and events.

### MongoDB Atlas (using Mongoose)

```javascript
// index.js
const mongoose = require('mongoose');
const { DJSNextClient, GatewayIntentBits } = require('djs-next');

// Connect to Atlas
mongoose.connect(process.env.MONGO_URI);

// Initialize DJSNext
const client = new DJSNextClient({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages ],
  db: mongoose
});

client.start(process.env.TOKEN);
```

```javascript
// src/commands/profile.js
const UserSchema = require('../models/User.js');

/** @type {import('djs-next').FileCommand} */
module.exports = {
  description: 'View your profile',
  execute: async (interaction, client) => {
    // client.db is your connected Mongoose instance
    const user = await UserSchema.findOne({ discordId: interaction.user.id });
    await interaction.reply(`You have ${user.coins} coins!`);
  }
};
```

### Supabase (PostgreSQL)

```javascript
// index.js
const { createClient } = require('@supabase/supabase-js');
const { DJSNextClient, GatewayIntentBits } = require('djs-next');

const supabase = createClient('https://xyz.supabase.co', process.env.SUPABASE_KEY);

const client = new DJSNextClient({
  intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages ],
  db: supabase
});

client.start(process.env.TOKEN);
```

```javascript
// src/commands/leaderboard.js
/** @type {import('djs-next').FileCommand} */
module.exports = {
  description: 'View the leaderboard',
  execute: async (interaction, client) => {
    // client.db is your Supabase client
    const { data, error } = await client.db.from('users').select('*').order('level', { ascending: false });
    await interaction.reply(`Top user is: ${data[0].username}`);
  }
};
```

---

## 🛠️ The Developer Suite (`dnxt`)

`djs-next` comes with a hyper-advanced, native developer suite. By providing your Discord User ID in the `developers` array and calling `client.enableDevTools('nxt')` (or `'dnxt'`), you can execute backend logic live directly from Discord!

***(Make sure your bot has the `MessageContent` Intent enabled!)***

| Command | Action |
| --- | --- |
| `dnxt js <code>` | Evaluates Javascript live with async resolution. |
| `dnxt sh <cmd>` | Executes raw shell/terminal code on your host machine. |
| `dnxt git <cmd>` | Executes standard git workflows (e.g., `dnxt git pull`). |
| `dnxt in <channelId> <text>`| Injects a message seamlessly into a specific channel as the bot. |
| `dnxt reload <target>` | Hot-swaps the internal cache. (e.g., `dnxt reload commands`, `dnxt reload all`). |
| `dnxt debug <cmd>` | Executes Javascript while explicitly tracking the Node.js V8 Heap Memory Delta. |
| `dnxt sync` | Manually forces a global Discord Slash Command synchronization. |
| `dnxt restart` | Safely spawns a new background process and shuts down the current one. |
| `dnxt stop` or `dnxt shutdown` | Fully disconnects the client and kills the Node process. |
| `dnxt` | Displays the Developer Dashboard tracking System RAM, Node Host status, and Process uptime. |

---

## ⚙️ Configuration (`djs-next.config.js`)

At the root of your project, you can drop a config file to heavily control how `djs-next` acts:

```javascript
module.exports = {
  devGuildId: 'YOUR_TESTING_SERVER_ID',
  defaultLocale: 'en-US',
  directories: {
    commands: 'src/commands',
    events: 'src/events',
    components: 'src/components',
    tasks: 'src/tasks',
    locales: 'src/locales'
  },
  // Optional Redis or persistent cache adapter for cooldowns
  cooldownAdapter: {
    get: async (cmdId, userId) => { /* return timestamp or null */ },
    set: async (cmdId, userId, expiration) => { /* save to db */ }
  }
};
```

## 📜 License
Released under the [MIT License](LICENSE).
