// MÓDULO: middlewares/authorization.middleware.js
// CAPA: Middleware de autorización (RBAC)

// Responsabilidad única: verificar que el usuario tiene el permiso requerido
// para acceder a una ruta protegida.

// DIFERENCIA CON auth.middleware.js:
//   - auth.middleware.js responde "¿Quién eres?" (autenticación: verifica el JWT)
//   - authorization.middleware.js responde "¿Qué puedes hacer?" (autorización: verifica permisos)

// CLOSURE:
//   checkPermission es una función de orden superior que recibe el nombre del
//   permiso requerido y RETORNA el middleware (req, res, next).
//   Esto permite usarlo así en las rutas:
//     router.delete('/:id', verifyToken, checkPermission('tasks.delete.all'), deleteTask)
//   La función checkPermission "recuerda" el permiso requerido gracias al Closure.

// LÓGICA DE MÚLTIPLES ROLES:
//   Un usuario puede tener varios roles (ej: admin Y instructor).
//   Se usa .some() para verificar si AL MENOS UNO de sus roles tiene el permiso.
//   Si al menos un rol lo tiene, se permite el acceso.
 
import { getUserRolesAndPermissions } from '../models/user.model.js';
import { isUserAssignedToTask } from '../models/task.model.js';

// Helper reutilizable: consulta permisos actuales en BD, no datos manipulables
// del localStorage ni un rol antiguo incluido dentro del token.
export async function userHasPermission(userId, permiso) {
    const roles = await getUserRolesAndPermissions(userId);
    return roles.some(rol => Array.isArray(rol.permissions) && rol.permissions.includes(permiso));
}
 
// checkPermission — Closure que recibe el código del permiso requerido
// y retorna el middleware de Express (req, res, next).
//
// Parámetro: permiso — string con el código del permiso requerido
//   Ejemplos: 'tasks.delete.all', 'users.assign.role', 'tasks.create'
//
// El middleware resultante:
//   1. Consulta los roles del usuario en la BD (no en el token, para reflejar cambios en tiempo real)
//   2. Busca si alguno de sus roles tiene el permiso requerido con .some()
//   3. Si lo tiene → next() (continuar a la ruta)
//   4. Si no lo tiene → 403 Forbidden con mensaje en español
export function checkPermission(permiso) {
 
    // Esta función interna es el middleware que Express ejecutará.
    // La función externa checkPermission "recordará" el valor de `permiso`
    // gracias al mecanismo de Closure de JavaScript.
    return async function(req, res, next) {
 
        // req.usuario fue adjuntado por verifyToken (que debe ejecutarse antes).
        // Si no existe, el token no fue verificado — no debería pasar si la ruta
        // está configurada correctamente, pero lo verificamos por seguridad.
        if (!req.usuario || !req.usuario.id) {
            return res.status(401).json({
                error: 'Acceso denegado: Token requerido',
            });
        }
 
        // Consultar los roles y permisos del usuario en la base de datos RBAC.
        // No se usa el token para esto porque los permisos pueden cambiar desde
        // que se emitió el token — consultar la BD garantiza datos en tiempo real.
        const rolesDelUsuario = await getUserRolesAndPermissions(req.usuario.id);
 
        // Si el usuario no tiene roles registrados en la tabla user_roles,
        // se verifica si su campo `role` de la tabla users tiene el permiso
        // usando el sistema legacy (campo VARCHAR). Esto garantiza compatibilidad
        // con usuarios que existen antes de ejecutar rbac.sql.
        if (!rolesDelUsuario || rolesDelUsuario.length === 0) {
            // Fallback: usar el rol del campo `role` en el JWT para compatibilidad
            const rolLegacy = req.usuario.role;
            // Un admin legacy tiene todos los permisos — no bloqueamos
            if (rolLegacy === 'admin') return next();
            // Cualquier otro rol legacy que no sea admin no tiene el permiso
            return res.status(403).json({
                error: `Acceso denegado: no tienes el permiso requerido (${permiso})`,
            });
        }
 
        // Verificar si AL MENOS UNO de los roles del usuario tiene el permiso requerido.
        // rolesDelUsuario es un arreglo como:
        //   [{ name: 'admin', permissions: ['tasks.create', 'tasks.delete.all', ...] }, ...]
        // .some() recorre el arreglo y retorna true en el momento en que encuentra
        // un rol que incluye el permiso — si ninguno lo tiene, retorna false.
        const tienePermiso = rolesDelUsuario.some(function(rol) {
            // rol.permissions es un arreglo de strings con los códigos de permisos
            // .includes() busca el permiso requerido dentro del arreglo
            return Array.isArray(rol.permissions) && rol.permissions.includes(permiso);
        });
 
        // Si ningún rol del usuario tiene el permiso requerido, denegar con 403.
        // 403 Forbidden: el servidor entendió la petición pero se niega a autorizarla.
        // Es distinto de 401: aquí el usuario está autenticado pero no tiene privilegios.
        if (!tienePermiso) {
            return res.status(403).json({
                error: `Acceso denegado: no tienes el permiso requerido (${permiso})`,
            });
        }
 
        // El usuario tiene el permiso — continuar al controlador o siguiente middleware
        next();
    };
}

// Permite que un usuario normal consulte solo sus tareas usando
// /api/tasks/filter?userId=<su-id>. Si intenta cambiar el id en la URL, debe
// tener el permiso global tasks.view.all para continuar.
export function requireOwnTaskFilter(req, res, next) {
    if (!req.usuario?.id) {
        return res.status(401).json({ error: 'Acceso denegado: Token requerido' });
    }

    if (String(req.query.userId) === String(req.usuario.id)) return next();
    return checkPermission('tasks.view.all')(req, res, next);
}

// Autoriza a administradores/instructores con tasks.update o al usuario que
// realmente esta asignado a la tarea. Es defensa contra cambiar /tasks/12 por
// /tasks/13 directamente desde DevTools o una herramienta externa.
export async function requireTaskAssigneeOrUpdatePermission(req, res, next) {
    if (!req.usuario?.id) {
        return res.status(401).json({ error: 'Acceso denegado: Token requerido' });
    }

    if (await userHasPermission(req.usuario.id, 'tasks.update')) return next();

    if (await isUserAssignedToTask(req.params.id, req.usuario.id)) return next();
    return res.status(403).json({ error: 'Acceso denegado: la tarea no esta asignada al usuario autenticado' });
}
