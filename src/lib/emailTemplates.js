// This file holds the HTML templates for the emails

export const welcomeEmailTemplate = (userName, role, loginUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #4f46e5; padding: 24px; text-align: center; color: white; }
    .content { padding: 32px; color: #374151; line-height: 1.6; }
    .btn { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Welcome to Acme School</h1>
    </div>
    <div class="content">
      <h2>Hello ${userName},</h2>
      <p>Your account has been successfully created as a <strong>${role}</strong>.</p>
      <p>We are excited to have you on board. You can now log in to your dashboard to access your features.</p>
      <div style="text-align: center;">
        <a href="${loginUrl}" class="btn">Login to Dashboard</a>
      </div>
      <p style="margin-top: 24px;">If you have any questions, please contact your administrator.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Acme School System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const forgotPasswordTemplate = (resetLink) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #ef4444; padding: 24px; text-align: center; color: white; }
    .content { padding: 32px; color: #374151; line-height: 1.6; }
    .btn { display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
    </div>
    <div class="content">
      <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
      <p>Click the button below to set a new password:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="btn">Reset Password</a>
      </div>
      <p style="margin-top: 24px;">This link will expire in 24 hours.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Acme School System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const superAdminApprovalTemplate = (schoolName, dashboardLink) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #10b981; padding: 24px; text-align: center; color: white; }
    .content { padding: 32px; color: #374151; line-height: 1.6; }
    .btn { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">School Approved!</h1>
    </div>
    <div class="content">
      <h2>Congratulations, ${schoolName}!</h2>
      <p>Your registration for the School Management System has been approved by the Super Admin.</p>
      <p>You can now log in and start configuring your school environment, adding teachers, and managing classes.</p>
      <div style="text-align: center;">
        <a href="${dashboardLink}" class="btn">Go to Dashboard</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Acme School System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;
