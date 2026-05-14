# GUIA COMPLETA — Sistema Gestión de Tareas
# Paulo Joel Pacheco Zapata — SENA ADSO

---

## 1. CORREGIR METODOS EN POSTMAN (el AI puso todo como GET)

Abre cada request y cambia el método así:

### Carpeta AUTH
| Request            | Método correcto |
|--------------------|-----------------|
| Login              | POST            |
| Register           | POST            |
| Refresh Token      | POST            |
| Forgot Password    | POST            |
| Verify Reset Code  | POST            |
| Reset Password     | POST            |

### Carpeta USERS
| Request              | Método correcto |
|----------------------|-----------------|
| Listar usuarios      | GET             |
| Crear usuario        | POST            |
| Buscar por documento | GET             |
| Tareas de usuario    | GET             |
| Usuario por ID       | GET             |
| Actualizar usuario   | PUT             |
| Eliminar usuario     | DELETE          |
| Cambiar contraseña   | PATCH           |
| Cambiar rol          | PATCH           |

### Carpeta TASKS
| Request            | Método correcto |
|--------------------|-----------------|
| Listar tareas      | GET             |
| Dashboard          | GET             |
| Filtrar tareas     | GET             |
| Todas (admin)      | GET             |
| Crear tarea        | POST            |
| Tarea por ID       | GET             |
| Actualizar tarea   | PUT             |
| Eliminar tarea     | DELETE          |
| Cambiar estado     | PATCH           |
| Asignar usuarios   | POST            |
| Ver asignados      | GET             |
| Quitar usuario     | DELETE          |

---

## 2. BODY QUE VA EN CADA REQUEST (pestaña Body > raw > JSON)

### POST /api/auth/login
```json
{
  "email": "tu@correo.com",
  "password": "tu_password"
}
```

### POST /api/auth/register
```json
{
  "name": "Paulo Joel Pacheco",
  "documento": "1234567890",
  "email": "tu@correo.com",
  "password": "tu_password"
}
```

### POST /api/auth/forgot-password
```json
{
  "email": "tu@correo.com"
}
```

### POST /api/auth/verify-reset-code
```json
{
  "email": "tu@correo.com",
  "code": "123456"
}
```

### POST /api/auth/reset-password
```json
{
  "email": "tu@correo.com",
  "newPassword": "nueva_password"
}
```

### POST /api/users (crear usuario sin contraseña)
```json
{
  "documento": "1234567890",
  "name": "Nombre Apellido",
  "email": "correo@ejemplo.com"
}
```

### PUT /api/users/:id
```json
{
  "name": "Nombre Actualizado",
  "email": "nuevo@correo.com"
}
```

### PATCH /api/users/:id/password
```json
{
  "currentPassword": "password_actual",
  "newPassword": "nueva_password"
}
```

### PATCH /api/users/:id/role  (solo admin puede hacer esto)
```json
{
  "role": "admin"
}
```

### POST /api/tasks
```json
{
  "title": "Titulo de la tarea",
  "description": "Descripcion de la tarea",
  "status": "pendiente"
}
```

### PUT /api/tasks/:id
```json
{
  "title": "Titulo actualizado",
  "description": "Nueva descripcion",
  "status": "en_progreso"
}
```

### PATCH /api/tasks/:id/status
```json
{
  "status": "completada"
}
```
Valores válidos para status: pendiente | en_progreso | completada

### POST /api/tasks/:taskId/assign
```json
{
  "userIds": [1, 2, 3]
}
```

---

## 3. ENDPOINTS QUE NECESITAN TOKEN (Authorization > Bearer Token)

Copia el token que te devuelve el Login y pégalo en estos endpoints:
- PATCH /api/users/:id/password
- PATCH /api/users/:id/role
- GET  /api/tasks/all
- POST /api/tasks
- DELETE /api/tasks/:id

Cómo agregar el token en Postman:
1. Abre el request
2. Pestaña Authorization
3. Type: Bearer Token
4. Pega el token en el campo Token

---

## 4. SQL PARA QUE PAULO E ISABELLA SEAN ADMIN
(Ejecutar en MySQL Workbench, NO en Postman)

IMPORTANTE: Reemplaza los correos con los reales antes de ejecutar.

```sql
-- Paso 1: Ver quiénes están registrados
SELECT id, name, email, role FROM users;

-- Paso 2: Dar rol admin a Paulo e Isabella
-- CAMBIA los correos por los reales de ustedes
UPDATE users
SET role = 'admin'
WHERE email IN (
    'paulo@correo.com',
    'isabella@correo.com'
);

-- Paso 3: Verificar que quedó bien
SELECT id, name, email, role FROM users
WHERE email IN (
    'paulo@correo.com',
    'isabella@correo.com'
);

-- Paso 4: Asignar rol admin en el sistema RBAC
-- Primero ver el id del rol admin
SELECT id, name FROM roles;

-- Luego ver los ids de Paulo e Isabella
SELECT id, name, email FROM users WHERE role = 'admin';

-- Finalmente agregar a user_roles (reemplaza los ids que veas)
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email IN ('paulo@correo.com', 'isabella@correo.com')
  AND r.name = 'admin';

-- Verificar RBAC
SELECT u.name, u.email, r.name AS rol
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'admin';
```

---

## 5. QUE HACER EN UN PC NUEVO

### Requisitos a instalar primero:
- Node.js (versión 18 o superior)
- MySQL (versión 8)
- Git
- Postman (descargar de postman.com)

### Pasos en orden:

1. Clonar el repositorio:
   git clone URL_DEL_REPO
   cd Backend-IP

2. Instalar dependencias:
   npm install

3. Crear el archivo .env en la raíz con estos datos:
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=paulo_user
   DB_PASSWORD=Paulo2024*
   DB_NAME=gestion_tareas_sena
   JWT_SECRET=cualquier_texto_secreto_largo
   JWT_REFRESH_SECRET=otro_texto_secreto_largo
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d

4. En MySQL Workbench, crear el usuario y la base de datos:
   CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
   CREATE USER IF NOT EXISTS 'paulo_user'@'localhost' IDENTIFIED BY 'Paulo2024*';
   GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'paulo_user'@'localhost';
   FLUSH PRIVILEGES;

5. Ejecutar los scripts SQL del proyecto (carpeta sql/)

6. Levantar el servidor:
   npm run dev

7. Importar la colección en Postman:
   - Abrir Postman
   - Clic en Import
   - Seleccionar el archivo .json de la carpeta postman/

8. Ejecutar primero POST /api/auth/register para crear tu usuario
9. Ejecutar POST /api/auth/login para obtener el token
10. Correr el SQL del paso 4 (sección 4 de esta guia) para darte rol admin

---

## 6. ORDEN CORRECTO PARA PROBAR EN POSTMAN

1. POST /api/auth/register  → crear tu usuario
2. POST /api/auth/login     → obtener token (copiarlo)
3. Pegar token en los endpoints protegidos
4. GET  /api/users          → ver usuarios
5. GET  /api/tasks          → ver tareas
6. POST /api/tasks          → crear tarea (necesita token)
7. POST /api/tasks/:id/assign → asignar usuarios a la tarea

---

## 7. ERRORES COMUNES Y SOLUCIONES

| Error                        | Causa                          | Solución                              |
|------------------------------|--------------------------------|---------------------------------------|
| Cannot connect to server     | Backend no está corriendo      | Ejecutar npm run dev                  |
| 401 Unauthorized             | No enviaste el token           | Agregar Bearer Token en Authorization |
| 403 Forbidden                | Tu usuario no es admin         | Ejecutar el SQL de la sección 4       |
| 500 Internal Server Error    | Error en .env o MySQL          | Verificar .env y que MySQL esté activo|
| JWT_SECRET vacío             | .env incompleto                | Agregar JWT_SECRET en .env            |
