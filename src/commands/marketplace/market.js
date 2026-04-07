const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
} = require("discord.js");
const MarketItem = require("../../models/MarketItem");

module.exports = {
  name: "market",
  description: "Browse the public marketplace",

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const guildId = interaction.guild.id;

    // Fetch only active public items
    const items = await MarketItem.find({
      guildId,
      isVIPOnly: false,
      isActive: true,
    }).sort({ price: 1 });

    if (items.length === 0) {
      return interaction.reply({
        content: "🛒 The public market is currently empty.",
        ephemeral: true,
      });
    }

    let currentPage = 0;

    const generateEmbed = (item) => {
      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`🛒 Public Market - ${item.name}`)
        .setDescription(item.description)
        .addFields(
          {
            name: "💰 Price",
            value: `${item.price.toLocaleString()} coins`,
            inline: true,
          },
          {
            name: "📦 Stock",
            value:
              item.quantity === -1
                ? "Unlimited"
                : `${item.quantity - item.soldCount} left`,
            inline: true,
          },
          {
            name: "Type",
            value: item.rewardType.replace("_", " ").toUpperCase(),
            inline: true,
          },
        )
        .setFooter({
          text: `Item ${currentPage + 1} of ${items.length} • Use buttons to navigate`,
        });

      return embed;
    };

    const createButtons = (current) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`market_prev_${current}`)
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current === 0),

        new ButtonBuilder()
          .setCustomId(`buy_${items[current].itemId}`)
          .setLabel("🛍️ Buy")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`market_next_${current}`)
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current === items.length - 1),
      );

      return row;
    };

    const message = await interaction.reply({
      embeds: [generateEmbed(items[0])],
      components: [createButtons(0)],
      fetchReply: true,
    });

    // Create collector for pagination (5 minutes timeout)
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000, // 5 minutes
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("market_prev_")) {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId.startsWith("market_next_")) {
        currentPage = Math.min(items.length - 1, currentPage + 1);
      }

      await i.update({
        embeds: [generateEmbed(items[currentPage])],
        components: [createButtons(currentPage)],
      });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
