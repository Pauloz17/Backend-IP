// MÓDULO: schemas/task.schema.js
// CAPA: Schemas (moldes de validación de datos)
//
// Responsabilidad única: definir la forma y las reglas que deben cumplir
// los datos de una tarea antes de llegar al controlador.
// Este archivo NO toca el DOM, NO hace peticiones HTTP, NO accede a la BD.
//
// Se usa Zod como librería estándar de validación de esquemas.
//
// ACTUALIZACIÓN v3.2.0:
//   Se agrega "pendiente_aprobacion" como cuarto estado válido del sistema.
//   Lo pone el usuario cuando considera que terminó su tarea y necesita
//   que el admin la revise antes de marcarla como completada.
//   Los cuatro estados siguen el flujo de trabajo del proyecto:
//     pendiente → en_progreso → pendiente_aprobacion → completada

import { z } from 'zod';

// Lista centralizada de estados válidos del sistema.
// Se define aquí para reutilizarla en los tres schemas sin repetirla.
const ESTADOS_VALIDOS = [
    'pendiente',
    'en_progreso',
    'pendiente_aprobacion',
    'completada',
];

// Esquema para CREAR una tarea — POST /api/tasks
// Define qué campos son obligatorios y qué restricciones tiene cada uno
export const createTaskSchema = z.object({

    // title: obligatorio, mínimo 3 caracteres, máximo 200
    // Evita que se creen tareas sin nombre o con nombres sin sentido
    title: z
        .string({
            required_error:     'El título de la tarea es obligatorio',
            invalid_type_error: 'El título debe ser una cadena de texto',
        })
        .min(3,   'El título debe tener al menos 3 caracteres')
        .max(200, 'El título no puede exceder los 200 caracteres'),

    // description: opcional — puede no venir en el body
    // Si viene, no puede superar 500 caracteres
    description: z
        .string({ invalid_type_error: 'La descripción debe ser una cadena de texto' })
        .max(500, 'La descripción no puede exceder los 500 caracteres')
        .optional(),

    // status: obligatorio, solo acepta los cuatro valores del sistema
    // ACTUALIZACIÓN: se agrega "pendiente_aprobacion" como cuarto estado
    status: z.enum(
        ESTADOS_VALIDOS,
        {
            required_error:     'El estado de la tarea es obligatorio',
            invalid_type_error: 'El estado debe ser una cadena de texto',
            message:            "El estado debe ser: 'pendiente', 'en_progreso', 'pendiente_aprobacion' o 'completada'",
        }
    ),

    // assignedUsers: opcional — arreglo de números (IDs de usuarios)
    // Si viene, debe ser un arreglo y cada elemento debe ser un número entero positivo
    assignedUsers: z
        .array(
            z.number({
                invalid_type_error: 'Cada ID de usuario debe ser un número',
            }).int('Los IDs de usuario deben ser números enteros')
              .positive('Los IDs de usuario deben ser números positivos'),
            { invalid_type_error: 'assignedUsers debe ser un arreglo' }
        )
        .optional(),

    // comment: opcional — comentario sobre la tarea
    comment: z
        .string({ invalid_type_error: 'El comentario debe ser una cadena de texto' })
        .max(500, 'El comentario no puede exceder los 500 caracteres')
        .optional(),
});

// Esquema para ACTUALIZAR una tarea completa — PUT /api/tasks/:id
// Igual que createTaskSchema pero todos los campos son opcionales (partial)
export const updateTaskSchema = createTaskSchema.partial();

// Esquema para CAMBIAR solo el estado — PATCH /api/tasks/:id/status
// Solo acepta el campo status con los cuatro valores válidos del sistema
// ACTUALIZACIÓN: se agrega "pendiente_aprobacion" al enum
export const updateTaskStatusSchema = z.object({
    status: z.enum(
        ESTADOS_VALIDOS,
        {
            required_error: 'El estado es obligatorio',
            message:        "El estado debe ser: 'pendiente', 'en_progreso', 'pendiente_aprobacion' o 'completada'",
        }
    ),
    comment: z
        .string({ invalid_type_error: 'El comentario debe ser una cadena de texto' })
        .max(500, 'El comentario no puede exceder los 500 caracteres')
        .optional(),
});

// Esquema para ASIGNAR usuarios a una tarea — POST /api/tasks/:taskId/assign
// userIds debe ser un arreglo con al menos un ID numérico
export const assignUsersSchema = z.object({
    userIds: z
        .array(
            z.number({
                invalid_type_error: 'Cada ID debe ser un número',
            }).int('Los IDs deben ser números enteros')
              .positive('Los IDs deben ser números positivos'),
            { invalid_type_error: 'userIds debe ser un arreglo' }
        )
        .min(1, 'Debes enviar al menos un ID de usuario'),
});