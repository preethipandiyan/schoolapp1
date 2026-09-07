import { Resend } from 'resend';
import admin from 'firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'school-management-system-6a2c4'
      });
    }
  }
  db = admin.firestore();
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const targetEmail = email.toLowerCase().trim();

  try {
    // 1. Generate password reset link via Firebase Admin SDK (does NOT send default Firebase email)
    let resetLink = '';
    try {
      resetLink = await admin.auth().generatePasswordResetLink(targetEmail);
    } catch (authErr) {
      console.warn("Could not generate reset link via Admin SDK:", authErr);
      const origin = req.headers.origin || 'https://school-management-system-6a2c4.web.app';
      resetLink = `${origin}/login`;
    }

    // 2. Fetch SuperAdmin custom email template from Firestore DB
    let subject = 'Password Reset Request';
    let innerHtml = `<p>We received a request to reset your password.</p><p>Click the link below to securely reset your password:</p><p><a href="${resetLink}" target="_blank">Reset Password</a></p><p>This link will expire in 24 hours.</p>`;

    if (db) {
      try {
        const docSnap = await db.collection('settings').doc('emailTemplates').get();
        if (docSnap.exists) {
          const templates = docSnap.data();
          if (templates.forgotPasswordSubject) {
            subject = templates.forgotPasswordSubject;
          }
          if (templates.forgotPasswordHtml) {
            innerHtml = templates.forgotPasswordHtml.replace(/\{\{resetLink\}\}/g, resetLink);
          }
        }
      } catch (dbReadErr) {
        console.warn("Could not read emailTemplates from Firestore:", dbReadErr);
      }
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f9fafb; padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color: #4f46e5; padding: 24px; text-align: center; color: white; }
    .content { padding: 32px; color: #374151; line-height: 1.6; font-size: 16px; }
    .content h1, .content h2, .content h3 { color: #111827; margin-top: 0; }
    .content p { margin: 0 0 16px 0; }
    .content a { color: #4f46e5; text-decoration: underline; font-weight: bold; }
    .footer { padding: 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; background: #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">School Management System</h1>
    </div>
    <div class="content">
      ${innerHtml}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} School Management System. All rights reserved.
    </div>
  </div>
</body>
</html>`;

    // 3. Send email via Resend API from Team Carrezza <admin@teamcarrezza.com>
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: 'Team Carrezza <admin@teamcarrezza.com>',
      to: [targetEmail],
      subject: subject,
      html: fullHtml,
    });

    if (resendError) {
      console.error("Resend API error:", resendError);
    }

    // 4. Update user document in Firestore DB
    if (db) {
      try {
        const usersSnap = await db.collection('users').where('email', '==', targetEmail).get();
        const batch = db.batch();
        usersSnap.forEach(userDoc => {
          batch.update(userDoc.ref, {
            lastPasswordResetAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      } catch (dbUpdateErr) {
        console.warn("Could not update user record in DB:", dbUpdateErr);
      }
    }

    return res.status(200).json({ success: true, resendData });
  } catch (err) {
    console.error("Forgot password handler error:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
