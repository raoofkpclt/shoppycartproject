const passport = require('passport');
const User = require('../model/userModel');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
require('dotenv').config();

// Use GoogleStrategy for OAuth authentication
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://shopycartonline.shop/user/auth/google/callback", 
    passReqToCallback: true,
    scope: ['profile', 'email'],  // Ensure scope is set
  },
  async (request, accessToken, refreshToken, profile, done) => {
    try {
      // Use async/await to handle the result of findOne()
      const existingUser = await User.findOne({ googleId: profile.id });

      if (existingUser) {
        return done(null, existingUser);  // User found, return the user
      } else {
        // Create a new user if not found
        const newUser = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
        });

        await newUser.save();  // Use await for saving the new user
        return done(null, newUser);  // New user created, return the user
      }
    } catch (err) {
      return done(err);  // Handle any errors
    }
  }
));


// Serialize user by Google ID
passport.serializeUser((user, done) => {
  done(null, user.googleId);  // Store only Google ID
});

// Deserialize user by Google ID
passport.deserializeUser(async (id, done) => {
    try {
        // Find user by googleId, not _id
        const user = await User.findOne({ googleId: id });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

