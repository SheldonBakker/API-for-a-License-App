const mysql = require("mysql2");

// Debug logging
console.log("Database Configuration:");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);
console.log("Database:", process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: true,
        }
      : false,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Database connected successfully");
  connection.release();
});

const promisePool = pool.promise();

module.exports = promisePool;
