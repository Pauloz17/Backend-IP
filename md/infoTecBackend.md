```markdown
# servidor_backend_parejas

Backend en Node.js con Express para el Sistema de Gestión de Tareas.
Desarrollado como parte de la guía "Modelos y separación de responsabilidades"
del Técnico en Programación de Software — SENA.

## Equipo

| Nombre    | Rama        | Rol                              |
|-----------|-------------|----------------------------------|
| Paulo     | desarrollador | Líder, app.js, frontend       |
| Ana Isabella | developer   | Modelos y controladores           |

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

El servidor corre en: http://localhost:3000

## Arquitectura MVC

```
Cliente HTTP
    ↓
app.js (Express — registra rutas con prefijo /api)
    ↓
routes/ (userRoutes.js, taskRoutes.js — conectan URLs con controladores)
    ↓
controller/ (users.controller.js, tasks.controller.js — manejan req y res)
    ↓
models/ (userModel.js, taskModel.js — datos en memoria y operaciones CRUD)
```

## Endpoints de Usuarios

| Método | Endpoint                      | Descripción                          |
|--------|-------------------------------|--------------------------------------|
| GET    | /api/users                    | Listar todos los usuarios            |
| GET    | /api/users/:id                | Obtener un usuario por id            |
| POST   | /api/users                    | Crear un usuario nuevo               |
| PUT    | /api/users/:id                | Actualizar un usuario                |
| DELETE | /api/users/:id                | Eliminar un usuario                  |
| GET    | /api/users/:userId/tasks      | Tareas asignadas a un usuario        |

### Cuerpo para POST /api/users

```json
{
  "documento": "1097497124",
  "name": "Nombre Apellido",
  "email": "correo@ejemplo.com"
}
```

### Respuesta de GET /api/users

```json
[
  { "id": 1, "documento": "1097497001", "name": "Paulo",     "email": "paulo@sena.edu.co" },
  { "id": 2, "documento": "1097497002", "name": "Ana Isabella", "email": "ana@sena.edu.co" }
]
```

## Endpoints de Tareas

| Método | Endpoint                              | Descripción                          |
|--------|---------------------------------------|--------------------------------------|
| GET    | /api/tasks                            | Listar todas las tareas              |
| GET    | /api/tasks/filter                     | Filtrar tareas por estado o usuario  |
| GET    | /api/tasks/dashboard                  | Estadísticas generales               |
| GET    | /api/tasks/:id                        | Obtener una tarea por id             |
| POST   | /api/tasks                            | Crear una tarea nueva                |
| PUT    | /api/tasks/:id                        | Actualizar una tarea                 |
| DELETE | /api/tasks/:id                        | Eliminar una tarea                   |
| PATCH  | /api/tasks/:id/status                 | Cambiar el estado de una tarea       |
| POST   | /api/tasks/:taskId/assign             | Asignar usuarios a una tarea         |
| GET    | /api/tasks/:taskId/users              | Ver usuarios asignados a una tarea   |
| DELETE | /api/tasks/:taskId/users/:userId      | Quitar un usuario de una tarea       |

### Cuerpo para POST /api/tasks

```json
{
  "title": "Título de la tarea",
  "description": "Descripción detallada",
  "status": "pendiente",
  "assignedUsers": [1, 2]
}

**Nota:** El campo `assignedUsers` es un array de IDs numéricos de usuarios. En la arquitectura actual, este campo es gestionado por el frontend desde el panel de administración al crear o asignar tareas. Al consumir este endpoint directamente (por ejemplo desde Postman), se puede enviar vacío `[]` o con los IDs deseados.

```

### Valores válidos para status

```
pendiente
en_progreso
completada
```

### Query params para GET /api/tasks/filter

```
/api/tasks/filter?status=pendiente
/api/tasks/filter?userId=1
/api/tasks/filter?status=en_progreso&userId=2
```

### Cuerpo para POST /api/tasks/:taskId/assign

```json
{
  "userIds": [1, 2, 3]
}
```

### Cuerpo para PATCH /api/tasks/:id/status

```json
{
  "status": "completada"
}
```

## Ruta raíz

GET http://localhost:3000/ retorna:

```json
{ "message": "Hola, Bienvenido a mi servidor" }
```
```

**En GitBash:**
```bash
git add README.md
git commit -m "docs: crear README con descripcion del proyecto y tabla de endpoints"
git push origin desarrollador
```

---

---

## PULL REQUEST

Crea el PR desde tu fork hacia el repositorio de Paulo.
Va de tu rama `desarrollador` → rama `release` del repo original.

**Espera a que el PR de Sebastián esté mergeado antes de crear este PR**,
porque tus archivos importan de los controladores de Sebastián.

**Título:**
```
feat: crear rutas nuevas userRoutes y taskRoutes con todos los endpoints
```

**Comentario:**
```
Qué se hizo:
- nuevo src/routes/userRoutes.js: define GET /, GET /:id, POST /,
  PUT /:id, DELETE /:id, GET /:userId/tasks
  importa desde ../controller/users.controller.js (archivo de Sebastián)
- nuevo src/routes/taskRoutes.js: define los 11 endpoints de tareas.
  Las rutas /filter y /dashboard están definidas ANTES de /:id para
  que Express no las interprete como parámetros.
  importa desde ../controller/tasks.controller.js (archivo de Sebastián)
- nuevo README.md: descripción del proyecto, cómo ejecutarlo,
  tabla completa de endpoints con ejemplos de cuerpos y respuestas

Por qué:
Las rutas son el eslabón entre app.js de Paulo y los controladores de
Ana Isabella. Sin estos archivos, aunque app.js los registre con el prefijo
/api, no hay nada que responda a las peticiones.

Archivos:
src/routes/userRoutes.js (nuevo)
src/routes/taskRoutes.js (nuevo)
README.md (nuevo)

Orden de merge: después del PR de Ana Isabella, antes del PR de Paulo (app.js).
```
