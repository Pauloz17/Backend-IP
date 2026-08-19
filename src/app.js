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
import os from 'os';

import { errorMiddleware } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.routes.js';
import { verifyToken } from './middlewares/auth.middleware.js';
import usersRouter from './routes/users.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import systemRouter from './routes/system.routes.js';


const app = express();

// habilita CORS para que el frontend pueda hacer peticiones al backend
// sin esto el navegador bloquearía las peticiones con un error de origen cruzado
//
// Como el frontend se sirve con `npx serve` (puertos aleatorios), se permite
// cualquier puerto de localhost, 127.0.0.1 y cualquier IP de red privada.
// Así funciona sin cambios al conectarse desde otra red o con otra IP.
// Si FRONTEND_ORIGINS está definido en .env, también se incluyen esos orígenes.
const extraOrigins = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const allowedPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,   // 192.168.x.x
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, // 10.x.x.x
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/, // 172.16-31.x.x
];

app.use(cors({
    origin(origin, callback) {
        // Postman / herramientas sin Origin → permitir para pruebas de API
        if (!origin) return callback(null, true);
        // Coincidencia exacta con lista explícita (.env)
        if (extraOrigins.includes(origin)) return callback(null, true);
        // Coincidencia por patrón (localhost, 127.0.0.1, IP de red)
        if (allowedPatterns.some(re => re.test(origin))) return callback(null, true);
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
// Detecta automáticamente la IP de la red para mostrarla en consola
function obtenerIPLocal() {
    const interfaces = os.networkInterfaces();
    for (const nombre of Object.keys(interfaces)) {
        for (const iface of interfaces[nombre]) {
            // IPv4, no interna (no 127.0.0.1)
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const ip = obtenerIPLocal();
    console.log(`Servidor escuchando en http://${ip}:${PORT}`);
});
