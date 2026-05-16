import { Router } from 'express';
import { getNetworkIp } from '../controller/system.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Ruta protegida para que el frontend consulte la IP
router.get('/network-ip', verifyToken, getNetworkIp);

export default router;