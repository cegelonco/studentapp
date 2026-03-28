const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP with timeouts
const createTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

// Send verification email
const sendVerificationEmail = async (email, firstName, verificationCode) => {
  try {
    if (!email || !verificationCode) {
      throw new Error('Email and verification code are required');
    }

    const code = String(verificationCode);
    const name = firstName || 'User';

    console.log(`Sending verification email to ${email} with code: ${code}`);

    const transporter = createTransporter();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .code { background-color: #fff; border: 2px dashed #4CAF50; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #4CAF50; margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Student Housing</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for signing up for Student Housing. Please verify your email address by entering the verification code below:</p>
            <div class="code">${code}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Student Housing. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Hello ${name}!

      Thank you for signing up for Student Housing. Please verify your email address by entering the verification code below:

      Verification Code: ${code}

      This code will expire in 10 minutes.

      If you didn't create an account with us, please ignore this email.

      © ${new Date().getFullYear()} Student Housing. All rights reserved.
    `;

    const mailOptions = {
      from: `"Student Housing" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Student Housing',
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error.message);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Student Housing" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset - Student Housing',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .code { background-color: #fff; border: 2px dashed #f44336; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #f44336; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>You requested to reset your password for your Student Housing account.</p>
              <p>Use the code below to reset your password:</p>
              <div class="code">${resetCode}</div>
              <div class="warning">
                <strong>Security Notice:</strong> This code will expire in 10 minutes. If you didn't request this, please ignore this email.
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Student Housing. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
