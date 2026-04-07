const { EmbedBuilder } = require("discord.js");
const MarketItem = require("../../models/MarketItem");
const Quest = require("../../models/Quest");
const User = require("../../models/User");

module.exports = async (client, interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith("buy_")) {
    const itemId = interaction.customId.replace("buy_", "");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      // 1. Get the item
      const item = await MarketItem.findById(itemId);
      if (!item || !item.isActive || item.guildId !== guildId) {
        return interaction.editReply({
          content: "❌ This item is no longer available.",
        });
      }

      // 2. VIP Check
      if (item.isVIPOnly) {
        const member = await interaction.guild.members.fetch(userId);
        const hasVIP = member.roles.cache.some(
          (role) =>
            role.name.toLowerCase().includes("vip") ||
            // Add your actual VIP role ID here if you want strict check
            role.id === process.env.VIP_ROLE_ID,
        );

        if (!hasVIP) {
          return interaction.editReply({
            content:
              "❌ This is a VIP-only item. You need the VIP role to purchase it.",
          });
        }
      }

      // 3. Check stock
      const remaining =
        item.quantity === -1 ? Infinity : item.quantity - item.soldCount;
      if (remaining <= 0) {
        return interaction.editReply({
          content: "❌ This item is out of stock.",
        });
      }

      // 4. Get user balance (assuming you have User model, otherwise use UserData)
      let userData = await User.findOne({ guildId, userId }); // Using UserData model we already have
      if (!userData) userData = new User({ guildId, userId, coins: 0 });

      if (userData.coins < item.price) {
        return interaction.editReply({
          content: `❌ You need **${item.price.toLocaleString()}** coins to buy this.\nYou currently have **${userData.coins.toLocaleString()}** coins.`,
        });
      }

      // 5. Deduct coins
      userData.coins -= item.price;

      let rewardMessage = "";

      // 6. Process reward
      if (item.rewardType === "role" && item.roleId) {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(item.roleId);
        rewardMessage = `You received the role <@&${item.roleId}>!`;
      } else if (
        (item.rewardType === "digital" || item.rewardType === "custom") &&
        item.productKeys.length > 0
      ) {
        // Find an unused key
        const availableKey = item.productKeys.find(
          (key) => !item.usedKeys.includes(key),
        );

        if (!availableKey) {
          return interaction.editReply({
            content: "❌ No product keys available for this item.",
          });
        }

        // Mark key as used
        item.usedKeys.push(availableKey);

        // DM the product key
        try {
          await interaction.user.send({
            content:
              `✅ **Purchase Successful!**\n\n` +
              `**Item:** ${item.name}\n` +
              `**Your Code/Key:** \`${availableKey}\`\n\n` +
              `This is a one-time use code. Please save it safely!`,
          });
          rewardMessage = "The product key has been sent to your DMs!";
        } catch (dmErr) {
          rewardMessage =
            "❌ Could not send DM. Please enable DMs and try again.";
          // Optionally refund coins here if DM fails (rare)
        }
      }

      // 7. Update sold count and save
      item.soldCount += 1;
      await item.save();
      await userData.save();

      // 8. Success message
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle("✅ Purchase Successful!")
        .setDescription(
          `You bought **${item.name}** for ${item.price.toLocaleString()} coins.`,
        )
        .addFields({
          name: "Reward",
          value: rewardMessage || "Reward processed successfully.",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Buy error:", error);
    }
  }

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("join_quest:")
  ) {
    try {
      const questId = interaction.customId.split(":")[1];
      const userId = interaction.user.id;

      const quest = await Quest.findById(questId);
      if (!quest || !quest.isActive) {
        return interaction.reply({
          content: "This quest is no longer active.",
          ephemeral: true,
        });
      }

      // Check if already participating
      const alreadyJoined = quest.participants.some((p) => p.userId === userId);
      if (alreadyJoined) {
        return interaction.reply({
          content: "You have already joined this quest!",
          ephemeral: true,
        });
      }

      // Add user to participants
      quest.participants.push({
        userId,
        acceptedAt: new Date(),
        currentProgress: 0,
        completed: false,
      });

      await quest.save();

      await interaction.reply({
        content: `✅ You have successfully joined the quest: **${quest.name}**!`,
        ephemeral: true,
      });

      // DM the user
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle("🎯 Quest Joined!")
          .setDescription(`You are now participating in **${quest.name}**`)
          .addFields(
            { name: "Description", value: quest.description },
            {
              name: "Target",
              value: `${quest.targetAmount} ${quest.type.replace("_", " ")}`,
              inline: true,
            },
            {
              name: "Rewards",
              value: `${quest.xpReward} XP + ${quest.coinReward} Coins`,
              inline: true,
            },
            {
              name: "Deadline",
              value: `<t:${Math.floor(new Date(quest.endDate).getTime() / 1000)}:R>`,
              inline: false,
            },
          )
          .setColor(0x00ff88)
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`Could not DM user ${userId} (DMs disabled)`);
      }
    } catch (error) {
      console.error("Quest Join Button Error:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: "Something went wrong while joining the quest.",
          ephemeral: true,
        });
      }
    }
  }
};
