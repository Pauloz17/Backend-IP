# Sistema de Gestión de Tareas — Software Factory SENA

**Metodología:** *"Del Requerimiento al Producto"*  
**Programa:** Técnico en Programación de Software — Código 3233198  
**Instructor:** John Freddy Becerra Castellanos  

---

## Equipo

| Nombre | Rol | Rama | Usuario de GitHub |
|:---|:---|:---|:---|
Ana Isabella Garcia Rozo  |  `Developer ` | `desarrolladora` | `@Isapro18` |
| Paulo Zapata | Desarrollador | `Lider (Arquitecto)` | `@Pauloz17` |

---

## Descripción del Proyecto

Aplicación web full-stack para gestionar tareas por usuario. Implementa un CRUD completo con arquitectura en capas, panel de administración, vista de usuario y backend REST con Node.js y MySQL.

El sistema tiene dos repositorios:

- **`transferencia_dom_parejas`** — Frontend modularizado con Vite y Vanilla JS
- **`servidor_backend_parejas`** — Backend REST con Node.js, Express y MySQL

---

## Repositorio 1: Frontend (`transferencia_dom_parejas`)

### Tecnologías

- Vite (empaquetador)
- Vanilla JavaScript con ES Modules
- SweetAlert2 (notificaciones y confirmaciones)
- CSS con variables personalizadas

### Arquitectura en capas

```
servidor_backend_parejas/
├── database/
│   ├── connection.sql   ← NUEVO: crea la BD y el usuario de conexión (ejecutar con root)
│   └── schema.sql       ← tablas e inserts (ejecutar con app_user)
├── md/                  ← NUEVO: documentación técnica del proyecto
│   ├── asignaciones_1/
│   │   ├── asignacion_Isabella.md
│   │   ├── asignacion_paulo.md
│   ├── analisisTecnico.md
│   ├── analisisRedundancia.md
│   ├── infoTecBackend.md
│   └── informeBackend.md
├── src/
│   ├── app.js
│   ├── controller/
│   ├── database/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   └── utils/
├── docs/           ← solo guías del sistema y metodología del equipo
├── postman/
├── .env
└── package.json
```

### Vistas del sistema

**Pantalla de inicio** — Dos tarjetas de acceso: Usuario y Administrador, con fondo degradado y efecto glass.

**Vista Usuario** — El usuario busca por número de documento, ve sus tareas asignadas en tabla con estado y comentario, y puede editar o eliminar tareas propias con confirmación SweetAlert2.

**Vista Administrador** — Panel completo con búsqueda en el header, tabla de usuarios con botones "Ver / Asignar" y "Eliminar", tabla de todas las tareas con filtros por estado y usuario, exportación a JSON, y modal dinámico para asignar tareas a usuarios específicos.

### Reglas de arquitectura

- La UI **nunca** llama directamente a la API — todo pasa por el service
- Ningún módulo usa `innerHTML` ni atributos `style` en JavaScript
- Las variables globales están prohibidas — se usan ES Modules con `export`/`import`
- Comentarios en español, código en inglés con `camelCase`

### Cómo ejecutar

```bash
# Instalar dependencias
npm install

# Modo desarrollo (http://localhost:5173)
npm run dev

# Build de producción
npm run build

# Vista previa del build
npm run preview
```

> El servidor backend debe estar corriendo en `http://localhost:3000` antes de iniciar el frontend.

---

## Repositorio 2: Backend (`servidor_backend_parejas`)

### Tecnologías

- Node.js (ES Modules)
- Express.js v5
- MySQL 2 con pool de conexiones
- Nodemon (desarrollo)
- dotenv (variables de entorno)

### Arquitectura MVC

```
src/
├── database/
│   └── db.connection.js       ← pool de conexiones MySQL con dotenv
├── models/
│   ├── user.model.js        ← CRUD sobre la tabla users en MySQL
│   └── task.model.js        ← CRUD sobre la tabla tasks en MySQL
├── controller/
│   ├── users.controller.js ← recibe req/res, llama al modelo de usuarios
│   └── tasks.controller.js ← recibe req/res, llama al modelo de tareas
├── routes/
│   ├── users.routes.js       ← conecta endpoints /api/users con el controlador
│   └── tasks.routes.js       ← conecta endpoints /api/tasks con el controlador
└── app.js                  ← instancia de Express, CORS, registro de rutas
```

### Variables de entorno

Crear un archivo `.env` en la raíz del repositorio backend:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=TU_CONTRASEÑA
DB_NAME=gestion_tareas_sena
```

### Configuración de MySQL

Ejecutar como root en MySQL Workbench:

```sql
CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'TU_CONTRASEÑA';
GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

Luego ejecutar `database/schema.sql` con la conexión `app_user` para crear las tablas e insertar los usuarios iniciales.

### Cómo ejecutar

```bash
# Instalar dependencias
npm install

# Modo desarrollo con nodemon (http://localhost:3000)
npm run dev
```

---

## Endpoints del Backend

### Usuarios — `/api/users`

| Método | Ruta | Descripción |
|:---|:---|:---|
| GET | `/api/users` | Listar todos los usuarios |
| GET | `/api/users/:id` | Obtener un usuario por id |
| POST | `/api/users` | Crear un usuario nuevo |
| PUT | `/api/users/:id` | Actualizar un usuario |
| DELETE | `/api/users/:id` | Eliminar un usuario |
| GET | `/api/users/:userId/tasks` | Tareas asignadas a un usuario |

**Cuerpo para POST `/api/users`:**
```json
{
  "documento": "1097497124",
  "name": "Nombre Apellido",
  "email": "correo@ejemplo.com"
}
```

### Tareas — `/api/tasks`

| Método | Ruta | Descripción |
|:---|:---|:---|
| GET | `/api/tasks` | Listar todas las tareas |
| GET | `/api/tasks/filter` | Filtrar por estado o usuario |
| GET | `/api/tasks/dashboard` | Estadísticas generales |
| GET | `/api/tasks/:id` | Obtener una tarea por id |
| POST | `/api/tasks` | Crear una tarea nueva |
| PUT | `/api/tasks/:id` | Actualizar una tarea |
| DELETE | `/api/tasks/:id` | Eliminar una tarea |
| PATCH | `/api/tasks/:id/status` | Cambiar el estado de una tarea |
| POST | `/api/tasks/:taskId/assign` | Asignar usuarios a una tarea |
| GET | `/api/tasks/:taskId/users` | Ver usuarios asignados a una tarea |
| DELETE | `/api/tasks/:taskId/users/:userId` | Quitar un usuario de una tarea |

**Cuerpo para POST `/api/tasks`:**
```json
{
  "title": "Título de la tarea",
  "description": "Descripción detallada",
  "status": "pendiente",
  "assignedUsers": [1, 2]
}

**Nota:** El campo `assignedUsers` es un array de IDs numéricos de usuarios. En la arquitectura actual, este campo es gestionado por el frontend desde el panel de administración al crear o asignar tareas. Al consumir este endpoint directamente (por ejemplo desde Postman), se puede enviar vacío `[]` o con los IDs deseados.

```

**Query params para GET `/api/tasks/filter`:**
```
?status=pendiente
?userId=1
?status=en_progreso&userId=2
```

**Valores válidos para `status`:** `pendiente` | `en_progreso` | `completada`

---

## Flujo de Datos

```
Usuario (evento DOM)
        ↓
  tareasService.js  ←→  utils/ (validaciones, notificaciones, filtros, ordenamiento)
        ↓
    api/*.js  (tareasApi.js / usuariosApi.js)
        ↓
  GET/POST/PUT/PATCH/DELETE http://localhost:3000
        ↓
    app.js (Express)
        ↓
    routes/ (userRoutes.js / taskRoutes.js)
        ↓
    controller/ (users.controller.js / tasks.controller.js)
        ↓
    models/ (userModel.js / taskModel.js)
        ↓
    MySQL — base de datos gestion_tareas_sena
```

---

## Estructura de Ramas

```
main          ← producción (solo Paulo mergea, con tag de versión)
  └── release ← integración (todos hacen PR aquí)
        ├── desarrollador-Isa  ← rama de Isa
        └── desarrollador-Paulo   ← rama de Paulo
```

**Regla de oro:** ningún commit va directo a `main` ni a `release`. Todo entra por Pull Request con al menos una aprobación del líder.

---

## Historial de Versiones

### Frontend (transferencia_dom)

| Tag   | Descripción |
|:------|:------------|
| v1.0.0 | Implementación completa (filtros, ordenamiento, notificaciones y exportación JSON) |
| v2.0.0 | Migración a entorno con Vite y configuración de build |
| v2.1.0 | Integración SweetAlert2 (reemplazo de diálogos nativos) |
| v2.1.1 | Documentación técnica del versionado + configuración de gitignore y limpieza del proyecto |
| v3.0.0 | Sistema completo con panel admin, backend Express, modelos dinámicos y CRUD con SweetAlert2 |
| v3.1.0 | Rediseño de pantalla de inicio + validaciones en formulario admin + SweetAlert2 completo |

---

### Backend (servidor_backend_parejas)

| Tag   | Descripción |
|:------|:------------|
| v1.0.0 | Modelos, controladores y rutas base |
| v1.1.0 | Implementación de subida de archivos + ajustes faltantes |

---

## Guías del Proyecto

La carpeta `docs/` contiene las guías metodológicas del proyecto:

- `docs/01-guia-sistema/` — Gestión de Issues, Milestones y tablero Kanban
- `docs/02-guia-metodologia/` — GitFlow, commits convencionales, Pull Requests
- `docs/03-formatos-maestros/` — Plantillas oficiales de Issues y PRs

---

## Criterios de Entrega

La fase se considera terminada cuando:

- El **Milestone** en GitHub marca **100%** de progreso
- Todas las Issues del hito están cerradas y vinculadas a un PR aprobado
- El sistema corre sin errores con `npm run dev` en ambos repositorios
- El backend conecta correctamente con MySQL y responde a todos los endpoints

---


## Base de Datos

Este proyecto usa **MySQL 8.0** para la persistencia de datos.
Los datos se mantienen aunque el servidor se reinicie.

### Requisitos previos

- MySQL 8.0 instalado
- MySQL Workbench 8.0 CE

### Configuración inicial (una sola vez por computador)

**Paso 1 — Crear el usuario y la base de datos (con root)**

Abrir MySQL Workbench → conexión `gestion_tareas_root` → ejecutar:

```sql
CREATE DATABASE IF NOT EXISTS gestion_tareas_sena;
CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'TU_CONTRASEÑA';
GRANT ALL PRIVILEGES ON gestion_tareas_sena.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```
## Arquitectura de Base de Datos — v4.0

El sistema usa 3 archivos SQL separados que deben ejecutarse en este orden:

### 1. `database/connection.sql`
Crea la base de datos `gestion_tareas_sena` y el usuario `app_user`.
Ejecutar con conexión de **root** en MySQL Workbench (solo si no se ha ejecutado antes).

### 2. `database/schema.sql`
Crea las tablas principales del sistema:
- `users` — usuarios del sistema con campo `role` VARCHAR
- `tasks` — tareas con `assigned_users` en formato JSON

### 3. `database/rbac.sql`
Implementa la arquitectura RBAC (Role-Based Access Control):
- `roles` — roles del sistema: `admin`, `user`, `instructor`
- `permissions` — permisos atómicos (ej: `tasks.create`, `users.delete`)
- `role_permissions` — relación M:N entre roles y permisos
- `user_roles` — relación M:N entre usuarios y roles

### Matriz RBAC del Sistema

| Permiso | admin | instructor | user |
|---------|:-----:|:----------:|:----:|
| tasks.create | ✅ | ✅ | ❌ |
| tasks.view.all | ✅ | ✅ | ✅ |
| tasks.update | ✅ | ✅ | ❌ |
| tasks.delete.all | ✅ | ✅ | ❌ |
| tasks.assign | ✅ | ✅ | ❌ |
| tasks.status.update | ✅ | ✅ | ✅ |
| users.view | ✅ | ✅ | ❌ |
| users.edit | ✅ | ❌ | ❌ |
| users.delete | ✅ | ❌ | ❌ |
| users.assign.role | ✅ | ❌ | ❌ |

*Servicio Nacional de Aprendizaje (SENA) · Técnico en Programación de Software · 2026*