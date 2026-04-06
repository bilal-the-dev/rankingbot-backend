const ServerAnalytics = require("../models/ServerAnalytics");
const User = require("../models/User");
const { apiResponse } = require("../utils/response");
const { getClient } = require("../services/botServices");
const config = require("../config/config");

const getOverview = async (req, res) => {
  try {
    const guildId = config.guildId;
    if (!config.guildId)
      return res
        .status(500)
        .json(apiResponse(false, "GUILD_ID is not configured in .env"));

    const now = new Date();

    // Today and yesterday
    const todayStr = now.toISOString().split("T")[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

    // Last 7 days for trends
    const trendDates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      trendDates.push(d.toISOString().split("T")[0]);
    }

    // ====================== SERVER ANALYTICS ======================
    const analyticsDocs = await ServerAnalytics.find({
      guildId,
      date: { $in: [todayStr, yesterdayStr, ...trendDates] },
    }).lean();

    const analyticsMap = {};
    analyticsDocs.forEach((doc) => {
      analyticsMap[doc.date] = doc;
    });

    const todayDoc = analyticsMap[todayStr] || {
      totalMessages: 0,
      totalXPGained: 0,
      totalVoiceMinutes: 0,
      totalCoinsDistributed: 0,
    };

    const yesterdayDoc = analyticsMap[yesterdayStr] || {
      totalMessages: 0,
      totalXPGained: 0,
      totalVoiceMinutes: 0,
      totalCoinsDistributed: 0,
    };

    // Helper: return both % and absolute change
    const calculateChange = (todayVal, yesterdayVal) => {
      const absolute = todayVal - yesterdayVal;
      let percent = 0;
      if (yesterdayVal === 0) {
        percent = todayVal > 0 ? 100 : 0;
      } else {
        percent = Math.round((absolute / yesterdayVal) * 100);
      }
      return { percent, absolute };
    };

    const todayData = {
      messages: {
        count: todayDoc.totalMessages,
        change: calculateChange(
          todayDoc.totalMessages,
          yesterdayDoc.totalMessages,
        ),
      },
      xpGained: {
        count: todayDoc.totalXPGained,
        change: calculateChange(
          todayDoc.totalXPGained,
          yesterdayDoc.totalXPGained,
        ),
      },
      voiceMinutes: {
        count: todayDoc.totalVoiceMinutes,
        change: calculateChange(
          todayDoc.totalVoiceMinutes,
          yesterdayDoc.totalVoiceMinutes,
        ),
      },
      coinsDistributed: {
        count: todayDoc.totalCoinsDistributed,
        change: calculateChange(
          todayDoc.totalCoinsDistributed,
          yesterdayDoc.totalCoinsDistributed,
        ),
      },
    };

    const messageTrend = trendDates.map((date) => ({
      date,
      count: analyticsMap[date] ? analyticsMap[date].totalMessages : 0,
    }));

    const xpTrend = trendDates.map((date) => ({
      date,
      count: analyticsMap[date] ? analyticsMap[date].totalXPGained : 0,
    }));

    // ====================== LEADERBOARD (Top 20) ======================
    const topUsersDocs = await User.find({ guildId })
      .sort({ xp: -1 }) // ← Top by XP (most common)
      .limit(20)
      .lean();

    const client = getClient();

    const leaderboard = await Promise.all(
      topUsersDocs.map(async (userDoc) => {
        let username = "Unknown User";
        let avatar = "https://cdn.discordapp.com/embed/avatars/0.png";

        if (client) {
          try {
            const discordUser = await client.users.fetch(userDoc.userId);
            username = discordUser.tag || discordUser.username;
            avatar = discordUser.displayAvatarURL({
              size: 128,
              extension: "png",
            });
          } catch (err) {
            // User not cached / not found → keep default
          }
        }

        return {
          userId: userDoc.userId,
          username,
          avatar,
          messages: userDoc.totalMessagesSent,
          xp: userDoc.xp,
          coins: userDoc.coins,
          lastMessageAt: userDoc.lastMessageAt
            ? userDoc.lastMessageAt.toISOString()
            : null,
          lastVoiceActivityEnd: userDoc.lastVoiceActivityEnd
            ? userDoc.lastVoiceActivityEnd.toISOString()
            : null,
        };
      }),
    );

    // ====================== FINAL RESPONSE ======================
    const overviewData = {
      today: todayData,
      messageTrend,
      xpTrend,
      leaderboard, // ← NEW
    };

    return res
      .status(200)
      .json(
        apiResponse(true, "Overview data fetched successfully", overviewData),
      );
  } catch (error) {
    console.error("Overview API Error:", error);
    return res
      .status(500)
      .json(
        apiResponse(false, "Internal server error while fetching overview"),
      );
  }
};

module.exports = getOverview;
