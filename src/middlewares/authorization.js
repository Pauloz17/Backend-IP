// MÓDULO: middlewares/authorization.js
// CAPA: Middleware de autorización RBAC

// authorize(requiredPermission) retorna un middleware que verifica si el usuario
// tiene el permiso requerido antes de permitir el acceso a la ruta.
export const authorize = (requiredPermission) => {
    return (req, res, next) => {
        const userPermissions = req.user?.permissions || req.usuario?.permissions || [];
        const hasPermission = Array.isArray(userPermissions) && userPermissions.includes(requiredPermission);

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado. Se requiere: ${requiredPermission}`,
            });
        }

        next();
    };
};
