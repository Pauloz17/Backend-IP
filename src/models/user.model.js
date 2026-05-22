// MÓDULO: models/user.model.js
// CAPA: Modelo (datos y operaciones sobre la tabla users en MySQL)
//
// Responsabilidad única: interactuar con la tabla users de MySQL.
// NUNCA conoce req, res ni Express.
//
// pool.query retorna [filas, metadatos] — desestructuramos con [rows]
// para tomar solo las filas y descartar los metadatos que no necesitamos.

import pool from '../database/db.connection.js';

// campos que se pueden actualizar desde el exterior
// cualquier otro campo que llegue en el body se ignora silenciosamente
const CAMPOS_ACTUALIZABLES = ['documento', 'name', 'email'];

// RF03 — READ: retorna todos los usuarios de la tabla users
// el arreglo completo se usa en GET /api/users
export async function getAllUsers() {
    const [rows] = await pool.query('SELECT * FROM users');
    return rows;
}

// RF03 — READ: busca un usuario por su id numérico
// el ? es un placeholder que mysql2 reemplaza de forma segura (evita SQL injection)
// retorna el primer resultado, o undefined si no existe
export async function getUserById(id) {
    const [rows] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [Number(id)]
    );
    return rows[0];
}

// busca un usuario por su número de documento de identidad
// se usa desde el frontend para buscar por documento
export async function getUserByDocumento(documento) {
    const [rows] = await pool.query(
        'SELECT * FROM users WHERE documento = ?',
        [documento.toString()]
    );
    return rows[0];
}

// RF02 — CREATE: inserta un usuario nuevo en la tabla users
// result.insertId contiene el id AUTO_INCREMENT que MySQL asignó
// retornamos el usuario completo llamando a getUserById para incluir timestamps
export async function createUser({ documento, name, email }) {
    const [result] = await pool.query(
        'INSERT INTO users (documento, name, email) VALUES (?, ?, ?)',
        [documento, name, email]
    );
    return getUserById(result.insertId);
}

// actualiza los campos de un usuario existente
// solo se permiten los campos definidos en CAMPOS_ACTUALIZABLES
// cualquier otro campo que llegue en el body se ignora para evitar corrupción de datos
export async function updateUser(id, campos) {
    const existente = await getUserById(id);
    if (!existente) return null;

    // Permitir actualizar el campo 'activo' para soft delete
    const camposFiltrados = {};
    for (const campo of CAMPOS_ACTUALIZABLES) {
        if (campos[campo] !== undefined) {
            camposFiltrados[campo] = campos[campo];
        }
    }
    // Permitir explícitamente el campo 'activo' (soft delete)
    if (campos.activo !== undefined) {
        camposFiltrados.activo = campos.activo;
    }
    // si no hay campos válidos no se ejecuta el UPDATE
    if (Object.keys(camposFiltrados).length === 0) return existente;
    const parteSet = Object.keys(camposFiltrados).map(c => `${c} = ?`).join(', ');
    const valores  = Object.values(camposFiltrados);
    await pool.query(
        `UPDATE users SET ${parteSet} WHERE id = ?`,
        [...valores, Number(id)]
    );
    return getUserById(id);
}

// ── NUEVA FUNCIÓN: busca usuario por email ───────────────────────────────────
// GET interno — se usa en loginService y registerService de auth.service.js
// Antes el login buscaba por documento. Ahora busca por email porque el
// formulario de login del frontend pide email + contraseña.
// Retorna el usuario encontrado (con el campo password incluido para bcrypt),
// o undefined si no existe ningún usuario con ese email.
export async function getUserByEmail(email) {
    // La consulta usa un placeholder ? para evitar inyección SQL (mysql2 lo reemplaza)
    const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email.toString().toLowerCase().trim()]
    );
    // rows[0] es el primer resultado o undefined si no hay coincidencia
    return rows[0];
}

// ── CREAR USUARIO CON CONTRASEÑA Y ROL ───────────────────────────────────────
// Se usa exclusivamente desde registerService en auth.service.js.
// La función createUser que ya existe en este archivo no acepta password ni role,
// por eso se crea esta variante separada para el flujo de registro.
//
// Parámetros:
//   name     — nombre completo del usuario
//   documento — número de documento de identidad (solo dígitos)
//   email    — correo electrónico del usuario
//   password — contraseña ya hasheada con bcrypt (NUNCA texto plano)
//   role     — rol del usuario ('user' o 'admin'), por defecto 'user'
//
// Retorna el objeto completo del usuario recién creado (incluyendo password
// para que registerService pueda excluirlo antes de responder al cliente).
export async function createUserWithPassword({ name, documento, email, password, role = 'user' }) {
    // INSERT con los 5 campos: los 3 básicos + password hasheada + role
    const [result] = await pool.query(
        'INSERT INTO users (name, documento, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, documento, email, password, role]
    );
    // result.insertId es el id AUTO_INCREMENT que MySQL asignó a la nueva fila
    // Se usa getUserById (ya existe en este archivo) para retornar el objeto completo
    return getUserById(result.insertId);
}

// elimina un usuario de la tabla users
// primero guarda el objeto para retornarlo y confirmar qué se eliminó
export async function deleteUser(id) {
    const aEliminar = await getUserById(id);
    if (!aEliminar) return null;
    // Hard delete: elimina físicamente el usuario
    await pool.query('DELETE FROM users WHERE id = ?', [Number(id)]);
    return aEliminar;
}

// ── ACTUALIZAR ROL DE USUARIO ────────────────────────────────────────────────
// Se usa desde changeUserRole en users.controller.js.
// Solo actualiza el campo 'role', no toca ningún otro dato del usuario.
//
// Parámetros:
//   id   — id numérico del usuario a modificar
//   role — nuevo rol: 'admin' o 'user' (validado en el schema antes de llegar aquí)
//
// Retorna el usuario actualizado sin el campo password,
// o null si el id no existe en la tabla users.
export async function updateUserRole(id, role) {
    // Verificar que el usuario existe antes de intentar actualizar
    const existente = await getUserById(id);
    if (!existente) return null;

    // UPDATE solo modifica el campo role, no el updated_up timestamp
    // mysql2 reemplaza los ? por los valores de forma segura (evita SQL injection)
    await pool.query(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, Number(id)]
    );

    // Retornar el usuario con los datos actualizados desde MySQL
    // getUserById incluye todos los campos excepto que el controlador los filtre
    return getUserById(id);
}

// ── OBTENER ROLES Y PERMISOS DE UN USUARIO (RBAC) ────────────────────────────
// Se usa en el middleware authorization.middleware.js para verificar permisos.
// También se usa en loginService para devolver los roles al frontend tras el login.

// Consulta las 4 tablas RBAC en una sola query con JOINs:
//   users → user_roles → roles → role_permissions → permissions

// Parámetro: userId — id numérico del usuario

// Retorna un arreglo de objetos con la estructura:
//   [{ name: 'admin', permissions: ['tasks.create', 'users.delete', ...] }, ...]

// Si el usuario no tiene roles en la tabla user_roles, retorna un arreglo vacío [].
// Esto puede pasar con usuarios registrados antes de ejecutar rbac.sql.
export async function getUserRolesAndPermissions(userId) {
 
    // La query une las 4 tablas RBAC con LEFT JOINs para que si un rol
    // no tiene permisos asignados, igual aparezca en el resultado (con permission NULL).
    // El LEFT JOIN en role_permissions y permissions garantiza que roles sin permisos
    // también se incluyan en la respuesta en lugar de desaparecer del resultado.
    const [rows] = await pool.query(
        `SELECT
            r.name        AS roleName,
            p.code        AS permissionCode
        FROM user_roles ur
        INNER JOIN roles       r  ON r.id  = ur.role_id
        LEFT  JOIN role_permissions rp ON rp.role_id = r.id
        LEFT  JOIN permissions  p  ON p.id  = rp.permission_id
        WHERE ur.user_id = ?
        ORDER BY r.name, p.code`,
        [Number(userId)]
    );
 
    // Si el usuario no tiene roles en user_roles, retornar arreglo vacío
    if (rows.length === 0) return [];
 
    // Agrupar los resultados por nombre de rol, acumulando sus permisos en un arreglo.
    // rows puede tener múltiples filas con el mismo roleName (una por cada permiso).
    // Necesitamos convertirlas a: [{ name: 'admin', permissions: ['tasks.create', ...] }]
    const rolesMap = {};
 
    rows.forEach(function(fila) {
        // Si este rol no está en el mapa todavía, creamos su entrada
        if (!rolesMap[fila.roleName]) {
            rolesMap[fila.roleName] = {
                name:        fila.roleName,
                permissions: [],
            };
        }
        // Si tiene un permiso asignado (puede ser NULL si el rol no tiene permisos),
        // lo agregamos al arreglo de permisos del rol
        if (fila.permissionCode) {
            rolesMap[fila.roleName].permissions.push(fila.permissionCode);
        }
    });
 
    // Object.values convierte el mapa de objetos a un arreglo de roles
    return Object.values(rolesMap);
}

// ── ACTUALIZAR CONTRASEÑA DE USUARIO ─────────────────────────────────────────
// Se usa desde:
//   1. PATCH /api/users/:id/password (cambio de contraseña desde el panel)
//   2. POST /api/auth/reset-password (restablecimiento por código de Mailtrap)

// Parámetro: id — id numérico del usuario
// Parámetro: nuevaPasswordHasheada — contraseña ya hasheada con bcrypt (NUNCA texto plano)

// Retorna: el usuario actualizado, o null si el id no existe.
export async function updateUserPassword(id, nuevaPasswordHasheada) {
    // Verificar que el usuario existe antes de intentar actualizar
    const existente = await getUserById(id);
    if (!existente) return null;
 
    // Solo actualiza la columna password — ningún otro campo se toca
    await pool.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [nuevaPasswordHasheada, Number(id)]
    );
 
    // Retornar el usuario con los datos actualizados
    return getUserById(id);
}