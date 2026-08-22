USE gestion_tareas_sena;
SET @email_admin = 'paulo@sena.edu.co';

INSERT IGNORE INTO roles (name, description)
VALUES ('admin', 'Administrador del sistema — acceso total');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = @email_admin;

UPDATE users
SET role = 'admin'
WHERE email = @email_admin;

SELECT u.id, u.email, u.role FROM users u WHERE u.email = @email_admin;