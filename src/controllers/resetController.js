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

    const result = await User.deleteMany({ guildId: config.guildId });

    return res.status(200).json(
      apiResponse(
        true,
        `Successfully reset all users (${result.deletedCount} users affected). All XP, coins, messages, and stats have been cleared.`,
        {
          deletedCount: result.deletedCount,
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

    const result = await User.deleteOne({
      guildId: config.guildId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "User not found or already has no data"));
    }

    return res.status(200).json(
      apiResponse(
        true,
        `Successfully reset user ${userId}. All their XP, coins, messages, and stats have been cleared.`,
        {
          userId,
          deleted: true,
        },
      ),
    );
  } catch (error) {
    console.error("Reset Specific User Error:", error);
    return res.status(500).json(apiResponse(false, "Failed to reset user"));
  }
};

module.exports = { resetAllUsers, resetSpecificUser };
