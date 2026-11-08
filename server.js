
const express = require("express");
const path = require("path");
const session = require("express-session");
const nocache = require("nocache");
const cors = require("cors");
const passport = require("passport");
const MongoStoreModule = require("connect-mongo");
const MongoStore = MongoStoreModule.default || MongoStoreModule;

require("dotenv").config();
require("./config/passport");

const connectDb = require("./db/connectDb");

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");

const app = express();

app.set("trust proxy", 1);

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

// Connect MongoDB before Passport and sessions
app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).send("Database connection failed");
  }
});

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 86400
    }),
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

// Routes
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);


app.get("/", (req, res) => {
  res.redirect("/user");
});

// 404 handler
app.use((req, res) => {
  const isAdmin = req.originalUrl.startsWith("/admin");

  res.status(404).render(
    isAdmin ? "admin/404" : "user/404",
    { title: "Page Not Found" }
  );
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
