import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: 2525,
  secure: false,
  auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS },
});

export async function sendEmail(to, subject, html) {
  await transporter.sendMail({
    from: process.env.MAILTRAP_FROM,
    to,
    subject,
    html,
  });
}