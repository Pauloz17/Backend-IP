// MÓDULO: schemas/user.schema.js
// CAPA: Schemas (moldes de validación de datos)
//
// Responsabilidad única: definir la forma y las reglas que deben cumplir
// los datos de un usuario antes de llegar al controlador.
// Este archivo NO toca el DOM, NO hace peticiones HTTP, NO accede a la BD.
//
// Se usa Zod como librería estándar de validación de esquemas.
// Sigue el mismo patrón que task.schema.js — molde separado de la lógica.

import { z } from 'zod';

// Esquema para CREAR un usuario — POST /api/users
// Los tres campos son obligatorios para registrar un usuario en el sistema
export const createUserSchema = z.object({

    // documento: obligatorio, solo números, mínimo 5 dígitos, máximo 20
    // Evita que se registren documentos vacíos o con letras
    documento: z
        .string({
            required_error:     'El número de documento es obligatorio',
            invalid_type_error: 'El documento debe ser una cadena de texto',
        })
        .min(5,  'El documento debe tener al menos 5 caracteres')
        .max(20, 'El documento no puede exceder los 20 caracteres')
        .regex(
            /^\d+$/,
            'El documento solo puede contener números'
        ),

    // name: obligatorio, mínimo 3 caracteres, máximo 100
    // Evita registrar usuarios sin nombre o con nombres de un solo carácter
    name: z
        .string({
            required_error:     'El nombre es obligatorio',
            invalid_type_error: 'El nombre debe ser una cadena de texto',
        })
        .min(3,   'El nombre debe tener al menos 3 caracteres')
        .max(100, 'El nombre no puede exceder los 100 caracteres'),

    // email: obligatorio, formato de correo electrónico válido
    // Zod valida automáticamente que tenga @ y dominio correcto
    email: z
        .string({
            required_error:     'El correo electrónico es obligatorio',
            invalid_type_error: 'El correo debe ser una cadena de texto',
        })
        .email('El correo electrónico no tiene un formato válido')
        .max(100, 'El correo no puede exceder los 100 caracteres'),
});

// Esquema para ACTUALIZAR un usuario — PUT /api/users/:id
// Igual que createUserSchema pero todos los campos son opcionales (partial)
// Permite actualizar solo documento, solo name, solo email o cualquier combinación
export const updateUserSchema = createUserSchema.partial();

// ── SCHEMA PARA CAMBIAR ROL (LEGACY — single role) ──────────────────────────
// PATCH /api/users/:id/role
// Cuerpo esperado: { role: 'admin' | 'user' | 'instructor' }
// Mantiene compatibilidad con clientes que aún usan el endpoint single-role.
export const changeRoleSchema = z.object({
    role: z.enum(
        ['admin', 'user', 'instructor'],
        {
            required_error: 'El rol es obligatorio',
            message:        "El rol debe ser: 'admin', 'user' o 'instructor'",
        }
    ),
});

// ── SCHEMA PARA AGREGAR UN ROL ADICIONAL ────────────────────────────────────
// POST /api/users/:id/roles
// Cuerpo: { role: 'admin' | 'user' | 'instructor' }
// Agrega el rol al usuario SIN borrar los que ya tiene.
export const assignRoleSchema = z.object({
    role: z.enum(
        ['admin', 'user', 'instructor'],
        {
            required_error: 'El rol es obligatorio',
            message:        "El rol debe ser: 'admin', 'user' o 'instructor'",
        }
    ),
});

// ── SCHEMA PARA REEMPLAZAR EL SET COMPLETO DE ROLES ─────────────────────────
// PUT /api/users/:id/roles
// Cuerpo: { roles: ['admin', 'instructor'] }
// Reemplaza la lista completa de roles del usuario. Ideal para UIs con checkboxes.
// Debe contener al menos 1 rol — un usuario sin rol no podría hacer nada.
export const setRolesSchema = z.object({
    roles: z
        .array(z.enum(['admin', 'user', 'instructor']))
        .min(1, 'El usuario debe tener al menos un rol asignado'),
});