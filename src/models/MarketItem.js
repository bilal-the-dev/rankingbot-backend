const mongoose = require("mongoose");

const marketItemSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 1,
    },

    quantity: {
      type: Number,
      default: -1, // -1 = unlimited
      min: -1,
    },

    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    rewardType: {
      type: String,
      required: true,
      enum: ["role", "digital", "custom"],
    },

    // For rewardType === "role"
    roleId: {
      type: String,
      default: null,
    },

    // For rewardType === "digital" or "custom" → Product Keys System
    productKeys: {
      type: [String],
      default: [],
    },
    usedKeys: {
      type: [String],
      default: [],
    },

    isVIPOnly: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Indexes
marketItemSchema.index({ guildId: 1, isActive: 1 });
marketItemSchema.index({ guildId: 1, rewardType: 1 });

module.exports = mongoose.model("MarketItem", marketItemSchema);
