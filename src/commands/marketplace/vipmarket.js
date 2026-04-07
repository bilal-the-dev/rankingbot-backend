const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require("discord.js");
const MarketItem = require("../../models/MarketItem");

module.exports = {
  name: "vipmarket",
  description: "Browse the VIP exclusive marketplace",

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    // VIP Role Check (You can make this role ID configurable later via dashboard)
    const VIP_ROLE_ID = process.env.VIP_ROLE_ID; // ← Change this or make it dynamic

    if (!member.roles.cache.has(VIP_ROLE_ID)) {
      return interaction.reply({
        content:
          "❌ This market is only available for **VIP Subscribers**.\n\nGet VIP role to access exclusive items!",
        ephemeral: true,
      });
    }

    const items = await MarketItem.find({
      guildId,
      isVIPOnly: true,
      isActive: true,
    }).sort({ price: 1 });

    if (items.length === 0) {
      return interaction.reply({
        content: "🛒 The VIP market is currently empty.",
        ephemeral: true,
      });
    }

    let currentPage = 0;

    const generateEmbed = (item) => {
      const embed = new EmbedBuilder()
        .setColor(0xffaa00) // Gold color for VIP
        .setTitle(`👑 VIP Market - ${item.name}`)
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
          text: `VIP Exclusive • Item ${currentPage + 1} of ${items.length}`,
        });

      return embed;
    };

    const createButtons = (current) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vipmarket_prev_${current}`)
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current === 0),

        new ButtonBuilder()
          .setCustomId(`vipmarket_buy_${items[current]._id}`)
          .setLabel("🛍️ Buy")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`vipmarket_next_${current}`)
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

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("buy")) return;

      if (i.customId.startsWith("vipmarket_prev_")) {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId.startsWith("vipmarket_next_")) {
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
