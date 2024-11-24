const nodemailer = require("nodemailer");
const retry = require("retry"); // Reuse the retry package from database config

class EmailService {
  constructor() {
    this.transporter = null;
  }

  // Initialize transporter with retry mechanism
  async initialize() {
    const operation = retry.operation({
      retries: 5,
      factor: 2,
      minTimeout: 2000,
      maxTimeout: 60000,
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: true,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
              rejectUnauthorized: false,
              minVersion: "TLSv1.2",
            },
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 30000,
          });

          // Verify connection
          await this.transporter.verify();
          console.log("Email service initialized successfully");
          resolve(this.transporter);
        } catch (error) {
          console.error(
            `Email initialization attempt ${currentAttempt} failed:`,
            error
          );
          if (operation.retry(error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  // Send email with retry mechanism
  async sendMail(options) {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = {
      ...options,
      from:
        options.from ||
        `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      headers: {
        ...options.headers,
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "X-Mailer": "Remlic-Mailer",
        "Message-ID": `<${Date.now()}@${process.env.EMAIL_HOST}>`,
        "X-Sender": process.env.EMAIL_FROM_ADDRESS,
        "X-Remote-IP": "0.0.0.0",
      },
    };

    const operation = retry.operation({
      retries: parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3,
      factor: 2,
      minTimeout: parseInt(process.env.EMAIL_RETRY_DELAY) || 5000,
      maxTimeout: 30000,
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async (currentAttempt) => {
        try {
          const result = await this.transporter.sendMail(mailOptions);
          console.log("Email sent successfully:", result.messageId);
          resolve(result);
        } catch (error) {
          console.error(`Send mail attempt ${currentAttempt} failed:`, error);
          if (operation.retry(error)) {
            return;
          }
          reject(operation.mainError());
        }
      });
    });
  }

  // Helper method to create standard email options
  createMailOptions({
    to,
    subject,
    text,
    html,
    attachments = [],
    cc,
    bcc,
    replyTo,
    template,
  }) {
    const options = {
      to,
      subject,
      text,
      html: template || html,
      attachments,
      ...(cc && { cc }),
      ...(bcc && { bcc }),
      ...(replyTo && { replyTo }),
    };

    // Validate email options
    this.validateEmailOptions(options);
    return options;
  }

  // Validate email options
  validateEmailOptions(options) {
    const requiredFields = ["to", "subject"];
    const missingFields = requiredFields.filter((field) => !options[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required email fields: ${missingFields.join(", ")}`
      );
    }

    if (!options.text && !options.html) {
      throw new Error("Either text or html content must be provided");
    }
  }
}

// Create and export singleton instance
const emailService = new EmailService();
module.exports = emailService;
