const User = require("../../models/User");
const {
  shouldGiveXP,
  checkAndHandleLevelUps,
} = require("../../utils/levelingHelpers");
const { updateServerAnalytics } = require("../../utils/utils");

module.exports = async (client, message) => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  try {
    // Always count message for analytics
    await updateServerAnalytics(guildId, { messages: 1 });

    // Check leveling rules
    const { canGiveXP, xpAmount } = await shouldGiveXP(message);
    if (!canGiveXP) return;

    // Get or create user
    let user = await User.findOne({ guildId, userId });
    if (!user) {
      user = new User({ guildId, userId });
    }

    const oldLevel = user.level;

    // Award XP
    user.xp += xpAmount;
    user.totalMessagesSent += 1;
    user.lastMessageAt = new Date();

    await user.save(); // Save XP first

    // Update analytics with gained XP
    await updateServerAnalytics(guildId, { xp: xpAmount });

    // Check for level ups and handle rewards
    await checkAndHandleLevelUps(client, message, user);

    if (user.level > oldLevel) {
      console.log(
        `✅ Level Up Completed | User: ${message.author.tag} | Level ${oldLevel} → ${user.level} | Guild: ${guildId}`,
      );
    }
  } catch (error) {
    console.error("Error in messageCreate event:", error);
  }
};
