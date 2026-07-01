# Estructura de tabs y auth en admin.html

## Definición de tabs (HTML)
154:  <div class="tab" onclick="irTab('workers',this)">WORKERS</div>
155:  <div class="tab" onclick="irTab('cola',this)">COLA</div>
156:  <div class="tab" onclick="irTab('intel',this)">INTEL</div>
157:  <div class="tab" onclick="irTab('finanzas',this)">FINANZAS</div>
158:  <div class="tab" onclick="irTab('live',this)">LIVE</div>
159:  <div class="tab" onclick="irTab('nexus',this)">NEXUS</div>
163:<div class="tc active" id="tc-pedidos">
169:<div class="tc" id="tc-workers">
185:<div class="tc" id="tc-cola">
194:<div class="tc" id="tc-intel">
222:<div class="tc" id="tc-finanzas">
232:<div id="tab-nexus" class="tab-content" style="display:none;padding:12px;">
286:<div class="tc" id="tc-live">

## Función JS de cambio de tab
340:function irTab(id,btn){
916:// Hook en showTab para cargar leads
917:const _origShowTab = window.showTab;
918:window.showTab = function(tab){
1033:// Hook en showTab para cargar leads
1034:const _origShowTab = window.showTab;
1035:window.showTab = function(tab){

## Cómo se guarda/lee el token (localStorage key)
295:if(urlT){localStorage.setItem('token',urlT);history.replaceState(null,'','/admin.html');}
296:const TOKEN=localStorage.getItem('token');

## Patrón de fetch existente (para replicar headers/auth)
305:    const r=await fetch('/api/admin/pedidos',{headers:{Authorization:'Bearer '+TOKEN}});
316:    const r2=await fetch('/api/admin/stats',{headers:{Authorization:'Bearer '+TOKEN}});
355:    const r=await fetch('/api/admin/pedidos',{headers:{Authorization:'Bearer '+TOKEN}});
378:    const r=await fetch('/api/admin/trabajadores',{headers:{Authorization:'Bearer '+TOKEN}});
445:    const rv=await fetch(`/api/admin/trabajadores/${id}/verificar`,{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
468:    const rv=await fetch(`/api/admin/trabajadores/${id}`,{method:'DELETE',headers:{Authorization:'Bearer '+TOKEN}});
477:    const rv=await fetch(`/api/admin/trabajadores/${id}/desactivar`,{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
485:    const rv=await fetch(`/api/admin/pedidos/${id}/cancelar`,{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
493:    const rv=await fetch(`/api/admin/pedidos/${id}/reasignar`,{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
503:    const r=await fetch('/api/admin/pedidos',{headers:{Authorization:'Bearer '+TOKEN}});

## Últimas 40 líneas del archivo (cierre de tags, dónde insertar)
      document.getElementById('lead-telefono').value='';
      document.getElementById('lead-zona').value='';
      cargarLeads();
    } else toast('❌ ' + (d.error||'Error'));
  }catch(e){ toast('❌ Error de conexión'); }
}

async function moverEstado(id, estado){
  try{
    const r = await fetch('/api/leads/'+id+'/estado', {method:'POST', headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'}, body: JSON.stringify({estado, actor:'admin'})});
    const d = await r.json();
    if(d.ok){ toast('✅ Lead -> '+estado); cargarLeads(); }
    else toast('❌ '+(d.error||'Error'));
  }catch(e){ toast('❌ Error'); }
}

async function verMensaje(id){
  try{
    const r = await fetch('/api/leads/'+id+'/mensaje', {headers:{Authorization:'Bearer '+TOKEN}});
    const d = await r.json();
    if(d.ok){
      const msg = d.mensajes.whatsapp;
      // Mostrar en modal o copiar
      if(navigator.clipboard){ navigator.clipboard.writeText(msg); toast('📋 Mensaje copiado al portapapeles'); }
      else{ alert(msg); }
    }
  }catch(e){ toast('❌ Error'); }
}

// Hook en showTab para cargar leads
const _origShowTab = window.showTab;
window.showTab = function(tab){
  if(_origShowTab) _origShowTab(tab);
  document.getElementById('panel-leads').style.display = tab==='leads' ? 'block' : 'none';
  if(tab==='leads'){ cargarLeads(); cargarLeadsStats(); }
};

</script>
</body>
</html>
