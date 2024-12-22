const adminSchema = require("../model/adminModel");
const bcrypt = require("bcrypt");
const userSchema = require("../model/userModel");
const mongoose= require('mongoose')
const Category=require('../model/categoryModel');
const Product=require('../model/productModel');
const path=require('path')
const fs=require('fs');

// Load Admin Login Page
const loadlogin = async (req, res) => {
    res.render("admin/login");
};

// Handle Admin Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await adminSchema.findOne({ email });
        console.log(req.body);

        if (!admin) {
            return res.render("admin/login", { message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render("admin/login", { message: "Invalid credentials" });
        }

        req.session.admin = true; 
        res.redirect("/admin/dash");
    } catch (error) {
        console.error("Error during admin login:", error);
        res.status(500).render("admin/login", { message: "Something went wrong. Please try again later." });
    }
};

// Load Admin Home Page
const loadHome = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect("/admin/login");

        const users = await userSchema.find({}); 
        res.render("admin/dash", { users });
    } catch (error) {
        console.error("Error loading admin home:", error);
        res.status(500).send("Something went wrong.");
    }
};

//user management page 
const userManagement=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const limit=20;
        const skip=(page-1)*limit;

        const totalUser=await userSchema.countDocuments({});
        const userData=await userSchema.find({}).skip(skip).limit(limit);

        const totalPage=Math.ceil(totalUser/limit);
        res.render('admin/userManagement',{
            users:userData,
            currentPage:page,
            totalPages:totalPage
        })
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('An error occurred');
    }
};

// user blocking
const blockUser=async(req,res)=>{
    try {
        const {userId}=req.body;

        if(!userId){
            return res.status(400).send('User ID is required');
        }
        await userSchema.findByIdAndUpdate(userId,{isBlocked:true});
        req.session.user=null;
        res.redirect('/admin/userManagement')
        
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Server Error');
    }
}

const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; 

        if (!userId) {
            return res.status(400).send('User ID is required');
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid User ID format');
        }

        await userSchema.findByIdAndUpdate(userId, { isBlocked: false });
        res.redirect('/admin/userManagement');
    } catch (error) {
        console.log('Error unblocking user:', error);
        res.redirect('/admin/userManagement');
    }
};

//category management
const categoryManagement=async (req,res) => {
    try {
        const {message,error}=req.body
        const categories=await Category.find({})
        res.render('admin/categoryManagement' ,{categories,message,error});
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
        
    }
};

//load create category
const createCategory=async (req,res) => {
    try {
        res.render('admin/addCategory')
    } catch (error) {
        console.log(error);
    }
}

//add category page 
const addCategory = async (req, res) => {
    try {
        const { name } = req.body;

        // Trim the input to remove leading and trailing spaces
        const trimmedName = name.trim();

        // Check if the category name is empty after trimming
        if (!trimmedName) {
            return res.redirect('/admin/categoryManagement?error=Category name cannot be empty or only spaces.');
        }

        // Check for duplicate category
        const existing = await Category.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
        if (existing) {
            return res.redirect('/admin/categoryManagement?error=Category with this title already exists');
        }

        // Validate the category name to allow only letters and spaces
        const validNamePattern = /^[A-Za-z\s]+$/;
        if (!validNamePattern.test(trimmedName)) {
            return res.redirect('/admin/categoryManagement?error=Category name can only contain letters and spaces.');
        }

        // Create and save the new category
        const newCategory = new Category({ name: trimmedName });
        await newCategory.save();
        res.redirect('/admin/categoryManagement?message=Category Added');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ message: 'Error adding category' });
    }
};

///load edit category
const loadEditCategory = async (req, res) => {
    try {
        const { message, error } = req.query;
        const { id } = req.params;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.redirect('/admin/categoryManagement?error=Invalid category ID.');
        }

        const category = await Category.findById(id);

        if (!category) {
            return res.redirect('/admin/categoryManagement?error=Category not found');
        }

        res.render('admin/editCategory', { category, message, error });
    } catch (error) {
        console.error('Error loading edit category page:', error);
        res.redirect('/admin/categoryManagement?error=Server error while loading category.');
    }
};

//edit category
const editCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.redirect('/admin/categoryManagement?error=Invalid category ID.');
        }

        // Validate name
        const validNamePattern =  /^[A-Za-z\s ]+$/;
        if (!name || !validNamePattern.test(name.trim())) {
            return res.redirect(`/admin/editCategory/${id}?error=Category name must contain only letters and spaces.`);
        }

        const trimmedName = name.trim();

        // Check if category exists
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.redirect('/admin/categoryManagement?error=Category not found.');
        }

        // Check if the name has actually changed
        if (existingCategory.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
            return res.redirect(`/admin/editCategory/${id}?error=No changes made to the category name.`);
        }

        // Check for duplicates
        const duplicateCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            _id: { $ne: id },
        });

        if (duplicateCategory) {
            return res.redirect(`/admin/editCategory/${id}?error=Category with this name already exists.`);
        }

        // Update the category
        await Category.findByIdAndUpdate(id, { name: trimmedName }, { new: true });

        res.redirect('/admin/categoryManagement?message=Category updated successfully.');
    } catch (error) {
        console.error('Error updating category:', error);
        res.redirect(`/admin/editCategory/${req.params.id}?error=Server error while updating category.`);
    }
};

const deleteCategory=async (req,res) => {
    try {
        const categoryId = req.params.id;
        
        if (!categoryId) {
            console.error('Category ID is missing!');
            return res.status(400).json({ message: 'Category ID is required' });
        }

        // await Category.findByIdAndUpdate(categoryId, { isActive: false });
        await Category.findByIdAndDelete(categoryId);
        
        res.redirect('/admin/categoryManagement?message=Category+Deleted');
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

// Display product management page
const productManagement = async (req, res) => {
    try {
        const { message, error } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const product = await Product.find({ isActive: true })
            .populate('categoryId')
            .skip(skip)
            .limit(limit);

        const totalProduct = await Product.countDocuments({ isActive: true });
        const totalPages = Math.ceil(totalProduct / limit);

        const categories = await Category.find({ isActive: true });

        res.render('admin/productManagement', {
            product,
            message,
            error,
            currentPage: page,
            totalPages,
            limit,
            categories,
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/productManagement?error=Error fetching products');
    }
};

//product page
const addProduct = async (req, res) => {
    try {
        const { product, brand, categoryId, price, stock, description } = req.body;
        const images = req.files; 
        const getproduct=req.body
        console.log(getproduct);
        if (!product || !brand || !categoryId || !price || !stock || !description) {
            return res.redirect('/admin/productManagement?error=All fields are required');
        }

        if (isNaN(price) || price <= 0) {
            return res.redirect('/admin/productManagement?error=Price must be a positive number');
        }

        if (isNaN(stock) || stock < 0) {
            return res.redirect('/admin/productManagement?error=Stock must be a non-negative number');
        }

        if (!images || images.length === 0) {
            return res.redirect('/admin/productManagement?error=At least one image is required');
        }

        const existingProduct = await Product.findOne({ product});
        if (existingProduct) {
            return res.redirect('/admin/productManagement?error=Product with this name already exists');
        }
        console.log('get offer something');

        const newProduct = new Product({
            product: product,
            brand: brand,
            categoryId: categoryId,
            price: price,
            stock: stock,
            description: description,
            images: images.map((img) => img.filename), // Store image filenames
        });

        await newProduct.save();
        res.redirect('/admin/productManagement?message=Product added successfully');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/productManagement?error=Error adding product');
    }
};

// Edit product
const editProduct = async (req, res) => {
    try {
        const { id, name, brand, categoryId, price, stock, description } = req.body;
        const images = req.files;

        const product = await Product.findById(id);
        if (!product) {
            return res.redirect('/admin/productManagement?error=Product not found');
        }

        product.name = name || product.name;
        product.brand = brand || product.brand;
        product.categoryId = categoryId || product.categoryId;
        product.price = price || product.price;
        product.stock = stock || product.stock;
        product.description = description || product.description;

        if (images && images.length > 0) {
            // Remove old images
            product.images.forEach((image) => {
                const imagePath = path.join(__dirname, '../uploads', image);
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error(`Error deleting image: ${imagePath}`, err);
                    }
                });
            });
            product.images = images.map((img) => img.filename);
        }

        await product.save();
        res.redirect('/admin/productManagement?message=Product updated successfully');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/productManagement?error=Error updating product');
    }
};

// Delete product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(id);

        const product = await Product.findById(id);
        if (!product) {
            return res.redirect('/admin/productManagement?error=Product not found');
        }

        product.isActive = false;
        await product.save();
        console.log('done');

        res.redirect('/admin/productManagement?message=Product deleted successfully');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/productManagement?error=Error deleting product');
    }
};

// Handle Admin Logout
const logout = async (req, res) => {
    req.session.admin = null; 
    res.redirect("/admin/login");
};

module.exports = {
    loadlogin,
    login,
    loadHome,
    logout,
    userManagement,
    blockUser,
    unblockUser,
    productManagement,
    categoryManagement,
    createCategory,
    addCategory,
    loadEditCategory,
    editCategory,
    deleteCategory,
    productManagement,
    addProduct,
    editProduct,
    deleteProduct

};
