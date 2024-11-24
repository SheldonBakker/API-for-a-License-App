const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const csrf = require("csurf");
const helmet = require("helmet");
const getVerificationEmailTemplate = require("../templates/verificationEmail");
const sanitizeHtml = require("sanitize-html");
const emailService = require("../config/email");

// Add rate limiter for login attempts
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true, // Only count failed attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts. Account locked for 15 minutes.",
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// Registration rate limiter - prevent too many account creations
const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: { message: "Too many accounts created. Please try again later." },
});

// Add CSRF protection
const csrfProtection = csrf({ cookie: true });

// Add password validation middleware
const passwordValidation = [
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
    .withMessage(
      "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
];

// Simplified middleware without Redis
const checkIPBlocked = async (req, res, next) => {
  // Skip Redis check for now
  next();
};

const trackFailedAttempt = async (ip) => {
  // Skip Redis tracking for now
  console.log("Failed login attempt from IP:", ip);
};

// Update the login route to use simplified rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { message: "Too many login attempts. Please try again later." },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: { message: "Too many accounts created. Please try again later." },
});

// Update the unblock-ip route to work without Redis
router.post("/unblock-ip", authMiddleware, async (req, res) => {
  res.json({ message: "IP blocking temporarily disabled" });
});

const checkPasswordBreach = async (req, res, next) => {
  const { password } = req.body;
  try {
    const hash = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex")
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`
    );
    const text = await response.text();

    if (text.includes(suffix)) {
      return res.status(400).json({
        message:
          "This password has been found in known data breaches. Please choose a different password.",
      });
    }
    next();
  } catch (error) {
    next();
  }
};

// Now we can use it in the registration route
router.post(
  "/register",
  registrationLimiter,
  csrfProtection,
  passwordValidation,
  checkPasswordBreach,
  body("email").isEmail().normalizeEmail(),
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      console.log("Registration attempt for email:", email);

      // Check if user already exists
      const [existingUsers] = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ message: "Email already exists" });
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

      // Hash password and insert user with verification token
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await db.query(
        `INSERT INTO users (email, password, verification_token, verification_token_expires, is_verified) 
         VALUES (?, ?, ?, ?, ?)`,
        [email, hashedPassword, verificationToken, tokenExpiry, false]
      );

      // Send verification email using the email service
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await emailService.sendMail({
        to: email,
        subject: "Verify your email address",
        html: getVerificationEmailTemplate(verificationUrl),
      });

      res.status(201).json({
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (error) {
      console.error("Registration error:", error);
      res
        .status(500)
        .json({ message: "An error occurred during registration" });
    }
  }
);

const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
          allowedIframeHostnames: [],
        });
      }
    });
  }
  next();
};

router.post(
  "/login",
  loginRateLimiter,
  csrfProtection,
  checkIPBlocked,
  sanitizeInput,
  body("email").isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid input" });
    }

    try {
      const { email, password } = req.body;
      const ip = req.ip;

      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
        email,
      ]);

      // Check password and handle failed attempts
      const isValidPassword =
        users.length > 0 && (await bcrypt.compare(password, users[0].password));

      if (!isValidPassword) {
        await trackFailedAttempt(ip);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: users[0].id, email: users[0].email },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Add security headers
      res.set({
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
      });

      res.json({ token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "An error occurred during login" });
    }
  }
);

// Get user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, email, first_name, last_name, contact_number, id_number, type_of_user, subscription_end_date, is_verified FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update user profile
router.patch("/me", authMiddleware, async (req, res) => {
  try {
    const { email, first_name, last_name, contact_number, id_number } =
      req.body;
    const userId = req.user.userId;

    // If email is being updated, check if it's already taken
    if (email) {
      const [existingUsers] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (email) {
      updates.push("email = ?");
      values.push(email);
    }
    if (first_name) {
      updates.push("first_name = ?");
      values.push(first_name);
    }
    if (last_name) {
      updates.push("last_name = ?");
      values.push(last_name);
    }
    if (contact_number) {
      updates.push("contact_number = ?");
      values.push(contact_number);
    }
    if (is_verified) {
      updates.push("is_verified = ?");
      values.push(is_verified);
    }
    if (id_number) {
      updates.push("id_number = ?");
      values.push(id_number);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    values.push(userId);
    await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // Fetch and return updated user data
    const [users] = await db.query(
      "SELECT id, email, first_name, last_name, contact_number, id_number, type_of_user, subscription_end_date FROM users WHERE id = ?",
      [userId]
    );

    res.json({ user: users[0] });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Change password
router.post(
  "/change-password",
  authMiddleware,
  csrfProtection,
  passwordValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { current_password, new_password } = req.body;
      const userId = req.user.userId;

      // Get current user with password
      const [users] = await db.query(
        "SELECT password FROM users WHERE id = ?",
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        current_password,
        users[0].password
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);

      // Update password
      await db.query("UPDATE users SET password = ? WHERE id = ?", [
        hashedPassword,
        userId,
      ]);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update the verification endpoint to use query parameter instead of URL parameter
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }

    const [users] = await db.query(
      `SELECT * FROM users 
       WHERE verification_token = ? 
       AND verification_token_expires > NOW() 
       AND is_verified = false`,
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired verification token",
      });
    }

    await db.query(
      `UPDATE users 
       SET is_verified = true, 
           verification_token = NULL, 
           verification_token_expires = NULL 
       WHERE id = ?`,
      [users[0].id]
    );

    // Redirect to frontend with success status
    res.redirect(`${process.env.FRONTEND_URL}/verification-success`);
  } catch (error) {
    console.error("Verification error:", error);
    // Redirect to frontend with error status
    res.redirect(`${process.env.FRONTEND_URL}/verification-error`);
  }
});

module.exports = router;
