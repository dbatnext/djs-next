import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  Message,
  MessageComponentInteraction
} from 'discord.js';

export async function paginate(
  context: Message | CommandInteraction | MessageComponentInteraction,
  pages: EmbedBuilder[],
  time: number = 60000
) {
  const isMessage = 'author' in context;

  if (!isMessage) {
    if (!context.deferred && !context.replied) {
      await context.deferReply();
    }
  }

  if (pages.length === 1) {
    if (isMessage) {
      return context.reply({ embeds: [pages[0]], components: [] });
    } else {
      return context.editReply({ embeds: [pages[0]], components: [] });
    }
  }

  let index = 0;

  const prevButton = new ButtonBuilder()
    .setCustomId('djs_prev')
    .setLabel('Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId('djs_next')
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

  let message: Message;
  if (isMessage) {
    message = await context.reply({
      embeds: [pages[index]],
      components: [row],
    });
  } else {
    message = await context.editReply({
      embeds: [pages[index]],
      components: [row],
    });
  }

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === (isMessage ? context.author.id : context.user.id),
    time
  });

  collector.on('collect', async (i: MessageComponentInteraction) => {
    if (i.customId === 'djs_prev') {
      index = index > 0 ? index - 1 : index;
    } else if (i.customId === 'djs_next') {
      index = index < pages.length - 1 ? index + 1 : index;
    }

    prevButton.setDisabled(index === 0);
    nextButton.setDisabled(index === pages.length - 1);

    await i.update({
      embeds: [pages[index]],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton)]
    });
  });

  collector.on('end', async () => {
    prevButton.setDisabled(true);
    nextButton.setDisabled(true);
    if (message.editable) {
      await message.edit({
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton)]
      }).catch(() => {});
    }
  });
}
