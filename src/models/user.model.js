// MÓDULO: models/user.model.js
// CAPA: Modelo (datos y operaciones sobre la tabla users en MySQL)
//
// Responsabilidad única: interactuar con la tabla users de MySQL.
// NUNCA conoce req, res ni Express.
//
// pool.query retorna [filas, metadatos] — desestructuramos con [rows]
// para tomar solo las filas y descartar los metadatos que no necesitamos.

import pool from '../database/db.connection.js';

// Campos que se pueden actualizar desde el exterior vía PUT /api/users/:id.
// Cualquier otro campo que llegue en el body se ignora silenciosamente.
//
// REGLA DE NEGOCIO: documento, email y name son DATOS PERSONALES inmutables
// tras el registro. Ninguno está en esta lista; documento y email también
// están protegidos por el trigger SQL tr_users_immutability como defensa
// en profundidad (bloquea incluso UPDATE directos en Workbench).
const CAMPOS_ACTUALIZABLES = [];

// RF03 — READ: retorna los usuarios de la tabla users con sus roles agregados.
//
// REGLA DE NEGOCIO (rbac.sql, Consulta 2):
//   Los usuarios "admin puros" (que SOLO tienen el rol admin) NO aparecen
//   en la lista. Los admins solo se ven si tienen al menos otro rol
//   adicional (ej. admin + instructor). Los usuarios sin rol admin
//   siempre se incluyen.
//
// El HAVING aplica las dos condiciones:
//   - Usuarios sin rol asignado (roles_csv NULL) → se incluyen
//   - Usuarios cuyo conjunto de roles NO contiene 'admin' → se incluyen
//   - Usuarios con 'admin' pero también otros roles → se incluyen
//   - Usuarios con 'admin' como único rol → se ocultan
//
// GROUP_CONCAT junta los nombres separados por coma; luego JS los separa en un array.
export async function getAllUsers() {
    const [rows] = await pool.query(
        `SELECT
            u.*,
            GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') AS roles_csv,
            COUNT(DISTINCT r.id) AS total_roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles      r  ON r.id       = ur.role_id
         GROUP BY u.id
         HAVING
            roles_csv IS NULL
            OR NOT FIND_IN_SET('admin', roles_csv)
            OR (FIND_IN_SET('admin', roles_csv) AND total_roles > 1)`
    );
    return rows.map(({ roles_csv, total_roles, ...rest }) => ({
        ...rest,
        roles: roles_csv ? roles_csv.split(',') : [],
    }));
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

// actualiza los campos de un usuario existente.
// Solo se permiten los campos definidos en CAMPOS_ACTUALIZABLES (actualmente
// vacío por la regla de inmutabilidad de datos personales). Cualquier otro
// campo que llegue en el body se ignora silenciosamente.
export async function updateUser(id, campos) {
    const existente = await getUserById(id);
    if (!existente) return null;

    const camposFiltrados = {};
    for (const campo of CAMPOS_ACTUALIZABLES) {
        if (campos[campo] !== undefined) {
            camposFiltrados[campo] = campos[campo];
        }
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
    const [result] = await pool.query(
        'INSERT INTO users (name, documento, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, documento, email, password, role]
    );
    const userId = result.insertId;
    // 2. SOPORTE MULTI-ROL: Asociar el rol inicial en la tabla pivote user_roles
    // Buscamos el ID del rol solicitado en la tabla roles
    const [rolesFound] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    
    if (rolesFound.length > 0) {
        // Insertamos la relación en la tabla pivote
        await pool.query(
            'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, rolesFound[0].id]
        );
    }

    // Retornar el objeto completo incluyendo los campos generados por la BD
    return getUserById(userId);
}

// elimina un usuario de la tabla users.
// Reglas de negocio:
//   - Si el usuario tiene tareas que aún NO están en estado 'completada',
//     se bloquea el borrado (regla: no perder trazabilidad de trabajo pendiente).
//     Devuelve { error, codigo: 409 } para que el controlador responda 409 Conflict.
//   - Si el id no existe, retorna null para que el controlador responda 404.
//   - En cualquier otro caso elimina físicamente la fila y retorna el objeto eliminado.
export async function deleteUser(id) {
    const aEliminar = await getUserById(id);
    if (!aEliminar) return null;

    // Contar tareas del usuario que NO están completadas.
    // JOIN contra task_assignees (3FN): se cuentan las tareas distintas en las
    // que el usuario aparece como asignado y cuyo estado no es 'completada'.
    const [filas] = await pool.query(
        `SELECT COUNT(DISTINCT t.id) AS cantidad
         FROM tasks t
         INNER JOIN task_assignees ta ON ta.task_id = t.id
         WHERE ta.user_id = ?
           AND t.status <> 'completada'`,
        [Number(id)]
    );
    const tareasAbiertas = filas[0].cantidad;
    if (tareasAbiertas > 0) {
        return {
            error: `No se puede eliminar a "${aEliminar.name}": tiene ${tareasAbiertas} tarea(s) sin completar`,
            codigo: 409,
        };
    }

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

    // 1. Actualizar el campo legacy en la tabla principal
    await pool.query(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, Number(id)]
    );

    // 2. Sincronizar con la tabla RBAC user_roles (Soporte Multi-Rol)
    const [rolesFound] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (rolesFound.length > 0) {
        await pool.query('DELETE FROM user_roles WHERE user_id = ?', [Number(id)]);
        await pool.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [Number(id), rolesFound[0].id]
        );
    }

    return getUserById(id);
}

// ── HELPER INTERNO: SINCRONIZAR CAMPO LEGACY users.role ─────────────────────
// El campo VARCHAR users.role todavía lo usa el JWT y requireAdmin. Después
// de cualquier mutación en user_roles hay que dejarlo coherente con el rol
// de mayor prioridad del usuario. Prioridad: admin > instructor > user.
async function syncLegacyUserRole(userId) {
    const nombres = await getUserRoleNames(userId);
    if (nombres.length === 0) return;
    const prioridad = ['admin', 'instructor', 'user'];
    const legacyRole = prioridad.find(p => nombres.includes(p)) || nombres[0];
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [legacyRole, Number(userId)]);
}

// ── ASIGNAR ROL ADICIONAL ───────────────────────────────────────────────────
// Permite que un usuario tenga múltiples roles simultáneamente sin borrar los anteriores.
export async function addRoleToUser(userId, roleName) {
    const [rolesFound] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (rolesFound.length === 0) return null;

    // INSERT IGNORE evita errores si el usuario ya tiene ese rol asignado
    await pool.query(
        'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [Number(userId), rolesFound[0].id]
    );

    await syncLegacyUserRole(userId);
    return true;
}

// ── ELIMINAR ROL ESPECÍFICO ─────────────────────────────────────────────────
// Bloquea quitar el último rol: un usuario sin roles no podría hacer nada.
// Retorna { error } cuando el caller intenta quitar el único rol restante.
export async function removeRoleFromUser(userId, roleName) {
    const [rolesFound] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    if (rolesFound.length === 0) return null;

    const nombresActuales = await getUserRoleNames(userId);
    if (nombresActuales.length <= 1 && nombresActuales.includes(roleName)) {
        return { error: 'No se puede quitar el último rol del usuario' };
    }

    await pool.query(
        'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
        [Number(userId), rolesFound[0].id]
    );

    await syncLegacyUserRole(userId);
    return true;
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

// ── LISTAR TODOS LOS ROLES DEL SISTEMA ──────────────────────────────────────
// Se usa en GET /api/roles para que el frontend pueda renderizar la lista
// de roles disponibles (checkboxes en el modal de asignación).
export async function getAllRoles() {
    const [rows] = await pool.query(
        'SELECT id, name, description FROM roles ORDER BY name'
    );
    return rows;
}

// ── OBTENER LOS NOMBRES DE LOS ROLES DE UN USUARIO ──────────────────────────
// Devuelve solo el array de strings ['admin', 'instructor'] — pensado para
// GET /api/users/:id/roles, que el frontend usa para precargar los checkboxes.
export async function getUserRoleNames(userId) {
    const [rows] = await pool.query(
        `SELECT r.name
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ?
         ORDER BY r.name`,
        [Number(userId)]
    );
    return rows.map(r => r.name);
}

// ── REEMPLAZAR EL SET COMPLETO DE ROLES DE UN USUARIO ───────────────────────
// PUT /api/users/:id/roles — pensado para una UI con checkboxes que envía la
// lista completa de roles que el usuario DEBE tener después del guardado.
//
// Estrategia: transacción para garantizar atomicidad — si algo falla, no
// queda el usuario sin roles a la mitad de la operación.
//   1. DELETE de todas las filas previas en user_roles para ese user_id
//   2. INSERT en bloque de las nuevas filas (una por cada rol del array)
//   3. Sincronizar el campo legacy users.role con el primer rol del array
//      para que requireAdmin y el JWT sigan funcionando con clientes viejos
export async function setUserRoles(userId, roleNames) {
    const existente = await getUserById(userId);
    if (!existente) return null;

    // Resolver los IDs de los roles a partir de los nombres
    const [rolesEncontrados] = await pool.query(
        `SELECT id, name FROM roles WHERE name IN (?)`,
        [roleNames]
    );

    // Si algún nombre no existe en la tabla roles, fallamos antes de tocar nada
    if (rolesEncontrados.length !== roleNames.length) {
        const nombresEncontrados = rolesEncontrados.map(r => r.name);
        const noExisten = roleNames.filter(n => !nombresEncontrados.includes(n));
        return { error: `Roles no existen en el sistema: ${noExisten.join(', ')}` };
    }

    // Transacción: si una sentencia falla, revertimos todo
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();

        // 1. Borrar los roles actuales del usuario
        await conexion.query(
            'DELETE FROM user_roles WHERE user_id = ?',
            [Number(userId)]
        );

        // 2. Insertar los nuevos roles en bloque
        const valores = rolesEncontrados.map(r => [Number(userId), r.id]);
        await conexion.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ?',
            [valores]
        );

        // 3. Sincronizar campo legacy users.role
        //    Prioridad: admin > instructor > user (para que requireAdmin siga funcionando)
        const prioridad = ['admin', 'instructor', 'user'];
        const legacyRole = prioridad.find(p => roleNames.includes(p)) || roleNames[0];
        await conexion.query(
            'UPDATE users SET role = ? WHERE id = ?',
            [legacyRole, Number(userId)]
        );

        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }

    return getUserById(userId);
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