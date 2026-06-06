-- ============================================================
-- ARCHIVO: database/rbac.sql
-- PROYECTO: BACKEND-IP — Sistema RBAC
-- AUTORES: Paulo y Isabella
-- SENA — Técnico en Programación de Software
-- ============================================================
-- PROPÓSITO:
--   Este archivo crea los roles, permisos y relaciones RBAC.
--   Los datos se insertan en la BD (tablas ya existen desde schema.sql).
--
-- QUÉ HACER:
--   1. Abre Workbench → Conexión paulo_user
--   2. Copia TODO este archivo (rbac.sql)
--   3. Pega en una nueva query
--   4. Click en botón azul PLAY ▶ para ejecutar
--   5. LISTO — Roles, permisos y asignaciones creadas
-- ============================================================

USE gestion_tareas_sena;

-- ============================================================
-- PASO 1: CREAR ROLES
-- ============================================================
INSERT IGNORE INTO roles (name, description) VALUES
    ('admin',       'Administrador del sistema — acceso total'),
    ('user',        'Usuario estándar — gestiona sus propias tareas'),
    ('instructor',  'Docente SENA — gestiona tareas y ve usuarios sin poder eliminarlos');

-- ============================================================
-- PASO 2: CREAR PERMISOS
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
-- PASO 3: ASIGNAR PERMISOS A ROLES
-- ============================================================

-- Admin: acceso a TODOS los permisos
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Instructor: CRUD tareas + ver usuarios (sin gestión de usuarios)
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

-- User: solo ver tareas y cambiar estado de las propias
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.code IN (
      'tasks.status.update',
      'tasks.view.all'
  );


