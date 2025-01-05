const express=require('express');
const router=express.Router();
const userController=require('../controller/userController');
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

//home page
router.get('/',auth.isLogin,userController.loadHome);
router.get('/home',auth.checkSession,userController.getHome)

//login
router.get('/login',auth.isLogin,userController.loadLogin);
router.post('/login',userController.loginUser);

//register
router.get('/signup',auth.isLogin,userController.loadRegister);
router.post('/signup',userController.registerUser);

//forgot password
router.get('/forgotPassword',auth.isLogin,userController.loadReset);
router.post('/forgotPassword',userController.resetPassword);

//otp verification
router.get('/verification',auth.isLogin,userController.loadVerification);
router.post('/verification',userController.verifyOTP);
router.post('/resendOtp',userController.resendOtp);

//product
router.get('/productList',userController.getProducts);
router.get('/productDetails/:id',userController.productDetails);
router.post('/cart/addProducts/:product_id', auth.checkSession, userController.addToCart);

//cart
router.get('/cart',auth.checkSession,userController.loadCart);
router.post('/removeCart',auth.checkSession,userController.removeFromCart);
router.post('/updateCart/:productId',auth.checkSession,userController.updateCart);

//checkout
router.post('/checkout',auth.checkSession,userController.checkout);
router.post('/addNewAddress',auth.checkSession,userController.addNewAddress);

//order
router.post('/order',auth.checkSession,userController.checkoutCOD);
router.post('/ordersCancel/:orderId', auth.checkSession, userController.cancelOrder);

//user profile
router.get('/profile',auth.checkSession,userController.loadProfile);
router.post('/editProfile',auth.checkSession,userController.editProfile);
router.post('/addAddress',auth.checkSession,userController.addAddress);
router.post('/editAddress/:addressId',auth.checkSession,userController.editAddress);
router.post('/deleteAddress/:addressId',auth.checkSession,userController.deleteAddress);

//distroy
router.get('/logout',auth.checkSession,userController.logout);

router.get('/checking',userController.checking);

module.exports=router;