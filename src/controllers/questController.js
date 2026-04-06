const Quest = require("../models/Quest");
const { apiResponse } = require("../utils/response");
const config = require("../config/config");
const { getClient } = require("../services/botServices");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// Assuming you have this helper (same as in RoleLevelReward)
const { fetchGuildResources } = require("../utils/fetchGuildResources");

const getAllQuests = async (req, res) => {
  try {
    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const quests = await Quest.find({ guildId: config.guildId })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch additional resources (channels, roles, etc.) based on query params
    const resources = await fetchGuildResources(req);

    const responseData = {
      quests, // main data
      ...resources, // channels, roles, users (if ?channels=true, ?roles=true, etc.)
    };

    return res
      .status(200)
      .json(apiResponse(true, "Quests fetched successfully", responseData));
  } catch (error) {
    console.error("Get Quests Error:", error);
    return res.status(500).json(apiResponse(false, "Failed to fetch quests"));
  }
};

// ==================== NEW: Get Single Quest by ID ====================
const getQuestById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json(apiResponse(false, "Quest ID is required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const quest = await Quest.findOne({
      _id: id,
      guildId: config.guildId,
    }).lean();

    if (!quest) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Quest not found or does not belong to this server",
          ),
        );
    }

    // Fetch additional resources (?channels=true, ?roles=true, etc.)
    const resources = await fetchGuildResources(req);

    const responseData = {
      ...quest,
      ...resources,
    };

    return res
      .status(200)
      .json(apiResponse(true, "Quest fetched successfully", responseData));
  } catch (error) {
    console.error("Get Quest By ID Error:", error);
    return res.status(500).json(apiResponse(false, "Failed to fetch quest"));
  }
};

const createQuest = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      targetAmount,
      xpReward,
      coinReward,
      endDate,
      questBoardChannelId,
      createdBy,
    } = req.body;

    if (
      !name ||
      !description ||
      !type ||
      !targetAmount ||
      !xpReward ||
      !coinReward ||
      !endDate ||
      !questBoardChannelId ||
      !createdBy
    ) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "All fields are required: name, description, type, targetAmount, xpReward, coinReward, endDate, questBoardChannelId, createdBy",
          ),
        );
    }

    if (!config.guildId)
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));

    const endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime()) || endDateObj <= new Date()) {
      return res
        .status(400)
        .json(apiResponse(false, "endDate must be a valid future date"));
    }

    const client = getClient();
    if (!client)
      return res
        .status(500)
        .json(apiResponse(false, "Discord bot is not ready"));

    // Create quest document first
    const newQuest = await Quest.create({
      guildId: config.guildId,
      name,
      description,
      type,
      targetAmount,
      xpReward,
      coinReward,
      endDate: endDateObj,
      questBoardChannelId,
      createdBy,
      isActive: true,
    });

    // Send Embed with Join Button to Quest Board Channel
    const channel = await client.channels
      .fetch(questBoardChannelId)
      .catch(() => null);
    if (!channel) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "Invalid questBoardChannelId - channel not found or inaccessible",
          ),
        );
    }

    const embed = new EmbedBuilder()
      .setTitle(`🗡️ New Quest: ${name}`)
      .setDescription(description)
      .setColor(0x00ff88)
      .addFields(
        {
          name: "Type",
          value: type.replace("_", " ").toUpperCase(),
          inline: true,
        },
        { name: "Target", value: targetAmount.toLocaleString(), inline: true },
        { name: "XP Reward", value: xpReward.toLocaleString(), inline: true },
        {
          name: "Coin Reward",
          value: coinReward.toLocaleString(),
          inline: true,
        },
        {
          name: "Ends On",
          value: `<t:${Math.floor(endDateObj.getTime() / 1000)}:R>`,
          inline: false,
        },
      )
      .setTimestamp();

    const joinButton = new ButtonBuilder()
      .setCustomId(`join_quest:${newQuest._id}`)
      .setLabel("Join Quest")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✅");

    const row = new ActionRowBuilder().addComponents(joinButton);

    const sentMessage = await channel.send({
      embeds: [embed],
      components: [row],
    });

    // Save message ID back to quest document
    newQuest.questMessageId = sentMessage.id;
    await newQuest.save();

    return res
      .status(201)
      .json(
        apiResponse(true, "Quest created and posted successfully", newQuest),
      );
  } catch (error) {
    console.error("Create Quest Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }
    return res.status(500).json(apiResponse(false, "Failed to create quest"));
  }
};

const updateQuest = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id)
      return res.status(400).json(apiResponse(false, "Quest ID is required"));

    if (!config.guildId)
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));

    const updateData = { ...req.body };
    delete updateData.guildId;
    delete updateData.questBoardChannelId; // ← Cannot be edited
    delete updateData.questMessageId; // Cannot be edited

    if (updateData.endDate) {
      const endDateObj = new Date(updateData.endDate);
      if (isNaN(endDateObj.getTime()) || endDateObj <= new Date()) {
        return res
          .status(400)
          .json(apiResponse(false, "endDate must be a valid future date"));
      }
      updateData.endDate = endDateObj;
    }

    const updatedQuest = await Quest.findOneAndUpdate(
      { _id: id, guildId: config.guildId },
      updateData,
      { new: true, runValidators: true },
    );

    if (!updatedQuest) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Quest not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Quest updated successfully", updatedQuest));
  } catch (error) {
    console.error("Update Quest Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }
    return res.status(500).json(apiResponse(false, "Failed to update quest"));
  }
};

const deleteQuest = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id)
      return res.status(400).json(apiResponse(false, "Quest ID is required"));

    if (!config.guildId)
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));

    const result = await Quest.deleteOne({ _id: id, guildId: config.guildId });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Quest not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Quest deleted successfully"));
  } catch (error) {
    console.error("Delete Quest Error:", error);
    return res.status(500).json(apiResponse(false, "Failed to delete quest"));
  }
};

module.exports = {
  getAllQuests,
  getQuestById,
  createQuest,
  updateQuest,
  deleteQuest,
};
