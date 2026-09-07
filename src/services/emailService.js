import { welcomeEmailTemplate, forgotPasswordTemplate, superAdminApprovalTemplate } from '../lib/emailTemplates';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const STANDARD_EMAIL_WRAPPER = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #4f46e5; padding: 24px; text-align: center; color: white; }
    .content { padding: 32px; color: #374151; line-height: 1.6; font-size: 16px; }
    .content h1, .content h2, .content h3 { color: #111827; margin-top: 0; }
    .content p { margin: 0 0 16px 0; }
    .content a { color: #4f46e5; text-decoration: underline; }
    .content strong { color: #111827; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; background: #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">School Management System</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} School Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

/**
 * Sends an email using the backend serverless function.
 * 
 * @param {Object} options 
 * @param {string} options.to - The recipient's email address
 * @param {string} options.templateType - 'WELCOME', 'FORGOT_PASSWORD', or 'APPROVAL'
 * @param {Object} options.data - The data required for the specific template
 * @returns {Promise<Object>} - Response from the server
 */
export const sendEmail = async ({ to, templateType, data }) => {
  let subject = '';
  let html = '';

  try {
    // Try to fetch dynamic template from Firestore
    const docRef = doc(db, 'settings', 'emailTemplates');
    const docSnap = await getDoc(docRef);
    let dynamicTemplates = null;
    
    if (docSnap.exists()) {
      dynamicTemplates = docSnap.data();
    }

    switch (templateType) {
      case 'WELCOME':
        if (dynamicTemplates && dynamicTemplates.welcomeHtml) {
          subject = dynamicTemplates.welcomeSubject || 'Welcome to Acme School System';
          const innerHtml = dynamicTemplates.welcomeHtml
            .replace(/\{\{userName\}\}/g, data.userName || '')
            .replace(/\{\{role\}\}/g, data.role || '')
            .replace(/\{\{loginUrl\}\}/g, data.loginUrl || '');
          html = STANDARD_EMAIL_WRAPPER(innerHtml);
        } else {
          subject = 'Welcome to Acme School System';
          html = welcomeEmailTemplate(data.userName, data.role, data.loginUrl);
        }
        break;
      case 'FORGOT_PASSWORD':
        if (dynamicTemplates && dynamicTemplates.forgotPasswordHtml) {
          subject = dynamicTemplates.forgotPasswordSubject || 'Password Reset Request';
          const innerHtml = dynamicTemplates.forgotPasswordHtml
            .replace(/\{\{resetLink\}\}/g, data.resetLink || '');
          html = STANDARD_EMAIL_WRAPPER(innerHtml);
        } else {
          subject = 'Password Reset Request';
          html = forgotPasswordTemplate(data.resetLink);
        }
        break;
      case 'APPROVAL':
        if (dynamicTemplates && dynamicTemplates.approvalHtml) {
          subject = dynamicTemplates.approvalSubject || 'Your School Account is Approved!';
          const innerHtml = dynamicTemplates.approvalHtml
            .replace(/\{\{schoolName\}\}/g, data.schoolName || '')
            .replace(/\{\{dashboardLink\}\}/g, data.dashboardLink || '');
          html = STANDARD_EMAIL_WRAPPER(innerHtml);
        } else {
          subject = 'Your School Account is Approved!';
          html = superAdminApprovalTemplate(data.schoolName, data.dashboardLink);
        }
        break;
      default:
        throw new Error('Invalid template type provided');
    }
  } catch (error) {
    console.warn("Failed to fetch dynamic templates from Firestore, using hardcoded fallback.", error);
    
    // Hardcoded Fallback logic just in case Firestore fails
    switch (templateType) {
      case 'WELCOME':
        subject = 'Welcome to Acme School System';
        html = welcomeEmailTemplate(data.userName, data.role, data.loginUrl);
        break;
      case 'FORGOT_PASSWORD':
        subject = 'Password Reset Request';
        html = forgotPasswordTemplate(data.resetLink);
        break;
      case 'APPROVAL':
        subject = 'Your School Account is Approved!';
        html = superAdminApprovalTemplate(data.schoolName, data.dashboardLink);
        break;
      default:
        throw new Error('Invalid template type provided');
    }
  }

  // First try serverless function endpoint /api/send-email
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("Serverless API endpoint unavailable, attempting direct Resend API call...", error);
  }

  // Direct Resend API invocation (ensures Resend sends email in both local dev & production)
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const directRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Team Carrezza <admin@teamcarrezza.com>',
          to: [to],
          subject: subject,
          html: html,
        }),
      });

      const data = await directRes.json();
      if (!directRes.ok) {
        throw new Error(data.message || 'Resend API returned error');
      }
      return data;
    } catch (directErr) {
      console.error("Direct Resend API error:", directErr);
      throw directErr;
    }
  }
};
