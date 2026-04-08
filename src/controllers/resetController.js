const User = require("../models/User");

const { apiResponse } = require("../utils/response");
const config = require("../config/config");

const resetAllUsers = async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== true) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Please send confirm: true to reset all users. This action cannot be undone.",
          ),
        );
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const result = await User.updateMany(
      { guildId: config.guildId },
      {
        $set: {
          xp: 0,
          coins: 0,
          level: 1,
          messages: 0,
          // Add any other stats fields you have in your User model
          totalXp: 0,
          voiceMinutes: 0,
          lastMessageAt: null,
          lastVoiceUpdateAt: null,
        },
      },
    );

    return res.status(200).json(
      apiResponse(
        true,
        `Successfully reset all users (${result.modifiedCount} users affected). All XP, coins, levels, messages, and stats have been cleared.`,
        {
          modifiedCount: result.modifiedCount,
        },
      ),
    );
  } catch (error) {
    console.error("Reset All Users Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to reset all users"));
  }
};

const resetSpecificUser = async (req, res) => {
  try {
    const { userId, confirm } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json(apiResponse(false, "userId is required in request body"));
    }

    if (confirm !== true) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Please send confirm: true to reset this user. This action cannot be undone.",
          ),
        );
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const result = await User.updateOne(
      {
        guildId: config.guildId,
        userId,
      },
      {
        $set: {
          xp: 0,
          coins: 0,
          level: 1,
          messages: 0,
          // Add any other stats fields you have
          totalXp: 0,
          voiceMinutes: 0,
          lastMessageAt: null,
          lastVoiceUpdateAt: null,
        },
      },
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json(
          apiResponse(false, "User not found or already has no stats to reset"),
        );
    }

    return res.status(200).json(
      apiResponse(
        true,
        `Successfully reset user ${userId}. All their XP, coins, levels, messages, and stats have been cleared.`,
        {
          userId,
          modified: true,
        },
      ),
    );
  } catch (error) {
    console.error("Reset Specific User Error:", error);
    return res.status(500).json(apiResponse(false, "Failed to reset user"));
  }
};

module.exports = { resetAllUsers, resetSpecificUser };
