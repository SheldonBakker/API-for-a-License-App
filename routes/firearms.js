const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Create firearm license
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      first_name,
      last_name,
      make_model,
      caliber,
      registration_number,
      expiry_date,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      first_name,
      last_name,
      make_model,
      caliber,
      registration_number,
      expiry_date,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || !value.trim()) {
        return res.status(400).json({
          message: `${field.replace(/_/g, " ")} is required`,
        });
      }
    }

    // Check if registration number already exists
    const [existingFirearms] = await db.query(
      "SELECT id FROM firearms WHERE registration_number = ?",
      [registration_number]
    );

    if (existingFirearms.length > 0) {
      return res.status(409).json({
        message: "Firearm with this registration number already exists",
      });
    }

    // Insert new firearm
    const [result] = await db.query(
      `INSERT INTO firearms (
        user_id, 
        first_name, 
        last_name, 
        make_model, 
        caliber, 
        registration_number, 
        expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        first_name,
        last_name,
        make_model,
        caliber,
        registration_number,
        expiry_date,
      ]
    );

    res.status(201).json({
      message: "Firearm license added successfully",
      firearm: {
        id: result.insertId,
        first_name,
        last_name,
        make_model,
        caliber,
        registration_number,
        expiry_date,
      },
    });
  } catch (error) {
    console.error("Firearm creation error:", error);
    res.status(500).json({
      message: "Failed to add firearm license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get all firearms for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [firearms] = await db.query(
      `SELECT 
        id,
        first_name,
        last_name,
        make_model,
        caliber,
        registration_number,
        expiry_date,
        created_at
       FROM firearms 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ firearms });
  } catch (error) {
    console.error("Fetch firearms error:", error);
    res.status(500).json({
      message: "Failed to fetch firearms",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get single firearm
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const firearmId = req.params.id;

    const [firearms] = await db.query(
      `SELECT * FROM firearms 
       WHERE id = ? AND user_id = ?`,
      [firearmId, userId]
    );

    if (firearms.length === 0) {
      return res.status(404).json({
        message: "Firearm not found",
      });
    }

    res.json({ firearm: firearms[0] });
  } catch (error) {
    console.error("Fetch firearm error:", error);
    res.status(500).json({
      message: "Failed to fetch firearm",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Update firearm
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const firearmId = req.params.id;
    const {
      first_name,
      last_name,
      make_model,
      caliber,
      registration_number,
      expiry_date,
    } = req.body;

    // Verify ownership
    const [existingFirearm] = await db.query(
      "SELECT id FROM firearms WHERE id = ? AND user_id = ?",
      [firearmId, userId]
    );

    if (existingFirearm.length === 0) {
      return res.status(404).json({
        message: "Firearm not found",
      });
    }

    // Check if new registration number conflicts with existing ones
    if (registration_number) {
      const [conflictingFirearms] = await db.query(
        "SELECT id FROM firearms WHERE registration_number = ? AND id != ?",
        [registration_number, firearmId]
      );

      if (conflictingFirearms.length > 0) {
        return res.status(409).json({
          message: "Registration number already exists",
        });
      }
    }

    // Update firearm
    await db.query(
      `UPDATE firearms 
       SET first_name = ?,
           last_name = ?,
           make_model = ?,
           caliber = ?,
           registration_number = ?,
           expiry_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        first_name,
        last_name,
        make_model,
        caliber,
        registration_number,
        expiry_date,
        firearmId,
        userId,
      ]
    );

    res.json({
      message: "Firearm updated successfully",
    });
  } catch (error) {
    console.error("Update firearm error:", error);
    res.status(500).json({
      message: "Failed to update firearm",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Delete firearm
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const firearmId = req.params.id;

    const [result] = await db.query(
      "DELETE FROM firearms WHERE id = ? AND user_id = ?",
      [firearmId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Firearm not found",
      });
    }

    res.json({
      message: "Firearm deleted successfully",
    });
  } catch (error) {
    console.error("Delete firearm error:", error);
    res.status(500).json({
      message: "Failed to delete firearm",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
