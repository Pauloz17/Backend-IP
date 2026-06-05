// MÓDULO: database/db.connection.js
// CAPA: Base de datos (configuración de la conexión con MySQL)

// Responsabilidad única: crear y exportar el pool de conexiones.
// Un pool mantiene varias conexiones abiertas y las reutiliza,
// evitando abrir y cerrar una conexión nueva por cada query.
// NUNCA contiene lógica de negocio ni conoce req, res ni Express.

// dotenv.config() carga las variables del .env en process.env
// debe llamarse ANTES de cualquier referencia a process.env
import dotenv from 'dotenv';
dotenv.config();

// mysql2/promise: versión async/await del cliente de MySQL
// permite usar await pool.query() en los modelos sin callbacks
import mysql from 'mysql2/promise';

// createPool crea un conjunto de conexiones reutilizables
// cada modelo usa una conexión del pool y la devuelve al terminar
const pool = mysql.createPool({
    host:     process.env.DB_HOST,      // localhost (del .env)
    port:     process.env.DB_PORT,      // 3306 (del .env)
    user:     process.env.DB_USER,      // paulo_user (del .env)
    password: process.env.DB_PASSWORD,  // contraseña real (del .env)
    database: process.env.DB_NAME,      // gestion_tareas_sena (del .env)
    waitForConnections: true,           // las nuevas peticiones esperan si no hay conexión libre
    connectionLimit:    10,             // máximo de conexiones simultáneas en el pool
    queueLimit:         0               // cola sin límite de peticiones en espera
});

// verificación al arrancar: intenta obtener una conexión inmediatamente
// si las credenciales son incorrectas, el error aparece en consola de inmediato
pool.getConnection()
    .then(function (conexion) {
        console.log('Conexión con MySQL establecida correctamente');
        conexion.release(); // devuelve la conexión al pool para que esté disponible
    })
    .catch(function (error) {
        console.error('Error al conectar con MySQL:', error.message);
    });

// todos los modelos importan este pool — nunca crean conexiones propias
export default pool;