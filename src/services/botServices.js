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
    logger(`✅ Discord Bot logged in as ${clientInstance.user.tag}`);

    const guild = clientInstance.guilds.cache.get(config.guildId);

    await guild.members.fetch();

    // Initialize invite cache for invite tracking
    if (config.guildId) {
      const guild = clientInstance.guilds.cache.get(config.guildId);
      if (guild) {
        try {
          const invites = await guild.invites.fetch();
          inviteCache.clear();
          invites.forEach((invite) => {
            if (invite.code && invite.inviter) {
              inviteCache.set(invite.code, {
                uses: invite.uses || 0,
                inviterId: invite.inviter.id,
              });
            }
          });
          logger("✅ Invite cache initialized");
        } catch (e) {
          logger("⚠️ Could not fetch initial invites");
        }
      }
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

    // image_posts
    const hasImage = message.attachments.some((att) =>
      att.contentType?.startsWith("image/"),
    );
    if (hasImage) await handleQuestProgress(userId, "image_posts", 1);

    // gif_posts
    const hasGif = message.attachments.some(
      (att) =>
        att.contentType?.startsWith("image/gif") ||
        att.url.toLowerCase().endsWith(".gif"),
    );
    if (hasGif) await handleQuestProgress(userId, "gif_posts", 1);
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

  clientInstance.on("inviteCreate", (invite) => {
    if (invite.guild.id !== config.guildId || !invite.inviter) return;
    inviteCache.set(invite.code, {
      uses: invite.uses || 0,
      inviterId: invite.inviter.id,
    });
  });

  clientInstance.on("guildMemberAdd", async (member) => {
    if (member.guild.id !== config.guildId) return;

    try {
      const newInvites = await member.guild.invites.fetch();
      let inviterId = null;

      newInvites.forEach((invite) => {
        const oldData = inviteCache.get(invite.code);
        if (oldData && invite.uses > oldData.uses) {
          inviterId = oldData.inviterId;
        }
      });

      // Update cache with latest data
      newInvites.forEach((invite) => {
        inviteCache.set(invite.code, {
          uses: invite.uses || 0,
          inviterId: invite.inviter ? invite.inviter.id : null,
        });
      });

      if (inviterId) {
        await handleQuestProgress(inviterId, "invites", 1);
        logger(`✅ Invite tracked for user ${inviterId} (+1 invite)`);
      }
    } catch (e) {
      // Silent fail if invites fetch fails
    }
  });

  // Attach other event handlers
  eventHandler(clientInstance);

  clientInstance.login(process.env.TOKEN);

  return clientInstance;
};

const getClient = () => clientInstance;

module.exports = { initializeBot, getClient };
