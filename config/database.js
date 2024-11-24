const mysql = require("mysql2");
const retry = require("retry"); // You'll need to install this: npm install retry

// Create a function to handle connection with retries
function createPoolWithRetry() {
  const operation = retry.operation({
    retries: 5,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 60000,
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === "true",
          connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 5,
          queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
          connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
          acquireTimeout: 30000,
          timeout: 60000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });

        // Test the connection
        pool.getConnection((err, connection) => {
          if (err) {
            console.error(`Connection attempt ${currentAttempt} failed:`, err);
            if (operation.retry(err)) {
              console.log(
                `Retrying connection... (Attempt ${currentAttempt + 1})`
              );
              return;
            }
            reject(operation.mainError());
          } else {
            console.log("Database connection successful!");
            connection.release();
            resolve(pool);
          }
        });
      } catch (err) {
        if (operation.retry(err)) {
          console.log(`Retrying connection... (Attempt ${currentAttempt + 1})`);
          return;
        }
        reject(operation.mainError());
      }
    });
  });
}

// Export the connection function
module.exports = {
  createPoolWithRetry,
};
