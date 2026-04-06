const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const User = require("../../models/User");
const { generateRankCard } = require("../../utils/rankCard");

module.exports = {
  name: "rank",
  description: "Show your current rank card",

  options: [
    {
      name: "user",
      description: "View another user's rank card",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const target = interaction.options.getUser("user") || interaction.user;
    const guildId = interaction.guild.id;

    await interaction.deferReply();

    try {
      // Fetch or create user data
      let userData = await User.findOne({ guildId, userId: target.id });

      if (!userData) {
        userData = new User({
          guildId,
          userId: target.id,
          // You can add defaults here if needed (level: 1, xp: 0, etc.)
        });
        await userData.save();
      }

      // Fetch member for displayName + avatar (fallback to user)
      let member;
      try {
        member = await interaction.guild.members.fetch(target.id);
      } catch (err) {
        member = null; // User may have left the server
      }

      // Pass the user's chosen theme (if you added the field to your schema)
      const theme = userData.rankCardTheme || "default";

      const rankBuffer = await generateRankCard(
        member || {
          user: target,
          displayName: target.username,
        },
        userData,
        theme, // ← Now using the theme from database
      );

      const attachment = new AttachmentBuilder(rankBuffer, {
        name: `rank-${target.username}.png`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ffaa)
        .setDescription(`**Rank Card for ${target}**`)
        .setImage("attachment://rank.png"); // Make sure this matches the attachment name

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Rank card generation error:", error);

      await interaction.editReply({
        content: "❌ Failed to generate rank card. Please try again later.",
        ephemeral: true, // Only the user sees the error
      });
    }
  },
};
