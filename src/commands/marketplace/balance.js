const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
} = require("discord.js");
const MarketItem = require("../../models/MarketItem");
const User = require("../../models/User");

module.exports = {
  name: "balance",
  description: "Check your current coin balance",

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    let user = await User.findOne({ guildId, userId });

    const balance = user ? user.coins : 0;

    const embed = new EmbedBuilder()
      .setColor(0x00ffaa)
      .setTitle(`💰 Your Coin Balance`)
      .setDescription(`**${interaction.user.username}**, you currently have:`)
      .addFields({
        name: "Balance",
        value: `${balance.toLocaleString()} coins`,
        inline: true,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false });
  },
};
