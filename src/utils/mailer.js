import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: '"Gestor de Tareas 🚀" <no-reply@tuproyecto.com>',
      to,
      subject,
      html,
    });
    console.log('✅ Correo enviado correctamente');
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
  }
}