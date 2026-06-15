const { MessagePayload, Message } = require('discord.js');
const payload = MessagePayload.create({ flags: { bitfield: 0 } }, "Pong!");
console.log(payload.resolveBody());
