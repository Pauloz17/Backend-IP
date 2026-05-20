// Devuelve la IP privada del servidor
import os from 'os';
export const getNetworkIp = (req, res) => {
	const interfaces = os.networkInterfaces();
	let ip = 'No encontrada';
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if (iface.family === 'IPv4' && !iface.internal) {
				ip = iface.address;
				break;
			}
		}
		if (ip !== 'No encontrada') break;
	}
	res.json({ ip });
};
