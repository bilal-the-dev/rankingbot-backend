require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/config");
const routes = require("./routes/index");
const errorHandler = require("./middleware/errorHandler");
const { initializeBot } = require("./services/botServices");
const logger = require("./utils/logger");

const app = express();

// ====================== MIDDLEWARE ======================
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173", // your frontend URL
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====================== ROUTES ======================
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("✅ Discord Bot + Express Backend is live!");
});

// ====================== ERROR HANDLING ======================
app.use(errorHandler);

// ====================== START SERVER + BOT ======================
const start = async () => {
  try {
    // 1. Start Discord Bot
    initializeBot();

    // 2. Start Express Server
    app.listen(config.port, () => {
      logger(`🚀 Server running at http://localhost:${config.port}`);
      logger(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger(`❌ Failed to start: ${error.message}`);
  }
};

start();
