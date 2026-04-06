const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },

    userId: {
      type: String,
      required: true,
    },

    // Core Leveling & Economy
    xp: {
      type: Number,
      default: 0,
      min: 0,
      max: 1_000_000_000,
    },

    level: {
      type: Number,
      default: 1,
      min: 1,
    },

    coins: {
      type: Number,
      default: 0,
      min: 0,
      max: 1_000_000_000,
    },

    // Lifetime Stats
    totalMessagesSent: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalVoiceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Activity tracking
    lastMessageAt: {
      type: Date,
    },

    lastVoiceActivityEnd: {
      type: Date,
    },

    // Customization
    rankCardTheme: {
      type: String,
      default: "default",
    },
  },
  {
    timestamps: true,
  },
);

// ✅ Only index you need
userDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("UserData", userDataSchema);
