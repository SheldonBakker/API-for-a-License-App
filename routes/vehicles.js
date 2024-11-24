const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Create vehicle
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { make, model, registration, expiryDate } = req.body;

    // Validate required fields
    const requiredFields = {
      make,
      model,
      registration,
      expiryDate,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || !value.trim()) {
        return res.status(400).json({
          message: `${field.replace(/([A-Z])/g, " $1").trim()} is required`,
        });
      }
    }

    // Check if registration number already exists
    const [existingVehicles] = await db.query(
      "SELECT id FROM vehicles WHERE registration = ?",
      [registration]
    );

    if (existingVehicles.length > 0) {
      return res.status(409).json({
        message: "Vehicle with this registration number already exists",
      });
    }

    // Insert new vehicle
    const [result] = await db.query(
      `INSERT INTO vehicles (
        user_id, 
        make, 
        model, 
        registration, 
        expiry_date
      ) VALUES (?, ?, ?, ?, ?)`,
      [userId, make, model, registration, expiryDate]
    );

    res.status(201).json({
      message: "Vehicle added successfully",
      vehicle: {
        id: result.insertId,
        make,
        model,
        registration,
        expiryDate,
      },
    });
  } catch (error) {
    console.error("Vehicle creation error:", error);
    res.status(500).json({
      message: "Failed to add vehicle",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get all vehicles for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [vehicles] = await db.query(
      `SELECT 
        id,
        make,
        model,
        registration,
        expiry_date,
        created_at
       FROM vehicles 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ vehicles });
  } catch (error) {
    console.error("Fetch vehicles error:", error);
    res.status(500).json({
      message: "Failed to fetch vehicles",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get single vehicle
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;

    const [vehicles] = await db.query(
      `SELECT * FROM vehicles 
       WHERE id = ? AND user_id = ?`,
      [vehicleId, userId]
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    res.json({ vehicle: vehicles[0] });
  } catch (error) {
    console.error("Fetch vehicle error:", error);
    res.status(500).json({
      message: "Failed to fetch vehicle",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Update vehicle
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;
    const { make, model, registration, expiryDate } = req.body;

    // Verify ownership
    const [existingVehicle] = await db.query(
      "SELECT id FROM vehicles WHERE id = ? AND user_id = ?",
      [vehicleId, userId]
    );

    if (existingVehicle.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    // Check if new registration conflicts with existing ones
    if (registration) {
      const [conflictingVehicles] = await db.query(
        "SELECT id FROM vehicles WHERE registration = ? AND id != ?",
        [registration, vehicleId]
      );

      if (conflictingVehicles.length > 0) {
        return res.status(409).json({
          message: "Registration number already exists",
        });
      }
    }

    // Update vehicle
    await db.query(
      `UPDATE vehicles 
       SET make = ?,
           model = ?,
           registration = ?,
           expiry_date = ?
       WHERE id = ? AND user_id = ?`,
      [make, model, registration, expiryDate, vehicleId, userId]
    );

    res.json({
      message: "Vehicle updated successfully",
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    res.status(500).json({
      message: "Failed to update vehicle",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Delete vehicle
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;

    const [result] = await db.query(
      "DELETE FROM vehicles WHERE id = ? AND user_id = ?",
      [vehicleId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    res.json({
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    res.status(500).json({
      message: "Failed to delete vehicle",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
