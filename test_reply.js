const { Client, MessagePayload } = require('discord.js');
const client = new Client({ intents: [] });
const payload = MessagePayload.create(client, { components: [], flags: 32768 });
console.log(payload.resolveBody());
