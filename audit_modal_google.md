# AUDITORÍA — Modal viejo + Login Google

## Bloque HTML del modal 'Hola, {nombre}' — contexto completo
410:try{var u=JSON.parse(localStorage.getItem("usuario")||"{}");var n=u.nombre?u.nombre.split(" ")[0]:null;document.getElementById("sp-saludo").textContent=n?"Hola, "+n:"Bienvenido/a";document.getElementById("sp-sub").innerHTML=n?"En que podemos ayudarte hoy?":"Conectando clientes, comercios<br>y trabajadores.";}catch(e){document.getElementById("sp-saludo").textContent="Bienvenido/a";document.getElementById("sp-sub").textContent="Conectando clientes, comercios y trabajadores.";}
751:  <div class="welcome-card-text"><h2>Hola, <span id="welcome-nombre">vos</span> </h2><p>Que queres hacer hoy?</p></div>
807:      <div class="action-card-title" style="color:#FF6D00;">Ofrecer mis servicios</div>
813:    <div><div class="action-card-title" style="color:#39ff14;">Registrar mi comercio</div><div class="action-card-desc">Hace crecer tu negocio y llega a mas clientes</div></div>
1731:      <h2 style="color:#00E5FF;font-family:Rajdhani,sans-serif;font-size:1.4rem;margin-bottom:6px;">Hola, ${nombre}</h2>
1732:      <p style="color:#64748b;font-size:0.85rem;margin-bottom:28px;">Bienvenido a ServiRed. ¿Qué querés hacer?</p>
1735:          🔍 Buscar un trabajador o servicio
1738:          🔧 Ofrecer mis servicios
1741:          🏪 Registrar mi comercio

## ¿Cuándo se introdujo este modal? (git blame de esas líneas)

## Botón/flujo de Google Sign-In en index.html
112:<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
309:<script src="https://accounts.google.com/gsi/client" async defer></script>
788:  <div id="home-google-btn" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
872:    <div style="margin-bottom:12px;"><div id="google-signin-btn" style="display:flex;justify-content:center;"></div><div style="text-align:center;color:#64748b;font-size:0.72rem;margin:8px 0;">— o ingresá con email —</div></div><div class="field"><label>Email o Teléfono</label><input type="text" id="gl-email" placeholder="tu@email.com o 1112345678"></div>
1682:function initGoogleSignIn() {
1683:  if (!window.google || !window.google.accounts) return;
1684:  const clientId = document.querySelector("meta[name=google-client-id]")?.content || "";
1685:  google.accounts.id.initialize({
1689:        const r = await fetch("/api/auth/google", {
1692:          body: JSON.stringify({ id_token: response.credential })
1695:        if (!data.ok) { alert("Error al ingresar con Google: " + data.error); return; }
1711:  const btn = document.getElementById("google-signin-btn");
1713:    google.accounts.id.renderButton(btn, {
1758:  if (window.google && window.google.accounts) { initGoogleSignIn(); }
1759:  else { document.addEventListener("googleAccountsReady", initGoogleSignIn); }
1760:  setTimeout(initGoogleSignIn, 2000);
1761:  setTimeout(renderHomeGoogleBtn, 2500);
1764:function renderHomeGoogleBtn() {
1765:  if (!window.google || !window.google.accounts) { setTimeout(renderHomeGoogleBtn, 500); return; }
1766:  var el = document.getElementById("home-google-btn");
1768:  google.accounts.id.renderButton(el, { theme:"filled_black", size:"large", text:"continue_with", locale:"es_419", width:320 });

## ¿Existe GOOGLE_CLIENT_ID configurado? (solo confirma que la env var existe, no su valor)
server.js:114:// Inyectar GOOGLE_CLIENT_ID en index.html sin exponerlo en el repo
server.js:117:  const clientId = process.env.GOOGLE_CLIENT_ID || "";
src/core/routes/auth.js:209:const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
src/core/routes/auth.js:217:      audience: process.env.GOOGLE_CLIENT_ID
