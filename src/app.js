// MÓDULO: app.js
// CAPA: Entrada (configura Express y registra las rutas)

// inicializa el pool de conexiones con MySQL al arrancar el servidor
// debe ser el primer import para que el pool esté listo antes de que lleguen peticiones
import './database/db.connection.js';
import express from 'express';
import cors from 'cors';

import { errorMiddleware } from './middlewares/error.middleware.js';
import authRouter from './routes/auth.routes.js';
import { verifyToken } from './middlewares/auth.middleware.js';
import usersRouter from './routes/users.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import systemRouter from './routes/system.routes.js';

const app = express();

// habilita CORS para que el frontend pueda hacer peticiones al backend
// sin esto el navegador bloquearía las peticiones con un error de origen cruzado
app.use(cors({ origin: '*' }));

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
// Karol agregará verifyToken a /api/users y /api/tasks en su rama
app.use('/api/auth', authRouter);

// Rutas protegidas — verifyToken valida el JWT antes de llegar al controlador
app.use('/api/users', verifyToken, usersRouter);
app.use('/api/tasks', verifyToken, tasksRouter);

// Ruta para obtener la IP de la red y estado del sistema
app.use('/api/system', verifyToken, systemRouter);

// Middleware global de errores — debe registrarse DESPUÉS de todas las rutas
// Si se registra antes, los errores de las rutas no llegarán aquí
app.use(errorMiddleware);

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});