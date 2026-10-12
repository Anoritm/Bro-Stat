if (bd.querySelector('#gb-ratio-display')) {
          bd.querySelector('#gb-cur-up-vol').textContent = `🔼 ${fV(curHpU)}`;
          bd.querySelector('#gb-cur-down-vol').textContent = `🔽 ${fV(curHpD)}`;
          if (bd.querySelector('#gb-wan-zero-up')) {
              bd.querySelector('#gb-wan-zero-up').textContent = !S.wZEU ? '' : fSV(S.wZEU);
              bd.querySelector('#gb-wan-zero-down').textContent = !S.wZED ? '' : fSV(S.wZED);
              bd.querySelector('#gb-wan-zero-up-cnt').textContent = S.wZEUC || 0;
              bd.querySelector('#gb-wan-zero-down-cnt').textContent = S.wZEDC || 0;
          }
        }
      }
      const inv_tot_cU = tot_cU > 0 ? 100 / tot_cU : 0;
      const inv_tOD = tOD > 0 ? 100 / tOD : 0;
      const inv_sU = sU > 0 ? 100 / sU : 0;
      const inv_sD = sD > 0 ? 100 / sD : 0;
      for (let m in cI) {
        let it = oDC[m];
        if (!it) continue;
        const cC = cI[m] || { upRate: 0, dnRate: 0, iface: "", offUp: 0, offDn: 0 },
              cS = S.cls[m] || { intUp: 0, intDn: 0, onS: 0 };
        let cache = it._gege || (it._gege = {});
