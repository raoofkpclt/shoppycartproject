const mongoose = require("mongoose");
const Category = require("../model/categoryModel");


//category management
const categoryManagement = async (req, res) => {
  try {
    const { message, error } = req.body;
    const categories = await Category.find({});
    res.render("admin/categoryManagement", { categories, message, error });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

//load create category
const createCategory = async (req, res) => {
  try {
    res.render("admin/addCategory");
  } catch (error) {
    console.log(error);
  }
};

//add category page
const addCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Trim the input to remove leading and trailing spaces
    const trimmedName = name.trim();

    // Check if the category name is empty after trimming
    if (!trimmedName) {
      return res.redirect(
        "/admin/categoryManagement?error=Category name cannot be empty or only spaces."
      );
    }

    // Check for duplicate category
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });
    if (existing) {
      return res.redirect(
        "/admin/categoryManagement?error=Category with this title already exists"
      );
    }

    // Validate the category name to allow only letters and spaces
    const validNamePattern = /^[A-Za-z\s]+$/;
    if (!validNamePattern.test(trimmedName)) {
      return res.redirect(
        "/admin/categoryManagement?error=Category name can only contain letters and spaces."
      );
    }

    // Create and save the new category
    const newCategory = new Category({ name: trimmedName });
    await newCategory.save();
    res.redirect("/admin/categoryManagement?message=Category Added");
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Error adding category" });
  }
};

///load edit category
const loadEditCategory = async (req, res) => {
  try {
    const { message, error } = req.query;
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect(
        "/admin/categoryManagement?error=Invalid category ID."
      );
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.redirect("/admin/categoryManagement?error=Category not found");
    }

    res.render("admin/editCategory", { category, message, error });
  } catch (error) {
    console.error("Error loading edit category page:", error);
    res.redirect(
      "/admin/categoryManagement?error=Server error while loading category."
    );
  }
};

//edit category
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect(
        "/admin/categoryManagement?error=Invalid category ID."
      );
    }

    // Validate name
    const validNamePattern = /^[A-Za-z\s ]+$/;
    if (!name || !validNamePattern.test(name.trim())) {
      return res.redirect(
        `/admin/editCategory/${id}?error=Category name must contain only letters and spaces.`
      );
    }

    const trimmedName = name.trim();

    // Check if category exists
    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return res.redirect(
        "/admin/categoryManagement?error=Category not found."
      );
    }

    // Check if the name has actually changed
    if (
      existingCategory.name.trim().toLowerCase() === trimmedName.toLowerCase()
    ) {
      return res.redirect(
        `/admin/editCategory/${id}?error=No changes made to the category name.`
      );
    }

    // Check for duplicates
    const duplicateCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      _id: { $ne: id },
    });

    if (duplicateCategory) {
      return res.redirect(
        `/admin/editCategory/${id}?error=Category with this name already exists.`
      );
    }

    await Category.findByIdAndUpdate(id, { name: trimmedName }, { new: true });

    res.redirect(
      "/admin/categoryManagement?message=Category updated successfully."
    );
  } catch (error) {
    console.error("Error updating category:", error);
    res.redirect(
      `/admin/editCategory/${req.params.id}?error=Server error while updating category.`
    );
  }
};

//delete category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.render(
        "admin/categoryManagement?error=Category ID is required"
      );
    }
    await Category.findByIdAndUpdate(categoryId, { isActive: false });
    res.redirect(
      "/admin/categoryManagement?message=Category deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    res.render("admin/categoryManagement?error=Error deleting category");
  }
};

//active category
const activeCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).send("Category ID is required");
    }
    await Category.findByIdAndUpdate(categoryId, { isActive: true });
    res.redirect(
      "/admin/categoryManagement?message=Category activated successfully"
    );
  } catch (error) {
    console.error("Error activating category:", error);
    res.status(500).send("Server Error");
  }
};

//--------------------------------------------------  admin side end ----------------------------------------------------

module.exports = {
  //admin side

  categoryManagement,
  addCategory,
  createCategory,
  loadEditCategory,
  editCategory,
  deleteCategory,
  activeCategory,

  //userside
};
