if (nowMs >= S.Force_MS && !S._RST) {
            doSettle(nowMs);
          } else if (nowMs >= S.Warn_MS && !document.getElementById('gb-w-bnr')) {
            let bd = document.getElementById('zte-geek-board');
            if (bd) {
              let bn = document.createElement('div'); bn.id = 'gb-w-bnr';
              bn.style.cssText = 'background:#fff3cd;color:#856404;padding:10px 15px;margin-bottom:10px;border-radius:6px;border-left:5px solid #ffc107;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;align-items:center;width:100%;box-sizing:border-box;';
              bn.innerHTML = `<span> 统计周期即将结束，流量将在跨越边界时自动清零备份。</span><button id="gb-f-btn" style="background:#ffc107;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;color:#333;">立即导出并清零</button>`;
              bd.insertBefore(bn, bd.firstChild);
              document.getElementById('gb-f-btn').onclick = () => doSettle(Date.now());}
          }
