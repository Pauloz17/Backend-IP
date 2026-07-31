// Diagnóstico: compara el dist local vs el bundle servido por el frontend
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 52232;
const HOST = '192.168.56.1';
const BUNDLE = '/assets/index-BfZAkZAj.js';
const LOCAL_DIST = 'c:/front/Frontend-IP/dist/assets/index-BfZAkZAj.js';

function fetch(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: HOST, port: PORT, path, timeout: 8000 }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}

function checkStrings(name, content) {
    console.log(`\n--- Contenido de ${name} (${content.length} bytes) ---`);
    const checks = {
        'manejarRegistro': content.includes('manejarRegistro'),
        'Creando cuenta...': content.includes('Creando cuenta'),
        'Cuenta creada exitosamente': content.includes('Cuenta creada exitosamente'),
        'registrarUsuario': content.includes('registrarUsuario'),
        'abrirModalRegistro': content.includes('abrirModalRegistro'),
        'validarFormularioRegistro': content.includes('validarFormularioRegistro'),
    };
    for (const [k, v] of Object.entries(checks)) {
        console.log(v ? '  [OK]' : '  [FALTA]', k);
    }
}

(async () => {
    console.log('=== DIAGNÓSTICO BUNDLE REGISTRO ===');
    try {
        // 1. Bundle servido por el puerto 52232
        const served = await fetch(BUNDLE);
        console.log(`GET ${BUNDLE} → status ${served.status}, ${served.data.length} bytes`);
        checkStrings('SERVIDO (192.168.56.1:52232)', served.data);

        // 2. Bundle local en c:\front\Frontend-IP\dist
        if (fs.existsSync(LOCAL_DIST)) {
            const local = fs.readFileSync(LOCAL_DIST, 'utf8');
            console.log(`\nArchivo local existe: ${LOCAL_DIST}`);
            checkStrings('LOCAL (c:/front/Frontend-IP/dist)', local);
            console.log('\n¿El servido es IDÉNTICO al local?', served.data === local);
        } else {
            console.log('\nNO EXISTE el dist local:', LOCAL_DIST);
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
})();

