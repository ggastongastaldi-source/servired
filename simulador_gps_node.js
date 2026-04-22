const { io } = require("socket.io-client");

const socket = io("https://servired.online");

const CENTER_LAT = -34.6037; // Obelisco
const CENTER_LNG = -58.3816;
const RANGE = 0.15; // Cobertura amplia de BA

socket.on("connect", () => {
    console.log("✅ Simulador (Node) conectado a la red");
    
    const workers = ["W-Alfa", "W-Beta", "W-Gama"];
    
    setInterval(() => {
        workers.forEach(id => {
            const lat = CENTER_LAT + (Math.random() * RANGE * 2 - RANGE);
            const lng = CENTER_LNG + (Math.random() * RANGE * 2 - RANGE);
            
            socket.emit("worker_gps_update", {
                worker_id: id,
                lat: lat,
                lng: lng,
                timestamp: Date.now()
            });
            console.log(`📡 Enviando ${id}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });
    }, 2000);
});

socket.on("connect_error", (err) => {
    console.log("❌ Error de conexión:", err.message);
});
