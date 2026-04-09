const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const eventHandler = require("../handlers/eventHandler");
const logger = require("../utils/logger");
const config = require("../config/config");

const { voiceJoinTimes, awardVoiceXP } = require("../utils/levelingHelpers");
const { checkAndHandleLevelUps } = require("../utils/levelingHelpers"); // Added
const { updateServerAnalytics } = require("../utils/utils"); // Added

const Quest = require("../models/Quest");
const User = require("../models/User");
const Invite = require("../models/Invite");

let clientInstance = null;
let inviteCache = new Map(); // inviteCode → { uses, inviterId }

const initializeBot = () => {
  if (clientInstance) return clientInstance;

  clientInstance = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [
      Partials.Message,
      Partials.Reaction,
      Partials.User,
      Partials.GuildMember,
    ],
  });

  clientInstance.once("ready", async () => {
    console.log(`✅ Logged in as ${clientInstance.user.tag}`);

    const guild = clientInstance.guilds.cache.get(config.guildId);
    if (!guild) return;

    try {
      const invites = await guild.invites.fetch();

      for (const invite of invites.values()) {
        await Invite.findOneAndUpdate(
          { guildId: guild.id, code: invite.code },
          {
            guildId: guild.id,
            code: invite.code,
            uses: invite.uses || 0,
            inviterId: invite.inviter?.id || null,
          },
          { upsert: true, new: true },
        );
      }
      console.log("✅ Invite database initialized");
    } catch (err) {
      console.error("⚠️ Could not fetch initial invites:", err);
    }
  });

  clientInstance.on("error", (error) => {
    logger(`❌ Discord Bot Error: ${error}`);
  });

  // ====================== QUEST PROGRESS & COMPLETION ======================
  const handleQuestProgress = async (userId, questType, amount = 1) => {
    if (!clientInstance || !config.guildId) return;

    const quests = await Quest.find({
      guildId: config.guildId,
      isActive: true,
      "participants.userId": userId,
    });

    for (const quest of quests) {
      const participant = quest.participants.find((p) => p.userId === userId);
      if (!participant || participant.completed || quest.type !== questType)
        continue;

      // === NEW: Check deadline before allowing progress ===
      if (new Date(quest.endDate) < new Date()) {
        // Auto-deactivate expired quest
        if (quest.isActive) {
          quest.isActive = false;
          await quest.save();
        }
        continue; // Skip this quest entirely
      }

      participant.currentProgress += amount;

      if (participant.currentProgress >= quest.targetAmount) {
        participant.completed = true;
        participant.completedAt = new Date();

        // ====================== AWARD XP + LEVELING ======================
        let user = await User.findOne({ guildId: config.guildId, userId });
        if (!user) {
          user = new User({ guildId: config.guildId, userId });
        }

        const oldLevel = user.level;

        const xpToGive = quest.xpReward || 0;
        const coinsToGive = quest.coinReward || 0;

        user.xp += xpToGive;
        if (coinsToGive > 0) {
          user.coins = (user.coins || 0) + coinsToGive;
        }
        user.totalQuestsCompleted = (user.totalQuestsCompleted || 0) + 1;
        user.lastQuestCompletedAt = new Date();

        await user.save();

        if (xpToGive > 0) {
          await updateServerAnalytics(config.guildId, {
            xp: xpToGive,
            coins: coinsToGive,
          });
        }

        await checkAndHandleLevelUps(
          clientInstance,
          {
            author: { id: userId },
            guild: { id: config.guildId },
            channel: { send: async () => {} },
          },
          user,
        );

        // DM completion (unchanged)
        try {
          const dmUser = await clientInstance.users.fetch(userId);
          const dmEmbed = new EmbedBuilder()
            .setTitle("🎉 Quest Completed!")
            .setDescription(
              `You have successfully completed **${quest.name}**!`,
            )
            .addFields({
              name: "Rewards",
              value: `${xpToGive} XP + ${coinsToGive} Coins`,
              inline: true,
            })
            .setColor(0x00ff00)
            .setTimestamp();

          await dmUser.send({ embeds: [dmEmbed] });
        } catch (dmErr) {}

        // Optional: Check if all participants completed → mark quest as fully done
        const allCompleted = quest.participants.every((p) => p.completed);
        if (allCompleted) {
          quest.isCompletedForAll = true;
        }
      }

      await quest.save();
    }
  };

  // ====================== EVENT LISTENERS ======================

  clientInstance.on("messageCreate", async (message) => {
    if (
      message.author.bot ||
      !message.guild ||
      message.guild.id !== config.guildId
    )
      return;

    const userId = message.author.id;

    // message_count
    await handleQuestProgress(userId, "message_count", 1);

    // image_posts - Check both attachments and embeds
    let hasImage = message.attachments.some((att) =>
      att.contentType?.startsWith("image/"),
    );

    // gif_posts - Improved detection for Tenor GIFs
    let hasGif = false;

    // 1. Check real attachments (for manually uploaded .gif files)
    hasGif = message.attachments.some((att) => {
      const url = (att.url || "").toLowerCase();
      const contentType = (att.contentType || "").toLowerCase();

      return (
        contentType.startsWith("image/gif") ||
        url.endsWith(".gif") ||
        url.includes("tenor.com") ||
        url.includes("media.tenor")
      );
    });

    // 2. Check embeds - This is the important part for Tenor GIF picker
    if (!hasGif && message.embeds.length > 0) {
      hasGif = message.embeds.some((embed) => {
        const embedUrl = (embed.url || "").toLowerCase();
        const imageUrl = (embed.image?.url || "").toLowerCase();
        const videoUrl = (embed.video?.url || "").toLowerCase();
        const providerName = (embed.provider?.name || "").toLowerCase();

        return (
          embedUrl.includes("tenor.com") ||
          imageUrl.includes("tenor.com") ||
          videoUrl.includes("tenor.com") ||
          imageUrl.endsWith(".gif") ||
          videoUrl.endsWith(".gif") ||
          providerName.includes("tenor")
        );
      });
    }

    // Count image_posts (normal images + GIFs)
    if (hasImage || hasGif) {
      await handleQuestProgress(userId, "image_posts", 1);
    }

    // Count gif_posts
    if (hasGif) {
      await handleQuestProgress(userId, "gif_posts", 1);
      console.log(`✅ GIF detected for user ${userId}`);
    } else if (message.embeds.length > 0) {
      console.log(
        `Embed detected but not counted as GIF:`,
        message.embeds.map((e) => ({
          url: e.url,
          provider: e.provider?.name,
          hasVideo: !!e.video,
          hasImage: !!e.image,
        })),
      );
    }
  });

  // Voice State Update (Cleaned - removed duplicate listener)
  clientInstance.on("voiceStateUpdate", async (oldState, newState) => {
    if (newState.guild.id !== config.guildId || newState.member?.user.bot)
      return;

    const userId = newState.id;

    // User joined voice
    if (!oldState.channelId && newState.channelId) {
      voiceJoinTimes.set(userId, Date.now());
    }

    // User left voice
    if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceJoinTimes.get(userId);
      if (joinTime) {
        const minutes = Math.floor((Date.now() - joinTime) / 60000);
        if (minutes > 0) {
          // Award Voice XP using your existing function
          await awardVoiceXP(
            newState.client,
            newState.guild.id,
            userId,
            minutes,
          );

          // Also handle quest progress for voice_time if you have such quest type
          await handleQuestProgress(userId, "voice_time", minutes);
        }
        voiceJoinTimes.delete(userId);
      }
    }
    // Channel switch = ignored (treated as continuous session)
  });

  clientInstance.on("messageReactionAdd", async (reaction, user) => {
    if (
      user.bot ||
      !reaction.message.guild ||
      reaction.message.guild.id !== config.guildId
    )
      return;

    // Fetch if partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    const userId = user.id;
    await handleQuestProgress(userId, "reactions", 1);
  });

  clientInstance.on("inviteCreate", async (invite) => {
    if (invite.guild.id !== config.guildId) return;

    try {
      await Invite.findOneAndUpdate(
        { guildId: invite.guild.id, code: invite.code },
        {
          guildId: invite.guild.id,
          code: invite.code,
          uses: invite.uses || 0,
          inviterId: invite.inviter?.id || null,
        },
        { upsert: true, new: true },
      );
      console.log(`✅ New invite created: ${invite.code}`);
    } catch (err) {
      console.error("Error saving new invite:", err);
    }
  });

  clientInstance.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== config.guildId) return;

    console.log(`👤 ${member.user.tag} joined the server`);

    try {
      const guildInvites = await member.guild.invites.fetch();

      for (const invite of guildInvites.values()) {
        // Find this invite in database
        const dbInvite = await Invite.findOne({
          guildId: member.guild.id,
          code: invite.code,
        });

        // If this invite's uses increased → this is the one used
        if (dbInvite && invite.uses > dbInvite.uses) {
          console.log(`✅ Invite used: ${invite.code} by ${member.user.tag}`);

          // Update the uses in database
          dbInvite.uses = invite.uses;
          await dbInvite.save();

          const inviterId = dbInvite.inviterId;

          if (inviterId) {
            await handleQuestProgress(inviterId, "invites", 1);
            console.log(`🎉 +1 invite quest for inviter: ${inviterId}`);
          }

          break; // Stop after finding the used invite
        }
      }
    } catch (err) {
      console.error("Error tracking invite on member join:", err);
    }
  });

  // Attach other event handlers
  eventHandler(clientInstance);

  clientInstance.login(process.env.TOKEN);

  return clientInstance;
};

const getClient = () => clientInstance;

module.exports = { initializeBot, getClient };
