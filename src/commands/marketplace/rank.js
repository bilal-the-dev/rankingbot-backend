const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const User = require("../../models/User");
const { generateRankCard } = require("../../utils/rankCard");
const RoleLevelReward = require("../../models/RoleLevelReward"); // ← Add this

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

  callback: async (client, interaction) => {
    const target = interaction.options.getUser("user") || interaction.user;
    const guildId = interaction.guild.id;

    await interaction.deferReply();

    try {
      let userData = await User.findOne({ guildId, userId: target.id });

      if (!userData) {
        userData = new User({ guildId, userId: target.id });
        await userData.save();
      }

      let member;
      try {
        member = await interaction.guild.members.fetch(target.id);
      } catch (err) {
        member = null;
      }

      // === Fetch next required XP from RoleLevelReward ===
      let nextRequiredXP = 15000; // safe default

      const rewards = await RoleLevelReward.find({ guildId }).sort({
        level: 1,
      });

      if (rewards.length > 0) {
        // Find the smallest level > current user level
        const nextReward = rewards.find((r) => r.level > (userData.level || 0));

        if (nextReward) {
          nextRequiredXP = nextReward.requiredXP;
        } else {
          // No higher level exists → use the highest available
          nextRequiredXP = rewards[rewards.length - 1].requiredXP;
        }
      }
      // If no rewards at all → keep default 100

      const theme = "default"; // You can later pull from XPSettings or userData

      const rankBuffer = await generateRankCard(
        member || { user: target, displayName: target.username },
        userData,
        theme,
        nextRequiredXP, // ← Pass the correct next required XP
      );

      const attachment = new AttachmentBuilder(rankBuffer, {
        name: `rank-${target.username}.png`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ffaa)
        .setDescription(`**Rank Card for ${target}**`)
        .setImage("attachment://rank.png");

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Rank card generation error:", error);
      await interaction.editReply({
        content: "❌ Failed to generate rank card. Please try again later.",
        ephemeral: true,
      });
    }
  },
};
