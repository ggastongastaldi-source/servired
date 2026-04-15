const jwt = require('jsonwebtoken');

// Verificar token JWT
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido' });
  }
};

// Verificar rol específico
const verificarRol = (rolRequerido) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }
    
    if (req.user.rol !== rolRequerido) {
      return res.status(403).json({ ok: false, error: 'Acceso denegado' });
    }
    
    next();
  };
};

// Verificar múltiples roles
const verificarRoles = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }
    
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ ok: false, error: 'Rol no autorizado' });
    }
    
    next();
  };
};

module.exports = { 
  verificarToken, 
  verificarRol, 
  verificarRoles 
};
