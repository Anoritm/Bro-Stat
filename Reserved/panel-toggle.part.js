let o = document.getElementById('gege-global-overlay');
    let tS = fS !== null ? fS : !(o && o.style.display === 'block');

    if (!tS) {
      if (o) o.style.display = 'none';
      return;
    }

    if (!o) {
      o = document.createElement('div');
      o.id = 'gege-global-overlay';
      document.body.appendChild(o);
    }
    o.style.display = 'block';
if (!window.gegeBActivated) {
      window.gegeBActivated = !0;
      clearTimeout(window.gegeMasterTimer);
      window.gegeMasterTimer = setInterval(rSD, CONFIG.lanRefreshInterval * 1000);
