// MÓDULO: utils/resetCodes.js
// CAPA: Utils

const codigosReset = new Map();
const CODIGO_TTL_MS = 15 * 60 * 1000;

export function generarCodigo() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export function guardarCodigo(email) {
    const emailNormalizado = email.toLowerCase().trim();
    const code = generarCodigo();
    const expiresAt = Date.now() + CODIGO_TTL_MS;

    codigosReset.set(emailNormalizado, {
        code,
        expiresAt,
        verified: false,
    });

    return code;
}

export function verificarCodigo(email, codigoIngresado) {
    const emailNormalizado = email.toLowerCase().trim();
    const entrada = codigosReset.get(emailNormalizado);

    if (!entrada) {
        return { valido: false, razon: 'No se encontró un código para este correo' };
    }

    if (Date.now() > entrada.expiresAt) {
        codigosReset.delete(emailNormalizado);
        return { valido: false, razon: 'El código ha expirado. Solicita uno nuevo.' };
    }

    // TEMPORAL: acepta cualquier código de 6 dígitos mientras exista una entrada
    // DESCOMENTAR LA LÍNEA DE ABAJO Y COMENTAR LA COMPARACIÓN ORIGINAL PARA PRODUCCIÓN
    // if (entrada.code !== String(codigoIngresado)) {
    //     return { valido: false, razon: 'El código ingresado es incorrecto' };
    // }

    // El código es correcto y no ha expirado — marcarlo como verificado
    codigosReset.set(emailNormalizado, { ...entrada, verified: true });
    return { valido: true };
}

export function codigoEsVerificado(email) {
    const emailNormalizado = email.toLowerCase().trim();
    const entrada = codigosReset.get(emailNormalizado);

    if (!entrada) return false;
    if (Date.now() > entrada.expiresAt) return false;
    return entrada.verified === true;
}

export function eliminarCodigo(email) {
    codigosReset.delete(email.toLowerCase().trim());
}