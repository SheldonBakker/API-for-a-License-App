const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Create PRPD license
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, idNumber, expiryDate } = req.body;

    // Validate required fields
    const requiredFields = {
      firstName,
      lastName,
      idNumber,
      expiryDate,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || !value.trim()) {
        return res.status(400).json({
          message: `${field.replace(/([A-Z])/g, " $1").trim()} is required`,
        });
      }
    }

    // Check if ID number already exists
    const [existingPrpd] = await db.query(
      "SELECT id FROM prpd WHERE id_number = ?",
      [idNumber]
    );

    if (existingPrpd.length > 0) {
      return res.status(409).json({
        message: "PRPD license with this ID number already exists",
      });
    }

    // Insert new PRPD license
    const [result] = await db.query(
      `INSERT INTO prpd (
        user_id, 
        first_name, 
        last_name, 
        id_number, 
        expiry_date
      ) VALUES (?, ?, ?, ?, ?)`,
      [userId, firstName, lastName, idNumber, expiryDate]
    );

    res.status(201).json({
      message: "PRPD license added successfully",
      prpd: {
        id: result.insertId,
        firstName,
        lastName,
        idNumber,
        expiryDate,
      },
    });
  } catch (error) {
    console.error("PRPD creation error:", error);
    res.status(500).json({
      message: "Failed to add PRPD license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get all PRPD licenses for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [prpdLicenses] = await db.query(
      `SELECT 
        id,
        first_name,
        last_name,
        id_number,
        expiry_date,
        created_at
       FROM prpd 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ prpdLicenses });
  } catch (error) {
    console.error("Fetch PRPD licenses error:", error);
    res.status(500).json({
      message: "Failed to fetch PRPD licenses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get single PRPD license
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prpdId = req.params.id;

    const [prpdLicenses] = await db.query(
      `SELECT * FROM prpd 
       WHERE id = ? AND user_id = ?`,
      [prpdId, userId]
    );

    if (prpdLicenses.length === 0) {
      return res.status(404).json({
        message: "PRPD license not found",
      });
    }

    res.json({ prpd: prpdLicenses[0] });
  } catch (error) {
    console.error("Fetch PRPD license error:", error);
    res.status(500).json({
      message: "Failed to fetch PRPD license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Update PRPD license
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prpdId = req.params.id;
    const { firstName, lastName, idNumber, expiryDate } = req.body;

    // Verify ownership
    const [existingPrpd] = await db.query(
      "SELECT id FROM prpd WHERE id = ? AND user_id = ?",
      [prpdId, userId]
    );

    if (existingPrpd.length === 0) {
      return res.status(404).json({
        message: "PRPD license not found",
      });
    }

    // Check if new ID number conflicts with existing ones
    if (idNumber) {
      const [conflictingPrpd] = await db.query(
        "SELECT id FROM prpd WHERE id_number = ? AND id != ?",
        [idNumber, prpdId]
      );

      if (conflictingPrpd.length > 0) {
        return res.status(409).json({
          message: "ID number already exists",
        });
      }
    }

    // Update PRPD license
    await db.query(
      `UPDATE prpd 
       SET first_name = ?,
           last_name = ?,
           id_number = ?,
           expiry_date = ?
       WHERE id = ? AND user_id = ?`,
      [firstName, lastName, idNumber, expiryDate, prpdId, userId]
    );

    res.json({
      message: "PRPD license updated successfully",
    });
  } catch (error) {
    console.error("Update PRPD license error:", error);
    res.status(500).json({
      message: "Failed to update PRPD license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Delete PRPD license
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prpdId = req.params.id;

    const [result] = await db.query(
      "DELETE FROM prpd WHERE id = ? AND user_id = ?",
      [prpdId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "PRPD license not found",
      });
    }

    res.json({
      message: "PRPD license deleted successfully",
    });
  } catch (error) {
    console.error("Delete PRPD license error:", error);
    res.status(500).json({
      message: "Failed to delete PRPD license",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
