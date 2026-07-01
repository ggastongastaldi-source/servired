# Anchors para insertar tab SOC en admin.html

## Línea completa del último tab (nexus)
159:  <div class="tab" onclick="irTab('nexus',this)">NEXUS</div>

## Función irTab completa
function irTab(id,btn){
  document.querySelectorAll('.tc').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tc-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='pedidos')cargarPed();
  if(id==='workers')cargarWor();
  if(id==='nexus')cargarNexus();
  if(id==='cola')cargarCola();
  if(id==='intel')cargarIntel();
  setTimeout(()=>mapa?.invalidateSize(),50);
}

async function cargarPed(){
  try{
    const r=await fetch('/api/admin/pedidos',{headers:{Authorization:'Bearer '+TOKEN}});
    const resp=await r.json();
    const data=resp.data||resp;
    const el=document.getElementById('lista-ped');
    if(!data.length){el.innerHTML='<div style="color:#00E5FF;text-align:center;padding:20px;font-size:0.85rem">Sin pedidos</div>';return;}
    el.innerHTML=data.map(p=>`

## Dónde cierra el último tc (buscar el próximo div.tc o tab-content después de tc-live)

## Línea donde arranca el <script> principal (para insertar funciones JS antes del cierre)
293:<script>
715:</script>
792:</script>
807:</script>
808:<script>
924:</script>
925:<script>
1041:</script>
