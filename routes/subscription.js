const express = require("express");
const router = express.Router();
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

// Update user subscription after successful payment
router.post("/subscription", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reference, trans, status } = req.body;

    // Verify payment details are present
    if (!reference || !trans || status !== "success") {
      return res.status(400).json({
        message: "Invalid payment details",
      });
    }

    // Calculate subscription end date (1 year from now)
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

    // Update user subscription status
    const [result] = await db.query(
      `UPDATE users 
       SET type_of_user = 'subscriber',
           subscription_end_date = ?
       WHERE id = ?`,
      [subscriptionEndDate, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get updated user data
    const [users] = await db.query(
      `SELECT id, email, type_of_user, subscription_end_date 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    res.json({
      message: "Subscription updated successfully",
      subscription: {
        status: users[0].type_of_user,
        endDate: users[0].subscription_end_date,
        reference: reference,
        transaction: trans,
      },
    });
  } catch (error) {
    console.error("Subscription update error:", error);
    res.status(500).json({
      message: "Failed to update subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get user subscription status
router.get("/subscription", authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT type_of_user, subscription_end_date 
       FROM users 
       WHERE id = ? AND is_verified = 1`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found or not verified",
      });
    }

    const user = users[0];
    const now = new Date();
    const subscriptionEnd = user.subscription_end_date
      ? new Date(user.subscription_end_date)
      : null;

    // Check if subscription has expired
    if (
      user.type_of_user === "subscriber" &&
      subscriptionEnd &&
      subscriptionEnd < now
    ) {
      // Update user back to registered status if subscription expired
      await db.query(
        `UPDATE users 
         SET type_of_user = 'registered',
             subscription_end_date = NULL 
         WHERE id = ?`,
        [req.user.userId]
      );

      user.type_of_user = "registered";
      user.subscription_end_date = null;
    }

    res.json({
      subscription: {
        status: user.type_of_user,
        endDate: user.subscription_end_date,
        isActive:
          user.type_of_user === "subscriber" &&
          (!subscriptionEnd || subscriptionEnd > now),
      },
    });
  } catch (error) {
    console.error("Subscription status check error:", error);
    res.status(500).json({
      message: "Failed to check subscription status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
