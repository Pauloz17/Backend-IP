// MÓDULO: services/auth.service.js
// CAPA: Servicios (lógica de negocio de autenticación)
//
// Responsabilidad única: validar credenciales y emitir tokens JWT.
// NUNCA conoce req, res ni Express.
// Solo importa del modelo y de las librerías de seguridad.

import jwt    from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/mailer.js';
import {
    getUserByEmail,
    getUserById,
    getUserByDocumento,
    createUserWithPassword,
    getUserRolesAndPermissions,   // ← NUEVA importación para el RBAC
} from '../models/user.model.js';

// Rondas de hashing para bcrypt.
// 10 es el estándar recomendado por OWASP: buen balance entre seguridad y velocidad.
const SALT_ROUNDS = 10;

// ── HASHEAR CONTRASEÑA ────────────────────────────────────────────────────────
// Convierte una contraseña en texto plano a un hash irreversible.
// Se usa en el script de semilla y en futuros endpoints de registro.
export async function hashearPassword(passwordPlano) {
    return bcrypt.hash(passwordPlano, SALT_ROUNDS);
}

// ── GENERAR ACCESS TOKEN ──────────────────────────────────────────────────────
// Genera el token de corta duración (1h).
// El payload incluye id, documento y role para que el middleware
// pueda autorizar sin consultar la BD en cada petición.
export function generarAccessToken(usuario, roles = []) {
    const roleNames = roles.map(r => r.name);
    return jwt.sign(
        { id: usuario.id, documento: usuario.documento, role: usuario.role, roles: roleNames },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

// ── GENERAR REFRESH TOKEN ─────────────────────────────────────────────────────
// Genera el token de larga duración (7d).
// Solo incluye el id para minimizar la información expuesta en el token.
// Paulo lo usa en su endpoint POST /api/auth/refresh.
export function generarRefreshToken(usuario) {
    return jwt.sign(
        { id: usuario.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
}

// ── LOGIN (VERSIÓN ACTUALIZADA) ──────────────────────────────────────────────
// POST /api/auth/login
// Cuerpo: { email, password }
// Retorna los tokens y datos del usuario, o null si las credenciales son incorrectas.
//
// CAMBIO: antes buscaba por documento, ahora busca por email.
// Esto es coherente con el formulario del frontend que pide email + contraseña.
// El payload del JWT sigue siendo { id, documento, role } para que el frontend
// pueda identificar al usuario sin cambiar la lógica de fetchConAuth.js.
//
// El orden de las propiedades en el objeto de retorno también se ajusta:
// primero accessToken, luego refreshToken, luego user, como pide el cliente.

export async function loginService({ email, password }) {

    // 1. Buscar el usuario por email — CORRECTO
    // INCORRECTO sería: getUserByDocumento(documento)
    const usuario = await getUserByEmail(email); // ← esta línea debe decir email, no documento

    if (!usuario) return null;
    if (!usuario.password) return null;

    // 2. Comparar contraseña con bcrypt
    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) return null;

    // 3. Obtener los roles y permisos del usuario desde las tablas RBAC.
    const roles = await getUserRolesAndPermissions(usuario.id);

    // 4. Generar tokens incluyendo los roles para el payload del JWT
    const accessToken  = generarAccessToken(usuario, roles);
    const refreshToken = generarRefreshToken(usuario);
 
    // 5. Retornar estructura compatible con el frontend
    return {
        accessToken,
        refreshToken,
        user: {
            id:        usuario.id,
            name:      usuario.name,
            role:      usuario.role,
            documento: usuario.documento,
            email:     usuario.email,
            // Se anidan los roles dentro del objeto user para que el frontend
            // pueda validar Array.isArray(datos.user.roles)
            roles:     roles, 
        },
    };
}

// ── RENOVAR ACCESS TOKEN ──────────────────────────────────────────────────────
// Valida el refreshToken y emite un nuevo accessToken.
// Lo usa el endpoint de Paulo (POST /api/auth/refresh).
export async function renovarAccessTokenService(refreshToken) {
    // Lanza error si la firma es inválida o el token expiró
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Verificar que el usuario sigue existiendo en la BD
    const usuario = await getUserById(payload.id);
    if (!usuario) return null;

    // Emitir un nuevo accessToken con los datos actuales del usuario
    return generarAccessToken(usuario);
}

// ── REGISTRO DE USUARIO ──────────────────────────────────────────────────────
// POST /api/auth/register
// Cuerpo: { name, documento, email, password }
//
// Este servicio es nuevo: no existía antes porque el sistema dependía del
// script manual scripts/changePassword.js para crear usuarios con contraseña.
// Ahora el usuario puede registrarse directamente desde la pantalla de inicio.
//
// El registro:
//   1. Verifica que el email no esté en uso (409 si ya existe)
//   2. Verifica que el documento no esté en uso (409 si ya existe)
//   3. Hashea la contraseña con bcrypt antes de guardarla en MySQL
//   4. Crea el usuario con role = 'user' por defecto
//   5. Retorna el usuario creado sin el campo password
//
// Retorna un objeto { error, usuario } en lugar de solo el usuario para que
// el controlador pueda distinguir entre un éxito y un error 409 sin usar try/catch.
export async function registerService({ name, documento, email, password }) {

    // 1. Verificar que el email no esté registrado ya
    // getUserByEmail viene del modelo de usuarios y busca en la tabla users de MySQL
    const usuarioPorEmail = await getUserByEmail(email);
    if (usuarioPorEmail) {
        // Se retorna un objeto de error en lugar de lanzar excepción
        // para que el controlador pueda responder con 409 de forma limpia
        return { error: 'El correo electrónico ya está registrado en el sistema', codigo: 409 };
    }

    // 2. Verificar que el documento no esté registrado ya
    // getUserByDocumento viene del modelo y busca en la columna 'documento' de la tabla users
    const usuarioPorDocumento = await getUserByDocumento(documento);
    if (usuarioPorDocumento) {
        return { error: 'El número de documento ya está registrado en el sistema', codigo: 409 };
    }

    // 3. Hashear la contraseña antes de guardarla en la base de datos
    // NUNCA se guarda una contraseña en texto plano en la BD
    // SALT_ROUNDS = 10 es el estándar recomendado por OWASP (ya está definido arriba en el archivo)
    const passwordHasheada = await hashearPassword(password);

    // 4. Crear el usuario en MySQL con la contraseña ya hasheada
    // createUserWithPassword es una función nueva que se agrega al modelo
    // (ver src/models/user.model.js más abajo)
    // El rol es 'user' por defecto — solo un admin puede cambiar el rol después
    const usuarioCreado = await createUserWithPassword({
        name,
        documento,
        email,
        password: passwordHasheada,
        role: 'user',
    });
    // 4.5. Enviar correo de bienvenida por Mailtrap
await sendEmail(
    email,
    '¡Bienvenido al Sistema de Gestión de Tareas - SENA!',
    `<h1>Hola ${name} 👋</h1>
     <p>Tu cuenta ha sido creada exitosamente en el <strong>Sistema de Gestión de Tareas - SENA</strong>.</p>
     <p>Ya puedes iniciar sesión y empezar a gestionar tus tareas.</p>`
);
    // 5. Retornar el usuario sin el campo password
    // Se usa desestructuración para excluir password del objeto de retorno
    const { password: _ignorado, ...usuarioSinPassword } = usuarioCreado;
    return { usuario: usuarioSinPassword };
}