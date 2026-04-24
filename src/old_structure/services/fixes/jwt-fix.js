/**
 * FIX 1: JWT Real con verify()
 * Intercepta validación de tokens sin tocar socketHandlers.js
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
    patch: (io) => {
        io.use((socket, next) => {
            // Verificar token en handshake
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            
            if (!token) {
                console.log('[JWT-FIX] Conexión sin token - rechazada');
                return next(new Error('Token requerido'));
            }

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                socket.user = decoded;
                socket.authenticated = true;
                console.log('[JWT-FIX] Token válido para usuario:', decoded.id || 'unknown');
                next();
            } catch (err) {
                console.log('[JWT-FIX] Token inválido:', err.message);
                next(new Error('Token inválido'));
            }
        });
        console.log('[JWT-FIX] Middleware activo');
    }
};
