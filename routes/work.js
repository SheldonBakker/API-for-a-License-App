const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Create work contract
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      contractName,
      contractType,
      companyName,
      firstName,
      lastName,
      contactNumber,
      emailAddress,
      expiryDate,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      contractName,
      contractType,
      companyName,
      firstName,
      lastName,
      contactNumber,
      emailAddress,
      expiryDate,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || !value.trim()) {
        return res.status(400).json({
          message: `${field.replace(/([A-Z])/g, " $1").trim()} is required`,
        });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return res.status(400).json({
        message: "Invalid email address format",
      });
    }

    // Insert new work contract
    const [result] = await db.query(
      `INSERT INTO work_contracts (
        user_id,
        contract_name,
        contract_type,
        company_name,
        first_name,
        last_name,
        contact_number,
        email_address,
        expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        contractName,
        contractType,
        companyName,
        firstName,
        lastName,
        contactNumber,
        emailAddress,
        expiryDate,
      ]
    );

    res.status(201).json({
      message: "Work contract added successfully",
      contract: {
        id: result.insertId,
        contractName,
        contractType,
        companyName,
        firstName,
        lastName,
        contactNumber,
        emailAddress,
        expiryDate,
      },
    });
  } catch (error) {
    console.error("Work contract creation error:", error);
    res.status(500).json({
      message: "Failed to add work contract",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get all work contracts for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [contracts] = await db.query(
      `SELECT 
        id,
        contract_name,
        contract_type,
        company_name,
        first_name,
        last_name,
        contact_number,
        email_address,
        expiry_date,
        created_at
       FROM work_contracts 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ contracts });
  } catch (error) {
    console.error("Fetch work contracts error:", error);
    res.status(500).json({
      message: "Failed to fetch work contracts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get single work contract
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contractId = req.params.id;

    const [contracts] = await db.query(
      `SELECT * FROM work_contracts 
       WHERE id = ? AND user_id = ?`,
      [contractId, userId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({
        message: "Work contract not found",
      });
    }

    res.json({ contract: contracts[0] });
  } catch (error) {
    console.error("Fetch work contract error:", error);
    res.status(500).json({
      message: "Failed to fetch work contract",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Update work contract
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contractId = req.params.id;
    const {
      contractName,
      contractType,
      companyName,
      firstName,
      lastName,
      contactNumber,
      emailAddress,
      expiryDate,
    } = req.body;

    // Verify ownership
    const [existingContract] = await db.query(
      "SELECT id FROM work_contracts WHERE id = ? AND user_id = ?",
      [contractId, userId]
    );

    if (existingContract.length === 0) {
      return res.status(404).json({
        message: "Work contract not found",
      });
    }

    // Validate email format if provided
    if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      return res.status(400).json({
        message: "Invalid email address format",
      });
    }

    // Update work contract
    await db.query(
      `UPDATE work_contracts 
       SET contract_name = ?,
           contract_type = ?,
           company_name = ?,
           first_name = ?,
           last_name = ?,
           contact_number = ?,
           email_address = ?,
           expiry_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        contractName,
        contractType,
        companyName,
        firstName,
        lastName,
        contactNumber,
        emailAddress,
        expiryDate,
        contractId,
        userId,
      ]
    );

    res.json({
      message: "Work contract updated successfully",
    });
  } catch (error) {
    console.error("Update work contract error:", error);
    res.status(500).json({
      message: "Failed to update work contract",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Delete work contract
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contractId = req.params.id;

    const [result] = await db.query(
      "DELETE FROM work_contracts WHERE id = ? AND user_id = ?",
      [contractId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Work contract not found",
      });
    }

    res.json({
      message: "Work contract deleted successfully",
    });
  } catch (error) {
    console.error("Delete work contract error:", error);
    res.status(500).json({
      message: "Failed to delete work contract",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
