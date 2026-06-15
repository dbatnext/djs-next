import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  CommandInteraction, 
  EmbedBuilder, 
  Message, 
  ComponentType 
} from 'discord.js';

export class PaginationBuilder {
  private pages: EmbedBuilder[] = [];
  private timeout: number = 60000;

  constructor(pages?: EmbedBuilder[]) {
    if (pages) this.pages = pages;
  }

  public addPage(embed: EmbedBuilder): this {
    this.pages.push(embed);
    return this;
  }

  public setPages(pages: EmbedBuilder[]): this {
    this.pages = pages;
    return this;
  }

  public setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  public async build(target: CommandInteraction | Message): Promise<Message | null> {
    if (this.pages.length === 0) throw new Error('[djs-next] PaginationBuilder requires at least one page.');

    if (this.pages.length === 1) {
      if (target instanceof CommandInteraction) {
        if (target.deferred || target.replied) {
          return await target.editReply({ embeds: [this.pages[0]] }) as Message;
        }
        return await target.reply({ embeds: [this.pages[0]], fetchReply: true }) as Message;
      } else {
        return await target.reply({ embeds: [this.pages[0]] });
      }
    }

    let currentPage = 0;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(true),
      new ButtonBuilder().setCustomId('page').setLabel(`1 / ${this.pages.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Primary)
    );

    let replyMsg: Message;
    if (target instanceof CommandInteraction) {
      if (target.deferred || target.replied) {
        replyMsg = await target.editReply({ embeds: [this.pages[0]], components: [row] }) as Message;
      } else {
        replyMsg = await target.reply({ embeds: [this.pages[0]], components: [row], fetchReply: true }) as Message;
      }
    } else {
      replyMsg = await target.reply({ embeds: [this.pages[0]], components: [row] });
    }

    const userId = target instanceof CommandInteraction ? target.user.id : target.author.id;

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: this.timeout,
      filter: i => i.user.id === userId
    });

    collector.on('collect', async i => {
      if (i.customId === 'prev') currentPage--;
      else if (i.customId === 'next') currentPage++;

      const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('page').setLabel(`${currentPage + 1} / ${this.pages.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage === this.pages.length - 1)
      );

      await i.update({ embeds: [this.pages[currentPage]], components: [newRow] });
    });

    collector.on('end', () => {
      replyMsg.edit({ components: [] }).catch(() => null);
    });

    return replyMsg;
  }
}
