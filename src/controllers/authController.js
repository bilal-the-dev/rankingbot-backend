const config = require("../config/config");
const User = require("../models/User");
const { getClient } = require("../services/botServices");
const { setJWTCookie } = require("../utils/cookie");
const {
  isLoggedIn,
  getDiscordUserFromToken,
  getAccessTokenFromCode,
} = require("../utils/discordOauth");

const { apiResponse } = require("../utils/response");

exports.login = async (req, res) => {
  try {
    const {
      query: { code },
      cookies,
    } = req;

    let data;

    if (!code && !cookies.JWT) {
      return res.status(401).json(apiResponse(false, "You are not logged in"));
    }

    if (!code && cookies.JWT) {
      await isLoggedIn(req);
      return res
        .status(200)
        .json(apiResponse(true, "User fetched successfully", req.discordUser));
    }

    if (code) {
      data = await getAccessTokenFromCode(code);
    }

    const discordUser = await getDiscordUserFromToken(data.access_token);

    const guild = getClient().guilds.cache.get(config.guildId);
    const member = await guild.members.cache.get(discordUser.id);

    if (
      !member ||
      !member.roles.cache.some((r) =>
        process.env.ACCESS_ROLE_IDS.split(",").includes(r.id),
      )
    )
      throw new Error(
        "You dont have the required role to access the dashboard",
      );
    let userDoc = await User.findOne({ userId: discordUser.id });

    if (userDoc) {
      await userDoc.updateOne({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
    } else {
      userDoc = await User.create({
        userId: discordUser.id,
        guildId: config.guildId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
    }

    await setJWTCookie(discordUser, req, res);
  } catch (err) {
    return res
      .status(500)
      .json(apiResponse(false, err.message || "Internal Server Error"));
  }
};

exports.logout = async (req, res) => {
  try {
    res.cookie("JWT", "loggedout", {
      expires: new Date(Date.now() - 1000),
    });

    return res.status(200).json(apiResponse(true, "Logged out successfully"));
  } catch (err) {
    return res
      .status(500)
      .json(apiResponse(false, err.message || "Internal Server Error"));
  }
};

exports.protect = async (req, res, next) => {
  try {
    await isLoggedIn(req);
    next();
  } catch (err) {
    return res
      .status(401)
      .json(apiResponse(false, err.message || "Unauthorized"));
  }
};
