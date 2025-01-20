const express = require("express");
const app = express();

const path = require("path");

const session = require("express-session");
const nocache = require("nocache");

require("dotenv").config();
const passport = require("passport");
require("./config/passport");

const connectDb = require("./db/connectDb");
const cors = require("cors");

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");

//session use
app.use(nocache());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

//view engine configaration
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

//static file configaration
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());



//conect db
connectDb();

//cors
app.use(cors());

//use passport
app.use(passport.initialize());
app.use(passport.session());

//router middleware
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);


app.use('/user', (req, res, next) => {
  if (!req.route) {
    return res.status(404).render('user/404', { title: 'Page Not Found' });
  }
  next();
});

// Catch-all route for undefined admin routes
app.use('/admin', (req, res, next) => {
  if (!req.route) {
    return res.status(404).render('admin/404', { title: 'Admin Page Not Found' });
  }
  next();
});

  // General 404 fallback for other unexpected routes
  app.use((req, res) => {
    res.status(404).render('user/404', { title: 'Page Not Found' });
  });
  

//server port configaration 3002
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Your server running ${PORT} succesfully`);
});
