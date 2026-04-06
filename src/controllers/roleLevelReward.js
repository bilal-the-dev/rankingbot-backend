const RoleLevelReward = require("../models/RoleLevelReward");

const { apiResponse } = require("../utils/response");
const config = require("../config/config");
const { fetchGuildResources } = require("../utils/fetchGuildResources");

const getAllRoleLevelRewards = async (req, res) => {
  try {
    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const rewards = await RoleLevelReward.find({ guildId: config.guildId })
      .sort({ level: 1 })
      .lean();

    // Fetch additional resources based on query params (?roles=true, ?channels=true, etc.)
    const resources = await fetchGuildResources(req);

    const responseData = {
      rewards, // main data
      ...resources, // channels, roles, users (if requested)
    };

    return res
      .status(200)
      .json(
        apiResponse(
          true,
          "Role level rewards fetched successfully",
          responseData,
        ),
      );
  } catch (error) {
    console.error("Get RoleLevelReward Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to fetch role level rewards"));
  }
};

const createRoleLevelReward = async (req, res) => {
  try {
    const { level, requiredXP, roleId } = req.body;

    if (!level || !requiredXP || !roleId) {
      return res
        .status(400)
        .json(apiResponse(false, "level, requiredXP, and roleId are required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    // Extra safety check (even though schema has unique index)
    const existing = await RoleLevelReward.findOne({
      guildId: config.guildId,
      level,
    });
    if (existing) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            `Level ${level} already has a reward configured for this server`,
          ),
        );
    }

    const newReward = await RoleLevelReward.create({
      guildId: config.guildId,
      level,
      requiredXP,
      roleId,
    });

    return res
      .status(201)
      .json(
        apiResponse(true, "Role level reward created successfully", newReward),
      );
  } catch (error) {
    console.error("Create RoleLevelReward Error:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Level already exists for this guild (duplicate level)",
          ),
        );
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }

    return res
      .status(500)
      .json(apiResponse(false, "Failed to create role level reward"));
  }
};

const updateRoleLevelReward = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json(apiResponse(false, "Reward ID is required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const updateData = { ...req.body };
    delete updateData.guildId; // prevent changing guild

    const updated = await RoleLevelReward.findOneAndUpdate(
      { _id: id, guildId: config.guildId },
      updateData,
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Role level reward not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(
        apiResponse(true, "Role level reward updated successfully", updated),
      );
  } catch (error) {
    console.error("Update RoleLevelReward Error:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Level already exists for another reward in this guild",
          ),
        );
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }

    return res
      .status(500)
      .json(apiResponse(false, "Failed to update role level reward"));
  }
};

const deleteRoleLevelReward = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json(apiResponse(false, "Reward ID is required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const result = await RoleLevelReward.deleteOne({
      _id: id,
      guildId: config.guildId,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Role level reward not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Role level reward deleted successfully"));
  } catch (error) {
    console.error("Delete RoleLevelReward Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to delete role level reward"));
  }
};

const getRoleLevelRewardById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json(apiResponse(false, "Reward ID is required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const reward = await RoleLevelReward.findOne({
      _id: id,
      guildId: config.guildId,
    }).lean();

    if (!reward) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Role level reward not found or does not belong to this server",
          ),
        );
    }

    // Fetch additional resources (roles, channels, users) if requested via query params
    const resources = await fetchGuildResources(req);

    // Combine reward with requested resources
    const responseData = {
      ...reward,
      ...resources, // channels, roles, users will be added only if ?roles=true, ?channels=true etc.
    };

    return res
      .status(200)
      .json(
        apiResponse(
          true,
          "Role level reward fetched successfully",
          responseData,
        ),
      );
  } catch (error) {
    console.error("Get RoleLevelReward By ID Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to fetch role level reward"));
  }
};

module.exports = {
  getAllRoleLevelRewards,
  createRoleLevelReward,
  updateRoleLevelReward,
  deleteRoleLevelReward,
  getRoleLevelRewardById,
};
