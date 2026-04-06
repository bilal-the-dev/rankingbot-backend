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

module.exports = mongoose.model("RoleLevelReward", roleLevelRewardSchema);
