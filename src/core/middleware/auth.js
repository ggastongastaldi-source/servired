const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.user.userId = decoded.userId || decoded.id || decoded._id;
        req.user.hasRole = (role) => (req.user.roles || [req.user.rol]).includes(role);
        next();
    } catch (error) {
        return res.status(401).json({ ok: false, error: 'Token inválido' });
    }
};

const verificarRol = (rolRequerido) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ ok: false, error: 'No autenticado' });
        }
        const roles = req.user.roles || [req.user.rol];
        const autorizado = roles.includes(rolRequerido) ||
            (rolRequerido === 'WORKER' && roles.includes('TRABAJADOR'));
        if (!autorizado) {
            return res.status(403).json({ ok: false, error: 'Acceso denegado' });
        }
        next();
    };
};

const soloAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'No autenticado' });
    const roles = req.user.roles || [req.user.rol];
    if (!roles.includes('ADMIN')) return res.status(403).json({ ok: false, error: 'Acceso restringido a administradores' });
    next();
};

module.exports = { verificarToken, verificarRol, soloAdmin };
