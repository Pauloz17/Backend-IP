-- ============================================================
-- ARCHIVO: database/rbac.sql
-- PROYECTO: BACKEND-IP — Sistema RBAC
-- AUTORES: Paulo y Isabella
-- SENA — Técnico en Programación de Software
-- ============================================================
-- PROPÓSITO:
--   Este archivo implementa la arquitectura RBAC (Role-Based Access Control).
--   Crea las 4 tablas relacionales que permiten asignar múltiples roles y
--   permisos atómicos a los usuarios del sistema.
--
-- INSTRUCCIONES:
--   ¡¡¡ ATENCIÓN !!!: Ejecutar ÚNICAMENTE DESPUÉS de schema.sql.
--   Usar la conexión de paulo_user en MySQL Workbench.
--
-- ORDEN DE EJECUCIÓN:
--   1. connection.sql (crear BD y usuario — solo si no existe)
--   2. schema.sql     (crear tablas users y tasks)
--   3. rbac.sql       (este archivo — crear tablas RBAC y datos iniciales)
-- ============================================================

USE gestion_tareas_sena;

-- NOTA: Las tablas ya están definidas en schema.sql. 
-- Este archivo se enfoca en DATOS y CONSULTAS.

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

-- 1. Actualizar el campo 'role' (Legacy)
-- Esto es para que el sistema reconozca tu rango de inmediato
UPDATE users
SET role = 'admin'
WHERE documento IN ('1092209864', '109679551');

-- 2. Vincular el rol en la tabla pivote RBAC (Multi-Rol)
-- Asignar rol 'admin' en la tabla RBAC user_roles
-- La subconsulta obtiene los IDs reales sin hardcodearlos
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.documento IN ('1092209864', '109679551')

AND r.name = 'admin';

-- ============================================================
-- PARA PRESENTACIÓN: HACER ADMIN A PAULO
-- ============================================================
-- Ejecuta esta sección cuando necesites que Paulo sea admin
-- (COPIA Y PEGA SOLO ESTO EN UNA NUEVA QUERY en Workbench)
-- ============================================================

SET SQL_SAFE_UPDATES=0;
UPDATE users SET role = 'admin' WHERE documento = '1092209864';
UPDATE users SET role = 'admin' WHERE email = 'paulo@sena.edu.co';
SET SQL_SAFE_UPDATES=1;

SELECT id, documento, name, email, role FROM users 
WHERE documento = '1092209864' OR email = 'paulo@sena.edu.co';

-- ============================================================
-- SECCIÓN: CONSULTAS DE EVALUACIÓN TÉCNICA (SENA)
-- ============================================================

-- CONSULTA 1: Filtro dinámico de tareas por estado
-- Permite listar tareas filtrando por 'pendiente', 'en_progreso' o 'completada'.
SELECT id, title, status, created_at 
FROM tasks 
WHERE status = 'en_progreso' 
ORDER BY created_at DESC;

-- CONSULTA 2: Validación de Administradores con Múltiples Roles
-- REGLA: Los usuarios con rol 'admin' solo aparecen si tienen otros roles asignados.
-- Si un usuario es "Admin Puro" (solo tiene 1 rol), no se lista aquí.
SELECT 
    u.id, 
    u.name, 
    u.email,
    COUNT(DISTINCT ur.role_id) as total_roles,
    GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as roles_asignados
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id
INNER JOIN roles r ON ur.role_id = r.id
GROUP BY u.id
HAVING 
    -- Usuarios que NO tienen el rol 'admin'
    NOT EXISTS (SELECT 1 FROM user_roles ur2 JOIN roles r2 ON ur2.role_id = r2.id 
                WHERE ur2.user_id = u.id AND r2.name = 'admin')
    OR 
    -- Usuarios que son 'admin' PERO tienen otros roles adicionales
    (EXISTS (SELECT 1 FROM user_roles ur3 JOIN roles r3 ON ur3.role_id = r3.id 
             WHERE ur3.user_id = u.id AND r3.name = 'admin') AND total_roles > 1);

-- CONSULTA 3: Permisos Atómicos Totales por Usuario
-- Recorre toda la jerarquía RBAC (4 tablas) para traer los permisos de un usuario.
SELECT DISTINCT
    u.name AS usuario,
    p.code AS codigo_permiso,
    p.description AS descripcion_permiso
FROM users u
JOIN user_roles ur      ON u.id = ur.user_id
JOIN roles r            ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p      ON rp.permission_id = p.id
WHERE u.documento = '1092209864' -- Ejemplo con Paulo
ORDER BY p.code;

-- PRUEBA DE DISPARADOR (Trigger):
-- Descomenta la línea de abajo para probar que la BD bloquea cambios en documento:
-- UPDATE users SET documento = '999999' WHERE id = 1;

-- ============================================================
-- MIGRACIÓN: ACTUALIZAR TRIGGER tr_users_immutability
-- ============================================================
-- Esta sección recrea el trigger para que también bloquee cambios en `name`
-- (antes solo bloqueaba documento y email). Ejecutar UNA VEZ sobre la BD
-- existente; si reinstalas desde cero con schema.sql ya queda aplicado.
--
-- COPIA Y PEGA ESTE BLOQUE EN UNA NUEVA QUERY DE WORKBENCH:
-- ============================================================

USE gestion_tareas_sena;

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
-- MIGRACIÓN 3FN: tasks.assigned_users (JSON) → task_assignees (pivot)
-- ============================================================
-- Esta sección crea la tabla pivote task_assignees, migra los datos del
-- antiguo campo JSON `tasks.assigned_users` a filas relacionales, y
-- finalmente elimina la columna JSON para cumplir 3FN.
--
-- Ejecutar UNA VEZ sobre la BD existente. Si reinstalas desde cero con
-- schema.sql, la tabla ya queda creada y este bloque no hace falta.
--
-- COPIA Y PEGA ESTE BLOQUE EN UNA NUEVA QUERY DE WORKBENCH:
-- ============================================================

    USE gestion_tareas_sena;

-- 1. Crear la tabla pivote si aún no existe
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

-- 2. Migrar los datos del JSON antiguo a filas relacionales.
--    JSON_TABLE recorre cada elemento del array assigned_users y produce
--    una fila por cada (task_id, user_id). INSERT IGNORE evita duplicados
--    si la migración se corre dos veces por error.
--    Solo se ejecuta si la columna assigned_users todavía existe.
SET @col_existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'gestion_tareas_sena'
      AND TABLE_NAME   = 'tasks'
      AND COLUMN_NAME  = 'assigned_users'
);

SET @sql_migrar := IF(@col_existe = 1,
    'INSERT IGNORE INTO task_assignees (task_id, user_id)
     SELECT t.id, CAST(jt.user_id AS UNSIGNED)
     FROM tasks t,
     JSON_TABLE(t.assigned_users, "$[*]" COLUMNS (user_id INT PATH "$")) jt
     WHERE jt.user_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM users u WHERE u.id = jt.user_id)',
    'SELECT "La columna assigned_users ya no existe — migración previa detectada" AS info'
);
PREPARE stmt FROM @sql_migrar;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Eliminar la columna JSON ya migrada (cumple 3FN)
SET @sql_drop := IF(@col_existe = 1,
    'ALTER TABLE tasks DROP COLUMN assigned_users',
    'SELECT "Columna assigned_users ya estaba eliminada" AS info'
);
PREPARE stmt FROM @sql_drop;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Verificación: cuenta cuántas asignaciones quedaron en la tabla pivote
SELECT COUNT(*) AS asignaciones_migradas FROM task_assignees;