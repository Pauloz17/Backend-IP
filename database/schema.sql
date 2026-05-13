-- ============================================================
-- ARCHIVO: database/schema.sql
-- PROYECTO: BACKEND-IP - Sistema de Gestión de Tareas
-- AUTORES: Paul Zapata y Isabella Garcia
-- SENA - Técnico en Programación de Software
-- ============================================================
-- INSTRUCCIONES:
-- Este archivo lo ejecutan con la conexión app_user en Workbench.
-- Antes, ejecuten el bloque en la conexion de root (SI NO LO HAN HECHO YA):

-- CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
-- CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'TORRES_2007';
-- GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'app_user'@'localhost';
-- FLUSH PRIVILEGES;
-- ============================================================

-- Selecciona la base de datos del proyecto (en conexion de app_user)
USE gestion_tareas_sena;

-- ============================================================
-- TABLA: users
-- documento UNIQUE: evita registrar la misma persona dos veces
-- password: hash bcrypt de la contraseña (nunca texto plano)
-- role: 'admin' para administradores, 'user' para usuarios normales, 'instructor' para docentes
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT          NOT NULL AUTO_INCREMENT,
    documento   VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_ud  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_up  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: tasks
-- assigned_users: arreglo de IDs guardado como JSON (sin FK externa)
-- comment: campo opcional para que el usuario anote observaciones
-- status valores válidos:
--   pendiente | en_progreso | pendiente_aprobacion | completada
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id              INT          NOT NULL AUTO_INCREMENT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
    comment         TEXT         NULL,
    assigned_users  JSON         NOT NULL DEFAULT (JSON_ARRAY()),
    created_ud      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_up      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);