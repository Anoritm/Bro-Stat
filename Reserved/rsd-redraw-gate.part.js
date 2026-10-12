//if (!isWanFetched) { cWU = cSU; cWD = cSD; }
      let ol = document.getElementById('gege-global-overlay'),
        cM = Object.keys(cI),
        iD = window.gegeForceUIRedraw || (cM.length !== window.gegeRenderedMacs.size);
      if (!iD && cM.length > 0) {
        for (let i = 0; i < cM.length; i++) {
          if (!window.gegeRenderedMacs.has(cM[i])) { iD = !0; break; }
        }
      }
      if (iD) {
        for (let m in S.cls) if (!cI[m]) {
          let cS = S.cls[m], dt = n - cS.lUT;
          if (dt > CONFIG.lanRefreshInterval * 1000) dt = CONFIG.lanRefreshInterval * 1000;
          cS.intUp += cS.upR * dt * 0.0005; cS.intDn += cS.dnR * dt * 0.0005;
          cS.upR = cS.dnR = 0; cS.lUT = n;
        }
      }
      if (ol && ol.style.display === 'block' && (iD || !ol.querySelector('.gege-list-item'))) {
        bVD(ol, cI);
        window.gegeRenderedMacs = new Set(cM);
        window.gegeForceUIRedraw = !1;
