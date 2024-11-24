require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const authRoutes = require("./routes/auth");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const subscriptionRoutes = require("./routes/subscription");
const driversRoutes = require("./routes/drivers");
const firearmsRoutes = require("./routes/firearms");
const prpdRoutes = require("./routes/prpd");
const vehiclesRoutes = require("./routes/vehicles");
const workRoutes = require("./routes/work");
const sanitizeHtml = require("sanitize-html");

const app = express();

// Add type checking for fetch API
const fetch = global.fetch || require("node-fetch");

// Move request sanitization before routes
app.use((req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    });
  }
  next();
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  })
);

// Additional security headers
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-Download-Options", "noopen");
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Logging
app.use(morgan("dev"));

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL;
app.use(
  cors({
    origin: [FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "CSRF-Token",
      "X-CSRF-Token",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight requests for 10 minutes
  })
);

app.use(express.json({ limit: "10kb" })); // Limit payload size

// Move CSRF setup before routes
app.use(cookieParser());

// Setup CSRF protection
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  },
});

// Create endpoint to get CSRF token - this needs to be before other routes
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (error) {
    console.error("CSRF Token Generation Error:", error);
    res.status(500).json({ message: "Failed to generate CSRF token" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/auth", csrfProtection, authRoutes);
app.use("/api/users", csrfProtection, subscriptionRoutes);
app.use("/api/drivers", csrfProtection, driversRoutes);
app.use("/api/firearms", csrfProtection, firearmsRoutes);
app.use("/api/prpd", csrfProtection, prpdRoutes);
app.use("/api/vehicles", csrfProtection, vehiclesRoutes);
app.use("/api/work", csrfProtection, workRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
