# PASOS REALIZADOS — Sistema Gestión de Tareas
# Paulo Joel Pacheco Zapata — SENA ADSO 3233198
# Fecha: 2026-05-14

---

## RESUMEN DEL STACK

- Frontend:      http://localhost:5173  (Vite)
- Backend API:   http://localhost:3000  (Node.js + Express)
- Base de datos: localhost:3306         (MySQL)
- Usuario MySQL: paulo_user / Paulo2024*
- Base de datos: gestion_tareas_sena

---

## PASO 1 — Completar el archivo .env

Se agregaron las variables de JWT que estaban vacías:

    JWT_SECRET=clave_secreta_gestion_tareas_sena_2024
    JWT_REFRESH_SECRET=refresh_clave_secreta_sena_2024
    JWT_EXPIRES_IN=1h
    JWT_REFRESH_EXPIRES_IN=7d

Sin estas variables el login y el register no funcionan.

---

## PASO 2 — Crear la colección en Postman

Se creó la colección "SISTEMA GESTIÓN DE TAREAS" con 3 carpetas:

### Carpeta AUTH — todos son POST
    POST /api/auth/login
    POST /api/auth/register
    POST /api/auth/refresh
    POST /api/auth/forgot-password
    POST /api/auth/verify-reset-code
    POST /api/auth/reset-password

### Carpeta USERS
    GET    /api/users
    POST   /api/users
    GET    /api/users/by-document/:documento
    GET    /api/users/:userId/tasks
    GET    /api/users/:id
    PUT    /api/users/:id
    DELETE /api/users/:id
    PATCH  /api/users/:id/password     <- requiere token
    PATCH  /api/users/:id/role         <- requiere token + ser admin

### Carpeta TASKS
    GET    /api/tasks
    GET    /api/tasks/dashboard
    GET    /api/tasks/filter
    GET    /api/tasks/all              <- requiere token + ser admin
    POST   /api/tasks                  <- requiere token
    GET    /api/tasks/:id
    PUT    /api/tasks/:id
    DELETE /api/tasks/:id              <- requiere token + ser admin
    PATCH  /api/tasks/:id/status
    POST   /api/tasks/:taskId/assign
    GET    /api/tasks/:taskId/users
    DELETE /api/tasks/:taskId/users/:userId

---

## PASO 3 — Registrar a Paulo en Postman

Endpoint: POST http://localhost:3000/api/auth/register
Body:
    {
      "name": "Paulo Joel Pacheco",
      "documento": "1092209864",
      "email": "paulo@sena.edu.co",
      "password": "123456"
    }

Respuesta exitosa: 201 — "Usuario registrado correctamente"

---

## PASO 4 — Registrar a Isabella en Postman

Endpoint: POST http://localhost:3000/api/auth/register
Body:
    {
      "name": "Isabella Garcia",
      "documento": "109679551",
      "email": "isabella@sena.edu.co",
      "password": "su_password"
    }

---

## PASO 5 — Dar rol admin a Paulo e Isabella en MySQL Workbench

Se ejecutaron estos comandos en MySQL Workbench con la conexión paulo_user:

    -- Actualizar campo role en tabla users
    UPDATE users
    SET role = 'admin'
    WHERE documento IN ('1092209864', '109679551');

    -- Asignar rol admin en el sistema RBAC
    INSERT IGNORE INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u, roles r
    WHERE u.documento IN ('1092209864', '109679551')
    AND r.name = 'admin';

    -- Verificar resultado
    SELECT u.name, u.email, u.role, r.name AS rol_rbac
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.documento IN ('1092209864', '109679551');

Resultado esperado: ambos con role=admin y rol_rbac=admin

---

## PASO 6 — Login exitoso

Endpoint: POST http://localhost:3000/api/auth/login
Body:
    {
      "email": "paulo@sena.edu.co",
      "password": "123456"
    }

Respuesta: 200 con accessToken, refreshToken y datos del usuario con role=admin

---

## QUE HACER EN UN PC NUEVO

1. Instalar: Node.js 18+, MySQL 8, Git, Postman

2. Clonar el repositorio:
   git clone URL_DEL_REPO
   cd Backend-IP

3. Instalar dependencias:
   npm install

4. Crear el archivo .env con estos valores:
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=paulo_user
   DB_PASSWORD=Paulo2024*
   DB_NAME=gestion_tareas_sena
   JWT_SECRET=clave_secreta_gestion_tareas_sena_2024
   JWT_REFRESH_SECRET=refresh_clave_secreta_sena_2024
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d

5. En MySQL Workbench con conexión root:
   CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
   CREATE USER IF NOT EXISTS 'paulo_user'@'localhost' IDENTIFIED BY 'Paulo2024*';
   GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'paulo_user'@'localhost';
   FLUSH PRIVILEGES;

6. Ejecutar los SQL en orden con conexión paulo_user:
   - database/schema.sql
   - database/rbac.sql

7. Levantar el servidor:
   npm run dev

8. Importar la colección en Postman:
   - Import -> seleccionar el .json de la carpeta postman/

9. Registrar tu usuario con POST /api/auth/register

10. Ejecutar el SQL del Paso 5 para darte rol admin

11. Login con POST /api/auth/login

---

## CREDENCIALES DEL PROYECTO

Paulo:
  - Email:     paulo@sena.edu.co
  - Password:  123456
  - Rol:       admin
  - Documento: 1092209864

Isabella:
  - Email:     isabella@sena.edu.co
  - Rol:       admin
  - Documento: 109679551

---

## ERRORES COMUNES Y SOLUCIONES

| Error                    | Causa                        | Solución                              |
|--------------------------|------------------------------|---------------------------------------|
| Credenciales incorrectas | Email o password mal escritos| Verificar con SELECT en Workbench     |
| Cannot connect           | Backend no está corriendo    | Ejecutar npm run dev                  |
| 401 Unauthorized         | No enviaste el token         | Agregar Bearer Token en Authorization |
| 403 Forbidden            | Usuario no es admin          | Ejecutar SQL del Paso 5               |
| 500 Internal Server Error| .env incompleto o MySQL caído| Verificar .env y MySQL                |
| JWT error                | JWT_SECRET vacío             | Agregar JWT_SECRET en .env            |
