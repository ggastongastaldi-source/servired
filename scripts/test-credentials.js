// test-credentials.js — ÚNICA fuente de verdad de credenciales de prueba
// Nunca hardcodear credentials en otro archivo de test

module.exports = {
  cliente: {
    email:    'ggaston.gastaldi@gmail.com',
    password: '28630732',
    rol:      'CLIENTE',
  },
  worker: {
    email:    'debora.rouiller.1@gmail.com',
    password: 'debora2024',
    rol:      'TRABAJADOR',
  },
  admin: {
    email:    'ggastonnet@gmail.com',
    password: '28630732G@s',
    rol:      'ADMIN',
  },
};
