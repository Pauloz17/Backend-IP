# Documentación Técnica — Sistema de Autenticación JWT
## Sistema de Gestión de Tareas

**Autores:** Paulo Zapata, Ana Isabella  
**Institución:** SENA — Técnico en Programación de Software  
**Instructor:** John Freddy Becerra Castellanos  
**Fecha:** Abril 2026  
**Versión del sistema:** v4.0.0

---

## ¿Por qué necesitamos autenticación?

Sin autenticación, cualquier persona que conozca la URL del servidor puede leer, crear, modificar o eliminar tareas y usuarios. La autenticación resuelve dos preguntas que todo sistema debe responder:

- **¿Quién eres?** (autenticación) — verificar que el usuario es quien dice ser
- **¿Qué puedes hacer?** (autorización) — verificar que tiene permiso para realizar la acción

---

## Qué es JWT (JSON Web Token)

Un JWT es una cadena de texto codificada en Base64 con tres partes separadas por puntos: `header.payload.firma`

**Ejemplo de token real (decodificado):**
```
Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "id": 1, "documento": "1097497003", "role": "admin", "iat": 1714000000, "exp": 1714003600 }
Firma:   HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

El payload se puede leer desde cualquier lugar (está en Base64, no cifrado). La firma es lo que garantiza que nadie modificó el token — si alguien cambia el payload la firma ya no coincide y el servidor lo rechaza.

**El token NO guarda la contraseña ni información sensible.** Solo guarda el id, el documento y el rol del usuario para que el servidor pueda identificarlo sin consultar la base de datos en cada petición.

---

## El flujo completo de autenticación en el proyecto

### 1. Registro (nuevo en esta versión)

```
Frontend (pantalla de inicio)          Backend
       |                                   |
       |-- POST /api/auth/register ------> |
       |   { name, documento, email,       |
       |     password }                    |
       |                                   |-- Zod valida los campos
       |                                   |-- Verifica que email no exista en MySQL
       |                                   |-- Verifica que documento no exista
       |                                   |-- bcrypt.hash(password, 10) → hash
       |                                   |-- INSERT en tabla users con hash
       |                                   |
       |<-- 201 { usuario sin password } --|
       |                                   |
```

**¿Por qué se hashea la contraseña?** Porque si la base de datos es hackeada, el atacante no puede saber las contraseñas reales. El hash es irreversible: dado el hash no se puede obtener la contraseña original. bcrypt con 10 rondas significa que para probar 1 contraseña tarda ~100ms — suficiente para frenar ataques de fuerza bruta.

---

### 2. Login

```
Frontend                                Backend
       |                                   |
       |-- POST /api/auth/login ---------->|
       |   { email, password }             |
       |                                   |-- Zod valida los campos
       |                                   |-- Busca el usuario por email en MySQL
       |                                   |-- bcrypt.compare(password, hash) → true/false
       |                                   |-- jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
       |                                   |   → accessToken (dura 1 hora)
       |                                   |-- jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' })
       |                                   |   → refreshToken (dura 7 días)
       |                                   |
       |<-- 200 { accessToken,             |
       |          refreshToken,            |
       |          user: { id, name,        |
       |                  role,            |
       |                  documento } } ---|
       |                                   |
       |-- localStorage.setItem('accessToken', ...)
       |-- localStorage.setItem('refreshToken', ...)
       |-- localStorage.setItem('usuarioActual', JSON.stringify(user))
```

---

### 3. Petición autenticada a una ruta protegida

```
Frontend                                Backend
       |                                   |
       |-- GET /api/tasks ----------------> |
       |   Authorization: Bearer <token>    |
       |                                   |-- verifyToken middleware:
       |                                   |   jwt.verify(token, JWT_SECRET)
       |                                   |   Si token válido: req.usuario = payload
       |                                   |   Si expirado: responde 401
       |                                   |-- getTasks controller
       |                                   |-- SELECT * FROM tasks
       |                                   |
       |<-- 200 { data: [...tareas] } ------|
```

**¿Por qué el token va en el header y no en el body?** Por convención REST. El header `Authorization: Bearer <token>` es el estándar de la industria para autenticación con tokens. Los headers se envían en todas las peticiones automáticamente si se configuran correctamente.

---

### 4. Silent Refresh — cuando el accessToken expira

Este es el mecanismo más sofisticado del sistema. El accessToken dura 1 hora. Cuando expira, en lugar de forzar al usuario a hacer login de nuevo, el frontend pide automáticamente un token nuevo usando el refreshToken.

```
Frontend (fetchConAuth.js)              Backend
       |                                   |
       |-- GET /api/tasks ----------------> |
       |   Authorization: Bearer <token    |
       |   expirado>                        |
       |                                   |-- verifyToken: TokenExpiredError
       |                                   |
       |<-- 401 { error: "El token ha      |
       |          expirado..." }  ----------|
       |                                   |
       |-- (AUTOMÁTICO: Silent Refresh)    |
       |-- POST /api/auth/refresh --------> |
       |   { refreshToken }                |
       |                                   |-- jwt.verify(refreshToken, JWT_REFRESH_SECRET)
       |                                   |-- Verifica que el usuario existe en MySQL
       |                                   |-- jwt.sign(nuevoPayload, JWT_SECRET, { expiresIn: '1h' })
       |                                   |   → nuevo accessToken
       |                                   |
       |<-- 200 { accessToken: nuevo } ----|
       |                                   |
       |-- localStorage.setItem('accessToken', nuevoToken)
       |                                   |
       |-- GET /api/tasks (REINTENTO) ----> |
       |   Authorization: Bearer <nuevo    |
       |   token>                           |
       |                                   |-- verifyToken: OK
       |                                   |
       |<-- 200 { data: [...tareas] } ------|
```

**El usuario no nota nada.** Todo este proceso ocurre en milisegundos dentro de `src/utils/fetchConAuth.js` sin interrumpir la experiencia del usuario.

---

### 5. ¿Por qué dos tokens? accessToken vs refreshToken

| | accessToken | refreshToken |
|:---|:---|:---|
| **Duración** | 1 hora | 7 días |
| **Dónde se usa** | En cada petición (header Authorization) | Solo en POST /api/auth/refresh |
| **Secret del servidor** | JWT_SECRET | JWT_REFRESH_SECRET |
| **Si es robado** | El atacante tiene acceso 1 hora máximo | El atacante puede pedir nuevos accessTokens |
| **Por qué separados** | Minimizar el riesgo: si el accessToken es interceptado el daño es limitado | El refreshToken permite renovar sin login, pero rara vez viaja por la red |

La guía del instructor pide el refreshToken específicamente porque es una práctica estándar de la industria. Sin él, el usuario tendría que hacer login cada hora, lo cual es una experiencia terrible.

---

## Los archivos clave del sistema de autenticación

### Backend

| Archivo | Responsabilidad |
|:---|:---|
| `schemas/auth.schema.js` | Moldes Zod que validan email+password (login) y name+documento+email+password (registro) |
| `src/services/auth.service.js` | Lógica de negocio: buscar usuario por email, comparar contraseña con bcrypt, generar tokens |
| `src/controller/auth.controller.js` | Recibe HTTP, llama al servicio, responde HTTP |
| `src/controller/auth.refresh.controller.js` | Controlador exclusivo para renovar el accessToken |
| `src/routes/auth.routes.js` | Define POST /login, POST /register, POST /refresh |
| `src/middlewares/auth.middleware.js` | `verifyToken`: verifica el JWT en cada petición; `requireAdmin`: verifica que el rol sea admin |

### Frontend

| Archivo | Responsabilidad |
|:---|:---|
| `src/utils/sesion.js` | CRUD del localStorage: guardar, leer y borrar tokens y datos del usuario |
| `src/utils/fetchConAuth.js` | Interceptor: adjunta el token JWT a cada petición y hace el Silent Refresh si recibe 401 |
| `src/api/authApi.js` | Funciones fetch para login, registro y renovación de token |
| `src/ui/modoUI.js` | Gestiona la lógica del formulario de login, el modal de registro y el botón de logout |

---

## Variables de entorno del backend (.env)

El archivo `.env` en la raíz del backend debe tener estas variables. **Este archivo NUNCA se sube a GitHub** (está en `.gitignore`):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=tu_contraseña_de_mysql
DB_NAME=gestion_tareas_sena

JWT_SECRET=una_cadena_larga_y_aleatoria_para_el_access_token
JWT_REFRESH_SECRET=otra_cadena_larga_y_diferente_para_el_refresh_token
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

**¿Por qué los secrets deben ser largos y aleatorios?** Porque la seguridad del JWT depende de que nadie más conozca el secret. Si el secret es "123456" o "password", un atacante puede adivinar el secret y forjar tokens válidos. Un secret de 32+ caracteres aleatorios hace esto prácticamente imposible.

---

## El script changePassword.js — por qué se dejó de usar

El archivo `scripts/changePassword.js` era un parche temporal para hashear contraseñas directamente en MySQL sin pasar por el sistema de registro. Sus problemas:

1. **No profesional:** en producción nunca se modifica la BD con scripts manuales para cada usuario
2. **Riesgo de olvido:** si alguien crea un usuario desde el panel de admin y olvida correr el script, el usuario queda sin contraseña y no puede iniciar sesión
3. **No escalable:** si el sistema tiene 100 usuarios, ejecutar el script 100 veces es inmanejable

Con el endpoint `POST /api/auth/register` este flujo queda reemplazado por completo. El usuario se registra desde la pantalla de inicio, la contraseña se hashea automáticamente en el mismo proceso, y queda guardada en MySQL correctamente. El archivo del script puede permanecer en el repositorio para referencia histórica pero ya no debe ejecutarse.

---

## Cómo probar el sistema completo (para sustentación)

### En Postman (Sebastián lo configura en el Issue B-4):

1. **Registro:** `POST /api/auth/register` con un nuevo usuario → debe responder 201
2. **Login:** `POST /api/auth/login` con email + contraseña → debe responder 200 y guardar el token automáticamente
3. **Ruta protegida:** `GET /api/users` (el token se adjunta solo) → debe responder 200
4. **Cambio de rol:** `PATCH /api/users/3/role` con `{ "role": "admin" }` → solo funciona con token de admin
5. **Refresh:** `POST /api/auth/refresh` con el refreshToken → debe responder 200 con nuevo accessToken

### En el navegador (Paulo lo implementa en los Issues F-1 a F-5):

1. Abrir `http://localhost:5173`
2. Hacer clic en "Regístrate aquí" → aparece el modal
3. Intentar registrarse con campos vacíos → aparecen errores
4. Intentar registrarse con nombre con números → aparece error
5. Registrarse correctamente → el modal se cierra y aparece el login
6. Hacer login con el nuevo email y contraseña → se carga el panel correcto
7. Si es user: ver que los datos y tareas cargan automáticamente
8. Hacer clic en el botón circular de logout → aparece confirmación
9. Confirmar → los campos del login están vacíos, se vuelve a la pantalla de inicio

---

## Preguntas frecuentes que puede hacer el instructor en sustentación

**¿Por qué el accessToken dura solo 1 hora?**  
Para minimizar el riesgo si un token es robado. Si alguien intercepta un accessToken, solo tiene acceso durante 1 hora máximo. Después de eso el token expira y ya no sirve.

**¿Por qué el refreshToken dura 7 días?**  
Para no obligar al usuario a hacer login cada hora. El refreshToken vive más tiempo pero solo se usa en el endpoint de refresh, no en cada petición, lo que lo hace menos vulnerable a ser interceptado.

**¿Qué pasa si alguien roba el refreshToken?**  
Podría pedir nuevos accessTokens por 7 días. Por eso es importante que el logout limpie el localStorage: `cerrarSesion()` borra ambos tokens, y aunque el refreshToken siga siendo técnicamente válido en el servidor, ya no está disponible en el navegador del cliente legítimo. Una mejora futura sería mantener una lista negra de refreshTokens revocados en la BD.

**¿Por qué se guarda el token en localStorage y no en cookies?**  
Por simplicidad en el contexto del SENA. Las cookies HTTP-only son más seguras contra XSS pero requieren configuración de CORS más compleja. Para el nivel técnico del proyecto, localStorage es la opción estándar enseñada y cumple con lo requerido por la guía.

**¿Qué hace `fetchConAuth.js`?**  
Es un wrapper del `fetch` nativo que automáticamente adjunta el token JWT en el header Authorization de cada petición. Si el servidor responde 401 (token expirado), llama al endpoint de refresh, obtiene un nuevo token, lo guarda en localStorage y reintenta la petición original. Todo esto ocurre transparentemente sin que el usuario lo note.

**¿Por qué el payload del JWT incluye `documento` y no `email`?**  
Porque en las guías anteriores el sistema identificaba a los usuarios por su número de documento. El payload sigue incluyendo `documento` para que el resto del sistema funcione sin cambios. El email solo se usa para autenticación (login y registro), no para identificar al usuario en el flujo de tareas.

**¿Por qué `bcrypt.compare` en lugar de comparar el hash directamente?**  
Porque bcrypt usa un "salt" aleatorio al hashear. Dos hashes de la misma contraseña son diferentes entre sí. `bcrypt.compare` sabe cómo extraer el salt del hash guardado y rehashear la contraseña enviada con ese mismo salt para compararlos correctamente. Comparar los hashes directamente (con `===`) siempre daría `false`.

---

## Glosario de términos clave

| Término | Definición |
|:---|:---|
| **JWT (JSON Web Token)** | Estándar para transmitir información de forma segura entre partes como un objeto JSON firmado digitalmente |
| **accessToken** | Token de corta duración (1h) que se envía en cada petición para identificar al usuario |
| **refreshToken** | Token de larga duración (7d) que se usa solo para obtener un nuevo accessToken cuando el anterior expira |
| **bcrypt** | Algoritmo de hashing de contraseñas diseñado para ser lento y resistente a ataques de fuerza bruta |
| **salt** | Valor aleatorio que bcrypt agrega a la contraseña antes de hashear para que dos contraseñas iguales produzcan hashes diferentes |
| **middleware** | Función en Express que se ejecuta entre recibir la petición y llegar al controlador (ej: verificar el token) |
| **payload** | La parte del JWT que contiene los datos del usuario (id, documento, role) — está en Base64, no cifrado |
| **firma (signature)** | La parte del JWT que verifica que el payload no fue modificado — se genera con el secret del servidor |
| **Silent Refresh** | Proceso automático por el cual el frontend renueva el accessToken sin interrumpir al usuario |
| **Authorization: Bearer** | Formato estándar HTTP para enviar el token en el header de cada petición |
| **403 Forbidden** | Código HTTP que significa "estás autenticado pero no tienes permiso para esto" (diferente de 401 "no autenticado") |
| **OWASP** | Open Web Application Security Project — organización que publica estándares de seguridad web; recomienda bcrypt con 10 rondas |