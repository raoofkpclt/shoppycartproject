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


//distroy
router.get('/logout',auth.checkSession,userController.logout);

module.exports=router;