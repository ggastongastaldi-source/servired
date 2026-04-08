const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SERVIRED</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f0f2f5; }
                h1 { color: #1a73e8; }
                button { padding: 15px 30px; margin: 10px; font-size: 18px; border: none; border-radius: 8px; cursor: pointer; }
                button:first-of-type { background: #1a73e8; color: white; }
                button:last-of-type { background: #34a853; color: white; }
            </style>
        </head>
        <body>
            <h1>SERVIRED</h1>
            <h3>Tu red de servicios profesionales</h3>
            <button onclick="alert('Cliente - Pronto podrás solicitar servicios')">Soy Cliente</button>
            <button onclick="alert('Trabajador - Pronto podrás ofrecer servicios')">Soy Trabajador</button>
            <p>✅ Servidor activo en localhost:8080</p>
        </body>
        </html>
    `);
});

app.listen(8080, () => {
    console.log('✅ SERVIRED en http://localhost:8080');
});
