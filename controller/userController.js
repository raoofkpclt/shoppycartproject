const userSchema=require('../model/userModel');
const bcrypt = require('bcrypt');
const saltRound = 10;
const sendOtpToEmail=require('../config/otpVerification');
const OTP=require('../model/verification');
const otpGenerator = require('otp-generator');
const Product = require('../model/productModel');
const Category=require('../model/categoryModel')
const mongoose=require('mongoose');



// Helper function to generate OTP
function generateOTP() {
    return otpGenerator.generate(6, { upperCaseAlphabets: false, lowerCaseAlphabets: false, specialChars: false });
};

// Helper function to validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// signup page loader
const loadRegister=async(req,res)=>{
    res.render('user/signup', { error: "", message: "" });
};

// signup page
const registerUser = async (req, res) => {
    try {
        const { name, email, password, cpassword } = req.body;

        if (!name || !email || !password || !cpassword) {
            return res.render('user/signup', {error:"", message: "All fields are required" });
        }

        if (!isValidEmail(email)) {
            return res.render('user/signup', {error: "", message: "Please enter a valid Email" });
        }

        if (password !== cpassword) {
            return res.render('user/signup', { error: "",message: "Passwords do not match" });
        }

        const existingUser = await userSchema.findOne({ email });
        if (existingUser) {
            return res.render('user/signup', { error: "",message: "User already exists" });
        }

        req.session.tempUser = { name, email, password };
        const otp = generateOTP();
        await OTP.create({ email, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
        await sendOtpToEmail(email, otp);
        console.log(otp);

        req.session.otp = otp;
        req.session.otpExpires = Date.now() + 5 * 60 * 1000;

        res.render('user/verification', { email });
    } catch (error) {
        console.error("Error during signup:", error);
        res.render('user/signup', {error: "", message: "Something went wrong. Please try again later." });
    }
};

// verify otp
const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!req.session.otp || Date.now() > req.session.otpExpires) {
            return res.render('user/verification', {error: "", message: "OTP expired, please request again.", email: req.session.tempUser.email });
        }

        if (otp !== req.session.otp) {
            return res.render('user/verification', { error: "",message: "Invalid OTP. Try again.", email: req.session.tempUser.email });
        }

        const { name, email, password } = req.session.tempUser;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRound);

        // Generate unique referral code
        const referralCode = await userSchema.generateReferralCode();

        const newUser = new userSchema({
            name,
            email,
            password: hashedPassword,
            referralCode
        });

        await newUser.save();

        // Cleanup OTP from session and database
        await OTP.deleteOne({ email });
        delete req.session.tempUser;
        delete req.session.otp;
        delete req.session.otpExpires;

        req.session.user = { id: newUser._id, email: newUser.email };

        res.redirect('/user/home');
    } catch (error) {
        console.error("Error during OTP verification:", error);
        res.render('user/verification', { error: "",message: "Something went wrong", email: req.session.tempUser.email });
    }
};

// verification page loader
const loadVerification = async (req, res) => {
    try {
        const email = req.session.tempUser ? req.session.tempUser.email : null;
        console.log('load veryfy');
        res.render('user/verification', { email });
        console.log('load verication page');
    } catch (error) {
        console.error("Error during verification:", error);
        res.render('user/verification', { error: "", message: "" });
    }
};

// resend otp
const resendOtp = async (req, res) => {
    const { email } = req.body;  // Ensure the email field arrives
    if (!email) return res.status(400).json({ success: false, message: "Email is required." });

    try {
        // Check if an unexpired OTP already exists for this email
        const existingOTP = await OTP.findOne({ email, expiresAt: { $gt: Date.now() } });
        if (existingOTP) {
            return res.status(400).json({ success: false, message: 'Wait until current OTP expires before requesting a new one.' });
        }

        // Generate a new OTP
        const otp = generateOTP(); 

        
        const otpPayload = {
            email,
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000 
        };
        await OTP.create(otpPayload);

        // Send OTP via email
        await sendOtpToEmail(email, otp); 

        // Store OTP and its expiry in the session
        req.session.otp = otp;
        req.session.otpExpires = otpPayload.expiresAt;

        console.log(`Resent OTP: ${otp} to ${email}`);

        res.status(200).json({ success: true, message: "OTP sent successfully!", email });
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
};

// login page loader
const loadLogin=async(req,res)=>{
    res.render('user/login',{error:"",message:""})

};
  
// Google Login Handler
const googleLogin = async (req, res) => {
    console.log('google-login');
    if (req.isAuthenticated()) {
        console.log('1');
        // Check if the user is blocked
        if (req.user.isBlocked) {
            console.log('2');
            return res.render('user/login', { error: 'Your account is blocked', message: null });
        }
        console.log('3');
        // Save user to session
        req.session.user = { id: req.user._id, email: req.user.email };
        console.log(req.session.user);
        return res.redirect('/user/home');  
    }
    console.log('4');
    return res.redirect('/user/login?error=Authentication failed');
};

//Traditional Login Handler
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.render('user/login', { error: 'Both email and password are required', message: null });
        }

        const user = await userSchema.findOne({ email });
        if (!user) {
            return res.render('user/login', { error: 'User not found', message: null });
        }

        if (user.isBlocked) {
            return res.render('user/login', { error: 'Your account is blocked', message: null });
        }

        // Compare the password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('user/login', { error: 'Invalid password', message: null });
        }

        // Save user session
        req.session.user = { id: user._id, email: user.email };
        return res.redirect('/user/home');  // Redirect to home page after successful login

    } catch (error) {
        console.error(error);
        return res.render('user/login', { error: 'An error occurred. Please try again.', message: null });
    }
}

//login user
// const loginUser = async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         console.log('get');
//         console.log("getted email", email, password);

//         const user = await userSchema.findOne({ email });
//         console.log('user');
//         console.log(user);

//         // Check if user exists
//         if (!user) {
//             return res.render('user/login', { error: 'Fields are required', message: null });
//         }

//         // Check if the user is blocked
//         if (user.isBlocked === true) {
//             return res.render('user/login', { error: 'Your account is blocked', message: null });
//         }

//         console.log('ismatch');
//         const isMatch = await bcrypt.compare(password, user.password);
//         console.log(isMatch);

//         // Check if the password matches
//         if (isMatch) {
//             req.session.user = {
//                 id: user._id,
//                 email: user.email,
//             };
//             return res.redirect('/user/home');
//         } else {
//             return res.render('user/login', { error: 'Invalid password', message: null });
//         }

//     } catch (error) {
//         console.log(error);
//         return res.render('user/login', { error: 'An error occurred. Please try again.', message: "" });
//     }
// };

// Handle Google Login
// const googleLogin = (req, res) => {
//     if (req.isAuthenticated()) {
//         if (req.user.isBlocked) {
//             return res.render('user/login', { error: 'Your account is blocked', message: null });
//         }
//         req.session.user = { id: req.user._id, email: req.user.email };
//         return res.redirect('/user/home');
//     }
//     return res.redirect('/user/login?error=Authentication failed');
// };

// home page with login
const getHome=async(req,res)=>{

    try {
        const userId = req.session.user?.id;
        const products = await Product.find({ isActive: true }).populate('categoryId', 'name');

         // Render the page and pass categories, products with offers, and wishlist status to the view
         res.render('user/home', { 
            products,
            userId, 
            });
    } catch (error) {
        console.error('Error fetching home page data:', error);
        req.flash('error', 'An unexpected error occurred while loading the home page.');
        res.redirect('/error');
    }
};

// load home page without login
const loadHome=async (req,res) => {

    try {
        const product = await Product.find({ isActive: true }).populate('categoryId', 'name');
       
      
        // const categories = await Category.find({ isActive: true });  
        console.log(product);
        
        res.render('user/loadhome', { product });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
}
};

// load reset page
const loadReset=async(req,res)=>{
    res.render('user/forgotPassword', { error: "", message: "" })
};

// forgot password
const resetPassword = async (req, res) => {
    try {
        const { email, password, newpassword } = req.body;

        if (!newpassword || newpassword.trim() === '') {
            return res.render('user/forgotPassword', { error:"",message: "New password cannot be empty." });
        }

        // Find the user by email
        const user = await userSchema.findOne({ email });
        if (!user) {
            return res.render('user/forgotPassword', { error:"",message: "User does not exist" });
        }

        // Check if the old password matches
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(isMatch);
        if (!isMatch) {
            return res.render('user/forgotPassword', { error:"",message: "Incorrect old password" });
        }

        // Hash the new password and save it
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newpassword, saltRounds);

        user.password = hashedPassword;
        await user.save();

        return res.render('user/login', {error:"", message: "Password updated successfully. Please log in with your new password." });

    } catch (error) {
        console.error("Error resetting password:", error);
        return res.render('user/forgotPassword', { error:"",message: "An error occurred while resetting the password. Please try again." });
    }
};

// get product
const getProducts = async (req, res) => {
    try {
        const { sort, category, search, page = 1 } = req.query;
        const filter = { isActive: true }; // Only show active products
        const limit = 12;
        const skip = (page - 1) * limit;

        // Apply category filter if provided
        if (category) {
            const categoryObj = await Category.findOne({ name: category, isActive: true });
            if (categoryObj) {
                filter.categoryId = categoryObj._id;
            }
        }

        // Apply search filter if provided
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }
        let sortCriteria = {};
        switch (sort) {
            case 'price-low-high':
                sortCriteria.price = 1;
                break;
            case 'price-high-low':
                sortCriteria.price = -1;
                break;
            case 'average-ratings':
                sortCriteria.averageRating = -1;
                break;
            case 'new-arrivals':
                sortCriteria.createdAt = -1;
                break;
            case 'a-z':
                sortCriteria.title = 1;
                break;
            case 'z-a':
                sortCriteria.title = -1;
                break;
            case 'in-stock':
                filter.stock = { $gt: 0 };
                break;
        }

        const [products, totalProducts] = await Promise.all([
            Product.find(filter)
                .sort(sortCriteria)
                .skip(skip)
                .limit(limit)
                .populate('categoryId', 'name'),
            Product.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/productList', {
            products,
            categories: await Category.find({ isActive: true }),
            currentPage: page,
            totalPages,
            category,
            itemCount: products.length 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send("Error fetching products");
    }
};

// product details
const productDetails = async (req, res) => {
    try {
        const productId = req.params.id; 
        console.log(`Product ID: ${productId}`);

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: "Bad request" });
        }

        const product = await Product.findOne({ _id: productId, isActive: true })
            .populate('categoryId')
            .lean(); 

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Include the calculated discounted price
        product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));

        const relatedProducts = await Product.find({ isActive: true, _id: { $ne: productId } }).limit(4).lean();

        res.render('user/productDetails', { 
            product, 
            relatedProducts,
            discount:product.discountedPrice
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).send('Server error');
    }
};

// session distroy page
const logout=async(req,res)=>{
    req.session.user=null;
    res.redirect('/user/login')
};

module.exports={
    loadRegister,
    registerUser,
    loadVerification,
    verifyOTP,
    loadLogin,
    loginUser,
    loadHome,
    getHome,
    loadReset,
    resetPassword,
    logout,
    resendOtp,
    getProducts,
    productDetails,
    googleLogin,
}