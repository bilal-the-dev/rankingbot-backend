const MarketItem = require("../models/MarketItem");
const { apiResponse } = require("../utils/response");
const config = require("../config/config");

// Import resource fetcher (same as used in RoleLevelReward and Quest)
const { fetchGuildResources } = require("../utils/fetchGuildResources");

const getAllMarketItems = async (req, res) => {
  try {
    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const items = await MarketItem.find({
      guildId: config.guildId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    // Fetch additional resources based on query params (?roles=true, ?channels=true, etc.)
    const resources = await fetchGuildResources(req);

    const responseData = {
      items, // main data
      ...resources, // roles, channels, etc. (if requested)
    };

    return res
      .status(200)
      .json(
        apiResponse(true, "Market items fetched successfully", responseData),
      );
  } catch (error) {
    console.error("Get Market Items Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to fetch market items"));
  }
};

// ==================== NEW: Get Single Market Item by ID ====================
const getMarketItemById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      return res.status(400).json(apiResponse(false, "Item ID is required"));
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const item = await MarketItem.findOne({
      _id: id,
      guildId: config.guildId,
    }).lean();

    if (!item) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Market item not found or does not belong to this server",
          ),
        );
    }

    // Fetch resources if requested (?roles=true, ?channels=true)
    const resources = await fetchGuildResources(req);

    const responseData = {
      ...item,
      ...resources,
    };

    return res
      .status(200)
      .json(
        apiResponse(true, "Market item fetched successfully", responseData),
      );
  } catch (error) {
    console.error("Get MarketItem By ID Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to fetch market item"));
  }
};

const createMarketItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      quantity,
      rewardType,
      roleId,
      productKeys,
      isVIPOnly,
    } = req.body;

    if (!name || !description || !price || !rewardType) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "name, description, price, and rewardType are required",
          ),
        );
    }

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }
    if (rewardType === "role" && !roleId) {
      return res
        .status(400)
        .json(
          apiResponse(false, 'roleId is required when rewardType is "role"'),
        );
    }

    // Convert productKeys (accept string or array)
    const keysArray = productKeys
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const newItem = await MarketItem.create({
      guildId: config.guildId,
      name,
      description,
      price: Number(price),
      quantity: quantity !== undefined ? Number(quantity) : -1,
      rewardType,
      roleId: rewardType === "role" ? roleId : null,
      productKeys: keysArray,
      usedKeys: [],
      isVIPOnly: Boolean(isVIPOnly),
      isActive: true,
    });

    return res
      .status(201)
      .json(apiResponse(true, "Market item created successfully", newItem));
  } catch (error) {
    console.error("Create Market Item Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }

    if (error.code === 11000) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "An item with this name already exists in your server",
          ),
        );
    }
    return res
      .status(500)
      .json(apiResponse(false, "Failed to create market item"));
  }
};

const updateMarketItem = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id)
      return res.status(400).json(apiResponse(false, "Item ID is required"));

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const updateData = { ...req.body };
    delete updateData.guildId;

    // Handle productKeys if sent as string
    if (updateData.productKeys) {
      if (typeof updateData.productKeys === "string") {
        updateData.productKeys = updateData.productKeys
          .split(/[\n,]+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
      }
    }

    const updatedItem = await MarketItem.findOneAndUpdate(
      { _id: id, guildId: config.guildId },
      updateData,
      { new: true, runValidators: true },
    );

    if (!updatedItem) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Market item not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Market item updated successfully", updatedItem));
  } catch (error) {
    console.error("Update Market Item Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(apiResponse(false, "Validation failed: " + messages.join(", ")));
    }
    return res
      .status(500)
      .json(apiResponse(false, "Failed to update market item"));
  }
};

const deleteMarketItem = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id)
      return res.status(400).json(apiResponse(false, "Item ID is required"));

    if (!config.guildId) {
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));
    }

    const result = await MarketItem.deleteOne({
      _id: id,
      guildId: config.guildId,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json(
          apiResponse(
            false,
            "Market item not found or does not belong to this server",
          ),
        );
    }

    return res
      .status(200)
      .json(apiResponse(true, "Market item deleted successfully"));
  } catch (error) {
    console.error("Delete Market Item Error:", error);
    return res
      .status(500)
      .json(apiResponse(false, "Failed to delete market item"));
  }
};

module.exports = {
  getAllMarketItems,
  getMarketItemById, // ← New API
  createMarketItem,
  updateMarketItem,
  deleteMarketItem,
};
