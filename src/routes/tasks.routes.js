// MÓDULO: routes/tasks.routes.js
// CAPA: Rutas (conecta URLs con controladores)

// Responsabilidad única: definir qué función del controlador
// maneja cada combinación de método HTTP + ruta de tareas.

// REGLA CRÍTICA DE ORDEN:
// Express evalúa las rutas en el orden en que están definidas.
// Las rutas /filter y /dashboard deben ir ANTES de /:id.
// Si /:id estuviera primero, Express capturaría "filter" y "dashboard"
// como valores del parámetro id y nunca llegaría a esas rutas específicas.

import { Router } from 'express';

import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    assignUsersToTask,
    getAssignedUsers,
    removeUserFromTask,
    filterTasks,
    getDashboard
} from '../controller/tasks.controller.js';

// Se importa el middleware genérico de validación
import { validateSchema } from '../middlewares/validator.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/authorization.middleware.js';

// Se importan los esquemas de validación para cada operación de tareas
import {
    createTaskSchema,
    updateTaskSchema,
    updateTaskStatusSchema,
    assignUsersSchema,
} from '../../schemas/task.schema.js';

const router = Router();

// ── RUTAS SIN PARÁMETRO DINÁMICO ──
// Deben ir PRIMERO para que Express no las confunda con /:id

// GET /api/tasks/filter — filtra por ?status y/o ?userId
router.get('/filter', filterTasks);

// GET /api/tasks/dashboard — estadísticas generales
router.get('/dashboard', getDashboard);

// GET /api/tasks/all — lista todas las tareas (requiere permiso RBAC)
router.get('/all', verifyToken, checkPermission('tasks.view.all'), getTasks);

// ── RUTAS PRINCIPALES ──

// GET  /api/tasks — lista todas las tareas (no requiere validación de body)
router.get('/', getTasks);

// POST /api/tasks — crea una tarea nueva
// validateSchema(createTaskSchema) actúa como guardia antes de createTask
router.post('/', verifyToken, checkPermission('tasks.create'), validateSchema(createTaskSchema), createTask);

// GET    /api/tasks/:id — obtiene una tarea por id (no requiere validación de body)
router.get('/:id', getTaskById);

// PUT    /api/tasks/:id — actualiza una tarea completa
// updateTaskSchema usa .partial() así que todos los campos son opcionales
router.put('/:id', validateSchema(updateTaskSchema), updateTask);

// DELETE /api/tasks/:id — elimina una tarea (no requiere validación de body)
router.delete('/:id', verifyToken, checkPermission('tasks.delete.all'), deleteTask);

// ── ESTADO ──

// PATCH /api/tasks/:id/status — cambia solo el estado
// Solo valida que status tenga uno de los tres valores permitidos
router.patch('/:id/status', validateSchema(updateTaskStatusSchema), updateTaskStatus);

// ── ASIGNACIÓN DE USUARIOS ──

// POST   /api/tasks/:taskId/assign — asigna usuarios a una tarea
// Valida que userIds sea un arreglo con al menos un número
router.post('/:taskId/assign', validateSchema(assignUsersSchema), assignUsersToTask);

// GET    /api/tasks/:taskId/users — lista usuarios asignados (no requiere validación)
router.get('/:taskId/users', getAssignedUsers);

// DELETE /api/tasks/:taskId/users/:userId — quita un usuario (no requiere validación de body)
router.delete('/:taskId/users/:userId', removeUserFromTask);

export default router;