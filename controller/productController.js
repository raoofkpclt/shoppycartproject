const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
//schema
const Category = require("../model/categoryModel");
const Product = require("../model/productModel");
const Cart = require("../model/cartModel");
const Offer = require("../model/offerModal");

// Display product management page
const productManagement = async (req, res) => {
  try {
    const { message, error } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const product = await Product.find({ isActive: true })
      .populate("categoryId")
      .skip(skip)
      .limit(limit)
      .sort({_id:-1})

    const totalProduct = await Product.countDocuments({ isActive: true });
    const totalPages = Math.ceil(totalProduct / limit);

    const categories = await Category.find({ isActive: true });

    res.render("admin/productManagement", {
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
    res.redirect("/admin/productManagement?error=Error fetching products");
  }
};

// Add product
const addProduct = async (req, res) => {
  try {
    console.log("1");
    const { product, brand, categoryId, price, stock, description } =
      req.body;
    const images = req.files;
    console.log(req.body);

    if (
      !product ||
      !brand ||
      !categoryId ||
      !price ||
      !stock ||
      !description ||
      images.length < 3
    ) {
      console.log("checking");
      return res.redirect(
        "/admin/productManagement?error=All fields and at least 3 images are required"
      );
    }
    console.log("2");
    const newProduct = new Product({
      product,
      brand,
      categoryId,
      price: parseFloat(price),
      stock: parseInt(stock),
      description,
      images: images.map((img) => img.filename),
    });
    console.log("3");

    await newProduct.save();
    console.log("4");
    res.redirect("/admin/productManagement?message=Product added successfully");
  } catch (err) {
    console.log("5");
    console.error(err);
    res.redirect("/admin/productManagement?error=Error adding product");
  }
};

// Edit product
const editProduct = async (req, res) => {
  try {
    const { id, product, brand, categoryId, price, stock, description } =
      req.body;
    const images = req.files;

    console.log(product);

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.redirect("/admin/productManagement?error=Product not found");
    }

    existingProduct.product = product || existingProduct.product;
    existingProduct.brand = brand || existingProduct.brand;
    existingProduct.categoryId = categoryId || existingProduct.categoryId;
    existingProduct.price = price || existingProduct.price;
    existingProduct.stock = stock || existingProduct.stock;
    existingProduct.description = description || existingProduct.description;

    if (images && images.length > 0) {
      images.forEach((image, index) => {
        if (image) {
          const imagePath = path.join(
            __dirname,
            "../uploads",
            existingProduct.images[index]
          );
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
          existingProduct.images[index] = image.filename;
        }
      });
    }

    await existingProduct.save();
    res.redirect(
      "/admin/productManagement?message=Product updated successfully"
    );
  } catch (err) {
    console.error(err);
    res.redirect("/admin/productManagement?error=Error updating product");
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect("/admin/productManagement?error=Product not found");
    }

    // product.isActive = false;
    // await product.save();
    // console.log('done');
    await Product.findByIdAndDelete(id);

    res.redirect(
      "/admin/productManagement?message=Product deleted successfully"
    );
  } catch (error) {
    console.error(error);
    res.redirect("/admin/productManagement?error=Error deleting product");
  }
};

//--------------------------------------------------  admin side end ----------------------------------------------------

// home page with login
const getHome = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const products = await Product.find({ isActive: true })
      .populate("categoryId", "name")
      .skip(2)
      .limit(8);

    // Render the page
    res.render("user/home", {
      products,
      userId,
    });
  } catch (error) {
    console.error("Error fetching home page data:", error);
    req.flash(
      "error",
      "An unexpected error occurred while loading the home page."
    );
    res.redirect("/error");
  }
};

// load home page without login
const loadHome = async (req, res) => {
  try {
    const product = await Product.find({ isActive: true })
      .populate("categoryId", "name")
      .skip(2)
      .limit(8);

    // const categories = await Category.find({ isActive: true });
    console.log(product);

    res.render("user/loadHome", { product });
  } catch (error) {
    console.error("Error fetching products or categories:", error);
  }
};

// get products
const getProducts = async (req, res) => {
  try {
    const { sort, category, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const filter = { isActive: true };
    const limit = 12;
    const skip = (page - 1) * limit;
    const userId = req.session.user?.id;

    const cart = await Cart.findOne({ userId: userId }, { items: 1 });
    const itemCount = cart ? cart.items.length : 0;

    if (category && category !== "all") {
      filter.categoryId = category;
    }

    if (search) {
      filter.$or = [
        { product: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    let sortCriteria = {};
    switch (sort) {
      case "popularity":
        sortCriteria.popularity = -1;
        break;
      case "price-low-high":
        sortCriteria.price = 1;
        break;
      case "price-high-low":
        sortCriteria.price = -1;
        break;
      case "average-ratings":
        sortCriteria.averageRating = -1;
        break;
      case "featured":
        sortCriteria.isFeatured = -1;
        break;
      case "new-arrivals":
        sortCriteria.createdAt = -1;
        break;
      case "a-z":
        sortCriteria.product = 1;
        break;
      case "z-a":
        sortCriteria.product = -1;
        break;
      case "in-stock":
        filter.stock = { $gt: 0 };
        break;
    }

    const offers = await Offer.find({ isActive: true });

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .populate("categoryId", "name"),
      Product.countDocuments(filter),
    ]);
    const totalPage = Math.ceil(totalProducts / limit);

    const currentDate = new Date();
    const productsWithOffers = await Promise.all(
      products.map(async (product) => {
        let maxDiscountedPrice = product.price;
        let hasDiscount = false;

        offers.forEach((offer) => {
          const isOfferActive =
            !offer.validUntil || offer.validUntil > currentDate;
          const isProductEligible = offer.applicableProducts.some((id) =>
            id.equals(product._id)
          );

          const isCategoryEligible = offer.applicableCategories.some((id) =>
            id.equals(product.categoryId?._id)
          );

          if (isOfferActive && (isProductEligible || isCategoryEligible)) {
            const calculatedDiscountedPrice =
              product.price - product.price * (offer.discount / 100);

            if (calculatedDiscountedPrice < maxDiscountedPrice) {
              maxDiscountedPrice = calculatedDiscountedPrice;
              hasDiscount = true;
            }
          }
        });

        maxDiscountedPrice = Math.round(maxDiscountedPrice);

        product.discountPrice = maxDiscountedPrice;

        await product.save();

        return {
          ...product.toObject(),
          discountedPrice: maxDiscountedPrice,
          hasDiscount,
        };
      })
    );

    res.render("user/productList", {
      products: productsWithOffers,
      categories: await Category.find({ isActive: true }),
      currentPage: page,
      totalPages: totalPage,
      category,
      itemCount,
      search,
      sort,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Error fetching products");
  }
};

//product details page
const productDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Bad request" });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    }).populate("categoryId");

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const offers = await Offer.find({ isActive: true });

    let discountedPrice = product.price;
    let discountPercentage = 0;
    let hasDiscount = false;

    offers.forEach((offer) => {
      const isProductEligible = offer.applicableProducts.includes(
        product._id.toString()
      );
      const isCategoryEligible = offer.applicableCategories.includes(
        product.categoryId?._id.toString()
      );

      if (isProductEligible || isCategoryEligible) {
        discountedPrice =
          product.price - product.price * (offer.discount / 100);
        discountPercentage = offer.discount;
        hasDiscount = true;
      }
    });

    discountedPrice = Math.round(discountedPrice);

    // Create product object with offer details
    const productWithOffer = {
      ...product.toObject(),
      discountedPrice,
      discountPercentage,
      hasDiscount,
      offers,
    };

    const relatedProducts = await Product.find({
      isActive: true,
      _id: { $ne: productId },
    })
      .limit(6)
      .lean();

    res.render("user/productDetails", {
      product: productWithOffer,
      relatedProducts,
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).send("Server error");
  }
};

module.exports = {
  //admin side

  productManagement,
  addProduct,
  editProduct,
  deleteProduct,

  //userside

  loadHome,
  getHome,
  getProducts,
  productDetails,
};
