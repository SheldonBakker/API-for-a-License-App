const mysql = require("mysql2/promise");
const retry = require("retry");

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 30000, // 30 seconds
  maxIdle: 10,
  idleTimeout: 60000, // 60 seconds
  port: parseInt(process.env.DB_PORT) || 3306,
};

let pool = null;

const createPool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);

    pool.on("connection", (connection) => {
      console.log("New database connection established");

      connection.on("error", (err) => {
        console.error("Database connection error:", err);
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
          pool = null; // Force pool recreation
        }
      });
    });

    pool.on("error", (err) => {
      console.error("Pool error:", err);
      if (
        err.code === "POOL_CLOSED" ||
        err.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        pool = null;
      }
    });
  }
  return pool;
};

const query = async (sql, params = []) => {
  const operation = retry.operation({
    retries: 3,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 10000,
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        const currentPool = createPool();
        const connection = await currentPool.getConnection();

        try {
          console.log(`Executing query (attempt ${currentAttempt}):`, sql);
          const [results] = await connection.query(sql, params);
          connection.release();
          resolve(results);
        } catch (queryError) {
          connection.release();
          throw queryError;
        }
      } catch (error) {
        console.error(`Query attempt ${currentAttempt} failed:`, {
          error: error.message,
          code: error.code,
          sql: sql,
        });

        // Force pool recreation on specific errors
        if (
          error.code === "PROTOCOL_CONNECTION_LOST" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNREFUSED"
        ) {
          pool = null;
        }

        if (operation.retry(error)) {
          return;
        }
        reject(operation.mainError());
      }
    });
  });
};

const testConnection = async () => {
  try {
    const result = await query("SELECT 1 as test");
    const currentPool = createPool();

    console.log("\x1b[32m%s\x1b[0m", "✓ Database Connection Status:");
    console.table({
      status: "Connected",
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      activeConnections: currentPool.pool.activeConnections(),
      idleConnections: currentPool.pool.idleConnections(),
      totalConnections: currentPool.pool.totalConnections(),
    });

    return true;
  } catch (error) {
    console.log("\x1b[31m%s\x1b[0m", "✗ Database Connection Error:");
    console.error({
      status: "Failed",
      message: error.message,
      code: error.code,
      host: dbConfig.host,
      port: dbConfig.port,
    });

    return false;
  }
};

const initializeDatabase = async () => {
  console.log("Initializing database connection...");
  const isConnected = await testConnection();

  if (!isConnected) {
    console.error("Failed to initialize database connection");
    process.exit(1); // Exit the process if database connection fails
  }

  return createPool();
};

module.exports = {
  query,
  testConnection,
  createPool,
  initializeDatabase,
};
