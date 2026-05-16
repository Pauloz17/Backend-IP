import 'dotenv/config';
import { sendEmail } from './src/utils/mailer.js';

await sendEmail(
  'prueba@test.com',
  'Prueba Mailtrap',
  '<h1>Correo de prueba funcionando</h1>'
);

console.log('Correo enviado correctamente');