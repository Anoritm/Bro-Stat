if (dU < 0 || dD < 0) {
          if (dU < 0) { cS.uB += dU; cS.oU += dU; cS.dpU = cS.lU; }
          if (dD < 0) { cS.dB += dD; cS.oD += dD; cS.dpD = cS.lD; }
          cS.aR = 3;
        } else if (cS.aR === 3) {
          if (dU > 0 || dD > 0) {
            if (
