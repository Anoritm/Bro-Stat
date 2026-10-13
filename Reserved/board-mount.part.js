/* @BroTech-Reserved board-pin-anchor.part.js */
  
        const oDC = Object.create(null);
        if (!iPO) {
      const M_RX = /([a-fA-F0-9]{2}[:-]){5}[a-fA-F0-9]{2}/;
      const aI = aC.querySelectorAll('.config-item');
      for (const n of aI) {
        const mN = n.querySelector('.dev-number'),
          mM = mN ? mN.textContent.match(M_RX) : null;
        if (mM) {
          oDC[mM[0].toLowerCase().replace(/-/g, ':')] = n;
        }
      }
    }
    else {
      const gI = aC.querySelectorAll('.gege-list-item');
      for (const n of gI) {
        const m = n.getAttribute('data-gege-mac');
        if (m) oDC[m] = n;
      }
    }
            if (bd.parentNode) {
        const setText = (id, text) => { const el = bd.querySelector(id); if (el) el.textContent = text; };