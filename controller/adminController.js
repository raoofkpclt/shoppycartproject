const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const adminSchema = require("../model/adminModel");
const userSchema = require("../model/userModel");
const Order = require("../model/orderModel");

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
// const { Table } = require('pdfkit-table');
// const pdf = require('html-pdf')
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

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
    res.status(500).render("admin/login", {
      message: "Something went wrong. Please try again later.",
    });
  }
};

// Load Admin Home Page
const loadHome = async (req, res) => {
  try {
    const admin = req.session.admin;
    if (!admin) return res.redirect("/admin/login");

    res.render("admin/dash");
  } catch (error) {
    console.error("Error loading admin home:", error);
    res.status(500).send("Something went wrong.");
  }
};

const getDashboardData = async (req, res) => {
  try {
    const period = req.query.period || "monthly";
    let dateFilter;

    // Define date filter based on the selected period
    const now = new Date();
    let startDate = new Date(now); // Clone the current date

    switch (period) {
      case "daily":
        startDate.setDate(now.getDate() - 1);
        break;
      case "weekly":
        startDate.setDate(now.getDate() - 7);
        break;
      case "monthly":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "yearly":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = null;
    }

    if (startDate) {
      dateFilter = { $gte: startDate };
    }

    const matchFilter = {
      ...(dateFilter && { createdAt: dateFilter }),
      status: "delivered",
    };

    const salesSummary = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalSalesCount: { $sum: { $sum: "$products.quantity" } },
          totalRevenue: { $sum: "$totalAmount" },
          totalDiscount: { $sum: "$couponDiscount" },
        },
      },
    ]);

    const bestSellingProducts = await Order.aggregate([
      { $match: matchFilter },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalSold: { $sum: "$products.quantity" },
        },
      },

      { $sort: { totalSold: -1 } },

      { $limit: 10 },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },

      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          totalSold: 1,
          name: { $ifNull: ["$productInfo.product", "Unknown Product"] },
          brand: { $ifNull: ["$productInfo.brand", "Unknown Brand"] },
          productId: { $toString: "$_id" },
        },
      },
    ]);

    const bestSellingCategories = await Order.aggregate([
      { $match: matchFilter },

      { $unwind: "$products" },

      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },

      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "categories",
          localField: "productInfo.categoryId",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },

      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$categoryInfo.name",
          totalSold: { $sum: "$products.quantity" },
        },
      },

      { $sort: { totalSold: -1 } },

      { $limit: 10 },

      {
        $project: {
          _id: 0,
          categoryName: "$_id",
          totalSold: 1,
        },
      },
    ]);

    const bestSellingBrands = await Order.aggregate([
      { $match: matchFilter },
      { $unwind: "$products" },
      {
          $lookup: {
              from: "products",
              localField: "products.productId",
              foreignField: "_id",
              as: "productInfo",
          },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
          $group: {
              _id: "$productInfo.brand",
              totalSold: { $sum: "$products.quantity" },
          },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
          $project: {
              _id: 0,
              brandName: "$_id",
              totalSold: 1,
          },
      },
  ]);
    

    const dailyRevenue = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalUsers = await userSchema.countDocuments();

    res.json({
      salesSummary: salesSummary[0] || {
        totalSalesCount: 0,
        totalRevenue: 0,
        totalDiscount: 0,
      },
      bestSellingProducts,
      bestSellingCategories,
      bestSellingBrands,
      totalUsers,
      dailyRevenue,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

//user management page
const userManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalUser = await userSchema.countDocuments({});
    const userData = await userSchema.find({}).skip(skip).limit(limit);

    const totalPage = Math.ceil(totalUser / limit);
    res.render("admin/userManagement", {
      users: userData,
      currentPage: page,
      totalPages: totalPage,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("An error occurred");
  }
};

// user blocking
const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send("User ID is required");
    }
    await userSchema.findByIdAndUpdate(userId, { isBlocked: true });
    req.session.user = null;
    res.redirect("/admin/userManagement");
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).send("Server Error");
  }
};

// Unblock user
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send("User ID is required");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send("Invalid User ID format");
    }

    await userSchema.findByIdAndUpdate(userId, { isBlocked: false });
    res.redirect("/admin/userManagement");
  } catch (error) {
    console.log("Error unblocking user:", error);
    res.redirect("/admin/userManagement");
  }
};

// calculate sale summary
const calculateSalesSummary = async (salesData) => {
  return {
    totalOrders: salesData.length,
    totalSales: salesData.reduce((sum, order) => sum + order.totalAmount, 0),
    totalDiscount: salesData.reduce(
      (sum, order) => sum + (order.couponDiscount || 0),
      0
    ),
    averageOrderValue:
      salesData.length > 0
        ? salesData.reduce((sum, order) => sum + order.totalAmount, 0) /
          salesData.length
        : 0,
  };
};

// Remove the salesController object and directly export individual functions
const renderSalesReport = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get initial daily sales data
    const salesData = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["cancelled"] },
    })
      .populate("user", "name")
      .populate("products.productId");

    // Calculate summary statistics
    const summary = await calculateSalesSummary(salesData);

    res.render("admin/report", {
      sales: salesData,
      summary,
      reportType: "daily",
    });
  } catch (error) {
    console.error("Error rendering sales report:", error);
    res.status(500).send("Error loading sales report");
  }
};

//get sale repport
const getSalesReport = async (req, res) => {
  console.log("Full Request Body:", req.body);
  console.log("Report Type:", req.body.reportType);

  try {
    const { reportType, startDate, endDate } = req.body;

    // Validate report type
    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
      });
    }

    // Determine date range based on report type
    let dateQuery = {
      // Only include delivered orders
      status: "delivered",
    };
    const now = new Date();

    switch (reportType) {
      case "daily":
        dateQuery.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;

      case "weekly":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateQuery.createdAt = {
          $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
        break;

      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateQuery.createdAt = {
          $gte: startOfMonth,
          $lte: new Date(),
        };
        break;

      case "custom":
        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "Start and end dates are required for custom report",
          });
        }
        dateQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    // Fetch sales data
    const salesData = await Order.find(dateQuery)
      .populate("user", "name email")
      .populate("products.productId")
      .sort({ createdAt: -1 });

    console.log("data is:", salesData);
    // Calculate summary
    const summary = await calculateSalesSummary(salesData);

    // Return response
    res.json({
      success: true,
      sales: salesData,
      summary,
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).json({
      success: false,
      message: "Error generating sales report",
      error: error.message,
    });
  }
};

const downloadExcel = async (req, res) => {
  try {
    console.log("Excel Download Query:", req.query);

    const { reportType, startDate, endDate } = req.query;

    // Determine date range based on report type
    let dateQuery = {};
    const now = new Date();

    switch (reportType) {
      case "daily":
        dateQuery.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateQuery.createdAt = {
          $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateQuery.createdAt = {
          $gte: startOfMonth,
          $lte: new Date(),
        };
        break;
      case "custom":
        if (startDate && endDate) {
          dateQuery.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          };
        }
        break;
    }

    // Fetch sales data with populated references
    const orders = await Order.find(dateQuery)
      .populate("products.productId", "product brand")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // Generate Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Add headers
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Shipping Address", key: "shippingAddress", width: 40 },
      { header: "Products", key: "products", width: 50 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Coupon Discount", key: "couponDiscount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    // Add data rows
    orders.forEach((order) => {
      worksheet.addRow({
        orderId: order._id,
        date: new Date(order.createdAt).toLocaleDateString(),
        customer: order.user
          ? `${order.user.name} (${order.user.email})`
          : "N/A",
        shippingAddress: order.shippingAddress,
        products: order.products
          .map(
            (item) =>
              `${
                item.productId
                  ? `${item.productId.product} (${item.productId.brand})`
                  : "N/A"
              } - ${item.quantity} pcs @ ₹${item.price}`
          )
          .join(", "),
        totalAmount: `₹${order.totalAmount.toFixed(2)}`,
        couponDiscount: `₹${order.couponDiscount.toFixed(2)}`,
        finalAmount: `₹${(order.totalAmount - order.couponDiscount).toFixed(
          2
        )}`,
        paymentMethod: order.paymentMethod.toUpperCase(),
        status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
      });
    });

    // Add summary rows
    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalDiscount = orders.reduce(
      (sum, order) => sum + (order.couponDiscount || 0),
      0
    );
    const finalAmount = totalAmount - totalDiscount;

    worksheet.addRow({});
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", totalOrders]);
    worksheet.addRow(["Total Sales", `₹${totalAmount.toFixed(2)}`]);
    worksheet.addRow(["Total Discount", `₹${totalDiscount.toFixed(2)}`]);
    worksheet.addRow(["Net Sales", `₹${finalAmount.toFixed(2)}`]);

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Excel Download Error:", error);
    res.status(500).send("Error generating Excel: " + error.message);
  }
};

// Download pdf file
const downloadPDF = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    // Validate report type
    if (!reportType) {
      return res
        .status(400)
        .json({ success: false, message: "Report type is required." });
    }

    // Construct date query
    const now = new Date();
    let dateQuery = { status: "delivered" };

    switch (reportType) {
      case "daily":
        dateQuery.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateQuery.createdAt = {
          $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateQuery.createdAt = {
          $gte: startOfMonth,
          $lte: new Date(),
        };
        break;
      case "custom":
        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: "Start and end dates are required for custom reports.",
          });
        }
        dateQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid report type." });
    }

    // Fetch sales data
    const salesData = await Order.find(dateQuery)
      .populate("user", "name email") // Populate user info
      .populate("products.productId", "product price") // Populate product info
      .sort({ createdAt: -1 });

    if (!salesData.length) {
      return res.status(404).json({
        success: false,
        message: "No sales data found for the specified period.",
      });
    }

    // Create a new PDF document
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text("Sales Report", 105, 10, { align: "center" });

    // Metadata
    doc.setFontSize(10);
    doc.text(`Report Type: ${reportType}`, 14, 20);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 25);

    // Table data
    const tableData = salesData.map((order) => [
      order._id,
      order.user ? order.user.name : "N/A",
      order.products.map((product) => product.name).join(", "),
      order.totalAmount.toFixed(2),
      order.couponDiscount ? order.couponDiscount.toFixed(2) : "0.00",
      (order.totalAmount - (order.couponDiscount || 0)).toFixed(2),
      order.paymentMethod.toUpperCase(),
      new Date(order.createdAt).toLocaleString(),
    ]);

    // Table headers
    doc.autoTable({
      startY: 30,
      head: [
        [
          "Order ID",
          "Customer",
          "Products",
          "Total Amount",
          "Discount",
          "Final Amount",
          "Payment Method",
          "Order Date",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    // Summary
    const totalSales = salesData
      .reduce((acc, order) => acc + order.totalAmount, 0)
      .toFixed(2);
    const totalDiscount = salesData
      .reduce((acc, order) => acc + (order.couponDiscount || 0), 0)
      .toFixed(2);
    const totalOrders = salesData.length;

    doc.addPage();
    doc.text("Sales Summary", 105, 10, { align: "center" });
    doc.autoTable({
      startY: 20,
      head: [["Metric", "Value"]],
      body: [
        ["Total Orders", totalOrders],
        ["Total Sales", `${totalSales}/-`],
        ["Total Discount", `${totalDiscount}/-`],
      ],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
    });

    // Generate PDF Buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.pdf`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      success: false,
      message: "Error generating PDF",
      error: error.message,
    });
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
  getDashboardData,
  logout,
  userManagement,
  blockUser,
  unblockUser,
  renderSalesReport,
  getSalesReport,
  downloadExcel,
  downloadPDF,
};
