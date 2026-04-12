const RESEND_API_KEY = process.env.RESEND_API_KEY;

const sendEmail = async (to, subject, html) => {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Student Housing <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Email send failed');
  }
  console.log('Email sent via Resend:', data.id);
  return { success: true, messageId: data.id };
};

// Send verification email
const sendVerificationEmail = async (email, firstName, verificationCode) => {
  const code = String(verificationCode);
  const name = firstName || 'User';

  console.log(`Sending verification email to ${email} with code: ${code}`);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6EC4DB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .code { background-color: #fff; border: 2px dashed #6EC4DB; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #6EC4DB; margin: 20px 0; letter-spacing: 5px; border-radius: 8px; }
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

  return sendEmail(email, 'Verify Your Email - Student Housing', html);
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetCode) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #E87C7C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .code { background-color: #fff; border: 2px dashed #E87C7C; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #E87C7C; margin: 20px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <h2>Hello ${firstName}!</h2>
          <p>You requested to reset your password. Use the code below:</p>
          <div class="code">${resetCode}</div>
          <div class="warning">
            <strong>Security Notice:</strong> This code expires in 10 minutes. If you didn't request this, ignore this email.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Student Housing. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, 'Password Reset - Student Housing', html);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
