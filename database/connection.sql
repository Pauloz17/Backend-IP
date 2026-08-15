-- ============================================================
-- ARCHIVO: database/connection.sql
-- PROYECTO: BACKEND-IP - Sistema de Gestión de Tareas
-- AUTORES: Paulo y Isabella
-- SENA - Técnico en Programación de Software
-- ============================================================
-- INSTRUCCIONES:
-- Ejecutar este bloque con la conexión root en Workbench.
-- Crea la base de datos y el usuario de la aplicación.
-- ============================================================

-- Permitir la creación de Triggers sin requerir privilegios SUPER (Soluciona el Error 1419)
SET GLOBAL log_bin_trust_function_creators = 1;

CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
CREATE USER IF NOT EXISTS 'paulo_user'@'localhost' IDENTIFIED BY 'Paulo2024*';
GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'paulo_user'@'localhost';
FLUSH PRIVILEGES;