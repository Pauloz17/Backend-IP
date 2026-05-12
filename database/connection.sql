-- ============================================================
-- ARCHIVO: database/connection.sql
-- PROYECTO: servidor_backend_parejas - Sistema de Gestión de Tareas
-- AUTORES: Paulo y Isabella
-- SENA - Técnico en Programación de Software
-- ============================================================
-- INSTRUCCIONES:
-- Ejecutar este bloque con la conexión root en Workbench.
-- Crea la base de datos y el usuario de la aplicación.
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
CREATE USER IF NOT EXISTS 'paulo_user'@'localhost' IDENTIFIED BY 'Paulo2024*';
GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'paulo_user'@'localhost';
FLUSH PRIVILEGES;