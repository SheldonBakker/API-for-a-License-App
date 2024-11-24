const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Create driver license
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, idNumber, expiryDate } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !idNumber || !expiryDate) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check if ID number already exists
    const [existingDrivers] = await db.query(
      "SELECT id FROM drivers WHERE id_number = ?",
      [idNumber]
    );

    if (existingDrivers.length > 0) {
      return res.status(409).json({
        message: "Driver with this ID number already exists",
      });
    }

    // Insert new driver
    const [result] = await db.query(
      `INSERT INTO drivers (user_id, first_name, last_name, id_number, expiry_date)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, firstName, lastName, idNumber, expiryDate]
    );

    res.status(201).json({
      message: "Driver license added successfully",
      driver: {
        id: result.insertId,
        firstName,
        lastName,
        idNumber,
        expiryDate,
      },
    });
  } catch (error) {
    console.error("Driver creation error:", error);
    res.status(500).json({
      message: "Failed to add driver license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get all drivers for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [drivers] = await db.query(
      `SELECT id, first_name, last_name, id_number, expiry_date, created_at
       FROM drivers 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ drivers });
  } catch (error) {
    console.error("Fetch drivers error:", error);
    res.status(500).json({
      message: "Failed to fetch drivers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
