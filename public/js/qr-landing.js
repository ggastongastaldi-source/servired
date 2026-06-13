(function() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (!ref) return;

  SessionContext.setOriginRef(ref);

  fetch('/api/referidos/resolver?ref=' + encodeURIComponent(ref))
    .then(r => r.json())
    .then(data => { if (data.comercio) _render(data.comercio); })
    .catch(() => {});

  function _render(c) {
    const el = document.createElement('div');
    el.id = 'qr-referral-banner';
    el.style.cssText = 'background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #ff6b35;border-radius:12px;padding:12px 16px;margin:0 16px 16px;text-align:center;font-family:inherit';
    el.innerHTML = '<div style="color:#aaa;font-size:11px;margin-bottom:4px">Te recomendó</div>'
      + '<div style="color:#fff;font-weight:700;font-size:15px">' + c.nombre + '</div>'
      + '<div style="color:#ff6b35;font-size:12px;margin-top:2px">📍 ' + c.zona + '</div>';

    const target = document.querySelector('.btn-cyan');
    if (target) target.insertAdjacentElement('beforebegin', el);
  }
})();
