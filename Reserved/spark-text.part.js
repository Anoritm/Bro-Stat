const SPRK = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
      function getSpark(ringArr, headIdx, maxVal) {
        let s = "";
        for (let i = 64; i--; ) {
          let v = ringArr[(headIdx - i) & 127];
          s += SPRK[v > 0 ? Math.min(7, Math.max(1, ((v / maxVal) * 7) | 0)) : 0];
        }
        return s;
      }
