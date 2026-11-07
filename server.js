
const express = require("express");
const path = require("path");
const session = require("express-session");
const nocache = require("nocache");
const cors = require("cors");
const passport = require("passport");

require("dotenv").config();
require("./config/passport");

const connectDb = require("./db/connectDb");

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");

const app = express();

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(nocache());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).send("Database connection failed");
  }
});

// Routes
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
  const isAdmin = req.originalUrl.startsWith("/admin");

  res.status(404).render(
    isAdmin ? "admin/404" : "user/404",
    {
      title: "Page Not Found"
    }
  );
});

// Export Express app for Vercel
module.exports = app;
