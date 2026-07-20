const TER = (() => {

  const STATE_COLOR = {
    SHORTAGE: { color: '#EF4444', emoji: '🔴', label: 'Shortage' },
    BALANCED: { color: '#FFB300', emoji: '🟡', label: 'Balanced' },
    SURPLUS:  { color: '#00E5FF', emoji: '🔵', label: 'Surplus'  },
    UNKNOWN:  { color: '#64748B', emoji: '⚪', label: 'Sin datos' }
  };

  function pressureBar(val) {
    const pct = Math.round((val || 0) * 100);
    const color = val > 0.7 ? '#EF4444' : val > 0.4 ? '#FFB300' : '#00E5FF';
    return `<div style="background:var(--surface3);border-radius:4px;height:5px;margin-top:6px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s;"></div>
    </div><div style="font-size:0.6rem;color:var(--muted);margin-top:2px;font-family:var(--font-mono);">${pct}% presión</div>`;
  }

  async function loadHeatmap() {
    try {
      const r = await fetch('/api/zones/heatmap');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const zones = await r.json();
      if (!zones || !zones.length) {
        document.getElementById('ter-heatmap').innerHTML =
          '<div style="color:var(--muted);font-size:0.82rem;padding:16px;text-align:center;grid-column:1/-1;">Sin zonas registradas aún.</div>';
        return;
      }

      // KPIs
      document.getElementById('ter-zonas').textContent = zones.length;
      const shortage = zones.filter(z => z.zoneState === 'SHORTAGE').length;
      const surplus  = zones.filter(z => z.zoneState === 'SURPLUS').length;
      const maxP     = Math.max(...zones.map(z => z.marketPressure || 0));
      document.getElementById('ter-shortage').textContent = shortage;
      document.getElementById('ter-surplus').textContent  = surplus;
      document.getElementById('ter-presion-max').textContent = (maxP * 100).toFixed(0) + '%';
      document.getElementById('ter-subtitle').textContent =
        zones.length + ' zonas monitoreadas · AMBA en tiempo real';

      // GIA insight territorial
      const topZone = zones[0];
      if (topZone) {
        const st = STATE_COLOR[topZone.zoneState] || STATE_COLOR.UNKNOWN;
        document.getElementById('ter-gia-txt').textContent =
          `GIA detecta: ${topZone.zoneId} lidera con ${((topZone.marketPressure||0)*100).toFixed(0)}% de presión de mercado. ${shortage} zona(s) en shortage requieren cobertura inmediata.`;
      }

      // Heatmap grid
      const select = document.getElementById('ter-zona-select');
      select.innerHTML = '<option value="">Seleccioná una zona...</option>';

      document.getElementById('ter-heatmap').innerHTML = zones.map(z => {
        const st = STATE_COLOR[z.zoneState] || STATE_COLOR.UNKNOWN;
        return `<div class="card interactive" onclick="TER.selectZona('${z.zoneId}')"
          style="padding:12px;border-color:${st.color}22;transition:all 0.2s;"
          onmouseenter="this.style.borderColor='${st.color}88'"
          onmouseleave="this.style.borderColor='${st.color}22'">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text);text-transform:capitalize;">
              ${z.zoneId.replace(/_/g,' ')}
            </div>
            <span style="font-size:0.7rem;">${st.emoji}</span>
          </div>
          <div style="font-size:0.65rem;color:${st.color};font-weight:700;font-family:var(--font-mono);">${st.label}</div>
          ${pressureBar(z.marketPressure)}
        </div>`;
      }).join('');

      // Populate select
      zones.forEach(z => {
        const opt = document.createElement('option');
        opt.value = z.zoneId;
        opt.textContent = z.zoneId.replace(/_/g,' ');
        select.appendChild(opt);
      });

    } catch(e) {
      document.getElementById('ter-heatmap').innerHTML =
        '<div style="color:var(--danger);font-size:0.82rem;padding:16px;text-align:center;grid-column:1/-1;">Error cargando zonas: ' + e.message + '</div>';
    }
  }

  async function loadRanking() {
    try {
      const r = await fetch('/api/zones/ranking');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const zones = await r.json();
      const el = document.getElementById('ter-ranking');
      if (!zones || !zones.length) {
        el.innerHTML = '<div class="alert alert-info"><span class="alert-icon">✅</span>No hay zonas en shortage crítico.</div>';
        return;
      }
      el.innerHTML = zones.map((z, i) => {
        const pct = ((z.marketPressure||0)*100).toFixed(0);
        const mult = z.pricingMultiplier ? (z.pricingMultiplier).toFixed(2) + 'x' : '—';
        return `<div class="card" style="margin-bottom:8px;padding:12px 16px;border-color:rgba(239,68,68,0.2);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:1.1rem;font-weight:700;color:var(--danger);font-family:var(--font-mono);width:24px;">${i+1}</div>
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.92rem;text-transform:capitalize;">${z.zoneId.replace(/_/g,' ')}</div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">
                Presión: <span style="color:var(--danger);font-family:var(--font-mono);">${pct}%</span>
                · Multiplicador: <span style="color:var(--warning);font-family:var(--font-mono);">${mult}</span>
              </div>
              ${pressureBar(z.marketPressure)}
            </div>
            <span class="badge badge-danger">SHORTAGE</span>
          </div>
        </div>`;
      }).join('');
    } catch(e) {
      document.getElementById('ter-ranking').innerHTML =
        '<div class="alert alert-warn"><span class="alert-icon">⚠️</span>No se pudo cargar el ranking.</div>';
    }
  }

  async function loadGraph() {
    const zoneId = document.getElementById('ter-zona-select').value;
    if (!zoneId) return;
    const panel = document.getElementById('ter-graph-panel');
    panel.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;text-align:center;padding:var(--sp-md);">Cargando grafo económico...</div>';
    try {
      const r = await fetch('/api/graph/zone/' + zoneId + '?strength=0.05');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const nodes = d.nodes || [];
      const edges = d.edges || [];
      if (!nodes.length) {
        panel.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;text-align:center;padding:var(--sp-md);">Sin nodos en esta zona aún.</div>';
        return;
      }
      // Agrupar por tipo
      const byType = {};
      nodes.forEach(n => {
        const t = n.type || n.nodeType || 'ACTOR';
        if (!byType[t]) byType[t] = [];
        byType[t].push(n);
      });
      const typeEmoji = { PROFESSIONAL:'👷', COMMERCE:'🏪', CLIENT:'🛒', MANUFACTURER:'🏭', SERVICE:'🔧' };
      panel.innerHTML = `
        <div style="margin-bottom:var(--sp-sm);">
          <div style="font-size:0.72rem;color:var(--muted);font-family:var(--font-mono);margin-bottom:8px;">
            ${nodes.length} nodos · ${edges.length} conexiones · zona ${zoneId.replace(/_/g,' ')}
          </div>
          ${Object.entries(byType).map(([type, ns]) => `
            <div style="margin-bottom:8px;">
              <div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
                ${typeEmoji[type]||'●'} ${type} (${ns.length})
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${ns.slice(0,8).map(n => `<span class="badge badge-muted">${n.id||n.entityId||'actor'}</span>`).join('')}
                ${ns.length > 8 ? `<span class="badge badge-muted">+${ns.length-8} más</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch(e) {
      panel.innerHTML = '<div class="alert alert-warn"><span class="alert-icon">⚠️</span>Error cargando grafo: ' + e.message + '</div>';
    }
  }

  function selectZona(zoneId) {
    document.getElementById('ter-zona-select').value = zoneId;
    loadGraph();
    document.getElementById('ter-zona-select').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function init() {
    await Promise.all([loadHeatmap(), loadRanking()]);
  }

  function refresh() { init(); }

  return { init, refresh, loadGraph, selectZona };
})();
