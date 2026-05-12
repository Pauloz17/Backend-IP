-- ============================================================
-- ARCHIVO: database/rbac.sql
-- PROYECTO: servidor Backend-IP — Sistema RBAC
-- AUTORES: Paulo y Isabella
-- SENA — Técnico en Programación de Software
-- ============================================================
-- PROPÓSITO:
--   Este archivo implementa la arquitectura RBAC (Role-Based Access Control).
--   Crea las 4 tablas relacionales que permiten asignar múltiples roles y
--   permisos atómicos a los usuarios del sistema.
--
-- INSTRUCCIONES:
--   Ejecutar DESPUÉS de schema.sql.
--   Usar la conexión de paulo_user en MySQL Workbench.
--
-- ORDEN DE EJECUCIÓN:
--   1. connection.sql (crear BD y usuario — solo si no existe)
--   2. schema.sql     (crear tablas users y tasks)
--   3. rbac.sql       (este archivo — crear tablas RBAC y datos iniciales)
-- ============================================================

USE gestion_tareas_sena;

-- ============================================================
-- TABLA: roles
-- Almacena los roles del sistema. Un usuario puede tener múltiples roles.
-- Relación M:N con users a través de la tabla user_roles.
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id          INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(200) NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: permissions
-- Almacena los permisos atómicos del sistema.
-- Un permiso atómico es la unidad mínima de acción (ej: tasks.create).
-- Nomenclatura: recurso.accion o recurso.accion.alcance
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
    id          INT          NOT NULL AUTO_INCREMENT,
    code        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(200) NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================================
-- TABLA: role_permissions
-- Tabla pivote que materializa la relación M:N entre roles y permisos.
-- Un rol puede tener múltiples permisos y un permiso puede estar en múltiples roles.
-- ON DELETE CASCADE: si se elimina un rol o permiso, se eliminan sus relaciones.
-- ============================================================
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

-- ============================================================
-- TABLA: user_roles
-- Tabla pivote que materializa la relación M:N entre usuarios y roles.
-- Un usuario puede tener múltiples roles (ej: admin Y instructor a la vez).
-- ON DELETE CASCADE: si se elimina un usuario, se eliminan sus asignaciones de rol.
-- ============================================================
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
-- DATOS INICIALES: ROLES
-- Los 3 roles del sistema Task App
-- ============================================================
INSERT IGNORE INTO roles (name, description) VALUES
    ('admin',       'Administrador del sistema — acceso total'),
    ('user',        'Usuario estándar — gestiona sus propias tareas'),
    ('instructor',  'Docente SENA — gestiona tareas y ve usuarios sin poder eliminarlos');

-- ============================================================
-- DATOS INICIALES: PERMISSIONS
-- Permisos atómicos del sistema Task App
-- Nomenclatura: recurso.accion o recurso.accion.alcance
-- ============================================================
INSERT IGNORE INTO permissions (code, description) VALUES
    -- Permisos sobre tareas
    ('tasks.create',         'Crear nuevas tareas en el sistema'),
    ('tasks.view.all',       'Ver todas las tareas del sistema'),
    ('tasks.update',         'Editar cualquier tarea del sistema'),
    ('tasks.delete.all',     'Eliminar permanentemente cualquier tarea del sistema'),
    ('tasks.assign',         'Asignar usuarios a una tarea'),
    ('tasks.status.update',  'Cambiar el estado de una tarea propia'),
    -- Permisos sobre usuarios
    ('users.view',           'Ver la lista de usuarios del sistema'),
    ('users.edit',           'Editar datos de cualquier usuario'),
    ('users.delete',         'Eliminar usuarios del sistema'),
    ('users.assign.role',    'Cambiar el rol de un usuario');

-- ============================================================
-- DATOS INICIALES: ROLE_PERMISSIONS
-- Matriz RBAC del sistema Task App
-- Referencia: docs/ RBAC_MATRIX.md
-- ============================================================

-- Permisos del rol admin — acceso total al sistema
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Permisos del rol instructor — CRUD de tareas, ver usuarios, sin gestión de usuarios
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

-- Permisos del rol user — solo gestionar su propia tarea y cambiar su estado
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.code IN (
      'tasks.status.update',
      'tasks.view.all'
  );

-- ============================================================
-- ASIGNAR ROL ADMIN A PAULO E ISABELLA (ejecutar DESPUÉS del registro)
--
-- Este bloque NO se ejecuta al correr rbac.sql por primera vez.
-- Se ejecuta MANUALMENTE en Workbench DESPUÉS de que Paulo e Isabella
-- se hayan registrado desde Postman con POST /api/auth/register.
--
-- Por qué no van los INSERTs de usuarios aquí:
--   Las contraseñas deben hashearse con bcrypt desde el backend.
--   Insertar usuarios directamente en SQL dejaría la contraseña en
--   texto plano o sin hashear, lo cual es un riesgo de seguridad.
--
-- PROCEDIMIENTO:
--   1. Correr el servidor: npm run dev
--   2. Registrar a Paulo en Postman:
--        POST http://localhost:3000/api/auth/register
--        Body: { "name": "Paulo", "documento": "1092209864",
--                "email": "paulo@sena.edu.co", "password": "tu_contraseña*" }
--   3. Registrar a Isabella en Postman:
--        POST http://localhost:3000/api/auth/register
--        Body: { "name": "Isabella", "documento": "109679551",
--                "email": "isabella@sena.edu.co", "password": "tu_contraseña*" }
--   4. Ejecutar este bloque en Workbench:
-- ============================================================

-- Asignar rol 'admin' en el campo legacy de la tabla users
UPDATE users
SET role = 'admin'
WHERE documento IN ('1092209864', '109679551');

-- Asignar rol 'admin' en la tabla RBAC user_roles
-- La subconsulta obtiene los IDs reales sin hardcodearlos
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.documento IN ('1092209864', '109679551')

AND r.name = 'admin';