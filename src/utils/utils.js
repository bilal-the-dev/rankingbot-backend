const ServerAnalytics = require("../models/ServerAnalytics");

/**
 * Updates daily server analytics for messages, XP, voice, or coins
 * @param {string} guildId
 * @param {Object} increments
 */
async function updateServerAnalytics(guildId, increments = {}) {
  try {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    const updateData = {
      $inc: {
        totalMessages: increments.messages || 0,
        totalXPGained: increments.xp || 0,
        totalVoiceMinutes: increments.voiceMinutes || 0,
        totalCoinsDistributed: increments.coins || 0,
      },
      $setOnInsert: {
        guildId: guildId,
        date: today,
      },
    };

    await ServerAnalytics.findOneAndUpdate(
      { guildId, date: today },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
    console.log("Updsated the level");
  } catch (error) {
    console.error(
      `❌ Analytics update failed for guild ${guildId}:`,
      error.message,
    );
  }
}

module.exports = { updateServerAnalytics };
