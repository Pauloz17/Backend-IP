// MÓDULO: controller/users.controller.js
// CAPA: Controlador (recibe HTTP, llama el modelo, responde HTTP)
//
// Responsabilidad única: manejar las peticiones HTTP de usuarios.
// NUNCA maneja datos directamente — solo recibe req, llama el modelo y responde res.
//
// REFACTORIZACIÓN APLICADA:
//   Se eliminaron todos los bloques try/catch manuales y las líneas
//   res.status().json() directas. Ahora se usan:
//   - catchAsync: para capturar errores async automáticamente
//   - successResponse: para respuestas exitosas con formato estándar
//   - errorResponse: para respuestas de error con formato estándar

import { catchAsync }                     from '../utils/catchAsync.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

import {
    getAllUsers,
    getUserById         as findUserById,
    getUserByDocumento  as findUserByDocumento,
    createUser          as insertUser,
    updateUser          as modifyUser,
    deleteUser          as removeUser,
    updateUserRole,
    addRoleToUser,
    removeRoleFromUser,
    getUserRoleNames,
    setUserRoles,
    getAllRoles,
} from '../models/user.model.js';

import { getTasksByUserId } from '../models/task.model.js';

import bcrypt from 'bcryptjs';
import { enviarNotificacionCambioPassword } from '../services/email.service.js';
import { updateUserPassword } from '../models/user.model.js';

// GET /api/users
// Retorna todos los usuarios con el formato estándar { success, message, data }
export const getUsers = catchAsync(async (req, res) => {
    const usuarios = await getAllUsers();
    return successResponse(res, 'Usuarios obtenidos correctamente', usuarios);
});

// GET /api/users/:id
// Retorna un usuario por su id o 404 si no existe
export const getUserById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const usuario = await findUserById(id);

    if (!usuario) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    return successResponse(res, 'Usuario encontrado', usuario);
});

// POST /api/users
// Crea un usuario nuevo
// Cuerpo esperado: { documento, name, email }
// NOTA: la validación de campos obligatorios y formatos la realiza
// el middleware validateSchema(createUserSchema) antes de llegar aquí.
// El controlador solo recibe datos ya validados y limpios.
export const createUser = catchAsync(async (req, res) => {
    const { documento, name, email } = req.body;
    const nuevoUsuario = await insertUser({ documento, name, email });
    return successResponse(res, 'Usuario creado correctamente', nuevoUsuario, 201);
});

// PUT /api/users/:id
// Actualiza los datos de un usuario existente
// El modelo solo permite actualizar: documento, name, email
export const updateUser = catchAsync(async (req, res) => {
    const { id }             = req.params;
    const campos             = req.body;
    const usuarioActualizado = await modifyUser(id, campos);

    if (!usuarioActualizado) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    return successResponse(res, 'Usuario actualizado correctamente', usuarioActualizado);
});

// DELETE /api/users/:id
// Elimina un usuario aplicando las reglas de negocio:
//   1. El usuario autenticado NO puede eliminarse a sí mismo (403).
//   2. El modelo bloquea el borrado si tiene tareas sin completar (409).
//   3. Si el id no existe, responde 404.
//
// La ruta agrega verifyToken + requireAdmin antes de llegar aquí, así que
// solo un admin autenticado puede invocar este endpoint.
export const deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;

    // Regla 1: bloqueo de auto-eliminación
    if (Number(req.usuario.id) === Number(id)) {
        return errorResponse(res, 'No puedes eliminar tu propia cuenta', 403);
    }

    const resultado = await removeUser(id);

    // Regla 3: id no existe
    if (resultado === null) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    // Regla 2: el modelo bloqueó por tareas pendientes — propagamos el 409
    if (resultado && resultado.error) {
        return errorResponse(res, resultado.error, resultado.codigo);
    }

    return successResponse(
        res,
        `Usuario "${resultado.name}" eliminado correctamente`
    );
});

// GET /api/users/by-document/:documento
// Busca un usuario por su número de documento
// Va ANTES de /:id en las rutas para que Express no capture "by-document" como id
export const getUserByDocumento = catchAsync(async (req, res) => {
    const { documento } = req.params;
    const usuario       = await findUserByDocumento(documento);

    if (!usuario) {
        return errorResponse(
            res,
            `No existe un usuario con el documento ${documento}`,
            404
        );
    }

    return successResponse(res, 'Usuario encontrado', usuario);
});

// GET /api/users/:userId/tasks
// Retorna todas las tareas asignadas a un usuario específico
export const getUserTasks = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const tareas     = await getTasksByUserId(userId);
    return successResponse(res, 'Tareas del usuario obtenidas correctamente', tareas);
});

// ── PATCH /api/users/:id/role ────────────────────────────────────────────────
// Cambia el rol de un usuario entre 'admin' y 'user'.
// Solo accesible para usuarios autenticados con role = 'admin'.
// (El middleware requireAdmin verifica esto antes de que llegue aquí.)
//
// Cuerpo esperado (validado por validateSchema(changeRoleSchema)):
//   { role: 'admin' | 'user' }
//
// Respuesta exitosa 200: { success, message, data: usuario sin password }
// Error 404: el id no existe
export const changeUserRole = catchAsync(async (req, res) => {
    const { id }       = req.params;
    const { role }     = req.body;

    // updateUserRole actualiza solo el campo role en MySQL
    // Retorna el usuario actualizado, o null si el id no existe
    const usuarioActualizado = await updateUserRole(id, role);

    if (!usuarioActualizado) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    // Construir la respuesta sin el campo password
    // Se usa desestructuración para excluir el campo sensible antes de enviar
    const { password: _ignorado, ...usuarioSinPassword } = usuarioActualizado;

    return successResponse(
        res,
        `Rol de ${usuarioActualizado.name} actualizado a '${role}' correctamente`,
        usuarioSinPassword
    );
});

// ── PATCH /api/users/:id/password ────────────────────────────────────────────
// Cambio de contraseña desde el panel del usuario logueado.
// Solo el usuario dueño del token puede cambiar su propia contraseña.
//
// Cuerpo esperado: { currentPassword, newPassword }
// Respuesta 200: contraseña actualizada correctamente
// Respuesta 400: contraseña actual incorrecta o datos inválidos
// Respuesta 403: el usuario intenta cambiar la contraseña de otro usuario
export const changeUserPassword = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
 
    // Validar que llegaron los campos necesarios
    if (!currentPassword || !newPassword) {
        return errorResponse(res, 'La contraseña actual y la nueva contraseña son obligatorias', 400);
    }
 
    // Validar longitud mínima de la nueva contraseña
    if (newPassword.length < 6) {
        return errorResponse(res, 'La nueva contraseña debe tener al menos 6 caracteres', 400);
    }
 
    // Solo el usuario logueado puede cambiar su propia contraseña
    // req.usuario.id viene del token JWT verificado por verifyToken
    if (Number(req.usuario.id) !== Number(id)) {
        return errorResponse(res, 'No tienes permiso para cambiar la contraseña de otro usuario', 403);
    }
 
    // Obtener el usuario completo (incluyendo el hash de la contraseña)
    const usuario = await findUserById(Number(id));
    if (!usuario) {
        return errorResponse(res, 'Usuario no encontrado', 404);
    }
 
    // Verificar que la contraseña actual sea correcta con bcrypt
    const passwordCorrecta = await bcrypt.compare(currentPassword, usuario.password);
    if (!passwordCorrecta) {
        return errorResponse(res, 'La contraseña actual es incorrecta', 400);
    }
 
    // Hashear la nueva contraseña antes de guardarla
    const SALT_ROUNDS = 10;
    const nuevaPasswordHasheada = await bcrypt.hash(newPassword, SALT_ROUNDS);
 
    // Actualizar la contraseña en la BD
    await updateUserPassword(Number(id), nuevaPasswordHasheada);

    // Se informa al correo registrado sin incluir datos sensibles.
    await enviarNotificacionCambioPassword(usuario.email);

    return successResponse(res, 'Contraseña actualizada correctamente', null);
});

// ── GET /api/users/available-roles ───────────────────────────────────────────
// Lista los roles que el sistema reconoce (admin, instructor, user).
// El frontend lo usa para renderizar los checkboxes del modal de asignación.
export const listAvailableRoles = catchAsync(async (req, res) => {
    const roles = await getAllRoles();
    return successResponse(res, 'Roles disponibles obtenidos correctamente', roles);
});

// ── GET /api/users/:id/roles ─────────────────────────────────────────────────
// Devuelve los roles que tiene asignados un usuario.
// El frontend lo usa para precargar los checkboxes del modal de roles.
export const getUserRoles = catchAsync(async (req, res) => {
    const { id } = req.params;
    const usuario = await findUserById(id);
    if (!usuario) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }
    const roles = await getUserRoleNames(id);
    return successResponse(res, 'Roles del usuario obtenidos correctamente', { userId: Number(id), roles });
});

// ── POST /api/users/:id/roles ────────────────────────────────────────────────
// Agrega un rol al usuario SIN borrar los que ya tiene.
// Body: { role: 'admin' | 'user' | 'instructor' } (validado por assignRoleSchema)
export const addUserRole = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const usuario = await findUserById(id);
    if (!usuario) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    const resultado = await addRoleToUser(id, role);
    if (resultado === null) {
        return errorResponse(res, `El rol '${role}' no existe en el sistema`, 400);
    }

    const roles = await getUserRoleNames(id);
    return successResponse(
        res,
        `Rol '${role}' asignado a ${usuario.name} correctamente`,
        { userId: Number(id), roles }
    );
});

// ── DELETE /api/users/:id/roles/:roleName ────────────────────────────────────
// Quita un rol específico del usuario sin tocar los demás.
// Bloquea quitar el último rol (un usuario sin roles no puede operar).
export const deleteUserRole = catchAsync(async (req, res) => {
    const { id, roleName } = req.params;

    const usuario = await findUserById(id);
    if (!usuario) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }

    const resultado = await removeRoleFromUser(id, roleName);
    if (resultado === null) {
        return errorResponse(res, `El rol '${roleName}' no existe en el sistema`, 400);
    }
    if (resultado && resultado.error) {
        return errorResponse(res, resultado.error, 400);
    }

    const roles = await getUserRoleNames(id);
    return successResponse(
        res,
        `Rol '${roleName}' removido de ${usuario.name} correctamente`,
        { userId: Number(id), roles }
    );
});

// ── PUT /api/users/:id/roles ─────────────────────────────────────────────────
// Reemplaza la lista completa de roles del usuario por la que llega en el body.
// Pensado para una UI con checkboxes que envía el set final tras "Guardar".
// Body: { roles: ['admin', 'instructor'] } (validado por setRolesSchema)
export const replaceUserRoles = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { roles } = req.body;

    const resultado = await setUserRoles(id, roles);
    if (resultado === null) {
        return errorResponse(res, `Usuario con id ${id} no encontrado`, 404);
    }
    if (resultado && resultado.error) {
        return errorResponse(res, resultado.error, 400);
    }

    const rolesActuales = await getUserRoleNames(id);
    const { password: _ignorado, ...usuarioSinPassword } = resultado;
    return successResponse(
        res,
        `Roles de ${resultado.name} actualizados correctamente`,
        { ...usuarioSinPassword, roles: rolesActuales }
    );
});