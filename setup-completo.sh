#!/bin/bash
set -e

echo "🚀 CONFIGURANDO SERVIRED COMPLETO..."

# 1. Crear los 3 HTMLs
mkdir -p public

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
        body { font-family: 'Segoe UI', system-ui; background: #0a0c12; color: #eef5ff; height: 100vh; display: flex; flex-direction: column; }
        .header { background: rgba(10,12,18,0.95); backdrop-filter: blur(12px); padding: 14px 20px; display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,255,255,0.3); }
        .logo { font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg,#0ff,#0a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .status-badge { background: #1e2a3a; padding: 6px 14px; border-radius: 40px; font-size: 0.8rem; border-left: 3px solid #0ff; }
        #map { flex: 1; width: 100%; background: #11131c; }
        .order-panel { background: rgba(18,22,32,0.95); backdrop-filter: blur(16px); border-top: 1px solid rgba(0,255,255,0.4); padding: 20px; display: flex; gap: 12px; flex-wrap: wrap; }
        input, button { padding: 12px 18px; border-radius: 60px; border: none; font-size: 1rem; font-weight: 500; }
        input { background: #0f1119; border: 1px solid #2a2f3f; color: #fff; flex: 2; min-width: 180px; }
        input:focus { outline: none; border-color: #0ff; box-shadow: 0 0 8px #0ff; }
        button { background: linear-gradient(95deg,#0ff,#0a8); color: #0a0c12; font-weight: bold; cursor: pointer; }
        .info-message { background: #0e1824; margin: 8px 20px; padding: 10px 16px; border-radius: 24px; font-size: 0.85rem; border-left: 4px solid #0ff; }
    </style>
</head>
<body>
<div class="header"><div class="logo">⚡ SERVired · Cliente</div><div class="status-badge" id="connectionStatus">🔌 Conectando...</div></div>
<div id="map"></div>
<div class="order-panel"><input type="text" id="direccion" placeholder="📍 Tu dirección" autocomplete="off"><button id="solicitarBtn">🚀 Solicitar servicio</button></div>
<div id="infoMsg" class="info-message">✨ Ingresa tu dirección y solicita un trabajador</div>
<script>
    const socket = io(); let map = L.map('map').setView([-34.6037,-58.3816],13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);
    let userMarker=null, workerMarker=null, currentOrderId=null;
    async function geocodeAddress(address){ try{ const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`); const data=await res.json(); if(data&&data.length) return {lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon)}; }catch(e){} return null; }
    function setUserLocation(lat,lng,address){ if(userMarker) map.removeLayer(userMarker); userMarker=L.marker([lat,lng]).addTo(map); userMarker.bindPopup(`<b>Tu ubicación</b><br>${address}`).openPopup(); map.setView([lat,lng],15); }
    function updateWorkerPosition(lat,lng){ if(workerMarker) map.removeLayer(workerMarker); workerMarker=L.marker([lat,lng],{icon:L.divIcon({html:'🚚',iconSize:[28,28]})}).addTo(map); workerMarker.bindPopup('🧑‍🔧 Trabajador en ruta'); }
    document.getElementById('solicitarBtn').onclick=async()=>{ const dir=document.getElementById('direccion').value.trim(); if(!dir) return; const coords=await geocodeAddress(dir); if(!coords) return; setUserLocation(coords.lat,coords.lng,dir); socket.emit('solicitar_servicio',{direccion:dir,lat:coords.lat,lng:coords.lng}); };
    socket.on('connect',()=>{document.getElementById('connectionStatus').innerHTML='🟢 Conectado';});
    socket.on('trabajador_asignado',(data)=>{if(data.workerLat&&data.workerLng) updateWorkerPosition(data.workerLat,data.workerLng);});
    socket.on('worker_location_update',(data)=>{if(data.lat&&data.lng) updateWorkerPosition(data.lat,data.lng);});
</script>
</body>
</html>
HTML1

cat > public/trabajador.html << 'HTML2'
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SERVired | Trabajador</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;} body{background:#0a0c12;color:#eef5ff;height:100vh;display:flex;flex-direction:column;} .header{background:rgba(10,12,18,0.95);padding:12px20px;display:flex;justify-content:space-between;border-bottom:1px solid #0ff3;} #map{flex:1;} .pedido-card{background:#121624;margin:12px;padding:16px;border-radius:24px;} .btn-aceptar{background:#0a8;color:#000;padding:10px;border-radius:40px;margin:5px;} .btn-rechazar{background:#a33;color:#fff;padding:10px;border-radius:40px;} .btn-finalizar{background:#f0b90b;color:#000;padding:10px;border-radius:40px;width:100%;} .hidden{display:none;}</style>
</head>
<body>
<div class="header"><div>🔧 SERVired · Trabajador</div><div id="statusText">⚪ Sin pedido</div></div>
<div id="map"></div>
<div id="pedidoContainer" class="pedido-card hidden"><div><strong>📦 Nuevo pedido</strong></div><div id="pedidoDireccion"></div><button class="btn-aceptar" id="aceptarBtn">✅ Aceptar</button><button class="btn-rechazar" id="rechazarBtn">❌ Rechazar</button></div>
<div id="activoPanel" class="pedido-card hidden"><div><strong>🚀 En curso</strong></div><div id="activoDireccion"></div><button id="finalizarBtn" class="btn-finalizar">🏁 Finalizar</button></div>
<script>
    const socket=io(); let map=L.map('map').setView([-34.6037,-58.3816],13); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);
    let workerMarker=null, currentOrderId=null, clientLat=null, clientLng=null;
    function setWorkerLocation(lat,lng){ if(workerMarker) map.removeLayer(workerMarker); workerMarker=L.marker([lat,lng],{icon:L.divIcon({html:'🔧',iconSize:[28,28]})}).addTo(map); map.setView([lat,lng],15); socket.emit('worker_moved',{lat,lng}); }
    if(navigator.geolocation) navigator.geolocation.watchPosition((pos)=>{setWorkerLocation(pos.coords.latitude,pos.coords.longitude);},null,{enableHighAccuracy:true});
    socket.on('nuevo_pedido',(data)=>{ if(currentOrderId) return; document.getElementById('pedidoDireccion').innerHTML=`📍 ${data.direccion}`; clientLat=data.lat; clientLng=data.lng; currentOrderId=data.orderId; document.getElementById('pedidoContainer').classList.remove('hidden'); });
    document.getElementById('aceptarBtn').onclick=()=>{ socket.emit('aceptar_pedido',{orderId:currentOrderId}); document.getElementById('pedidoContainer').classList.add('hidden'); document.getElementById('activoPanel').classList.remove('hidden'); document.getElementById('activoDireccion').innerHTML=document.getElementById('pedidoDireccion').innerHTML; };
    document.getElementById('rechazarBtn').onclick=()=>{ socket.emit('rechazar_pedido',{orderId:currentOrderId}); currentOrderId=null; document.getElementById('pedidoContainer').classList.add('hidden'); };
    document.getElementById('finalizarBtn').onclick=()=>{ socket.emit('finalizar_servicio',{orderId:currentOrderId}); currentOrderId=null; document.getElementById('activoPanel').classList.add('hidden'); };
</script>
</body>
</html>
HTML2

cat > public/admin.html << 'HTML3'
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>SERVired | Admin</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;} body{background:#0b0e16;color:#d9eaff;height:100vh;display:flex;flex-direction:column;} .header{background:#07090fcc;padding:12px20px;border-bottom:1px solid cyan;} .main-dash{display:flex;flex:1;gap:8px;padding:8px;} #map{flex:3;border-radius:20px;} .pedidos-list{flex:1;background:#0e111bdd;border-radius:20px;padding:12px;overflow-y:auto;} .pedido-item{background:#181e2c;margin-bottom:10px;padding:12px;border-radius:16px;border-left:4px solid #0ff;}</style>
</head>
<body>
<div class="header"><span>📡 SERVired Admin</span><span id="liveCounter">🟢 Activos: 0</span></div>
<div class="main-dash"><div id="map"></div><div class="pedidos-list"><h3>📋 Pedidos vivos</h3><div id="listaPedidos"></div></div></div>
<script>
    const socket=io(); let map=L.map('map').setView([-34.6037,-58.3816],12); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);
    let markers={clients:{},workers:{}};
    function actualizarLista(pedidos){ const container=document.getElementById('listaPedidos'); if(!pedidos||Object.keys(pedidos).length===0){ container.innerHTML='<div>✨ Sin pedidos activos</div>'; document.getElementById('liveCounter').innerHTML='🟢 Activos: 0'; return; } let html=''; let count=0; for(let id in pedidos){ count++; html+=`<div class="pedido-item"><b>#${id.slice(-6)}</b><br>📍 ${pedidos[id].direccion}<br>Estado: ${pedidos[id].estado}</div><hr>`; } container.innerHTML=html; document.getElementById('liveCounter').innerHTML=`🟢 Activos: ${count}`; }
    function actualizarMapa(pedidos){ for(let id in markers.clients) map.removeLayer(markers.clients[id]); for(let id in markers.workers) map.removeLayer(markers.workers[id]); markers={clients:{},workers:{}}; for(let id in pedidos){ const p=pedidos[id]; if(p.clienteLat&&p.clienteLng) markers.clients[id]=L.marker([p.clienteLat,p.clienteLng],{icon:L.divIcon({html:'📍',iconSize:[24,24]})}).addTo(map); if(p.workerLat&&p.workerLng&&p.estado!=='completado') markers.workers[id]=L.marker([p.workerLat,p.workerLng],{icon:L.divIcon({html:'🔧',iconSize:[28,28]})}).addTo(map); } }
    socket.on('admin_update',(data)=>{ actualizarLista(data.pedidos); actualizarMapa(data.pedidos); });
</script>
</body>
</html>
HTML3

echo "✅ HTMLs creados"

# 2. Configurar git y pushear automáticamente
git config user.email "gaston@servired.com" 2>/dev/null || true
git config user.name "Gastaldog" 2>/dev/null || true

git add -A
git commit -m "feat: SERVired UI cliente/trabajador/admin con Leaflet y Socket.io" || echo "Commit ya existe"

# 3. Crear repo y pushear
if ! git remote get-url origin 2>/dev/null | grep -q servired; then
    echo "🔧 Creando repositorio en GitHub..."
    gh auth status 2>/dev/null || gh auth login
    gh repo create servired --public --description "SERVired - Plataforma de servicios" --confirm 2>/dev/null || echo "Repo ya existe"
    git remote remove origin 2>/dev/null
    git remote add origin https://github.com/Gastaldog/servired.git
fi

git branch -M main
git push -u origin main --force

echo "🎉 TODO LISTO!"
echo "📱 Cliente: http://localhost:3000/cliente.html"
echo "🔧 Trabajador: http://localhost:3000/trabajador.html"
echo "📊 Admin: http://localhost:3000/admin.html"
