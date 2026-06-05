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
-- QUÉ HACER AL LLEGAR A LA PC DE PRESENTACIÓN:
--   1. Abre Workbench → Conexión paulo_user
--   2. Haz click en el + para una NUEVA QUERY
--   3. Copia TODO este archivo (rbac.sql) 
--   4. Pega en la query nueva
--   5. Click en botón azul PLAY ▶
--   6. Espera a que termine (sin errores)
--   7. LISTO — Roles y permisos creados
--
-- LUEGO (después de registrar desde frontend):
--   - Nueva query
--   - Copia la sección \"ASIGNAR ROL ADMIN A paulo@sena.edu.co\" (abajo)
--   - Ejecuta
--   - LISTO — paulo@sena.edu.co es admin
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

-- ============================================================
-- PASO 4: ASIGNAR ROL ADMIN A paulo@sena.edu.co
-- ============================================================
-- INSTRUCCIONES:
--   1. Registra a paulo@sena.edu.co desde el FRONTEND con POST /api/auth/register
--      Body: {
--        "name": "Paulo",
--        "documento": "1092209864",
--        "email": "paulo@sena.edu.co",
--        "password": "TuContraseña123*"
--      }
--   2. Una vez registrado, ejecuta este bloque en una NUEVA QUERY
--
-- QUÉ HACE:
--   - Define el email del usuario
--   - Crea el rol 'admin' si no existe
--   - Vincula usuario con rol en tabla pivote user_roles
--   - Sincroniza el campo legacy users.role
--   - Verifica que la asignación fue correcta
-- ============================================================

-- Variable: el email del usuario que será admin
SET @email_admin = 'paulo@sena.edu.co';

-- 1. Crear rol 'admin' si no existe (por seguridad)
INSERT IGNORE INTO roles (name, description)
VALUES ('admin', 'Administrador del sistema — acceso total');

-- 2. Vincular usuario con rol en tabla pivote (INSERT IGNORE previene duplicados)
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = @email_admin;

-- 3. Sincronizar campo legacy (necesario para JWT)
UPDATE users
SET role = 'admin'
WHERE email = @email_admin;

-- 4. VERIFICACIÓN: mira si quedó admin correctamente
SELECT
    u.id,
    u.email,
    u.role AS 'rol_campo_legacy',
    GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') AS 'roles_asignados',
    COUNT(DISTINCT r.id) AS 'total_roles'
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = @email_admin
GROUP BY u.id, u.email, u.role;

-- Resultado esperado: 
--   email = paulo@sena.edu.co
--   rol_campo_legacy = admin
--   roles_asignados = admin
--   total_roles = 1
