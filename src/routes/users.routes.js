// MÓDULO: routes/users.routes.js
// CAPA: Rutas (conecta URLs con controladores)
//
// Responsabilidad única: definir qué función del controlador
// maneja cada combinación de método HTTP + ruta de usuarios.
//
// CORRECCIÓN APLICADA EN ESTA VERSIÓN:
//   La ruta GET /:userId/tasks estaba DESPUÉS de GET /:id.
//   Express evalúa las rutas en el orden en que están definidas,
//   y /:id capturaba "tasks" como valor del parámetro id antes
//   de que Express llegara a evaluar /:userId/tasks.
//   Solución: mover /:userId/tasks ANTES de /:id.
//
// ACTUALIZACIÓN — Validaciones con Zod:
//   Se agregó validateSchema en las rutas POST y PUT para proteger
//   la creación y actualización de usuarios con reglas de negocio.

import { Router } from 'express';

import {
    getUsers,
    getUserById,
    getUserByDocumento,
    createUser,
    updateUser,
    deleteUser,
    getUserTasks,
    changeUserRole,
    changeUserPassword,
    listAvailableRoles,
    getUserRoles,
    addUserRole,
    deleteUserRole,
    replaceUserRoles,
} from '../controller/users.controller.js';

import { validateSchema } from '../middlewares/validator.middleware.js';

import {
    createUserSchema,
    updateUserSchema,
    changeRoleSchema,
    assignRoleSchema,
    setRolesSchema,
} from '../../schemas/user.schema.js';

import { verifyToken, requireAdmin } from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/authorization.middleware.js';

const router = Router();

// ── RUTAS SIN PARÁMETRO DINÁMICO ─────────────────────────────────────────────

// GET  /api/users — lista todos los usuarios del sistema (no requiere validación)
router.get('/', verifyToken, checkPermission('users.view'), getUsers);

// POST /api/users — crea un usuario nuevo
// validateSchema(createUserSchema) valida documento, name y email antes de crear
router.post('/', verifyToken, checkPermission('users.edit'), validateSchema(createUserSchema), createUser);

// ── RUTAS CON SEGMENTO FIJO AL FINAL (van ANTES de /:id) ─────────────────────

// GET /api/users/available-roles — catálogo de roles del sistema (admin/instructor/user).
// CRÍTICO: va ANTES de /:id para que Express no interprete "available-roles" como un id.
router.get('/available-roles', verifyToken, checkPermission('users.assign.role'), listAvailableRoles);

// GET /api/users/by-document/:documento — busca un usuario por su número de documento.
router.get('/by-document/:documento', verifyToken, checkPermission('users.view'), getUserByDocumento);

// GET /api/users/:userId/tasks — retorna todas las tareas asignadas a un usuario.
router.get('/:userId/tasks', verifyToken, checkPermission('tasks.view.all'), getUserTasks);

// ── RUTAS RBAC MULTI-ROL ────────────────────────────────────────────────────
// Estas rutas trabajan sobre el array de roles del usuario en la tabla pivote
// user_roles. Conviven con el endpoint legacy PATCH /:id/role (single-role).
//
// GET    /:id/roles                    — roles actuales del usuario (precargar checkboxes)
// POST   /:id/roles                    — agregar un rol sin borrar los demás
// DELETE /:id/roles/:roleName          — quitar un rol específico (bloquea si es el último)
// PUT    /:id/roles                    — reemplazar el set completo de roles (guardar checkboxes)
router.get('/:id/roles',  verifyToken, requireAdmin, getUserRoles);
router.post('/:id/roles', verifyToken, requireAdmin, validateSchema(assignRoleSchema), addUserRole);
router.delete('/:id/roles/:roleName', verifyToken, requireAdmin, deleteUserRole);
router.put('/:id/roles',  verifyToken, requireAdmin, validateSchema(setRolesSchema), replaceUserRoles);

// ── RUTAS CON PARÁMETRO DINÁMICO /:id (van DESPUÉS de las específicas) ────────

// PATCH /api/users/:id/password — cambio de contraseña del usuario logueado
// verifyToken verifica que la petición viene de un usuario autenticado
// Solo el usuario dueño del token puede cambiar su propia contraseña
router.patch('/:id/password', verifyToken, changeUserPassword);

// GET    /api/users/:id — obtiene un usuario por su id numérico (no requiere validación)
router.get('/:id', verifyToken, checkPermission('users.view'), getUserById);

// PUT    /api/users/:id — actualiza los datos de un usuario existente
// updateUserSchema usa .partial() — los campos son opcionales pero si vienen, se validan
router.put('/:id', verifyToken, checkPermission('users.edit'), validateSchema(updateUserSchema), updateUser);

// DELETE /api/users/:id — elimina un usuario del sistema.
// Requiere: token válido + permiso RBAC users.delete.
// El controlador además bloquea la auto-eliminación y respeta la regla
// "usuarios con tareas pendientes no se pueden eliminar" (409 Conflict).
router.delete('/:id', verifyToken, checkPermission('users.delete'), deleteUser);

// PATCH /api/users/:id/role — cambia el rol de un usuario
// requireAdmin verifica adicionalmente que el usuario autenticado sea admin
// validateSchema(changeRoleSchema) valida que role sea 'admin' o 'user'
router.patch('/:id/role', verifyToken, requireAdmin, validateSchema(changeRoleSchema), changeUserRole);

export default router;