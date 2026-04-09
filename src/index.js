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
const cookieParser = require("cookie-parser");

const app = express();

// ====================== MIDDLEWARE ======================
app.use(helmet());

const corsOptions = {
  origin: process.env.ORIGIN_URLS.split(","),
  credentials: true,
};

app.use(cors(corsOptions));

app.options("/{*splat}", cors(corsOptions));
app.use(cookieParser());
// app.use(morgan());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====================== ROUTES ======================
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("✅ Discord Bot + Express Backend is live!");
});

// ====================== ERROR HANDLING ======================
app.use(errorHandler);

initializeBot();

app.listen(config.port, () => {
  logger(`🚀 Server running at http://localhost:${config.port}`);
  logger(`Environment: ${config.nodeEnv}`);
});
