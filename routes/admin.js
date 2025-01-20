const express=require('express');
const router=express.Router();

const adminController=require('../controller/adminController');
const productController=require('../controller/productController')
const categoryController=require('../controller/categoryController')
const orderController=require('../controller/orderController')
const otherController=require('../controller/otherController')

const adminAuth=require('../middleware/adminAuth')

const multer = require('multer');
const upload=require('../config/multerConfig');

//login routers
router.get('/login',adminAuth.isLogin,adminController.loadlogin);
router.post('/login',adminController.login)

//load dashbord
router.get('/dash',adminAuth.checkSession,adminController.loadHome)
router.get('/dashboard-data',adminAuth.checkSession,adminController.getDashboardData)

//user management
router.get('/userManagement',adminAuth.checkSession,adminController.userManagement)
router.post('/blockUser',adminController.blockUser)
router.post('/unblockUser',adminController.unblockUser);

//category management
router.get('/categoryManagement',adminAuth.checkSession,categoryController.categoryManagement);
router.get('/addCategory',adminAuth.checkSession,categoryController.createCategory)
router.post('/addCategory',categoryController.addCategory)
router.post('/deleteCategory',categoryController.deleteCategory)
router.post('/activeCategory',categoryController.activeCategory)
router.get('/editCategory/:id',adminAuth.checkSession,categoryController.loadEditCategory)
router.post('/editCategory/:id',categoryController.editCategory)

//product management
router.get('/productManagement',adminAuth.checkSession,productController.productManagement);
router.post('/addProduct',upload.array('images', 3),productController.addProduct);
router.post('/editProduct',upload.array('images', 12),productController.editProduct);
router.post('/deleteProduct/:id', productController.deleteProduct);

//order management
router.get('/orderManagement',adminAuth.checkSession,orderController.orderManagement);
router.post('/changeOrderStatus/:id',adminAuth.checkSession,orderController.orderStatus);
router.post('/acceptReturn/:orderId',adminAuth.checkSession, orderController.acceptReturn);
router.post('/rejectReturn/:orderId', adminAuth.checkSession,orderController.rejectReturn);

//coupon management
router.get('/couponManagement',adminAuth.checkSession,otherController.couponManagement);
router.post('/addCoupon',otherController.addCoupon);
router.post('/deleteCoupon/:id',otherController.deleteCoupon);

//offer Management
router.get('/offerManagement',adminAuth.checkSession,otherController.offerManagement);
router.post('/addOffer',otherController.addOffer);
router.post('/deleteOffer/:id',otherController.deleteOffer);


//sale reports
router.get('/salesReport', adminAuth.checkSession, adminController.renderSalesReport);
router.post('/getSalesReport',  adminController.getSalesReport);
router.get('/downloadSalesReport/pdf', adminController.downloadPDF);
router.get('/downloadSalesReport/excel', adminController.downloadExcel);

//logout router
router.get('/logout',adminAuth.checkSession,adminController.logout)


module.exports=router;