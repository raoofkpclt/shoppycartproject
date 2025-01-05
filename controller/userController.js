const userSchema=require('../model/userModel');
const bcrypt = require('bcrypt');
const saltRound = 10;
const sendOtpToEmail=require('../config/otpVerification');
const OTP=require('../model/verification');
const otpGenerator = require('otp-generator');
const Product = require('../model/productModel');
const Category=require('../model/categoryModel')
const mongoose=require('mongoose');
const addressSchema=require('../model/addressModel');
const Cart=require('../model/cartModel');
const Order=require('../model/orderModel');



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
            return res.render('user/signup', {error:"All fields are required", message: null });
        }

        if (!isValidEmail(email)) {
            return res.render('user/signup', {error: "Please enter a valid Email", message: "Please enter a valid Email" });
        }

        if (password !== cpassword) {
            return res.render('user/signup', { error: "Passwords do not match",message: null });
        }

        const existingUser = await userSchema.findOne({ email });
        if (existingUser) {
            return res.render('user/signup', { error: "User already exists",message: null });
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
        res.render('user/signup', {error: "Something went wrong. Please try again later.", message: null });
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

// Login Handler
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
        const products = await Product.find({ isActive: true }).populate('categoryId', 'name').skip(2).limit(8)

         // Render the page
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
        const product = await Product.find({ isActive: true }).populate('categoryId', 'name').skip(2).limit(8)
       
      
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
        const filter = { isActive: true }; 
        const limit = 12;
        const skip = (page - 1) * limit;
        const userId = req.session.user?.id;

        const cart = await Cart.findOne({ userId: userId }, { items: 1 });
        const itemCount = cart ? cart.items.length : 0;

        if (category && category !== 'all') {
            filter.categoryId = category;
        }

        if (search) {
            filter.product = { $regex: search, $options: 'i' };
        }

        let sortCriteria = {};
        switch (sort) {
            case 'popularity': 
                sortCriteria.popularity = -1; 
                break;
            case 'price-low-high':
                sortCriteria.price = 1;
                break;
            case 'price-high-low':
                sortCriteria.price = -1;
                break;
            case 'average-ratings':
                sortCriteria.averageRating = -1;
                break;
            case 'featured':
                sortCriteria.isFeatured = -1;
                break;
            case 'new-arrivals':
                sortCriteria.createdAt = -1;
                break;
            case 'a-z':
                sortCriteria.product = 1;
                break;
            case 'z-a':
                sortCriteria.product = -1;
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
            currentPage: Number(page),
            totalPages,
            category,
            itemCount,
            search,
            sort
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send("Error fetching products");
    }
};

const productDetails = async (req, res) => {
    try {
        const productId = req.params.id; 

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: "Bad request" });
        }

        const product = await Product.findOne({ _id: productId, isActive: true })
            .populate('categoryId')
            .lean(); 

            console.log(product);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const relatedProducts = await Product.find({ isActive: true, _id: { $ne: productId } }).limit(6).lean();

        res.render('user/productDetails', { 
            product:product,
            relatedProducts,
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).send('Server error');
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
        const orders = await Order.find({ user: user._id }).populate('products.productId', 'product images').sort({ createdAt: -1 });



        // Pass user and addresses to the EJS template
        res.render('user/profile', {
            user,
            addresses,
            orders,
            firstAddress
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.render('user/home', { message: "Server error" });
    }
};

//edit profile
const editProfile = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).render('user/profile', { message: "Unauthorized" });
        }

        // Validate password confirmation if provided
        if (password && password !== confirmPassword) {
            return res.status(400).render('user/profile', { message: "Passwords do not match" });
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
        res.redirect('/user/profile?success=true');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/user/profile?error=true');
    }
};

//add address
const addAddress = async (req, res) => {
    try {
        const { name, phone, pincode, locality, city, state, address, landmark, alternatePhone } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.render('user/profile', { message: "Unauthorized" });
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

        res.redirect('/user/profile?section=addressBook');
    } catch (error) {
        console.error('Error adding address:', error);
        res.redirect('/user/profile?section=addressBook&error=true');
    }
};

//edit address
const editAddress = async (req, res) => {
    try {
        const { addressId } = req.params; 
        const userId = req.session.user?.id; 

        if (!userId) {
            return res.render('user/profile', { message: "Unauthorized" });
        }

        const { name, address, locality, city, state, pincode, phone, alternatePhone, landmark } = req.body;

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

        res.redirect('/user/profile?section=addressBook');
    } catch (error) {
        console.error('Error updating address:', error);
        res.redirect('/user/profile?section=addressBook&error=true');
    }
};

//delete address
const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params; 
        const userId = req.session.user?.id; 

        // Check if the user is authenticated
        if (!userId) {
            return res.render('user/profile', { message: "Unauthorized" });
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

        res.redirect('/user/profile?section=addressBook');
    } catch (error) {
        console.error('Error deleting address:', error);
        res.redirect('/user/profile?section=addressBook&error=true');
    }
};

//add to cart
const addToCart = async (req, res) => {
    try {
        const productId = req.params.product_id;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in",
            });
        }

        console.log("Adding to cart - Product ID:", productId, "User ID:", userId);

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Check if the product has sufficient stock
        if (product.quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Product is out of stock",
            });
        }

        // Find the user's cart or create a new one
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

    
          // Check if the cart already has 6 items
          const totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);
          if (totalItems >= 6) {
              return res.status(400).json({
                  success: false,
                  message: "Cart limit exceeded. You can add up to 6 items only.",
              });
          }

        // Check if the product already exists in the cart
        const existingItem = cart.items.find((item) => item.productId.toString() === productId);

        if (existingItem) {
            // Check if the quantity exceeds available stock
            if (existingItem.quantity + 1 > product.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more items. Only ${product.quantity} items available in stock.`,
                });
            }
            existingItem.quantity += 1;
            existingItem.totalPrice = existingItem.quantity * existingItem.price;
        } else {
            cart.items.push({
                name: product.product,
                productId,
                quantity: 1,
                price: product.salePrice || product.price, 
                totalPrice: product.salePrice || product.price,
                status: "placed",
                cancelationReason: "none",
            });
        }

        await cart.save();

        res.json({
            success: true,
            message: "Product added to cart successfully",
        });
    } catch (error) {
        console.error("Error in addToCart:", error);
        res.status(500).json({
            success: false,
            message: "Server error while adding to cart",
        });
    }
};

//load cart
const loadCart = async (req, res) => {
    const userId = req.session.user.id;

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            return res.render('user/cart', { items: [] ,errorMessage:null});
        }

        const items = cart.items.map(item => {
            return {
                productId: item.productId._id,
                name: item.productId.product,
                imageUrl: item.productId.images[0], 
                price: item.productId.price,
                quantity: item.quantity,
                total: item.productId.price * item.quantity 
            };
        })
        res.render('user/cart', { items,errorMessage:null });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error fetching cart');
    }
};

//remove from cart
const removeFromCart = async (req, res) => {
    const { productId } = req.body; 
    const userId = req.session.user.id; 

    console.log('1');

    try {
        // Find the user's cart
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the index of the product in the cart
        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

        if (itemIndex >= 0) {
            cart.items.splice(itemIndex, 1);

            if (cart.items.length === 0) {
                await Cart.deleteOne({ userId });
            } else {
                await cart.save();
            }

            return res.status(200).json({ success: true, message: 'Item removed from cart' });
        } else {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        return res.status(500).json({ success: false, message: 'Error removing item from cart' });
    }
};

//update cart
const updateCart = async (req, res) => {
    const { productId } = req.params;
    const { action } = req.body;
    const userId = req.session.user.id;

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        const product = cart.items[itemIndex].productId;

      
        if (action === 'increase') {
            if (cart.items[itemIndex].quantity >= product.stock) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot add more than the available stock.',
                    stock: product.stock
                });
            }
            cart.items[itemIndex].quantity += 1;
        } else if (action === 'decrease') {
            if(cart.items[itemIndex].quantity <= 1) {
                cart.items.splice(itemIndex, 1);
            } else {
            cart.items[itemIndex].quantity -= 1;
            }
        }

       
        
      
        if (cart.items[itemIndex].quantity <= 0) {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();

   
        const cartTotal = cart.items.reduce((total, item) => {
            return total + item.quantity * item.productId.price;
        }, 0);

        res.json({
            success: true,
            quantity: cart.items[itemIndex] ? cart.items[itemIndex].quantity : 0,
            cartTotal,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating cart' });
    }
}

//checkout
const checkout = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const items = cart.items.map(item => {
            return {
                productId: item.productId._id,
                name: item.productId.product,
                imageUrl: item.productId.images[0],
                price: item.productId.price,
                quantity: item.quantity,
                total: item.productId.price * item.quantity
            };
        });

        const userAddresses = await addressSchema.findOne({ userId });

        const addresses = userAddresses ? userAddresses.addresses : [];

        const cartTotal = items.reduce((total, item) => total + item.total, 0);

        res.render('user/checkout', { items, cartTotal, addresses, userId});
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ message: "Server error" });
    }
};

//add new address
const addNewAddress = async (req, res) => {
    try {
        const { name, phone, pincode, locality, city, state, address, landmark, alternatePhone } = req.body;
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized user.' });
        }

        let userAddress = await addressSchema.findOne({ userId });

        if (!userAddress) {
            userAddress = new addressSchema({
                userId,
                addresses: [],
            });
        }

        const newAddress = {
            name,
            phone,
            pincode,
            locality,
            city,
            state,
            address,
            landmark,
            alternatePhone,
        };

        userAddress.addresses.push(newAddress);
        await userAddress.save();

        res.status(201).json({
            success: true,
            address: userAddress.addresses[userAddress.addresses.length - 1],
        });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

//checkout cod
const checkoutCOD = async (req, res) => {
    const userId = req.session.user?.id; 
    const { addressId } = req.body;
    console.log('address',req.body);

    try {
       
        if (!userId) {
            return res.render('user/orderFailed'); 
        }

       
        

        // cart with populated product details
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.render('user/orderFailed');
        }

        // Fetch user address
        const userAddress = await addressSchema.findOne({ userId });
        const selectedAddress = userAddress?.addresses.id(addressId);
        if (!selectedAddress) {
            return res.render('user/orderFailed');
        }

        const shippingAddress = `${selectedAddress.name}, ${selectedAddress.address}, ${selectedAddress.locality}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.pincode}`;
        
        // Calculate order items and total
        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            name: item.productId.product, 
            price: item.productId.price,
            quantity: item.quantity,
            total: item.productId.price * item.quantity,
        }));
        
        const orderTotal = orderItems.reduce((total, item) => total + item.total, 0);

        // Create and save the order
        const order = await Order.create({
            user: userId,
            products: orderItems,
            totalAmount: orderTotal,
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            shippingAddress: shippingAddress,
            status: 'pending',
        });
        //minus stock
        for (const item of cart.items) {
            const product = await Product
                .findById(item.productId)
                .select('stock');
            product.stock -= item.quantity;
            await product.save();
        }


        // Clear cart
        await cart.deleteOne(); 

        // Respond with success
        return res.render('user/orderSuccess', { orderId: order._id });
    } catch (error) {
        console.error('Error during COD checkout:', error);
        return res.render('user/orderFailed');
    }
};

// Order Cancel 
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user.id;
        console.log('Order ID:', orderId, 'User ID:', userId);
        
        // Find the order
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        // Check if the order is cancellable
        if (order.status !== 'pending') {
            return res.json({ success: false, message: 'Order cannot be cancelled' });
        }

        // Update the order status
        order.status = 'cancelled';
        order.updatedAt = new Date();
        await order.save();

        // Refund the stock
        for (const item of order.products) {
            const product = await Product.findById(item.productId);
            product.stock += item.quantity;
            await product.save();
        }

        return res.json({ success: true, message: 'Order cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.json({ success: false, message: 'Server error' });
    }
};

// session distroy page
const logout=async(req,res)=>{
    req.session.user=null;
    res.redirect('/user/login')
};

//checking
const checking=async(req,res)=>{
    res.render('user/orderfailed')
}

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
    loadProfile,
    addToCart,
    addAddress,
    loadCart,
    checkout,
    editAddress,
    deleteAddress,
    removeFromCart,
    updateCart,
    addNewAddress,
    checkoutCOD,
    cancelOrder,
    editProfile,
   
    checking
}