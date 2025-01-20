const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const addressSchema = require("../model/addressModel");
const Cart = require("../model/cartModel");
const Wishlist = require("../model/wishlistModel");
const Wallet = require("../model/walletModel");
const Razorpay = require("razorpay");
require("dotenv").config();
const Coupon = require("../model/couponModel");
const Offer = require("../model/offerModal");
const crypto = require("crypto");
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');




const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//order management
const orderManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOrder = await Order.countDocuments({});
    const orders = await Order.find({})
      .populate("user", "name email")
      .populate("products.productId", "product price")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);

    const totalPage = Math.ceil(totalOrder / limit);
    res.render("admin/orderManagement", {
      orders,
      currentPage: page,
      totalPages: totalPage,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.render("admin/orderManagement", {
      orders: [],
      error: "Failed to fetch orders",
    });
  }
};

// Update order status
const orderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate the input status
    const validStatuses = [
      "pending",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status provided");
    }

    // Update the order in the database
    const updatedOrder = await Order.findById(id);

    if (!updatedOrder) {
      return res.status(404).send("Order not found");
    }

    //  all products have a valid name
    updatedOrder.products.forEach((product) => {
      if (!product.name) {
        product.name = product.productId
          ? product.productId.name
          : "Unknown Product";
      }
    });

    if (status === "delivered") {
      updatedOrder.paymentStatus = "paid";
    }

    updatedOrder.status = status;
    await updatedOrder.save();

    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).send("Internal Server Error");
  }
};

// const acceptReturn = async (req, res) => {
//   try {
//     const { orderId } = req.params;

//     // Find the order
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     // Validate order status
//     if (order.status !== "returnRequested") {
//       return res.status(400).json({ success: false, message: "Return request is not valid" });
//     }

//     // Update the order status
//     order.status = "returned";
//     order.returnStatus = "accepted";
//     order.updatedAt = new Date();
//     await order.save();

//     // Refund the stock
//     for (const item of order.products) {
//       const product = await Product.findById(item.productId);
//       product.stock += item.quantity;
//       await product.save();
//     }

//     //add to amount wallet
//        // Find or create the user's wallet
//        let wallet = await Wallet.findOne({ userId });
//        if (!wallet) {
//          wallet = await Wallet.create({
//            userId,
//            balance: 0,
//            transactions: [],
//          });
//        }
   
//        // Update the wallet balance
//        wallet.balance += order.totalAmount;
   
//        // Add a wallet transaction
//        wallet.transactions.push({
//          amount: order.totalAmount,
//          type: "credit", // This indicates money is added to the wallet
//          date: new Date(),
//        });
   
//        await wallet.save();


//     res.json({ success: true, message: "Return request accepted successfully" });
//   } catch (error) {
//     console.error("Error accepting return request:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

const acceptReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate order status
    if (order.status !== "returnRequested") {
      return res.status(400).json({ success: false, message: "Return request is not valid" });
    }

    // Update the order status
    order.status = "returned";
    order.returnStatus = "accepted";
    order.updatedAt = new Date();
    await order.save();

    // Refund the stock
    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      product.stock += item.quantity;
      await product.save();
    }

    // Find or create the user's wallet
    let wallet = await Wallet.findOne({ userId: order.user });
    if (!wallet) {
      wallet = new Wallet({
        userId: order.userId,
        balance: 0,
        transactions: [],
      });
    }

    // Update the wallet balance and add a transaction
    wallet.balance += order.totalAmount;
    wallet.transactions.push({
      amount: order.totalAmount,
      type: "credit", // Indicates money added to the wallet
      date: new Date(),
    });
    await wallet.save();

    res.json({ success: true, message: "Return request accepted successfully" });
  } catch (error) {
    console.error("Error accepting return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


//reject return
const rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate order status
    if (order.status !== "returnRequested") {
      return res.status(400).json({ success: false, message: "Return request is not valid" });
    }

    // Update the order status
    order.status = "delivered";
    order.returnStatus = "rejected";
    order.updatedAt = new Date();
    await order.save();

    res.json({ success: true, message: "Return request rejected successfully" });
  } catch (error) {
    console.error("Error rejecting return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


//--------------------------------------------------  admin side end ----------------------------------------------------

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
    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // Calculate the discount price
    const discountPrice =
      product.discountPrice > 0 ? product.discountPrice : product.price;
    const withOutDiscountPrice = product.price;
    const discount = withOutDiscountPrice - product.discountPrice;

    console.log(discount);

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
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      // Check if the quantity exceeds available stock
      if (existingItem.quantity + 1 > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more items. Only ${product.stock} items available in stock.`,
        });
      }
      existingItem.quantity += 1;
      existingItem.price = discountPrice; // Update the price with the discounted price
      existingItem.totalPrice = existingItem.quantity * discountPrice; // Update the total price
    } else {
      cart.items.push({
        name: product.product,
        productId,
        quantity: 1,
        price: discountPrice, // Set the discounted price
        totalPrice: discountPrice, // Set the total price for 1 item
        status: "placed",
        cancelationReason: "none",
        offer: discount,
        withOutDiscount: withOutDiscountPrice,
      });
    }

    await cart.save();

    // Remove product from wishlist after adding to cart
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });
    }

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
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.render("user/cart", { items: [], errorMessage: null });
    }

    const items = cart.items.map((item) => {
      return {
        productId: item.productId._id,
        name: item.productId.product,
        imageUrl: item.productId.images[0],
        price: item.productId.discountPrice,
        quantity: item.quantity,
        total: item.productId.discountPrice * item.quantity,
      };
    });
    res.render("user/cart", { items, errorMessage: null });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching cart");
  }
};

//remove from cart
const removeFromCart = async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.user.id;

  console.log("1");

  try {
    // Find the user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Find the index of the product in the cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex >= 0) {
      cart.items.splice(itemIndex, 1);

      if (cart.items.length === 0) {
        await Cart.deleteOne({ userId });
      } else {
        await cart.save();
      }

      return res
        .status(200)
        .json({ success: true, message: "Item removed from cart" });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error removing item from cart" });
  }
};

//update cart
const updateCart = async (req, res) => {
  const { productId } = req.params;
  const { action } = req.body;
  const userId = req.session.user.id;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      (item) => item.productId._id.toString() === productId
    );
    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found in cart" });
    }

    const product = cart.items[itemIndex].productId;

    if (action === "decrease") {
      if (cart.items[itemIndex].quantity <= 1) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot decrease quantity below 1",
          });
      }
      cart.items[itemIndex].quantity -= 1;
    } else if (action === "increase") {
      if (cart.items[itemIndex].quantity >= product.stock) {
        return res.status(400).json({
          success: false,
          message: "You cannot add more than the available stock.",
          stock: product.stock,
        });
      }
      cart.items[itemIndex].quantity += 1;
    } else if (action === "decrease") {
      if (cart.items[itemIndex].quantity <= 1) {
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
    res.status(500).json({ success: false, message: "Error updating cart" });
  }
};

// Process the checkout and redirect
const processCheckout = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    req.session.cartData = {
      items: cart.items.map((item) => ({
        productId: item.productId._id,
        name: item.productId.product,
        imageUrl: item.productId.images[0],
        price: item.productId.discountPrice,
        offer: item.productId.offer,
        withOutDiscount: item.productId.withOutDiscount,

        quantity: item.quantity,
        total: Math.round(item.productId.discountPrice * item.quantity), // Round individual totals
      })),
      cartTotal: Math.round(
        cart.items.reduce(
          (total, item) => total + item.productId.discountPrice * item.quantity,
          0
        )
      ), // Round total amount
    };

    res.redirect("/user/checkout");
  } catch (error) {
    console.error("Error during checkout:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//render checkout
const renderCheckout = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { items, cartTotal } = req.session.cartData || {};
    const userAddresses = await addressSchema.findOne({ userId });
    const addresses = userAddresses ? userAddresses.addresses : [];
    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    // Fetch available coupons and filter by minPurchase condition
    const coupons = await Coupon.find({ isActive: true });
    const filteredCoupons = coupons
      .filter((coupon) => coupon.minPurchase <= (cartTotal || 0)) // Only show coupons with minPurchase <= cartTotal
      .map((coupon) => ({
        code: coupon.code,
        description: `${coupon.discountPercentage}% OFF - Min Order ₹${coupon.minPurchase}`,
      }));

    res.render("user/checkout", {
      items,
      cartTotal,
      addresses,
      userId,
      walletBalance,
      availableCoupons: JSON.stringify(filteredCoupons), // Pass filtered coupons to the template
    });
  } catch (error) {
    console.error("Error during rendering checkout page:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//validate coupon
const validateCoupon = async (req, res) => {
    try {
       
      const { couponCode, subtotal } = req.body;
      const userId = req.session.user?.id;
  
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized user." });
      }
  
      // Fetch the coupon details
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) {
        return res
          .status(404)
          .json({ success: false, message: "Coupon not found or inactive." });
      }
  
      if (coupon.minPurchase > subtotal) {
        return res.status(400).json({
          success: false,
          message: `Minimum purchase required is ₹${coupon.minPurchase}. Your total is ₹${subtotal}.`,
        });
      }
  
      let discount = (subtotal * coupon.discountPercentage) / 100;
      // If discount is more than the max discount, apply the maximum discount
      if (discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      console.log(discount);
      console.log(coupon.maxDiscount);
      let discountedSubtotal = subtotal - discount;
  
      // Round the discountedSubtotal to the nearest integer
      discountedSubtotal = Math.round(discountedSubtotal);
  console.log(discountedSubtotal);
      // Save discounted subtotal in session for future use
      req.session.cartData = {
        ...req.session.cartData,
        discountedSubtotal,
        couponCode,
        discount,
      };
  
      return res.json({
        success: true,
        message: "Coupon applied successfully.",
        discountPercentage: coupon.discountPercentage,
        discountedSubtotal,
        discount,
      });
    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
//remove coupon
const removeCoupon = async (req, res) => {
  try {
    // Ensure cartData exists before clearing it
    if (req.session.cartData) {
      req.session.cartData.discountedSubtotal = null;
      req.session.cartData.couponCode = null;
    }
    console.log("remove coupon");
    res.json({ success: true, message: "Coupon removed successfully." });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while removing coupon." });
  }
};

//add new address
const addNewAddress = async (req, res) => {
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
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
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
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Order Cancel
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    console.log("Order ID:", orderId, "User ID:", userId);

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if the order is cancellable
    if (order.status !== "pending") {
      return res.json({ success: false, message: "Order cannot be cancelled" });
    }

    // Update the order status
    order.status = "cancelled";
    order.updatedAt = new Date();
    await order.save();

    //add to amount wallet
       // Find or create the user's wallet
       let wallet = await Wallet.findOne({ userId });
       if (!wallet) {
         wallet = await Wallet.create({
           userId,
           balance: 0,
           transactions: [],
         });
       }
   
       // Update the wallet balance
       wallet.balance += order.totalAmount;
   
       // Add a wallet transaction
       wallet.transactions.push({
         amount: order.totalAmount,
         type: "credit", // This indicates money is added to the wallet
         date: new Date(),
       });
   
       await wallet.save();

    // Refund the stock
    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      product.stock += item.quantity;
      await product.save();
    }

    return res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.json({ success: false, message: "Server error" });
  }
};

//return order
const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    const reason = req.body.reason
    console.log("Order ID:", orderId, "User ID:", userId);

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if the order is returnable
    if (order.status !== "delivered" || order.status === "returned") {
      return res.json({ success: false, message: "Order cannot be returned" });
    }
    
    order.status = 'returnRequested'
    order.returnStatus='requested'
    order.returnReason=reason
    order.updatedAt = new Date();
    await order.save();

    return res.json({ success: true, message: "Order returned successfully" });

  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
    
  }
}

// processto checkout
const processCheckout1 = async (req, res) => {
  try {
    const addressId = req.body.addressId;
    const userId = req.session.user.id;
    if (!userId) {
      return res.status(401).send("User not authenticated");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).send("No items in the cart");
    }

    let subtotal = 0;
    let offerDiscount = 0;
    const itemsToProcess = [];

    for (let item of cart.items) {
      const product = item.productId;
      subtotal += product.discountPrice * item.quantity;
      offerDiscount += product.price * item.quantity * 10;

      itemsToProcess.push({
        productId: product._id,
        quantity: item.quantity,
        name: product.product,
        price: product.discountPrice,
        total: product.discountPrice * item.quantity,
      });
    }

    // Calculate coupon discount
    const couponDiscount = req.session.cartData?.discountedSubtotal
      ? subtotal - req.session.cartData.discountedSubtotal
      : 0;

    const deliveryCarge=99;
    const totalDiscount = couponDiscount;
    const total = subtotal - totalDiscount+deliveryCarge;

    const userAddress = await addressSchema.findOne({ userId });
    const selectedAddress = userAddress?.addresses.id(addressId);
    console.log("Address ID:", addressId, "Selected Address:", selectedAddress);

    if (!selectedAddress) {
      return res.render("user/orderFailed");
    }

    const shippingAddress = `${selectedAddress.name}, ${selectedAddress.address}, ${selectedAddress.locality}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.pincode}`;
    console.log(shippingAddress);

    const newOrder = new Order({
      user: userId,
      products: itemsToProcess,
      totalAmount: total,
      paymentMethod: req.body.paymentMethod,
      shippingAddress,
      status: "pending",
      paymentStatus:
        req.body.paymentMethod === "razorpay" ? "failed" : "pending",
      couponDiscount: totalDiscount,
    });

    await newOrder.save();

    const razorpayOrderOptions = {
      amount: Math.round(total * 100),
      currency: "INR",
      receipt: newOrder._id.toString(),
    };

    const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

    newOrder.razorpayOrderId = razorpayOrder.id;
    await newOrder.save();

    await Cart.deleteOne({ userId });

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderStatus: "created",
    });
  } catch (error) {
    console.error("Error during checkout:", error);
    res.status(500).send("Internal server error");
  }
};

//verify payment
const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  // Verify the payment signature
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    try {
      // Find the order using the Razorpay order ID
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });


      if (!order) {
        return res.status(404).send("Order not found");
      }

      order.paymentStatus = "paid";
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.paymentStatus = "paid";
      await order.save();

      for (let item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      }

      return res.json({
        message: "Payment verified successfully, order is now paid.",
        orderId: order._id,
        status: order.status,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).send("Internal server error");
    }
  } else {
    // If the payment signature does not match, return an error
    return res.status(400).send("Payment verification failed");
  }
};


const retryPayment = async (req, res) => {
  try {
    console.log('1');
      const orderId = req.params.orderId;
      console.log('orderId: ' , orderId);
      const order = await Order.findById(orderId);
      console.log('orderById',order);
      
      // Assuming `razorpayOrderId` and `amount` are saved with the order
      res.json({
          orderId: order.razorpayOrderId,
          amount: order.total * 100, // Amount in smallest currency unit
          currency: 'INR'
      });
  } catch (error) {
      console.error("Error fetching order details:", error);
      res.status(500).send("Error fetching order details");
  }
}


//order success
const orderSuccess = async (req, res) => {
  const orderId = req.query.orderId; 
  if (!orderId) {
    return res.status(400).send("Order ID is missing");
  }

  // Render the EJS template with the orderId
  res.render("user/orderSuccess", { orderId });
};

//order failed
const orderFailed = async (req, res) => {
  const orderId = req.query.orderId;

  if (!orderId) {
    return res.status(400).send("Order ID is missing");
  }

  // Render the EJS template with the orderId
  res.render("user/orderFailed", { orderId });
};



const generateInvoicePDF = async (
  order,
  res,
  companyInfo = {
    name: "SHOPPY CART",
    address: {
      street: "Shoppy City",
      city: "Calicut",
      state: "Kerala",
      postalCode: "673572",
      country: "India",
    },
    phone: "+91 8075888900",
    email: "support@shoppycart.com",
    website: "www.shoppycart.com",
  }
) => {
  const doc = new PDFDocument({ margin: 50 });

  // Set headers for PDF download
  res.setHeader("Content-Disposition", `attachment; filename="invoice_${order._id}.pdf"`);
  res.setHeader("Content-Type", "application/pdf");

  // Pipe PDF to the response
  doc.pipe(res);
 
  // Helpers
  const leftMargin = 50;
  const rightMargin = doc.page.width - 50;
  const contentWidth = rightMargin - leftMargin;
  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const drawHorizontalLine = (y = doc.y) => {
    doc.strokeColor("#cccccc").lineWidth(1).moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
  };

  // 1. Header Section
  // doc.image("/image/Shoppycartfinel.png", leftMargin, 40, { width: 60 });
  doc.fontSize(18).font("Helvetica-Bold").text(companyInfo.name, leftMargin + 0, 45);

  doc.fontSize(10).text(`Order ID: ${order._id}`, leftMargin + 0, 65);
  doc.text(`Date: ${formatDate(order.createdAt)}`, leftMargin + 0, 80);

  drawHorizontalLine(100);

  // 2. Company Information
  doc.fontSize(12).font("Helvetica-Bold").text("From:", leftMargin, 110);
  doc.fontSize(10).font("Helvetica").text(companyInfo.name, leftMargin, 130);
  doc.text(`${companyInfo.address.street}, ${companyInfo.address.city}`, leftMargin, 145);
  doc.text(`${companyInfo.address.state}, ${companyInfo.address.postalCode}`, leftMargin, 160);
  doc.text(`Phone: ${companyInfo.phone}`, leftMargin, 175);
  doc.text(`Email: ${companyInfo.email}`, leftMargin, 190);
  doc.text(`Website: ${companyInfo.website}`, leftMargin, 205);

  // 3. Billing Address
  const addressX = 300;
  const address = order.shippingAddress; 
  doc.fontSize(12).font("Helvetica-Bold").text("Billing Address:", addressX, 110);
  doc.fontSize(10).font("Helvetica").text(address, addressX, 130, { width: 200 });

  drawHorizontalLine(220);

  // 4. Order Items
  doc.fontSize(12).font("Helvetica-Bold").text("Order Items", leftMargin, 230);

  const colProduct = leftMargin;
  const colQuantity = 300;
  const colPrice = 370;
  const colTotal = 450;
 
  // Table headers
  doc.fontSize(10).font("Helvetica-Bold")
    .text("Product", colProduct, 250)
    .text("Qty", colQuantity, 250)
    .text("Price", colPrice, 250)
    .text("Total", colTotal, 250,{ align: "right" });
    console.log('8');
  drawHorizontalLine(265);
 
  // Table content
  let yPosition = 275;
  order.products.forEach((item) => {
    const { name, price, quantity, total } = item;

    doc.fontSize(10).font("Helvetica")
      .text(name, colProduct, yPosition, { width: 250 })
      .text(quantity.toString(), colQuantity, yPosition)
      .text(`${price.toFixed(2)}`, colPrice, yPosition)
      .text(`${total.toFixed(2)}`, colTotal, yPosition,{ align: "right" });

    yPosition += 20;
  });

  drawHorizontalLine(yPosition + 10);

  // 5. Summary Section
const summaryStartY = yPosition + 30; 
const summaryLabelX = 350; 
const summaryValueX = 450;

const totalPrice = order.totalAmount + order.couponDiscount; 
doc.fontSize(10).font("Helvetica")
  .text("Delivery Charges:", summaryLabelX, summaryStartY)
  .text("99.00", summaryValueX, summaryStartY, { align: "right" }) 
  .text("Subtotal:", summaryLabelX, summaryStartY + 20)
  .text(`${totalPrice.toFixed(2)}`, summaryValueX, summaryStartY + 20, { align: "right" });

if (order.couponDiscount) {
  doc.text("Discount:", summaryLabelX, summaryStartY + 40)
    .text(`-${order.couponDiscount.toFixed(2)}`, summaryValueX, summaryStartY + 40, { align: "right" });
}

drawHorizontalLine(summaryStartY + 60); 

// Final total calculation
const finalTotal = order.totalAmount ;
doc.fontSize(12).font("Helvetica-Bold")
  .text("Total:", summaryLabelX, summaryStartY + 70)
  .text(`${finalTotal.toFixed(2)}`, summaryValueX, summaryStartY + 70, { align: "right" });

  // 6. Footer Section
  const footerY = doc.page.height - 100;
  drawHorizontalLine(footerY);

  doc.fontSize(10).font("Helvetica")
    .text("Thank you for shopping with Shoppy Cart!", leftMargin, footerY + 15, {
      width: contentWidth,
      align: "center",
    })
    .text("Contact us at support@shoppycart.com", leftMargin, footerY + 30, {
      width: contentWidth,
      align: "center",
    });

  doc.end();
};
 
  // Usage example
  const getInvoice = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId).populate('products.productId');
      if (!order) {
        return res.status(404).send("Order not found");
      }

      // Generate the PDF and send it directly in the response
      generateInvoicePDF(order, res);
    } catch (error) {
      console.error("Error generating invoice PDF:", error.message);
      res.status(500).send("Failed to generate invoice PDF.");
    }
  };


module.exports = {
  //admin side

  orderManagement,
  orderStatus,

  //userside

  addToCart,
  loadCart,
  removeFromCart,
  updateCart,
  processCheckout,
  renderCheckout,
  addNewAddress,
  cancelOrder,
  returnOrder,
  validateCoupon,
  removeCoupon,
  processCheckout1,
  verifyPayment,
  orderSuccess,
  orderFailed,
  getInvoice,
  retryPayment,
  acceptReturn,
  rejectReturn,
  
};
