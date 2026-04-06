const XPSettings = require("../models/XPSettings");

const { apiResponse } = require("../utils/response");
const config = require("../config/config");
const { fetchGuildResources } = require("../utils/fetchGuildResources");

const getXPSettings = async (req, res) => {
  try {
    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    let settings = await XPSettings.findOne({ guildId: config.guildId }).lean();

    if (!settings) {
      settings = await XPSettings.create({ guildId: config.guildId });
      settings = await XPSettings.findOne({ guildId: config.guildId }).lean();
    }

    const { levelingEnabled, ...cleanSettings } = settings;

    // Fetch additional resources based on query params
    const resources = await fetchGuildResources(req);

    // Combine settings + requested resources
    const responseData = {
      ...cleanSettings,
      ...resources, // channels, roles, users will be added only if requested
    };

    return res
      .status(200)
      .json(
        apiResponse(true, "XP Settings fetched successfully", responseData),
      );
  } catch (error) {
    console.error("Get XP Settings Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, error.message || "Failed to fetch XP settings"));
  }
};

const updateXPSettings = async (req, res) => {
  try {
    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const updateData = { ...req.body, guildId: config.guildId };

    // Remove levelingEnabled if frontend accidentally sends it
    delete updateData.levelingEnabled;

    const updatedSettings = await XPSettings.findOneAndUpdate(
      { guildId: config.guildId },
      updateData,
      {
        new: true, // return updated document
        upsert: true, // create if not exists
        runValidators: true, // enforce schema validation (required, min, enum, etc.)
      },
    );

    if (!updatedSettings) {
      return res
        .status(400)
        .json(apiResponse(false, "Failed to update XP settings"));
    }

    // Remove levelingEnabled from response
    const { levelingEnabled, ...cleanResponse } = updatedSettings.toObject();

    return res
      .status(200)
      .json(
        apiResponse(true, "XP Settings updated successfully", cleanResponse),
      );
  } catch (error) {
    console.error("Update XP Settings Error:", error);

    // Handle validation errors nicely
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }

    return res
      .status(500)
      .json(
        apiResponse(false, "Internal server error while updating settings"),
      );
  }
};

module.exports = { getXPSettings, updateXPSettings };
