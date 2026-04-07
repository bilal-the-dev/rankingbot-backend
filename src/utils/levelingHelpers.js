// utils/levelingHelpers.js
const XPSettings = require("../models/XPSettings");
const RoleLevelReward = require("../models/RoleLevelReward");
const User = require("../models/User");
const cron = require("node-cron");
const { updateServerAnalytics } = require("./utils");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { generateRankCard } = require("./rankCard");

const messageCooldowns = new Map();
const voiceJoinTimes = new Map(); // Shared with voiceStateUpdate

/* ==================== Message XP Logic ==================== */
async function shouldGiveXP(message) {
  const { guild, channel, author } = message;
  const guildId = guild.id;
  const userId = author.id;
  const channelId = channel.id;

  let settings = await XPSettings.findOne({ guildId });
  if (!settings) {
    settings = await XPSettings.create({ guildId });
  }

  if (!settings.levelingEnabled) return { canGiveXP: false };

  // Channel override
  const channelOverride = settings.channelOverrides.find(
    (c) => c.channelId === channelId,
  );
  if (channelOverride && !channelOverride.enabled) {
    return { canGiveXP: false };
  }

  // Blacklisted roles
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    const hasBlacklisted = settings.blacklistedRoleIds.some((roleId) =>
      member.roles.cache.has(roleId),
    );
    if (hasBlacklisted) return { canGiveXP: false };
  }

  // Cooldown
  const cooldownKey = `${guildId}-${userId}`;
  const lastTime = messageCooldowns.get(cooldownKey);
  const now = Date.now();

  if (lastTime && now - lastTime < settings.messageCooldownSeconds * 1000) {
    return { canGiveXP: false };
  }

  messageCooldowns.set(cooldownKey, now);

  return {
    canGiveXP: true,
    xpAmount: settings.xpPerMessage,
    settings,
  };
}

/* ==================== Voice XP Logic (New) ==================== */
async function awardVoiceXP(client, guildId, userId, minutesSpent) {
  if (minutesSpent <= 0) return;

  try {
    let settings = await XPSettings.findOne({ guildId });
    if (!settings || !settings.levelingEnabled) return;

    // Get or create user data
    let user = await User.findOne({ userId, guildId });

    if (!user) {
      user = new User({ userId, guildId });
    }

    const oldLevel = user.level;
    const xpToAward = Math.floor(minutesSpent * settings.xpPerVoiceMinute);

    user.xp += xpToAward;
    user.totalVoiceMinutes += minutesSpent;
    user.lastVoiceActivityEnd = new Date();

    await user.save();

    // Update server analytics
    await updateServerAnalytics(guildId, {
      xp: xpToAward,
      voiceMinutes: minutesSpent,
    });

    console.log(
      `🎤 Voice XP Awarded | +${xpToAward} XP (${minutesSpent} min) | User: ${userId} | Guild: ${guildId}`,
    );

    // Check for level up
    const messageMock = {
      guild: { id: guildId },
      author: { id: userId },
    }; // Minimal mock for level check

    await checkAndHandleLevelUps(client, messageMock, user);
  } catch (error) {
    console.error(`Error awarding voice XP to ${userId}:`, error);
  }
}

/* ==================== Level Up Handler ==================== */
async function checkAndHandleLevelUps(client, messageOrMock, user) {
  const guildId = user.guildId;
  const userId = user.userId;

  const allRewards = await RoleLevelReward.find({ guildId }).sort({
    requiredXP: 1,
  });
  if (allRewards.length === 0) return;

  let leveledUp = false;
  let newLevelsReached = [];

  for (const reward of allRewards) {
    if (user.xp >= reward.requiredXP && user.level < reward.level) {
      user.level = reward.level;
      leveledUp = true;
      newLevelsReached.push(reward);
    }
  }

  if (!leveledUp) return;

  await user.save();

  for (const reward of newLevelsReached) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member.roles.add(reward.roleId);
      }

      const xpSettings = await XPSettings.findOne({ guildId });

      const rankBuffer = await generateRankCard(
        member,
        user,
        xpSettings?.rankCardTheme || "default", // ← Now using the theme from database
      );

      const attachment = new AttachmentBuilder(rankBuffer, {
        name: `rank-${member.user.username}.png`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ffaa)
        .setDescription(`${member} just levelled upto ${reward.level}!`)
        .setImage("attachment://rank.png"); // Make sure this matches the attachment name

      const channel = guild.channels.cache.get(xpSettings.rankCardChannelId);

      if (channel)
        await channel.send({
          embeds: [embed],
          files: [attachment],
        });

      const discordUser = await client.users.fetch(userId).catch(() => null);
      if (discordUser) {
        await discordUser
          .send({
            content:
              `🎉 **Level Up!** Congratulations!\n\n` +
              `You have reached **Level ${reward.level}** (${reward.requiredXP.toLocaleString()} XP)!\n`,
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error(`Error handling level up for ${userId}:`, err);
    }
  }
}

/* ==================== Daily XP Decay (Already Implemented) ==================== */
async function applyDailyXPDecay(client) {
  console.log("🔄 [XP Decay] Starting daily XP decay process...");

  const guilds = await User.distinct("guildId");

  for (const guildId of guilds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const inactivityThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const inactiveUsers = await User.find({
      guildId,
      $or: [
        { lastMessageAt: { $lt: inactivityThreshold } },
        { lastVoiceActivityEnd: { $lt: inactivityThreshold } },
      ],
      xp: { $gt: 0 },
    });

    for (const user of inactiveUsers) {
      const oldLevel = user.level;
      const decayAmount = Math.floor(user.xp * 0.05);
      user.xp = Math.max(0, user.xp - decayAmount);

      const allRewards = await RoleLevelReward.find({ guildId }).sort({
        requiredXP: 1,
      });

      let newLevel = 1;
      for (const reward of allRewards) {
        if (user.xp >= reward.requiredXP) {
          newLevel = reward.level;
        } else {
          break;
        }
      }

      user.level = newLevel;
      await user.save();

      if (newLevel < oldLevel) {
        console.log(
          `📉 [XP Decay] Level Down: ${user.userId} | ${oldLevel} → ${newLevel}`,
        );

        try {
          const member = await guild.members
            .fetch(user.userId)
            .catch(() => null);
          if (member) {
            const lostReward = allRewards.find((r) => r.level === oldLevel);
            if (lostReward) await member.roles.remove(lostReward.roleId);
          }

          const discordUser = await client.users
            .fetch(user.userId)
            .catch(() => null);
          if (discordUser) {
            await discordUser
              .send({
                content: `📉 **Level Down Notice**\n\nDue to inactivity, you dropped from **Level ${oldLevel}** to **Level ${newLevel}**.\nCurrent XP: ${user.xp.toLocaleString()}\n\nBe active again to regain your level!`,
              })
              .catch(() => {});
          }
        } catch (err) {}
      }
    }
  }
  console.log("✅ [XP Decay] Daily process completed.");
}

function startXPDailyDecay(client) {
  cron.schedule("0 0 * * *", () => {
    applyDailyXPDecay(client);
  });
  console.log("⏰ [XP Decay] Cron job scheduled at 00:00");
}

module.exports = {
  shouldGiveXP,
  checkAndHandleLevelUps,
  awardVoiceXP,
  startXPDailyDecay,
  voiceJoinTimes, // Export so voiceStateUpdate can use it
};
