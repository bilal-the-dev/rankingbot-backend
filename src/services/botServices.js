const { Client, GatewayIntentBits, IntentsBitField } = require("discord.js");
const logger = require("../utils/logger");
const config = require("../config/config");
const { voiceJoinTimes, awardVoiceXP } = require("../utils/levelingHelpers");

const eventHandler = require("../handlers/eventHandler");
let clientInstance = null;

const initializeBot = () => {
  if (clientInstance) return clientInstance;

  clientInstance = new Client({
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildVoiceStates, // <<< REQUIRED for voiceStateUpdate
      IntentsBitField.Flags.GuildMembers, // optional, for member info
      IntentsBitField.Flags.GuildMessages, // only if needed for messages
      IntentsBitField.Flags.MessageContent, // only if reading message content
    ],
    partials: ["CHANNEL", "GUILD_MEMBER", "USER"],
  });

  clientInstance.once("ready", () => {
    logger(`✅ Discord Bot logged in as ${clientInstance.user.tag}`);
  });

  clientInstance.on("error", (error) => {
    logger(`❌ Discord Bot Error: ${error}`);
  });

  clientInstance.on("voiceStateUpdate", async (oldState, newState) => {
    const guildId = newState.guild.id;
    const userId = newState.id;

    if (newState.member?.user.bot) return;

    try {
      // User JOINED voice channel
      if (!oldState.channel && newState.channel) {
        const joinKey = `${guildId}-${userId}`;
        voiceJoinTimes.set(joinKey, Date.now());
        console.log(`🎤 ${newState.member.user.tag} joined VC`);
      }

      // User LEFT or switched channels
      else if (
        oldState.channel &&
        (!newState.channel || oldState.channel.id !== newState.channel.id)
      ) {
        const joinKey = `${guildId}-${userId}`;
        const joinTime = voiceJoinTimes.get(joinKey);

        if (joinTime) {
          const timeSpentMs = Date.now() - joinTime;
          const timeSpentMinutes = Math.floor(timeSpentMs / 1000 / 60);

          if (timeSpentMinutes > 0) {
            // Award Voice XP + Update user stats + Check level up
            await awardVoiceXP(
              newState.client,
              guildId,
              userId,
              timeSpentMinutes,
            );

            console.log(
              `⏱️ ${newState.member.user.tag} spent ${timeSpentMinutes} min in VC | Guild: ${guildId}`,
            );
          }

          voiceJoinTimes.delete(joinKey);
        }
      }
    } catch (error) {
      console.error("Error in voiceStateUpdate:", error);
    }
  });

  eventHandler(clientInstance);

  clientInstance.login(process.env.TOKEN);

  return clientInstance;
};

const getClient = () => clientInstance;

module.exports = { initializeBot, getClient };
