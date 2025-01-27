const bcrypt = require("bcrypt");
const saltRound = 10;
const sendOtpToEmail = require("../config/otpVerification");
const OTP = require("../model/verification");
const otpGenerator = require("otp-generator");
const userSchema = require("../model/userModel");
const addressSchema = require("../model/addressModel");
const Order = require("../model/orderModel");
const Wallet = require("../model/walletModel");

// Helper function to generate OTP
function generateOTP() {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
}

// Helper function to validate email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// signup page loader
const loadRegister = async (req, res) => {
  res.render("user/signup", { error: "", message: "" });
};

// signup page
const registerUser = async (req, res) => {
  try {
    const { name, email, password, cpassword, referrals } = req.body;

    if (!name || !email || !password || !cpassword) {
      return res.render("user/signup", {
        error: "All fields are required",
        message: null,
      });
    }

    if (!isValidEmail(email)) {
      return res.render("user/signup", {
        error: "Please enter a valid Email",
        message: "Please enter a valid Email",
      });
    }

    if (password !== cpassword) {
      return res.render("user/signup", {
        error: "Passwords do not match",
        message: null,
      });
    }

    const existingUser = await userSchema.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", {
        error: "User already exists",
        message: null,
      });
    }

    req.session.tempUser = { name, email, password, referrals };
    const otp = generateOTP();
    await OTP.create({ email, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendOtpToEmail(email, otp);
    console.log(otp);

    req.session.otp = otp;
    req.session.otpExpires = Date.now() + 5 * 60 * 1000;

    res.render("user/verification", { email });
  } catch (error) {
    console.error("Error during signup:", error);
    res.render("user/signup", {
      error: "Something went wrong. Please try again later.",
      message: null,
    });
  }
};

// verify otp
const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.otp || Date.now() > req.session.otpExpires) {
      return res.render("user/verification", {
        error: "",
        message: "OTP expired, please request again.",
        email: req.session.tempUser.email,
      });
    }

    if (otp !== req.session.otp) {
      return res.render("user/verification", {
        error: "",
        message: "Invalid OTP. Try again.",
        email: req.session.tempUser.email,
      });
    }

    const { name, email, password, referrals } = req.session.tempUser;

    if (referrals) {
      //check referrals is valid
      var referrer = await userSchema.findOne({ referralCode: referrals });
      if (!referrer) {
        return res.render("user/verification", {
          error: "",
          message: "Invalid referral code. Try again.",
          email: req.session.tempUser.email,
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRound);

    // Generate unique referral code
    const referralCode = await userSchema.generateReferralCode();

    const googleId = email;
    const newUser = new userSchema({
      name,
      email,
      password: hashedPassword,
      referralCode,
      googleId: googleId || null,
    });

    await newUser.save();

    if (referrals) {
      // Add ₹100 to referrer's wallet
      let referrerWallet = await Wallet.findOne({ userId: referrer._id });
      if (!referrerWallet) {
        referrerWallet = new Wallet({ userId: referrer._id, balance: 100 });
      } else {
        referrerWallet.balance += 100;
      }
      await referrerWallet.save();

      // Add ₹100 to new user's wallet
      const newUserWallet = new Wallet({ userId: newUser._id, balance: 100 });
      await newUserWallet.save();
    }
    await OTP.deleteOne({ email });
    delete req.session.tempUser;
    delete req.session.otp;
    delete req.session.otpExpires;

    req.session.user = { id: newUser._id, email: newUser.email };

    res.redirect("/user/home");
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.render("user/verification", {
      error: "",
      message: "Something went wrong",
      email: req.session.tempUser.email,
    });
  }
};

// verification page loader
const loadVerification = async (req, res) => {
  try {
    const email = req.session.tempUser ? req.session.tempUser.email : null;
    console.log("load veryfy");
    res.render("user/verification", { email });
    console.log("load verication page");
  } catch (error) {
    console.error("Error during verification:", error);
    res.render("user/verification", { error: "", message: "" });
  }
};

// resend otp
const resendOtp = async (req, res) => {
  const { email } = req.body; // Ensure the email field arrives
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });

  try {
    // Check if an unexpired OTP already exists for this email
    const existingOTP = await OTP.findOne({
      email,
      expiresAt: { $gt: Date.now() },
    });
    if (existingOTP) {
      return res.status(400).json({
        success: false,
        message: "Wait until current OTP expires before requesting a new one.",
      });
    }

    // Generate a new OTP
    const otp = generateOTP();

    const otpPayload = {
      email,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    await OTP.create(otpPayload);

    // Send OTP via email
    await sendOtpToEmail(email, otp);

    // Store OTP and its expiry in the session
    req.session.otp = otp;
    req.session.otpExpires = otpPayload.expiresAt;

    console.log(`Resent OTP: ${otp} to ${email}`);

    res
      .status(200)
      .json({ success: true, message: "OTP sent successfully!", email });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
};

// login page loader
const loadLogin = async (req, res) => {
  res.render("user/login", { error: "", message: "" });
};

// Google Login Handler
const googleLogin = async (req, res) => {
  if (req.isAuthenticated()) {
    // Check if the user is blocked
    if (req.user.isBlocked) {
      return res.render("user/login", {
        error: "Your account is blocked",
        message: null,
      });
    }
    // Save user to session
    req.session.user = { id: req.user._id, email: req.user.email };
    console.log(req.session.user);
    return res.redirect("/user/home");
  }
  return res.redirect("/user/login?error=Authentication failed");
};

// Login Handler
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.render("user/login", {
        error: "Both email and password are required",
        message: null,
      });
    }

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res.render("user/login", {
        error: "User not found",
        message: null,
      });
    }

    if (user.isBlocked) {
      return res.render("user/login", {
        error: "Your account is blocked",
        message: null,
      });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("user/login", {
        error: "Invalid password",
        message: null,
      });
    }

    // Save user session
    req.session.user = { id: user._id, email: user.email };
    return res.redirect("/user/home"); // Redirect to home page after successful login
  } catch (error) {
    console.error(error);
    return res.render("user/login", {
      error: "An error occurred. Please try again.",
      message: null,
    });
  }
};

// load reset page
const loadReset = async (req, res) => {
  res.render("user/forgotPassword", { error: "", message: "" });
};

//reset password with otp
const resetPassword = async (req, res) => {
  try {
    const { email, password, cpassword } = req.body;

    console.log("email", email, "pass", password, "cpass", cpassword);

    if (!email || !password || !cpassword) {
      return res.render("user/forgotPassword", {
        error: "All fields are required",
        message: null,
      });
    }
    console.log("7");

    if (!isValidEmail(email)) {
      return res.render("user/forgotPassword", {
        error: "Please enter a valid Email",
        message: "Please enter a valid Email",
      });
    }
    console.log("6");
    if (password !== cpassword) {
      return res.render("user/forgotPassword", {
        error: "Passwords do not match",
        message: null,
      });
    }
    console.log("4");
    const existingUser = await userSchema.findOne({ email });
    if (!existingUser) {
      return res.render("user/forgotPassword", {
        error: "User already exists",
        message: null,
      });
    }
    console.log("3");
    req.session.tempUser = { email, password };
    const otp = generateOTP();
    await OTP.create({ email, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendOtpToEmail(email, otp);
    console.log(otp);
    console.log("2");
    req.session.otp = otp;
    req.session.otpExpires = Date.now() + 5 * 60 * 1000;
    console.log("1");
    res.render("user/forgotOtp", { email });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.render("user/forgotPassword", {
      error: "",
      message:
        "An error occurred while resetting the password. Please try again.",
    });
  }
};

//load otp verification
const loadOtpVerification = async (req, res) => {
  try {
    const email = req.session.tempUser ? req.session.tempUser.email : null;
    res.render("user/forgotOtp", { email });
  } catch (error) {
    console.error("Error during verification:", error);
    res.render("user/forgotOtp", { error: "", message: "" });
  }
};

//verify forgot password
const verifyForgotPassword = async (req, res) => {
  try {
    const { otp } = req.body;

    // Check if OTP exists and is not expired
    if (!req.session.otp || Date.now() > req.session.otpExpires) {
      return res.render("user/forgotOtp", {
        error: "",
        message: "OTP expired, please request again.",
        email: req.session.tempUser.email,
      });
    }

    // Validate the OTP
    if (otp !== req.session.otp) {
      return res.render("user/forgotOtp", {
        error: "",
        message: "Invalid OTP. Try again.",
        email: req.session.tempUser.email,
      });
    }

    // Retrieve the temporary user details
    const { email, password } = req.session.tempUser;

    // Hash the new password
    const saltRounds = 10; // Define the number of salt rounds for bcrypt
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the password in the database
    const user = await userSchema.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.render("user/forgotOtp", {
        error: "",
        message: "User not found.",
        email: req.session.tempUser.email,
      });
    }

    // Cleanup OTP and session data
    await OTP.deleteOne({ email });
    delete req.session.tempUser;
    delete req.session.otp;
    delete req.session.otpExpires;

    // Set user session
    req.session.user = { id: user._id, email: user.email };

    // Redirect to home page
    res.redirect("/user/home");
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.render("user/forgotOtp", {
      error: "",
      message: "Something went wrong. Please try again.",
      email: req.session.tempUser?.email || "",
    });
  }
};

//profile page
const loadProfile = async (req, res) => {
  try {
    // Get user session details
    const { email } = req.session.user;
    const user = await userSchema.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch the user's address document
    const addressDocument = await addressSchema.findOne({ userId: user._id });

    const addresses = addressDocument ? addressDocument.addresses : [];

    const firstAddress = addresses.length > 0 ? addresses[0] : [];

    //order details
    const orders = await Order.find({ user: user._id })
      .populate("products.productId", "product images")
      .sort({ createdAt: -1 });

    // Pass user and addresses to the EJS template
    res.render("user/profile", {
      user,
      addresses,
      orders,
      firstAddress,
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.render("user/home", { message: "Server error" });
  }
};

//edit profile
const editProfile = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res
        .status(401)
        .render("user/profile", { message: "Unauthorized" });
    }

    // Validate password confirmation if provided
    if (password && password !== confirmPassword) {
      return res
        .status(400)
        .render("user/profile", { message: "Passwords do not match" });
    }

    // Create an object to store updated fields
    const updateFields = { name, email };

    // If a new password is provided, hash it and add to the update object
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.password = hashedPassword;
    }

    // Update the user's details in the database
    const updatedUser = await userSchema.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send("User not found or unauthorized");
    }

    // Redirect to the profile page with a success message
    res.redirect("/user/profile?success=true");
  } catch (error) {
    console.error("Error updating profile:", error);
    res.redirect("/user/profile?error=true");
  }
};

//add address
const addAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.render("user/profile", { message: "Unauthorized" });
    }

    // Find the user's address document or create a new one if it doesn't exist
    let userAddress = await addressSchema.findOne({ userId });

    if (!userAddress) {
      userAddress = new addressSchema({
        userId,
        addresses: [],
      });
    }

    // Append the new address
    userAddress.addresses.push({
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    });

    // Save the document
    await userAddress.save();

    res.redirect("/user/profile?section=addressBook");
  } catch (error) {
    console.error("Error adding address:", error);
    res.redirect("/user/profile?section=addressBook&error=true");
  }
};

//edit address
const editAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.render("user/profile", { message: "Unauthorized" });
    }

    const {
      name,
      address,
      locality,
      city,
      state,
      pincode,
      phone,
      alternatePhone,
      landmark,
    } = req.body;

    // Use MongoDB's `$set` operator to update the specific address in the array
    const updatedUser = await addressSchema.findOneAndUpdate(
      { userId, "addresses._id": addressId },
      {
        $set: {
          "addresses.$.name": name,
          "addresses.$.address": address,
          "addresses.$.locality": locality,
          "addresses.$.city": city,
          "addresses.$.state": state,
          "addresses.$.pincode": pincode,
          "addresses.$.phone": phone,
          "addresses.$.alternatePhone": alternatePhone,
          "addresses.$.landmark": landmark,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send("Address not found or user unauthorized");
    }

    res.redirect("/user/profile?section=addressBook");
  } catch (error) {
    console.error("Error updating address:", error);
    res.redirect("/user/profile?section=addressBook&error=true");
  }
};

//delete address
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.user?.id;

    // Check if the user is authenticated
    if (!userId) {
      return res.render("user/profile", { message: "Unauthorized" });
    }

    //remove the address from the addresses array
    const updatedUser = await addressSchema.findOneAndUpdate(
      { userId },
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send("Address not found or user unauthorized");
    }

    res.redirect("/user/profile?section=addressBook");
  } catch (error) {
    console.error("Error deleting address:", error);
    res.redirect("/user/profile?section=addressBook&error=true");
  }
};

// session distroy page
const logout = async (req, res) => {
  req.session.user = null;
  res.redirect("/user/login");
};

//checking
const checking = async (req, res) => {
  res.render("user/404");
};

module.exports = {
  loadRegister,
  registerUser,
  loadVerification,
  verifyOTP,
  loadLogin,
  loginUser,
  loadReset,
  resetPassword,
  loadOtpVerification,
  verifyForgotPassword,
  logout,
  resendOtp,
  googleLogin,
  loadProfile,
  addAddress,
  editAddress,
  deleteAddress,
  editProfile,

  checking,
};
