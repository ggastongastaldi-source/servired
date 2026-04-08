#!/bin/bash
set -e

echo "🚀 CREANDO SERVIRED COMPLETO..."

# Crear HTMLs
mkdir -p public

cat > public/cliente.html << 'HTML1'
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SERVired | Cliente</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',system-ui;background:#0a0c12;color:#eef5ff;height:100vh;display:flex;flex-direction:column;}.header{background:rgba(10,12,18,0.95);padding:14px20px;display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,255,255,0.3);}.logo{font-size:1.6rem;font-weight:800;background:linear-gradient(135deg,#0ff,#0a8);-webkit-background-clip:text;background-clip:text;color:transparent;}#map{flex:1;}.order-panel{background:rgba(18,22,32,0.95);padding:20px;display:flex;gap:12px;}input,button{padding:12px18px;border-radius:60px;border:none;}input{background:#0f1119;border:1px solid #2a2f3f;color:#fff;flex:2;}button{background:linear-gradient(95deg,#0ff,#0a8);color:#0a0c12;font-weight:bold;cursor:pointer;}</style>
</head>
<body>
<div class="header"><div class="logo">⚡ SERVired · Cliente</div><div id="status">🔌 Conectando...</div></div>
<div id="map"></div>
<div class="order-panel"><input type="text" id="direccion" placeholder="📍 Tu dirección"><button id="solicitarBtn">🚀 Solicitar</button></div>
<script>
const socket=io();let map=L.map('map').setView([-34.6037,-58.3816],13);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);let workerMarker=null;
async function geocode(a){let r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(a)}&limit=1`);let d=await r.json();if(d&&d.length)return{lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};return null;}
document.getElementById('solicitarBtn').onclick=async()=>{let dir=document.getElementById('direccion').value;if(!dir)return;let c=await geocode(dir);if(!c)return;L.marker([c.lat,c.lng]).addTo(map).bindPopup(dir).openPopup();socket.emit('solicitar_servicio',{direccion:dir,lat:c.lat,lng:c.lng});};
socket.on('connect',()=>document.getElementById('status').innerHTML='🟢 Conectado');
socket.on('trabajador_asignado',(d)=>{if(d.workerLat&&d.workerLng){if(workerMarker)map.removeLayer(workerMarker);workerMarker=L.marker([d.workerLat,d.workerLng],{icon:L.divIcon({html:'🚚',iconSize:[28,28]})}).addTo(map);}});
</script>
</body>
</html>
HTML1

cat > public/trabajador.html << 'HTML2'
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>SERVired | Trabajador</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0c12;color:#eef5ff;height:100vh;display:flex;flex-direction:column;}#map{flex:1;}.card{background:#121624;margin:12px;padding:16px;border-radius:24px;}button{padding:10px;margin:5px;border-radius:40px;border:none;cursor:pointer;}.aceptar{background:#0a8;color:#000;}.rechazar{background:#a33;color:#fff;}.finalizar{background:#f0b90b;color:#000;width:100%;}.hidden{display:none;}</style>
</head>
<body>
<div style="padding:12px;background:#0a0c12;"><b>🔧 SERVired Trabajador</b> <span id="status">⚪ Libre</span></div>
<div id="map"></div>
<div id="pedidoCard" class="card hidden"><div><strong>📦 Nuevo pedido</strong></div><div id="dir"></div><button id="aceptar" class="aceptar">✅ Aceptar</button><button id="rechazar" class="rechazar">❌ Rechazar</button></div>
<div id="activoCard" class="card hidden"><div><strong>🚀 En curso</strong></div><div id="actDir"></div><button id="finalizar" class="finalizar">🏁 Finalizar</button></div>
<script>
const socket=io();let map=L.map('map').setView([-34.6037,-58.3816],13);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);let currentOrder=null,marker=null;
if(navigator.geolocation)navigator.geolocation.watchPosition((p)=>{let{latitude:lat,longitude:lng}=p.coords;if(marker)map.removeLayer(marker);marker=L.marker([lat,lng],{icon:L.divIcon({html:'🔧',iconSize:[28,28]})}).addTo(map);map.setView([lat,lng],15);socket.emit('worker_moved',{lat,lng});});
socket.on('nuevo_pedido',(d)=>{if(currentOrder)return;document.getElementById('dir').innerHTML=`📍 ${d.direccion}`;currentOrder=d.orderId;document.getElementById('pedidoCard').classList.remove('hidden');});
document.getElementById('aceptar').onclick=()=>{socket.emit('aceptar_pedido',{orderId:currentOrder});document.getElementById('pedidoCard').classList.add('hidden');document.getElementById('activoCard').classList.remove('hidden');document.getElementById('actDir').innerHTML=document.getElementById('dir').innerHTML;document.getElementById('status').innerHTML='🚚 En ruta';};
document.getElementById('rechazar').onclick=()=>{socket.emit('rechazar_pedido',{orderId:currentOrder});currentOrder=null;document.getElementById('pedidoCard').classList.add('hidden');document.getElementById('status').innerHTML='⚪ Libre';};
document.getElementById('finalizar').onclick=()=>{socket.emit('finalizar_servicio',{orderId:currentOrder});currentOrder=null;document.getElementById('activoCard').classList.add('hidden');document.getElementById('status').innerHTML='✅ Completado';setTimeout(()=>document.getElementById('status').innerHTML='⚪ Libre',3000);};
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
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0b0e16;color:#d9eaff;height:100vh;display:flex;flex-direction:column;}.header{background:#07090fcc;padding:12px20px;border-bottom:1px solid cyan;display:flex;justify-content:space-between;}.main{display:flex;flex:1;gap:8px;padding:8px;}#map{flex:3;border-radius:20px;}.lista{flex:1;background:#0e111bdd;border-radius:20px;padding:12px;overflow-y:auto;}.item{background:#181e2c;margin-bottom:10px;padding:12px;border-radius:16px;border-left:4px solid #0ff;}</style>
</head>
<body>
<div class="header"><span>📡 SERVired Admin</span><span id="counter">🟢 Activos: 0</span></div>
<div class="main"><div id="map"></div><div class="lista"><h3>📋 Pedidos</h3><div id="pedidosLista"></div></div></div>
<script>
const socket=io();let map=L.map('map').setView([-34.6037,-58.3816],12);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OSM'}).addTo(map);let markers={c:{},w:{}};
function update(data){let pedidos=data.pedidos,container=document.getElementById('pedidosLista'),count=0,html='';for(let id in pedidos){count++;html+=`<div class="item"><b>#${id.slice(-6)}</b><br>📍 ${pedidos[id].direccion}<br>Estado: ${pedidos[id].estado}</div><hr>`;}container.innerHTML=html||'<div>✨ Sin pedidos</div>';document.getElementById('counter').innerHTML=`🟢 Activos: ${count}`;for(let i in markers.c)map.removeLayer(markers.c[i]);for(let i in markers.w)map.removeLayer(markers.w[i]);markers={c:{},w:{}};for(let id in pedidos){let p=pedidos[id];if(p.clienteLat&&p.clienteLng)markers.c[id]=L.marker([p.clienteLat,p.clienteLng],{icon:L.divIcon({html:'📍',iconSize:[24,24]})}).addTo(map);if(p.workerLat&&p.workerLng&&p.estado!=='completado')markers.w[id]=L.marker([p.workerLat,p.workerLng],{icon:L.divIcon({html:'🔧',iconSize:[28,28]})}).addTo(map);}}
socket.on('admin_update',update);
</script>
</body>
</html>
HTML3

echo "✅ HTMLs creados"

# Inicializar git y crear repo en GitHub
git init
git add .
git commit -m "Initial commit: SERVired UI completo"

# Crear repo en GitHub via API
echo "🔧 Creando repositorio en GitHub..."
curl -s -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
  https://api.github.com/user/repos \
  -d '{"name":"servired","private":false,"description":"SERVired - Plataforma de servicios"}' 2>/dev/null || echo "⚠️ No se pudo crear automáticamente"

# Configurar remote y pushear
git remote add origin https://github.com/Gastaldog/servired.git
git branch -M main
git push -u origin main --force

echo "🎉 COMPLETADO!"
