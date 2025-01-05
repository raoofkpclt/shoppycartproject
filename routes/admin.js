const express=require('express');
const router=express.Router();
const adminController=require('../controller/adminController');
const adminAuth=require('../middleware/adminAuth')
const multer = require('multer');
const upload=require('../config/multerConfig');

//login routers
router.get('/login',adminAuth.isLogin,adminController.loadlogin);
router.post('/login',adminController.login)

//load dashbord
router.get('/dash',adminAuth.checkSession,adminController.loadHome)

//user management
router.get('/userManagement',adminAuth.checkSession,adminController.userManagement)
router.post('/blockUser',adminController.blockUser)
router.post('/unblockUser',adminController.unblockUser);

//category management
router.get('/categoryManagement',adminAuth.checkSession,adminController.categoryManagement);
router.get('/addCategory',adminAuth.checkSession,adminController.createCategory)
router.post('/addCategory',adminController.addCategory)
router.post('/deleteCategory',adminController.deleteCategory)
router.post('/activeCategory',adminController.activeCategory)
router.get('/editCategory/:id',adminAuth.checkSession,adminController.loadEditCategory)
router.post('/editCategory/:id',adminController.editCategory)

//product management
router.get('/productManagement',adminAuth.checkSession,adminController.productManagement);
router.post('/addProduct',upload.array('images', 3),adminController.addProduct);
router.post('/editProduct',upload.array('images', 12),adminController.editProduct);
router.post('/deleteProduct/:id', adminController.deleteProduct);

//order management
router.get('/orderManagement',adminAuth.checkSession,adminController.orderManagement);
router.post('/changeOrderStatus/:id',adminAuth.checkSession,adminController.orderStatus);

//logout router
router.get('/logout',adminAuth.checkSession,adminController.logout)


module.exports=router;