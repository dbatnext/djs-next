import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  Message,
  MessageComponentInteraction
} from 'discord.js';

/**
 * Sends a confirmation prompt (Yes/No) to the user.
 * @param context The message or interaction context.
 * @param content The text or embed to display in the prompt.
 * @param time Time to wait for a response in milliseconds.
 * @returns Boolean indicating true for Yes, false for No, or null if timed out.
 */
export async function confirmPrompt(
  context: Message | CommandInteraction | MessageComponentInteraction,
  content: string | EmbedBuilder,
  time: number = 30000
): Promise<boolean | null> {
  const isMessage = 'author' in context;

  if (!isMessage) {
    if (!context.deferred && !context.replied) {
      await context.deferReply();
    }
  }

  const yesButton = new ButtonBuilder()
    .setCustomId('djs_prompt_yes')
    .setLabel('Yes')
    .setStyle(ButtonStyle.Success);

  const noButton = new ButtonBuilder()
    .setCustomId('djs_prompt_no')
    .setLabel('No')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesButton, noButton);

  const payload: any = { components: [row] };
  if (typeof content === 'string') {
    payload.content = content;
  } else {
    payload.embeds = [content];
  }

  let message: Message;
  if (isMessage) {
    message = await context.reply(payload);
  } else {
    message = await context.editReply(payload);
  }

  try {
    const interaction = await message.awaitMessageComponent({
      filter: (i) => i.user.id === (isMessage ? context.author.id : context.user.id),
      time
    });

    if (interaction.customId === 'djs_prompt_yes') {
      await interaction.update({ components: [] });
      return true;
    } else {
      await interaction.update({ components: [] });
      return false;
    }
  } catch (error) {
    if (message.editable) {
      await message.edit({ components: [] }).catch(() => {});
    }
    return null; // Timed out
  }
}
