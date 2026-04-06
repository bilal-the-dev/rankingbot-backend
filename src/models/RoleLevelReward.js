const mongoose = require("mongoose");

const roleLevelRewardSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },

    level: {
      type: Number,
      required: true,
      min: 1,
    },

    requiredXP: {
      type: Number,
      required: true,
      min: 0,
    },

    roleId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// ✅ Enforce unique level per guild (WORKS properly now)
roleLevelRewardSchema.index({ guildId: 1, level: 1 }, { unique: true });

// ✅ Fast lookups (optional but useful)
roleLevelRewardSchema.index({ guildId: 1, level: 1 });

module.exports = mongoose.model("RoleLevelReward", roleLevelRewardSchema);
