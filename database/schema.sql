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
    email       VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
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
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_up      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
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

-- ============================================================
-- Datos iniciales RBAC (opcional)
-- Los INSERT IGNORE permiten ejecutar este archivo varias veces
-- sin duplicar filas.
-- ============================================================

INSERT IGNORE INTO roles (name, description) VALUES
    ('admin',       'Administrador del sistema — acceso total'),
    ('user',        'Usuario estándar — gestiona sus propias tareas'),
    ('instructor',  'Docente SENA — gestiona tareas y ve usuarios sin poder eliminarlos');

INSERT IGNORE INTO permissions (code, description) VALUES
    ('tasks.create',         'Crear nuevas tareas en el sistema'),
    ('tasks.view.all',       'Ver todas las tareas del sistema'),
    ('tasks.update',         'Editar cualquier tarea del sistema'),
    ('tasks.delete.all',     'Eliminar permanentemente cualquier tarea del sistema'),
    ('tasks.assign',         'Asignar usuarios a una tarea'),
    ('tasks.status.update',  'Cambiar el estado de una tarea propia'),
    ('users.view',           'Ver la lista de usuarios del sistema'),
    ('users.edit',           'Editar datos de cualquier usuario'),
    ('users.delete',         'Eliminar usuarios del sistema'),
    ('users.assign.role',    'Cambiar el rol de un usuario');

-- Llenar role_permissions para los roles definidos arriba
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'instructor'
  AND p.code IN (
      'tasks.create',
      'tasks.view.all',
      'tasks.update',
      'tasks.delete.all',
      'tasks.assign',
      'users.view'
  );

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.code IN (
      'tasks.status.update',
      'tasks.view.all'
  );

-- NOTA: la asignación de usuarios específicos a roles (ej. admin a Paulo)
-- debe realizarse después de que los usuarios existan en la tabla `users`.
-- Ejemplo (ejecutar manualmente después de registrar los usuarios desde la API):
-- UPDATE users SET role = 'admin' WHERE documento IN ('1092209864', '109679551');
-- INSERT IGNORE INTO user_roles (user_id, role_id)
-- SELECT u.id, r.id FROM users u, roles r WHERE u.documento IN ('1092209864', '109679551') AND r.name = 'admin';