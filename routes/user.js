const express=require('express');
const router=express.Router();

const userController=require('../controller/userController');
const productController=require('../controller/productController')
const orderController=require('../controller/orderController')
const otherController=require('../controller/otherController')

const auth=require('../middleware/userAuth');

const passport=require('passport')

// Google Auth Routes
router.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/user/login?error=Authentication Failed' }),
  userController.googleLogin
);

//login
router.get('/login',auth.isLogin,userController.loadLogin);
router.post('/login',userController.loginUser);

//register
router.get('/signup',auth.isLogin,userController.loadRegister);
router.post('/signup',userController.registerUser);

//forgot password
router.get('/forgotPassword',auth.isLogin,userController.loadReset);
router.post('/forgotPassword',userController.resetPassword);

//otp generation
router.get('/sendotp',auth.isLogin,userController.loadOtpVerification);
router.post('/verifyotp',userController.verifyForgotPassword)

//otp verification
router.get('/verification',auth.isLogin,userController.loadVerification);
router.post('/verification',userController.verifyOTP);
router.post('/resendOtp',userController.resendOtp);

//user profile
router.get('/profile',auth.checkSession,userController.loadProfile);
router.post('/editProfile',auth.checkSession,userController.editProfile);
router.post('/addAddress',auth.checkSession,userController.addAddress);
router.post('/editAddress/:addressId',auth.checkSession,userController.editAddress);
router.post('/deleteAddress/:addressId',auth.checkSession,userController.deleteAddress);

//home page
router.get('/',auth.isLogin,productController.loadHome);
router.get('/home',auth.checkSession,productController.getHome)

//product
router.get('/productList',productController.getProducts);
router.get('/productDetails/:id',productController.productDetails);

//cart
router.post('/cart/addProducts/:product_id', auth.checkSession, orderController.addToCart);
router.get('/cart',auth.checkSession,orderController.loadCart);
router.post('/removeCart',auth.checkSession,orderController.removeFromCart);
router.post('/updateCart/:productId',auth.checkSession,orderController.updateCart);

//checkout
// router.post('/checkout',auth.checkSession,userController.checkout);
router.post('/addNewAddress',auth.checkSession,orderController.addNewAddress);

// POST: Process checkout
router.post('/checkout', auth.checkSession, orderController.processCheckout);

// GET: Render checkout page
router.get('/checkout', auth.checkSession, orderController.renderCheckout);

//order
router.post('/ordersCancel/:orderId', auth.checkSession, orderController.cancelOrder);
router.post('/ordersReturn/:orderId', auth.checkSession, orderController.returnOrder);
//wishlist
router.post('/addToWishlist/:product_id',auth.checkSession, otherController.addToWishlist);
router.get('/wishlist',auth.checkSession,otherController.wishlist);
// Route to remove item from wishlist
router.delete('/removeWishlist/:product_id', auth.checkSession, otherController.removeWishlist);
//move to cart
router.post('/moveToCart/:product_id',auth.checkSession, otherController.moveToCart);


//order new
router.post('/checkoutRazorpay',auth.checkSession, orderController.processCheckout1)
router.post('/verifyRazorpay', auth.checkSession, orderController.verifyPayment);


//wallet
router.get('/wallet',auth.checkSession,otherController.wallet);
router.get('/walletBalance',auth.checkSession, otherController.getWalletBalance);
router.post("/wallet/transaction", auth.checkSession, otherController.addWalletTransaction)

//coupon validation
router.post('/validateCoupon',auth.checkSession, orderController.validateCoupon);
router.post('/removeCoupon', auth.checkSession, orderController.removeCoupon);

router.get('/orderSuccess',auth.checkSession, orderController.orderSuccess)
router.get('/orderFailed',auth.checkSession, orderController.orderFailed)

router.get('/orders/:orderId/invoice',auth.checkSession,orderController.getInvoice)

router.get('/order-details/:orderId',auth.checkSession,orderController.retryPayment)
router.post('/verify-razorpay-payment',auth.checkSession, orderController.verifyPayment);


//distroy
router.get('/logout',auth.checkSession,userController.logout);

router.get('/checking',userController.checking);

module.exports=router;