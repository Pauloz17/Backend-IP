-- ============================================================
-- ARCHIVO: database/schema.sql
-- PROYECTO: BACKEND-IP - Sistema de Gestión de Tareas
-- AUTORES: Paul Zapata y Isabella Garcia
-- SENA - Técnico en Programación de Software
-- ============================================================
-- INSTRUCCIONES:
-- Este archivo lo ejecutan con la conexión app_user en Workbench.
-- Antes, ejecuten el bloque en la conexion de root (SI NO LO HAN HECHO YA):
-- ORDEN: 1. connection.sql -> 2. schema.sql (Este archivo) -> 3. rbac.sql
-- CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
-- CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'Paulo2024*';
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
    email       VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================================
-- REGLA DE NEGOCIO: INMUTABILIDAD DE DATOS PERSONALES
-- Protege documento, email y nombre para que no sean alterados tras el registro.
-- Si ya tienes la versión anterior del trigger en tu BD, primero ejecuta:
--     DROP TRIGGER IF EXISTS tr_users_immutability;
-- y luego este bloque para recrearlo con la nueva regla del nombre.
-- ============================================================
DROP TRIGGER IF EXISTS tr_users_immutability;
DELIMITER //
CREATE TRIGGER tr_users_immutability
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.documento <> OLD.documento THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Regla de Privacidad SENA: El documento no puede ser modificado.';
    END IF;
    IF NEW.email <> OLD.email THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Regla de Privacidad SENA: El correo electrónico no puede ser modificado.';
    END IF;
    IF NEW.name <> OLD.name THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Regla de Privacidad SENA: El nombre no puede ser modificado.';
    END IF;
END; //
DELIMITER ;

-- ============================================================
-- TABLA: tasks
-- comment: campo opcional para que el usuario anote observaciones
-- status valores válidos:
--   pendiente | en_progreso | pendiente_aprobacion | completada
--
-- NOTA 3FN: la asignación de usuarios a una tarea NO va en esta tabla
-- (sería un atributo multivaluado, violación de 1FN). Se modela con la
-- tabla pivote `task_assignees` declarada más abajo.
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id              INT          NOT NULL AUTO_INCREMENT,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
    comment         TEXT         NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: task_assignees (pivot tasks <-> users)
-- Relación M:N normalizada en 3FN entre tareas y usuarios asignados.
-- Reemplaza el antiguo campo JSON `tasks.assigned_users`.
--
-- ON DELETE CASCADE en ambas FKs:
--   - Si se elimina una tarea, sus asignaciones desaparecen.
--   - Si se elimina un usuario, deja de estar asignado a sus tareas.
-- ============================================================
CREATE TABLE IF NOT EXISTS task_assignees (
    task_id    INT NOT NULL,
    user_id    INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    CONSTRAINT fk_ta_task
        FOREIGN KEY (task_id)
        REFERENCES tasks (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ta_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ============================================================
-- Sección RBAC: roles, permissions y tablas pivote
-- Estas tablas se agregan aquí para que `schema.sql` contenga
-- todas las definiciones de esquema y se pueda ejecutar de una
-- sola vez respetando las dependencias (FKs)
-- Orden de creación: users (arriba), roles, permissions, tasks,
-- role_permissions, user_roles
-- ============================================================

-- TABLA: roles
CREATE TABLE IF NOT EXISTS roles (
    id          INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(200) NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- TABLA: permissions
CREATE TABLE IF NOT EXISTS permissions (
    id          INT          NOT NULL AUTO_INCREMENT,
    code        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(200) NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- TABLA: role_permissions (pivot role <-> permission)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_rp_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- TABLA: user_roles (pivot user <-> role)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id    INT NOT NULL,
    role_id    INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ur_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- NOTA: la asignación de usuarios específicos a roles (ej. admin a Paulo)
-- debe realizarse después de que los usuarios existan en la tabla `users`.
-- Ejemplo (ejecutar manualmente después de registrar los usuarios desde la API):
-- UPDATE users SET role = 'admin' WHERE documento IN ('1092209864', '109679551');
-- INSERT IGNORE INTO user_roles (user_id, role_id)
-- SELECT u.id, r.id FROM users u, roles r WHERE u.documento IN ('1092209864', '109679551') AND r.name = 'admin';

-- UPDATE users SET role = 'admin' WHERE documento = '1092209864';
-- INSERT IGNORE INTO user_roles (user_id, role_id) 
-- SELECT u.id, r.id FROM users u, roles r 
-- WHERE u.documento = '1092209864' AND r.name = 'admin';
