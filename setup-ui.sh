#!/bin/bash

# Crear public si no existe
mkdir -p public

# ─────────────────────────────────────────────
# 1. cliente.html
# ─────────────────────────────────────────────
cat > public/cliente.html << 'HTML1'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>SERVired | Cliente</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
            background: #0a0c12;
            color: #eef5ff;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        /* Header estilo dark neon */
        .header {
            background: rgba(10, 12, 18, 0.95);
            backdrop-filter: blur(12px);
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid rgba(0, 255, 255, 0.3);
            box-shadow: 0 0 12px rgba(0, 255, 255, 0.1);
            z-index: 10;
        }
        .logo {
            font-size: 1.6rem;
            font-weight: 800;
            background: linear-gradient(135deg, #0ff, #0a8);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            letter-spacing: -0.5px;
        }
        .status-badge {
            background: #1e2a3a;
            padding: 6px 14px;
            border-radius: 40px;
            font-size: 0.8rem;
            font-weight: 500;
            border-left: 3px solid #0ff;
            box-shadow: 0 0 6px rgba(0,255,255,0.3);
        }
        /* Mapa */
        #map {
            flex: 1;
            width: 100%;
            background: #11131c;
            z-index: 1;
        }
        /* Panel de pedido */
        .order-panel {
            background: rgba(18, 22, 32, 0.95);
            backdrop-filter: blur(16px);
            border-top: 1px solid rgba(0, 255, 255, 0.4);
            padding: 20px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        input, button {
            padding: 12px 18px;
            border-radius: 60px;
            border: none;
            font-size: 1rem;
            font-weight: 500;
        }
        input {
            background: #0f1119;
            border: 1px solid #2a2f3f;
            color: #fff;
            flex: 2;
            min-width: 180px;
        }
        input:focus {
            outline: none;
            border-color: #0ff;
            box-shadow: 0 0 8px #0ff;
        }
        button {
            background: linear-gradient(95deg, #0ff, #0a8);
            color: #0a0c12;
            font-weight: bold;
            cursor: pointer;
            transition: 0.2s;
            box-shadow: 0 0 8px rgba(0,255,255,0.4);
        }
        button:active { transform: scale(0.97); }
        button:disabled {
            opacity: 0.5;
            transform: none;
            cursor: not-allowed;
        }
        .info-message {
            background: #0e1824;
            margin: 8px 20px;
            padding: 10px 16px;
            border-radius: 24px;
            font-size: 0.85rem;
            text-align: center;
            border-left: 4px solid #0ff;
            color: #bbd9ff;
        }
        @media (max-width: 600px) {
            .order-panel { flex-direction: column; }
            button, input { width: 100%; }
        }
    </style>
</head>
<body>
<div class="header">
    <div class="logo">⚡ SERVired · Cliente</div>
    <div class="status-badge" id="connectionStatus">🔌 Conectando...</div>
</div>
<div id="map"></div>
<div class="order-panel">
    <input type="text" id="direccion" placeholder="📍 Tu dirección (ej: Av. Libertador 1234)" autocomplete="off">
    <button id="solicitarBtn">🚀 Solicitar servicio</button>
</div>
<div id="infoMsg" class="info-message">✨ Ingresa tu dirección y solicita un trabajador</div>

<script>
    const socket = io({
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
    });

    // Mapa
    let map = L.map('map').setView([-34.6037, -58.3816], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
        className: 'map-tiles'
    }).addTo(map);

    let userMarker = null;
    let workerMarker = null;
    let currentOrderId = null;
    let solicitarBtn = document.getElementById('solicitarBtn');
    let direccionInput = document.getElementById('direccion');
    let infoDiv = document.getElementById('infoMsg');

    function updateStatus(text, isError = false) {
        infoDiv.innerHTML = text;
        infoDiv.style.borderLeftColor = isError ? '#ff4d4d' : '#0ff';
        setTimeout(() => {
            if(!isError) setTimeout(() => { if(infoDiv.innerHTML === text) infoDiv.style.borderLeftColor = '#0ff'; }, 3000);
        }, 100);
    }

    // Geocoding simple Nominatim (sin clave)
    async function geocodeAddress(address) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const data = await res.json();
            if(data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        } catch(e) { console.warn(e); }
        return null;
    }

    // Mover marcador del cliente
    function setUserLocation(lat, lng, address) {
        if(userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'custom-div-icon', html: '📍', iconSize: [24,24], popupAnchor: [0,-12] }) }).addTo(map);
        userMarker.bindPopup(`<b>Tu ubicación</b><br>${address}`).openPopup();
        map.setView([lat, lng], 15);
    }

    // Marcador del trabajador
    function updateWorkerPosition(lat, lng) {
        if(workerMarker) map.removeLayer(workerMarker);
        workerMarker = L.marker([lat, lng], { icon: L.divIcon({ className: 'custom-div-icon', html: '🚚', iconSize: [28,28] }) }).addTo(map);
        workerMarker.bindPopup('🧑‍🔧 Trabajador en ruta').openPopup();
    }

    // Solicitar servicio
    solicitarBtn.onclick = async () => {
        const direccion = direccionInput.value.trim();
        if(!direccion) {
            updateStatus('❌ Escribí una dirección válida', true);
            return;
        }
        solicitarBtn.disabled = true;
        updateStatus('🔍 Geocodificando dirección...');
        const coords = await geocodeAddress(direccion);
        if(!coords) {
            updateStatus('⚠️ No se encontró la dirección. Intentá con un punto de referencia claro.', true);
            solicitarBtn.disabled = false;
            return;
        }
        setUserLocation(coords.lat, coords.lng, direccion);
        updateStatus('📡 Enviando pedido a trabajadores...');
        socket.emit('solicitar_servicio', {
            direccion: direccion,
            lat: coords.lat,
            lng: coords.lng,
            timestamp: Date.now()
        });
    };

    // Eventos Socket
    socket.on('connect', () => {
        document.getElementById('connectionStatus').innerHTML = '🟢 Conectado';
        updateStatus('✅ Conectado al servidor. Podés solicitar servicio.');
        solicitarBtn.disabled = false;
    });
    socket.on('disconnect', () => {
        document.getElementById('connectionStatus').innerHTML = '🔴 Desconectado';
        updateStatus('⚠️ Perdida conexión. Reconectando...', true);
        solicitarBtn.disabled = true;
    });

    socket.on('pedido_recibido', (data) => {
        currentOrderId = data.orderId;
        updateStatus(`📦 Pedido #${data.orderId.slice(-5)} recibido. Buscando trabajador...`);
    });

    socket.on('trabajador_asignado', (data) => {
        updateStatus(`✅ ¡Trabajador asignado! Está en camino hacia vos. 🚀`);
        if(data.workerLat && data.workerLng) updateWorkerPosition(data.workerLat, data.workerLng);
    });

    socket.on('worker_location_update', (data) => {
        if(data.lat && data.lng) updateWorkerPosition(data.lat, data.lng);
    });

    socket.on('servicio_completado', () => {
        updateStatus(`🎉 Servicio completado. ¡Gracias por usar SERVired!`);
        if(workerMarker) map.removeLayer(workerMarker);
        workerMarker = null;
        currentOrderId = null;
        solicitarBtn.disabled = false;
    });

    socket.on('error_msg', (msg) => {
        updateStatus(`❌ Error: ${msg}`, true);
        solicitarBtn.disabled = false;
    });
</script>
</body>
</html>
HTML1

# ─────────────────────────────────────────────
# 2. trabajador.html
# ─────────────────────────────────────────────
cat > public/trabajador.html << 'HTML2'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>SERVired | Trabajador</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui;
            background: #0a0c12;
            color: #eef5ff;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            background: rgba(10,12,18,0.95);
            backdrop-filter: blur(12px);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #0ff3;
        }
        .logo { font-size: 1.5rem; font-weight: bold; background: linear-gradient(135deg,#0ff,#0a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .status { background: #1e2a3a; padding: 4px 12px; border-radius: 30px; font-size: 0.75rem; border-left: 2px solid #0ff; }
        #map { flex: 1; width: 100%; background: #11131c; }
        .pedido-card {
            background: #121624;
            margin: 12px;
            padding: 16px;
            border-radius: 24px;
            border: 1px solid #2a2f42;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .acciones { display: flex; gap: 12px; margin-top: 12px; }
        .btn-aceptar { background: #0a8; color: #000; font-weight: bold; padding: 10px; border-radius: 40px; flex:1; border:none; cursor:pointer; }
        .btn-rechazar { background: #a33; color: white; flex:1; border-radius: 40px; border:none; cursor:pointer; }
        .btn-finalizar { background: #f0b90b; color: #000; margin-top: 8px; padding: 10px; border-radius: 40px; font-weight: bold; width:100%; }
        .info-text { font-size: 0.85rem; margin-top: 6px; color: #9aaec0; }
        button:active { transform: scale(0.97); }
        .hidden { display: none; }
    </style>
</head>
<body>
<div class="header">
    <div class="logo">🔧 SERVired · Trabajador</div>
    <div class="status" id="statusText">⚪ Sin pedido activo</div>
</div>
<div id="map"></div>
<div id="pedidoContainer" class="pedido-card hidden">
    <div><strong>📦 Nuevo pedido</strong></div>
    <div id="pedidoDireccion">Dirección: -</div>
    <div class="info-text" id="pedidoDistancia"></div>
    <div class="acciones">
        <button class="btn-aceptar" id="aceptarBtn">✅ Aceptar</button>
        <button class="btn-rechazar" id="rechazarBtn">❌ Rechazar</button>
    </div>
</div>
<div id="activoPanel" class="pedido-card hidden">
    <div><strong>🚀 Pedido en curso</strong></div>
    <div id="activoDireccion"></div>
    <button id="finalizarBtn" class="btn-finalizar">🏁 Finalizar servicio</button>
</div>

<script>
    const socket = io();
    let map = L.map('map').setView([-34.6037, -58.3816], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);
    let workerMarker = null;
    let currentOrderId = null;
    let clientLat = null, clientLng = null;
    let watchId = null;

    function setWorkerLocation(lat, lng) {
        if(workerMarker) map.removeLayer(workerMarker);
        workerMarker = L.marker([lat, lng], { icon: L.divIcon({ html: '🔧', iconSize: [28,28] }) }).addTo(map);
        map.setView([lat, lng], 15);
        socket.emit('worker_moved', { lat, lng });
    }

    function startGeoWatch() {
        if(!navigator.geolocation) return;
        watchId = navigator.geolocation.watchPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            setWorkerLocation(latitude, longitude);
        }, (err) => { console.warn(err); }, { enableHighAccuracy: true, maximumAge: 5000 });
    }

    socket.on('connect', () => { startGeoWatch(); });

    socket.on('nuevo_pedido', (data) => {
        if(currentOrderId) return;
        document.getElementById('pedidoDireccion').innerHTML = `📍 ${data.direccion}`;
        clientLat = data.lat;
        clientLng = data.lng;
        currentOrderId = data.orderId;
        document.getElementById('pedidoContainer').classList.remove('hidden');
        document.getElementById('activoPanel').classList.add('hidden');
        document.getElementById('statusText').innerHTML = '🆕 Nuevo pedido disponible';
    });

    document.getElementById('aceptarBtn').onclick = () => {
        if(!currentOrderId) return;
        socket.emit('aceptar_pedido', { orderId: currentOrderId });
        document.getElementById('pedidoContainer').classList.add('hidden');
        document.getElementById('activoPanel').classList.remove('hidden');
        document.getElementById('activoDireccion').innerHTML = `📍 ${document.getElementById('pedidoDireccion').innerHTML}`;
        document.getElementById('statusText').innerHTML = '🚚 En ruta hacia cliente';
    };
    document.getElementById('rechazarBtn').onclick = () => {
        if(!currentOrderId) return;
        socket.emit('rechazar_pedido', { orderId: currentOrderId });
        currentOrderId = null;
        document.getElementById('pedidoContainer').classList.add('hidden');
        document.getElementById('statusText').innerHTML = '⚪ Sin pedido activo';
    };
    document.getElementById('finalizarBtn').onclick = () => {
        if(!currentOrderId) return;
        socket.emit('finalizar_servicio', { orderId: currentOrderId });
        currentOrderId = null;
        document.getElementById('activoPanel').classList.add('hidden');
        document.getElementById('statusText').innerHTML = '✅ Servicio finalizado';
        setTimeout(() => { if(!currentOrderId) document.getElementById('statusText').innerHTML = '⚪ Sin pedido activo'; }, 3000);
    };
</script>
</body>
</html>
HTML2

# ─────────────────────────────────────────────
# 3. admin.html
# ─────────────────────────────────────────────
cat > public/admin.html << 'HTML3'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SERVired | Admin Live</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            background: #0b0e16;
            font-family: monospace, 'Inter', sans-serif;
            color: #d9eaff;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            background: #07090fcc;
            backdrop-filter: blur(8px);
            padding: 12px 20px;
            border-bottom: 1px solid cyan;
            display: flex;
            justify-content: space-between;
        }
        .main-dash {
            display: flex;
            flex: 1;
            overflow: hidden;
            gap: 8px;
            padding: 8px;
        }
        #map {
            flex: 3;
            border-radius: 20px;
            background: #0f121c;
            border: 1px solid #2a2f44;
        }
        .pedidos-list {
            flex: 1;
            background: #0e111bdd;
            backdrop-filter: blur(12px);
            border-radius: 20px;
            padding: 12px;
            overflow-y: auto;
            border: 1px solid cyan;
        }
        .pedido-item {
            background: #181e2c;
            margin-bottom: 10px;
            padding: 12px;
            border-radius: 16px;
            border-left: 4px solid #0ff;
            font-size: 0.8rem;
        }
        .badge { font-weight: bold; color: #0ff; }
        hr { border-color: #2a2f44; margin: 6px 0; }
        h3 { margin-bottom: 12px; font-size: 1.2rem; }
    </style>
</head>
<body>
<div class="header">
    <span>📡 SERVired Admin · Monitor en tiempo real</span>
    <span id="liveCounter">🟢 Pedidos activos: 0</span>
</div>
<div class="main-dash">
    <div id="map"></div>
    <div class="pedidos-list">
        <h3>📋 Pedidos vivos</h3>
        <div id="listaPedidos"></div>
    </div>
</div>
<script>
    const socket = io();
    let map = L.map('map').setView([-34.6037, -58.3816], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);
    let markers = { clients: {}, workers: {} };

    function actualizarLista(pedidos) {
        const container = document.getElementById('listaPedidos');
        if(!pedidos || Object.keys(pedidos).length === 0) {
            container.innerHTML = '<div style="opacity:0.6;">✨ Sin pedidos activos</div>';
            document.getElementById('liveCounter').innerHTML = '🟢 Pedidos activos: 0';
            return;
        }
        let html = '';
        let count = 0;
        for(let id in pedidos) {
            const p = pedidos[id];
            count++;
            html += `<div class="pedido-item">
                        <span class="badge">#${id.slice(-6)}</span><br>
                        📍 ${p.direccion || 'N/A'}<br>
                        🧑‍💼 Estado: ${p.estado || 'pendiente'}<br>
                        👷 Trabajador: ${p.workerId ? p.workerId.slice(-5) : 'No asignado'}
                     </div><hr>`;
        }
        container.innerHTML = html;
        document.getElementById('liveCounter').innerHTML = `🟢 Pedidos activos: ${count}`;
    }

    function actualizarMapa(pedidos) {
        // Limpiar marcadores previos
        for(let id in markers.clients) map.removeLayer(markers.clients[id]);
        for(let id in markers.workers) map.removeLayer(markers.workers[id]);
        markers = { clients: {}, workers: {} };

        for(let id in pedidos) {
            const p = pedidos[id];
            if(p.clienteLat && p.clienteLng) {
                let m = L.marker([p.clienteLat, p.clienteLng], { icon: L.divIcon({ html: '📍', iconSize: [24,24] }) }).addTo(map);
                m.bindPopup(`Cliente: ${p.direccion}<br>Estado: ${p.estado}`);
                markers.clients[id] = m;
            }
            if(p.workerLat && p.workerLng && p.estado !== 'completado') {
                let w = L.marker([p.workerLat, p.workerLng], { icon: L.divIcon({ html: '🔧', iconSize: [28,28] }) }).addTo(map);
                w.bindPopup(`Trabajador en ruta - Pedido #${id.slice(-5)}`);
                markers.workers[id] = w;
            }
        }
    }

    socket.on('admin_update', (data) => {
        actualizarLista(data.pedidos);
        actualizarMapa(data.pedidos);
    });
    socket.on('connect', () => console.log('Admin conectado'));
</script>
</body>
</html>
HTML3

echo "✅ Los 3 archivos se crearon correctamente en public/"
ls -la public/*.html
