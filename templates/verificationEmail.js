function getVerificationEmailTemplate(verificationUrl) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #ffffff;
            background: linear-gradient(135deg, #0f172a, #1e1b4b, #312e81);
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: rgba(31, 41, 55, 0.3);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 16px;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid rgba(99, 102, 241, 0.2);
          }
          .content {
            padding: 30px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4f46e5;
            color: #ffffff;
            text-decoration: none;
            border-radius: 12px;
            margin: 20px 0;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #4338ca;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid rgba(99, 102, 241, 0.2);
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
          }
          .link-text {
            color: rgba(255, 255, 255, 0.7);
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1 style="color: #4f46e5; margin: 0;">Welcome to Remlic!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering with us. To complete your registration and verify your email address, please click the button below:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p class="link-text">${verificationUrl}</p>
            <p>This verification link will expire in 24 hours for security purposes.</p>
          </div>
          <div class="footer">
            <p>This email was sent by Remlic. If you didn't register for an account, please ignore this email.</p>
            <p>© ${new Date().getFullYear()} Remlic. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

module.exports = getVerificationEmailTemplate;
