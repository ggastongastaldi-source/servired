module.exports = (data) => {
  const base = typeof data === 'string' 
    ? { id: data.trim(), nombre: data.trim() } 
    : data;

  return {
    id:     base.id || base._id || 'unknown',
    nombre: base.nombre || base.id || 'Sin Nombre',
    activo: base.activo !== undefined ? base.activo : true,
    icono:  base.icono || 'default-tool'
  };
};
