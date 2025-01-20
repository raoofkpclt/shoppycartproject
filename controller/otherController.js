//schema
const userSchema = require("../model/userModel");
const Wishlist = require("../model/wishlistModel");
const Product = require("../model/productModel");
const Wallet = require("../model/walletModel");
const Coupon = require("../model/couponModel");
const Offer = require("../model/offerModal");
const Category = require("../model/categoryModel");

//coupon managment
const couponManagement = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ _id: -1 });
    res.render("admin/couponManagement", { coupons, message: "", error: "" });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Error fetching coupons" });
  }
};

//add coupon
const addCoupon = async (req, res) => {
  try {
    console.log("1");
    const {
      code,
      description,
      minPurchase,
      discountPercentage,
      startDate,
      endDate,
      isActive,
      maxDiscount,
    } = req.body;
    console.log(req.body);
    if (
      !code ||
      !description ||
      !minPurchase ||
      !discountPercentage ||
      !maxDiscount||
      !startDate ||
      !endDate ||
      !isActive
    ) {
      console.log("ERR");
      return res.redirect(
        "/admin/couponManagement?error=All fields are required"
      );
    }
    const newCoupon = new Coupon({
      code,
      description,
      minPurchase,
      discountPercentage,
      maxDiscount,
      startDate,
      endDate,
      isActive,
    });
    await newCoupon.save();
    console.log("3");
    res.redirect("/admin/couponManagement?message=Coupon added successfully");
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({ message: "Error adding coupon" });
  }
};

//delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndDelete(couponId);
    res.redirect("/admin/couponManagement?message=Coupon deleted successfully");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ message: "Error deleting coupon" });
  }
};

//update coupon
const editCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      code,
      description,
      minPurchase,
      discountPercentage,
      startDate,
      endDate,
      isActive,
    } = req.body;
    if (
      !code ||
      !description ||
      !minPurchase ||
      !discountPercentage ||
      !startDate ||
      !endDate ||
      !isActive
    ) {
      return res.redirect(
        `/admin/editCoupon/${couponId}?error=All fields are required`
      );
    }
    await Coupon.findByIdAndUpdate(couponId, {
      code,
      description,
      minPurchase,
      discountPercentage,
      startDate,
      endDate,
      isActive,
    });
    res.redirect("/admin/couponManagement?message=Coupon updated successfully");
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Error updating coupon" });
  }
};

//offers management
const offerManagement = async (req, res) => {
  try {
    const products = await Product.find({});
    const categories = await Category.find({});
    const offers = await Offer.find({}).sort({ _id: -1 });
    res.render("admin/offerManagement", {
      offers,
      products,
      categories,
      message: "",
      error: "",
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ message: "Error fetching offers" });
  }
};

//add offer
const addOffer = async (req, res) => {
  try {
    console.log("1");
    const {
      name,
      discount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      isActive,
    } = req.body;
    console.log(
      name,
      discount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      isActive
    );
    if (
      !name ||
      !discount ||
      !applicableProducts ||
      !applicableCategories ||
      !startDate ||
      !endDate ||
      !isActive
    ) {
      console.log("ERR");
      return res.redirect(
        "/admin/offerManagement?error=All fields are required"
      );
    }
    console.log("2");
    const newOffer = new Offer({
      name,
      discount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      isActive,
    });
    await newOffer.save();
    console.log("3");
    res.redirect("/admin/offerManagement?message=Offer added successfully");
  } catch (error) {
    console.error("Error adding offer:", error);
    res.status(500).json({ message: "Error adding offer" });
  }
};

//delete offer
const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndDelete(offerId);
    res.redirect("/admin/offerManagement?message=Offer deleted successfully");
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({ message: "Error deleting offer" });
  }
};

//update offer
const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const {
      name,
      discount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      isActive,
    } = req.body;

    if (
      !name ||
      !discount ||
      !applicableProducts ||
      !applicableCategories ||
      !startDate ||
      !endDate ||
      !isActive
    ) {
      return res.redirect(
        `/admin/offer/${offerId}?error=All fields are required`
      );
    }

    await Offer.findByIdAndUpdate(offerId, {
      name,
      discount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      isActive,
    });

    res.redirect(`/admin/offer/${offerId}?message=Offer updated successfully`);
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({ message: "Error updating offer" });
  }
};

//--------------------------------------------------  admin side end ----------------------------------------------------

//load wallet

const wallet = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.render("user/wallet", {
        user,
        wallet: { balance: 0, transactions: [] },
      });
    }
  // Sort transactions to show the latest first
  wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render("user/wallet", { user, wallet });
  } catch (error) {
    console.error("Error fetching user or wallet:", error);
    res.status(500).json({ message: "Error fetching user or wallet" });
  }
};



const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const wallet = await Wallet.findOne({ userId })

    if (!wallet) {
      return res
        .status(404)
        .json({ success: false, message: "Wallet not found" });
    }

      // Sort transactions to show the latest first
      wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true,wallet, balance: wallet.balance });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const addTransaction = async (userId, amount, type) => {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Update balance
    if (type === "credit") {
      wallet.balance += amount;
    } else if (type === "debit") {
      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }
      wallet.balance -= amount;
    }

    // Add transaction
    wallet.transactions.push({ amount, type });
    await wallet.save();
    return wallet;
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
};


const addWalletTransaction = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { amount, type } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const wallet = await addTransaction(userId, amount, type)

    res.json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


//addToWallet
const addToWallet = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const amount = parseInt(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await userSchema.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    user.wallet += amount;
    await user.save();

    res.json({
      success: true,
      message: "Amount added to wallet",
      wallet: user.wallet,
    });
  } catch (error) {
    console.error("Error adding to wallet:", error);
    res.status(500).json({ message: "Error adding to wallet" });
  }
};

// Add to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const productId = req.params.product_id;

    console.log("id:", userId, "product_id:", productId);

    const user = await userSchema.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingItem = wishlist.items.find(
      (item) => item.productId.toString() === productId
    );
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Product already added to wishlist",
      });
    } else {
      wishlist.items.push({
        productId,
        name: product.product,
        price: product.discountPrice,
        image: product.images[0],
      });
    }

    // Save the wishlist
    await wishlist.save();

    // res.redirect('/user/wishlist');

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error adding to wishlist" });
  }
};

//load wishlist
const wishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;

    // Ensure user is authenticated
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch wishlist
    const wishlist = await Wishlist.findOne({ userId })
      .populate("items.productId")
      .lean();

    // Handle empty wishlist
    if (!wishlist || wishlist.items.length === 0) {
      return res.render("user/wishlist", { user, wishlist: [] });
    }

    // Render with fetched wishlist
    res.render("user/wishlist", { user, wishlist: wishlist.items });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
};

const removeWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const productId = req.params.product_id;

    // Ensure user is authenticated
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch wishlist and remove the product
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId } } },
      { new: true }
    ).populate("items.productId");

    console.log("Updated Wishlist:", wishlist);

    // Handle case when wishlist is empty
    if (!wishlist || wishlist.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Product removed, but wishlist is now empty.",
      });
    }

    // Successfully removed item from wishlist
    res.status(200).json({
      success: true,
      message: "Product removed from wishlist!",
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Error removing from wishlist",
    });
  }
};

//move to cart for wishlist item
const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const productId = req.params.product_id;

    // Ensure user is authenticated
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch wishlist and move the product to cart
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId } } },
      { new: true }
    ).populate("items.productId");

    // Handle case when wishlist is empty
    if (!wishlist || wishlist.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Product removed, but wishlist is now empty.",
      });
    }

    // Successfully moved item to cart
    res.status(200).json({
      success: true,
      message: "Product moved to cart!",
    });

    // Add the moved product to the user's cart
    const cart = user.cart || [];
    cart.push({
      productId,
      name: wishlist.items[0].name,
      price: wishlist.items[0].price,
      image: wishlist.items[0].image,
      quantity: 1,
    });
    user.cart = cart;

    // Remove the product from the wishlist
    await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

    await user.save();

    // // Add the product to the user's wallet
    // user.wallet -= wishlist.items[0].price;
    // await user.save();

    res.status(200).json({
      success: true,
      message: "Product moved to cart!",
    });
  } catch (error) {
    console.error("Error moving to cart:", error);
    res.status(500).json({ message: "Error moving to cart" });
  }
};

module.exports = {
  //admin side
  couponManagement,
  addCoupon,
  deleteCoupon,
  offerManagement,
  addOffer,
  deleteOffer,

  //userside
  wallet,
  addToWishlist,
  wishlist,
  removeWishlist,
  moveToCart,
  getWalletBalance,
  addWalletTransaction,
  
};
