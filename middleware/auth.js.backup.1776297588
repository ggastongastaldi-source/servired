const jwt = require('jsonwebtoken');
const verificarToken = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch(e) {
    res.status(401).json({ error: 'Token invalido' });
  }
};
module.exports = { verificarToken };
