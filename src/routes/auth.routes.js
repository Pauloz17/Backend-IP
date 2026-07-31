// MÓDULO: routes/auth.routes.js
// CAPA: Rutas
//
// Responsabilidad única: definir los endpoints de autenticación.
// ACTUALIZACIÓN v4.0: se agregan las rutas del flujo de recuperación de contraseña.
 
import { Router } from 'express';
import {
    login,
    register,
    forgotPassword,
    verifyResetCode,
    resetPassword,
} from '../controller/auth.controller.js';
import { refresh }        from '../controller/auth.refresh.controller.js';
import { validateSchema } from '../middlewares/validator.middleware.js';
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    verifyResetCodeSchema,
    resetPasswordSchema,
} from '../../schemas/auth.schema.js';
 
const router = Router();
 
// POST /api/auth/login — valida email y password antes de llegar al controlador
router.post('/login', validateSchema(loginSchema), login);
 
// POST /api/auth/refresh — renueva el accessToken con el refreshToken
router.post('/refresh', refresh);
 
// POST /api/auth/register — registro de usuarios nuevos desde la web
router.post('/register', validateSchema(registerSchema), register);
 
// ── FLUJO DE RECUPERACIÓN DE CONTRASEÑA (3 pasos) ───────────────────────────
// Paso 1: el usuario ingresa su email para recibir el código por Mailtrap
router.post('/forgot-password', validateSchema(forgotPasswordSchema), forgotPassword);

// Paso 2: el usuario ingresa el código de 6 dígitos para verificarlo
router.post('/verify-reset-code', validateSchema(verifyResetCodeSchema), verifyResetCode);

// Paso 3: el usuario ingresa la nueva contraseña (requiere haber pasado el paso 2)
router.post('/reset-password', validateSchema(resetPasswordSchema), resetPassword);
 
export default router;