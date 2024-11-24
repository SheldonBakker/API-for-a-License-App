const jwt = require("jsonwebtoken");
const sanitizeHtml = require("sanitize-html");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Invalid token format",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          status: "error",
          message: "Token expired",
        });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      status: "error",
      message: "Authentication failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = authMiddleware;
