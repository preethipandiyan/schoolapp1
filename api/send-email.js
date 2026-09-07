import { Resend } from 'resend';

// Vercel handles the .env variables securely
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields (to, subject, html/text)' });
    }

    // Using verified domain teamcarrezza.com for professional sending
    const { data, error } = await resend.emails.send({
      from: 'Team Carrezza <admin@teamcarrezza.com>',
      to: [to],
      subject: subject,
      html: html,
      text: text,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Server Error sending email:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
