// MÓDULO: controller/auth.controller.js
// CAPA: Controlador (recibe HTTP, llama el servicio, responde HTTP)
//
// Responsabilidad única: manejar las peticiones HTTP de autenticación.
// NUNCA contiene lógica de negocio — eso va en auth.service.js.

import { catchAsync }                     from '../utils/catchAsync.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { loginService, registerService }  from '../services/auth.service.js';

import { guardarCodigo, verificarCodigo, codigoEsVerificado, eliminarCodigo } from '../utils/resetCodes.js';
import { enviarCodigoRecuperacion, enviarNotificacionCambioPassword } from '../services/email.service.js';
import { getUserByEmail }           from '../models/user.model.js';
import { updateUserPassword }       from '../models/user.model.js';
import { hashearPassword }          from '../services/auth.service.js';

// POST /api/auth/login
// Cuerpo: { documento, password }
// Respuesta exitosa 200: { success, message, data: { accessToken, refreshToken, user } }
// Error 400: campos faltantes
// Error 401: credenciales incorrectas
export const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    //El servicio valida las credenciales - retorna los datos o NULL 
    const resultado = await loginService({ email, password });

    // null significa credenciales incorrectas
    if (!resultado) {
        return errorResponse(res, 'Credenciales incorrectas', 401);
    }

    return successResponse(res, 'Inicio de sesión exitoso', resultado);
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
// Registra un nuevo usuario en el sistema.
// Cuerpo esperado (validado por validateSchema(registerSchema) en la ruta):
//   { name, documento, email, password }
//
// Respuesta exitosa 201: { success, message, data: { usuario sin password } }
// Error 409: el email o documento ya están registrados
// Error 400: datos inválidos (lo maneja el middleware de validación)
//
// catchAsync captura cualquier error async y lo pasa al middleware global
// de errores sin necesidad de un bloque try/catch manual aquí.
export const register = catchAsync(async (req, res) => {
    // req.body ya fue validado y limpiado por validateSchema(registerSchema)
    const { name, documento, email, password } = req.body;

    // registerService maneja la lógica: verifica duplicados, hashea y crea
    // Retorna { error, codigo } si hay conflicto, o { usuario } si fue exitoso
    const resultado = await registerService({ name, documento, email, password });

    // Si el servicio retornó un error significa que el email o documento ya existen
    if (resultado.error) {
        return errorResponse(res, resultado.error, resultado.codigo);
    }

    // Si llegamos aquí el registro fue exitoso — respondemos con 201 Created
    return successResponse(res, 'Usuario registrado correctamente', resultado.usuario, 201);
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Paso 1 del flujo de recuperación: el usuario ingresa su email.
// Si el email existe en el sistema, genera un código de 6 dígitos,
// lo guarda en memoria con TTL de 15 minutos y lo envía por Mailtrap.
//
// Cuerpo esperado: { email }
// Respuesta 200: indica que si el email existe se envió el código
//   (no se confirma si el email existe para evitar enumeración de usuarios)
// Respuesta 500: si el servicio de correo falla
export const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
 
    // Validación básica del campo email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return errorResponse(res, 'El correo electrónico es inválido', 400);
    }
 
    // Buscar el usuario por email en la BD
    const usuario = await getUserByEmail(email.trim().toLowerCase());
 
    // Si el usuario no existe, respondemos igual que si existiera para no filtrar emails
    // (seguridad: evitar que un atacante enumere los emails registrados)
    if (!usuario) {
        return successResponse(res, 'Si el correo está registrado, recibirás el código en tu bandeja de entrada.', null);
    }
 
    // Generar y guardar el código de 6 dígitos en memoria
    const codigo = guardarCodigo(email.trim().toLowerCase());
 
    // Enviar el código al correo del usuario vía Mailtrap
    const correoEnviado = await enviarCodigoRecuperacion(email.trim().toLowerCase(), codigo);
 
    if (!correoEnviado) {
        return errorResponse(res, 'Error al enviar el correo de recuperación. Intenta de nuevo.', 500);
    }
 
    return successResponse(res, 'Si el correo está registrado, recibirás el código en tu bandeja de entrada.', null);
});
 
// ── POST /api/auth/verify-reset-code ─────────────────────────────────────────
// Paso 2 del flujo de recuperación: el usuario ingresa el código recibido.
// Verifica que el código sea correcto y no haya expirado.
//
// Cuerpo esperado: { email, code }
// Respuesta 200: el código es válido — el usuario puede avanzar al paso 3
// Respuesta 400: el código es incorrecto o ha expirado
export const verifyResetCode = catchAsync(async (req, res) => {
    const { email, code } = req.body;
 
    // Validar que llegaron los dos campos necesarios
    if (!email || !code) {
        return errorResponse(res, 'El correo y el código son obligatorios', 400);
    }
 
    // Verificar el código usando la función de resetCodes.js
    const resultado = verificarCodigo(email.trim().toLowerCase(), String(code).trim());
 
    if (!resultado.valido) {
        // resultado.razon tiene el mensaje específico del error (expirado, incorrecto, no encontrado)
        return errorResponse(res, resultado.razon, 400);
    }
 
    return successResponse(res, 'Código verificado correctamente. Puedes cambiar tu contraseña.', null);
});
 
// ── POST /api/auth/reset-password ─────────────────────────────────────────────
// Paso 3 del flujo de recuperación: el usuario ingresa la nueva contraseña.
// Solo procede si el email tiene un código previamente verificado en memoria.
//
// Cuerpo esperado: { email, newPassword }
// Respuesta 200: contraseña actualizada correctamente
// Respuesta 400: código no verificado o email no encontrado
export const resetPassword = catchAsync(async (req, res) => {
    const { email, newPassword } = req.body;
 
    // Validar que llegaron los campos necesarios
    if (!email || !newPassword) {
        return errorResponse(res, 'El correo y la nueva contraseña son obligatorios', 400);
    }
 
    // Verificar que el código fue verificado previamente en el paso 2
    const emailNormalizado = email.trim().toLowerCase();
    if (!codigoEsVerificado(emailNormalizado)) {
        return errorResponse(res, 'El código no fue verificado. Por favor verifica el código primero.', 400);
    }
 
    // Validar longitud mínima de la contraseña
    if (newPassword.length < 6) {
        return errorResponse(res, 'La nueva contraseña debe tener al menos 6 caracteres', 400);
    }
 
    // Buscar el usuario por email para obtener su id
    const usuario = await getUserByEmail(emailNormalizado);
    if (!usuario) {
        return errorResponse(res, 'El correo no está registrado en el sistema', 400);
    }
 
    // Hashear la nueva contraseña antes de guardarla
    const passwordHasheada = await hashearPassword(newPassword);
 
    // Actualizar la contraseña en la BD
    await updateUserPassword(usuario.id, passwordHasheada);

    // Aviso de seguridad: no revela la contraseña, solo confirma el cambio.
    await enviarNotificacionCambioPassword(emailNormalizado);
 
    // Limpiar el código del Map de memoria — ya fue usado, no se puede reutilizar
    eliminarCodigo(emailNormalizado);
 
    return successResponse(res, 'Contraseña restablecida correctamente. Puedes iniciar sesión.', null);
});