// MÓDULO: models/task.model.js
// CAPA: Modelo (datos y operaciones sobre la tabla tasks en MySQL)
//
// Responsabilidad única: interactuar con las tablas tasks y task_assignees.
// NUNCA conoce req, res ni Express.
//
// MIGRACIÓN 3FN: el antiguo campo JSON `tasks.assigned_users` fue reemplazado
// por la tabla pivote `task_assignees` (relación M:N con users). La API que
// expone este módulo NO cambia — sigue aceptando y devolviendo `assignedUsers`
// como un arreglo de números — pero internamente la persistencia es relacional.

import pool from '../database/db.connection.js';

// ── HELPERS PRIVADOS DE ASIGNACIONES ────────────────────────────────────────

// Devuelve los ids de usuarios asignados a una tarea como arreglo de números.
// Se usa internamente para componer el objeto de retorno con `assignedUsers`.
async function obtenerAsignadosDeTarea(taskId) {
    const [rows] = await pool.query(
        'SELECT user_id FROM task_assignees WHERE task_id = ? ORDER BY user_id',
        [Number(taskId)]
    );
    return rows.map(r => Number(r.user_id));
}

// Reemplaza el conjunto completo de asignados de una tarea por el array `userIds`.
// Operación atómica: borra los anteriores e inserta los nuevos en una sola
// transacción para que la tarea nunca quede en un estado intermedio.
async function reemplazarAsignados(taskId, userIds) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.query('DELETE FROM task_assignees WHERE task_id = ?', [Number(taskId)]);

        if (Array.isArray(userIds) && userIds.length > 0) {
            // Deduplicar y filtrar negativos antes de insertar
            const limpios = [...new Set(userIds.map(Number).filter(n => n > 0))];
            if (limpios.length > 0) {
                const valores = limpios.map(uid => [Number(taskId), uid]);
                await conexion.query(
                    'INSERT INTO task_assignees (task_id, user_id) VALUES ?',
                    [valores]
                );
            }
        }
        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

// ── FORMATEO DE FILAS ───────────────────────────────────────────────────────

// Convierte una fila raw de MySQL a la forma esperada por el frontend.
// `assignedUsers` se inyecta aparte porque viene de un JOIN/consulta separada,
// no del SELECT * de la tabla tasks (esa columna JSON ya no existe).
function formatearTarea(filaDb, assignedUsers = []) {
    if (!filaDb) return null;
    return {
        id:            filaDb.id,
        title:         filaDb.title,
        description:   filaDb.description,
        status:        filaDb.status,
        comment:       filaDb.comment || null,
        assignedUsers,
        createdAt:     filaDb.created_at,
        updatedAt:     filaDb.updated_at,
    };
}

// ── FUNCIONES EXPORTADAS ────────────────────────────────────────────────────

// RF03 — READ: retorna todas las tareas con sus asignados resueltos.
// Hace una sola consulta a tasks y otra a task_assignees+users para evitar
// N+1 queries, y resuelve en memoria los ids y nombres por cada tarea.
export async function getAllTasks() {
    const [tareas] = await pool.query('SELECT * FROM tasks');
    if (tareas.length === 0) return [];

    // Trae todas las asignaciones con los datos del usuario en un solo viaje
    const [asignaciones] = await pool.query(
        `SELECT ta.task_id, ta.user_id, u.name, u.documento
         FROM task_assignees ta
         INNER JOIN users u ON u.id = ta.user_id`
    );

    // Indexar por task_id para acceso O(1) al armar cada tarea
    const mapPorTarea = {};
    for (const fila of asignaciones) {
        if (!mapPorTarea[fila.task_id]) mapPorTarea[fila.task_id] = [];
        mapPorTarea[fila.task_id].push(fila);
    }

    return tareas.map(filaDb => {
        const filas = mapPorTarea[filaDb.id] || [];
        const tarea = formatearTarea(filaDb, filas.map(f => Number(f.user_id)));

        // Campos derivados que ya usaba el frontend: nombres + documentos
        const nombres = filas.map(f => f.name).filter(Boolean);
        tarea.assignedUsersDisplay = nombres.length > 0 ? nombres.join(', ') : null;
        tarea.assignedDocumentos   = filas.map(f => f.documento?.toString()).filter(Boolean);
        return tarea;
    });
}

// RF03 — READ: busca una tarea por id, resolviendo sus asignados.
export async function getTaskById(id) {
    const [rows] = await pool.query(
        'SELECT * FROM tasks WHERE id = ?',
        [Number(id)]
    );
    if (!rows[0]) return null;
    const assignedUsers = await obtenerAsignadosDeTarea(id);
    return formatearTarea(rows[0], assignedUsers);
}

// RF02 — CREATE: inserta una tarea nueva y registra sus asignados en el pivote.
export async function createTask({
    title,
    description,
    status        = 'pendiente',
    assignedUsers = [],
    comment       = null,
}) {
    const [result] = await pool.query(
        'INSERT INTO tasks (title, description, status, comment) VALUES (?, ?, ?, ?)',
        [title, description || '', status, comment || null]
    );
    const nuevoId = result.insertId;

    if (Array.isArray(assignedUsers) && assignedUsers.length > 0) {
        await reemplazarAsignados(nuevoId, assignedUsers);
    }

    return getTaskById(nuevoId);
}

// RF03 — UPDATE: actualiza una tarea. Si llega `assignedUsers`, reemplaza
// el set completo de asignados; cualquier otro campo se actualiza en `tasks`.
export async function updateTask(id, campos) {
    const existente = await getTaskById(id);
    if (!existente) return null;

    const camposDb = {};
    if (campos.title       !== undefined) camposDb.title       = campos.title;
    if (campos.description !== undefined) camposDb.description = campos.description;
    if (campos.status      !== undefined) camposDb.status      = campos.status;
    if (campos.comment     !== undefined) camposDb.comment     = campos.comment || null;

    if (Object.keys(camposDb).length > 0) {
        const parteSet = Object.keys(camposDb).map(c => `${c} = ?`).join(', ');
        await pool.query(
            `UPDATE tasks SET ${parteSet} WHERE id = ?`,
            [...Object.values(camposDb), Number(id)]
        );
    }

    // El campo assignedUsers se maneja aparte porque ya no vive en `tasks`
    if (campos.assignedUsers !== undefined) {
        await reemplazarAsignados(id, campos.assignedUsers);
    }

    return getTaskById(id);
}

// RF04 — DELETE: elimina una tarea (las asignaciones se borran en cascada).
export async function deleteTask(id) {
    const aEliminar = await getTaskById(id);
    if (!aEliminar) return null;
    await pool.query('DELETE FROM tasks WHERE id = ?', [Number(id)]);
    return aEliminar;
}

// FILTRO — retorna tareas filtradas por estado y/o usuario asignado.
// Si llega userId, se hace EXISTS contra task_assignees (consulta SQL pura,
// sin filtrar en memoria) para que el filtro funcione bien aunque crezca.
export async function filterTasks({ status, userId } = {}) {
    const condiciones = [];
    const valores     = [];

    if (status) {
        condiciones.push('t.status = ?');
        valores.push(status);
    }
    if (userId) {
        condiciones.push('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        valores.push(Number(userId));
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT * FROM tasks t ${where}`, valores);
    if (rows.length === 0) return [];

    // Reutilizamos getAllTasks() para no duplicar el cruce con users.
    // Filtramos su resultado por los ids que devolvió la query anterior.
    const idsFiltrados = new Set(rows.map(r => r.id));
    const todasConJoin = await getAllTasks();
    return todasConJoin.filter(t => idsFiltrados.has(t.id));
}

// Retorna todas las tareas asignadas a un usuario específico.
// Se usa en GET /api/users/:userId/tasks.
export async function getTasksByUserId(userId) {
    return filterTasks({ userId });
}

// Cambia solo el campo status de una tarea sin tocar los demás campos.
export async function updateTaskStatus(id, status) {
    return updateTask(id, { status });
}

// Agrega usuarios a la lista de asignados de una tarea sin duplicar
// los que ya estaban (INSERT IGNORE aprovecha la PK compuesta del pivote).
export async function assignUsersToTask(taskId, userIds) {
    const tarea = await getTaskById(taskId);
    if (!tarea) return null;

    const limpios = [...new Set((userIds || []).map(Number).filter(n => n > 0))];
    if (limpios.length > 0) {
        const valores = limpios.map(uid => [Number(taskId), uid]);
        await pool.query(
            'INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES ?',
            [valores]
        );
    }
    return getTaskById(taskId);
}

// Quita un usuario específico de la lista de asignados de una tarea.
export async function removeUserFromTask(taskId, userId) {
    const tarea = await getTaskById(taskId);
    if (!tarea) return null;
    await pool.query(
        'DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?',
        [Number(taskId), Number(userId)]
    );
    return getTaskById(taskId);
}
