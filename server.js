import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const messageStorePath = path.join(__dirname, 'contact-messages.jsonl');

async function saveMessage(payload) {
  const record = {
    timestamp: new Date().toISOString(),
    ...payload,
  };
  await fs.appendFile(messageStorePath, `${JSON.stringify(record)}\n`, 'utf8');
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.post('/api/contact', async (req, res) => {
  try {
    const body = req.body || {};
    const name = body.name || `${(body.firstName || '').trim()} ${(body.lastName || '').trim()}`.trim();
    const email = body.email || '';
    const phone = body.phone || '';
    const subject = body.subject || body.service || '';
    const message = body.message || '';

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    if (!smtpConfigured) {
      await saveMessage({ name, email, phone, subject, message });
      return res.json({
        success: true,
        message: 'Message received locally. Configure SMTP settings to send it by email.',
        stored: true,
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: email,
      subject: subject || 'New contact form message',
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\n\nMessage:\n${message}`,
      html: `
        <h3>New contact form message</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
        <br>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message. Please try again later.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'mwanaweika-tech-solutions.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
