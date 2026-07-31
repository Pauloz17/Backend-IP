// MÓDULO: app.js
// CAPA: Entrada (configura Express y registra las rutas)

// carga las variables de entorno del .env ANTES que cualquier otro módulo
// en ES modules los imports se evalúan en orden de dependencias, no de aparición,
// por eso se usa dotenv/config aquí para garantizar que process.env esté listo
import 'dotenv/config';

// inicializa el pool de conexiones con MySQL al arrancar el servidor
import './database/db.connection.js';
import express from 'express';
import cors from 'cors';

import { errorMiddleware } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.routes.js';
import { verifyToken } from './middlewares/auth.middleware.js';
import usersRouter from './routes/users.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import systemRouter from './routes/system.routes.js';

import os from 'os';

const app = express();

// habilita CORS para que el frontend pueda hacer peticiones al backend
// sin esto el navegador bloquearía las peticiones con un error de origen cruzado
// FRONTEND_ORIGINS admite una lista separada por comas. No se usa '*' porque
// las peticiones de esta API transportan tokens JWT.
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Postman no envía Origin; no se bloquea para facilitar pruebas de API.
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
        return callback(new Error('Origen no permitido por la política CORS'));
    },
}));

// configura el servidor para recibir cuerpos de petición en formato JSON
// necesario para leer req.body en los controladores (POST, PUT, PATCH)
app.use(express.json());

// configura para recibir datos enviados desde formularios HTML
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ruta raíz para verificar que el servidor está activo
app.get('/', (req, res) => {
    res.status(200).json({ status: 'API Online', version: '4.0.0' });
});

// Ruta de autenticación — PÚBLICA (no requiere token todavía)
app.use('/api/auth', authRouter);

// Rutas protegidas / públicas
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);

// Ruta para obtener la IP de la red y estado del sistema
app.use('/api/system', systemRouter);

// Middleware global de errores — debe registrarse DESPUÉS de todas las rutas
// Si se registra antes, los errores de las rutas no llegarán aquí
app.use(errorMiddleware);

// Escucha en todas las interfaces de red (accesible en LAN)
app.listen(PORT, '0.0.0.0', () => {
    let localIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                localIp = alias.address;
                break;
            }
        }
    }
    console.log(`Servidor escuchando en http://${localIp}:${PORT}`);
});
