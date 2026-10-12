if (dD < cS.dpD * 1.1 || dD < cS.dpD + CONFIG.宽带最大外网下行速率 * CONFIG.lanRefreshInterval) {
                cS.dB += cS.dpD; cS.oD += cS.dpD;
              } else { cS.dB += dD; cS.oD += dD; }
              cS.aR = 2;
              if (CONFIG.盲漫游 === undefined) CONFIG.盲漫游 = 1;
            } else {
              cS.aR = 0;
            }
            cS.dpU = 0; cS.dpD = 0;
          }
        }
