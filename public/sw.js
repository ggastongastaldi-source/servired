const CACHE = 'servired-vfc92c3';
const ASSETS = ['/', '/index.html', '/cliente.html', '/trabajador.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (e.request.url.includes('tile.openstreetmap') || e.request.url.includes('unpkg.com') || e.request.url.includes('cdnjs')) return;
  // HTML siempre desde red, nunca desde cache
  if (e.request.url.endsWith('/') || e.request.url.includes('index.html')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return resp;
    }))
  );
});


self.addEventListener('push', e => {
  let data = { title: 'ServiRed', body: 'Tenés una novedad', tag: 'servired', tipo: 'general' };
  try { data = { ...data, ...e.data.json() }; } catch(_) {}

  const iconMap = {
    'nueva_oportunidad': '/icons/icon-192.png',
    'link_pago':         '/icons/icon-192.png',
    'pedido_confirmado': '/icons/icon-192.png',
  };

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    iconMap[data.tipo] || '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      tag:     data.tag || data.tipo || 'servired',
      vibrate: data.tipo === 'link_pago' ? [200,100,200,100,400] : [100,50,100],
      data:    data,
      actions: data.tipo === 'link_pago' ? [
        { action: 'pagar', title: '💳 Pagar ahora' },
        { action: 'cerrar', title: 'Después' }
      ] : data.tipo === 'nueva_oportunidad' ? [
        { action: 'ver', title: '👀 Ver trabajo' },
        { action: 'silenciar', title: 'Silenciar' }
      ] : [],
      requireInteraction: data.tipo === 'link_pago',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  let url = '/';
  if (e.action === 'pagar' && data.url) url = data.url;
  else if (data.tipo === 'link_pago' && data.url) url = data.url;
  else if (data.tipo === 'nueva_oportunidad') url = '/trabajador.html';
  else if (data.tipo === 'pedido_confirmado') url = '/cliente.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(url.split('?')[0])) { c.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});
