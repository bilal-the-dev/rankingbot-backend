const express = require("express");
const router = express.Router();

const health = require("../controllers/health");
const getOverview = require("../controllers/overview");
const {
  getXPSettings,
  updateXPSettings,
} = require("../controllers/xpSettings");
const {
  resetAllUsers,
  resetSpecificUser,
} = require("../controllers/resetController");
const {
  getAllRoleLevelRewards,
  createRoleLevelReward,
  updateRoleLevelReward,
  deleteRoleLevelReward,
  getRoleLevelRewardById,
} = require("../controllers/roleLevelReward");
const {
  getAllQuests,
  createQuest,
  updateQuest,
  deleteQuest,
  getQuestById,
} = require("../controllers/questController"); // ← Added

const {
  getAllMarketItems,
  createMarketItem,
  updateMarketItem,
  deleteMarketItem,
  getMarketItemById,
} = require("../controllers/marketController");
const { login, logout, protect } = require("../controllers/authController");
const { getMe } = require("../controllers/userController");

router.post("/login", login);
router.post("/logout", logout);

router.get("/user/me", getMe);

router.use(protect);
router.get("/health", health);
router.get("/overview", getOverview);

// XP Settings
router.get("/xp-settings", getXPSettings);
router.put("/xp-settings", updateXPSettings);

// Reset
router.post("/reset-all-users", resetAllUsers);
router.post("/reset-user", resetSpecificUser);

// Role Level Rewards
router.get("/role-level-rewards", getAllRoleLevelRewards);
router.get("/role-level-rewards/:id", getRoleLevelRewardById);
router.post("/role-level-rewards", createRoleLevelReward);
router.put("/role-level-rewards/:id", updateRoleLevelReward);
router.delete("/role-level-rewards/:id", deleteRoleLevelReward);

// Quests CRUD
router.get("/quests", getAllQuests); // GET all quests
router.get("/quests/:id", getQuestById);
router.post("/quests", createQuest); // CREATE quest
router.put("/quests/:id", updateQuest); // UPDATE quest
router.delete("/quests/:id", deleteQuest); // DELETE quest

router.get("/market-items", getAllMarketItems);
router.get("/market-items/:id", getMarketItemById);
router.post("/market-items", createMarketItem);
router.put("/market-items/:id", updateMarketItem);
router.delete("/market-items/:id", deleteMarketItem);

module.exports = router;
