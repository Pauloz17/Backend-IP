# Autores: Paulo Zapata | Ana Isabella
# Proyecto: Backend para el Sistema de Gestión de Tareas

# Servidor Backend Parejas

Backend desarrollado con Node.js y Express.js para la gestión de usuarios y tareas. Es la base sobre la cual se implementarán controladores, conexión a base de datos y autenticación.

---

## Estructura del Proyecto

```
- src/
    - routes/
        - users.routes.js — rutas de usuarios
        - tasks.routes.js — rutas de tareas
    - app.js — archivo principal del servidor
- .gitignore
- package.json
- package-lock.json
```

---

## Cómo ejecutar el servidor

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar el servidor:
```bash
npm run test
```

3. El servidor quedará escuchando en: `http://localhost:3000`

---

## Rutas disponibles

**Usuarios (`/users`)**
- `GET /users` — Lista de usuarios
- `POST /users` — Crear usuario
- `PUT /users` — Actualizar usuario
- `DELETE /users` — Eliminar usuario

**Tareas (`/tasks`)**
- `GET /tasks` — Lista de tareas
- `POST /tasks` — Crear tarea