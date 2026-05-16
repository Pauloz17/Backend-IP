import { transporter } from '../config/mailer.js';

export async function enviarCodigoRecuperacion(destinatario, codigo) {
    try {
        const mailOptions = {
            from: process.env.MAIL_FROM || '"Sistema Gestor" <no-reply@gestor.com>',
            to: destinatario,
            subject: 'Recuperación de contraseña — Sistema Gestor',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Recuperación de Contraseña</h2>
                    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                    <p>Tu código de verificación es:</p>
                    <div style="background: #dbeafe; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${codigo}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Este código vence en <strong>15 minutos</strong>.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                    <p style="color: #9ca3af; font-size: 12px;">SENA — Gestión de Tareas</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Correo de recuperación enviado a:', destinatario);
        return true;

    } catch (error) {
        console.error('❌ Error enviando correo:', error.message);
        return false;
    }
}