// --- SERVIRED FRONTEND ENGINE V8.1 (CORE CONGELADO) ---
const workers = {};
const STATE_COLORS = { 
    disponible: '#00E5FF', 
    reservado: '#FFD600', 
    ocupado: '#FF3D00', 
    offline: '#9E9E9E' 
};

const getProIcon = (rubro, estado) => {
    const icons = { plomeria: 'fa-faucet', electricidad: 'fa-bolt', gas: 'fa-fire' };
    const color = STATE_COLORS[estado] || '#00E5FF';
    const icon = icons[rubro] || 'fa-tools';
    
    return L.divIcon({
        html: `<div style="background:${color}; width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
                <i class="fa-solid ${icon}" style="transform:rotate(45deg); color:white; font-size:12px;"></i>
               </div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 32]
    });
};

const smoothMove = (w, next) => {
    if (w.anim) clearInterval(w.anim);
    const start = w.marker.getLatLng();
    let i = 0;
    w.anim = setInterval(() => {
        i++;
        w.marker.setLatLng([
            start.lat + (next[0] - start.lat) * (i / 10),
            start.lng + (next[1] - start.lng) * (i / 10)
        ]);
        if (i >= 10) { clearInterval(w.anim); w.anim = null; }
    }, 50);
};

// HANDLER UNIFICADO DE ACTUALIZACIONES
socket.on('worker_update', data => {
    socket.emit('confirmar_recepcion', { id: data.id });
    const { id, lat, lng, estado, rubro } = data;
    if (!id || typeof mapa === 'undefined' || !mapa) return;

    if (estado === 'offline') {
        if (workers[id]) { workers[id].marker.remove(); delete workers[id]; }
        return;
    }

    if (!workers[id]) {
        workers[id] = { 
            marker: L.marker([lat, lng], { icon: getProIcon(rubro, estado) }).addTo(mapa), 
            estado, 
            anim: null 
        };
    } else {
        if (lat && lng) smoothMove(workers[id], [lat, lng]);
        if (estado !== workers[id].estado) {
            workers[id].estado = estado;
            workers[id].marker.setIcon(getProIcon(rubro, estado));
        }
    }
});

console.log("🛰️ Fleet Engine V8.1 Online");
