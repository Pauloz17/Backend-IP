import { MailtrapClient } from 'mailtrap';

const TOKEN = process.env.MAILTRAP_API_TOKEN;
const SENDER_EMAIL = process.env.MAILTRAP_SENDER_EMAIL || 'no-reply@gestor.com';
const SENDER_NAME = process.env.MAILTRAP_SENDER_NAME || 'Sistema Gestor';

const client = new MailtrapClient({ token: TOKEN });

const sender = { email: SENDER_EMAIL, name: SENDER_NAME };

export async function sendEmail(to, subject, html) {
  try {
    await client.send({
      from: sender,
      to: [{ email: to }],
      subject: subject,
      html: html,
    });
    console.log('✅ Correo enviado correctamente via Mailtrap SDK');
    return true;
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    return false;
  }
}