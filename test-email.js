import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

// Read the API key manually from .env for this test script
const envFile = fs.readFileSync(path.resolve('.env'), 'utf-8');
const keyMatch = envFile.match(/RESEND_API_KEY="?(re_[a-zA-Z0-9_]+)"?/);
const apiKey = keyMatch ? keyMatch[1] : null;

if (!apiKey) {
  console.error("Could not find RESEND_API_KEY in .env file");
  process.exit(1);
}

const resend = new Resend(apiKey);

async function testEmail() {
  console.log("Attempting to send a test email...");
  
  // NOTE: On the free plan, you MUST send this to the email address you registered with Resend!
  // Change the 'to' address below to your registered email address before running.
  const testEmailAddress = "delivered@resend.dev"; // This is a special Resend test address

  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme School <onboarding@resend.dev>', // Must use this domain for testing
      to: [testEmailAddress],
      subject: 'Hello World - Test from School Management',
      html: '<strong>It works!</strong> The Resend API is successfully connected.',
    });

    if (error) {
      console.error("❌ Failed to send email:", error);
    } else {
      console.log("✅ Email sent successfully!");
      console.log("Response:", data);
    }
  } catch (err) {
    console.error("❌ An unexpected error occurred:", err);
  }
}

testEmail();
