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
      default: -1,
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

    roleId: {
      type: String,
      default: null,
    },

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

// ==================== INDEXES ====================
marketItemSchema.index({ guildId: 1, isActive: 1 });
marketItemSchema.index({ guildId: 1, isVIPOnly: 1 }); // Good for Public/VIP filtering
marketItemSchema.index({ guildId: 1, name: 1 }); // Removed unique: true

module.exports = mongoose.model("MarketItem", marketItemSchema);
