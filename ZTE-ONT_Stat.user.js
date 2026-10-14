// ==UserScript==
// @name            中兴光猫增强 ZTE-ONT_Stat
// @name:en         ZTE-ONT_Stat
// @namespace       ucxn
// @version         1.0.0
// @description     中兴光猫（E8 / gch 老式界面）网速与流量增强：外网速率由 PON 口累计字节求导，无线终端实时速率积分，端口流量对比。Bro-Stat 系列独立组件。
// @description:en  Speed and traffic enhancement for ZTE ONT gateways (legacy E8/gch UI): WAN speed differentiated from PON byte counters, per-terminal Wi-Fi rate integration, port traffic comparison. A standalone Bro-Stat component.
// @copyright       哥哥科技. All Rights Reserved. 使用必要条件之一：不得删除源码、用户界面、文本中的任何“哥哥”；传播官方链接不限；除安装自用外任何使用传输均需查看许可证。
// @tag             路由器 中兴 光猫 ONT PON 网络 监控 统计 数据 可视化 极客 微积分 导数 WAN 网速 Bro-Stat 哥哥科技
// @author          哥哥科技 space.bilibili.com/501430041
// @noframes
// @icon            https://scriptcat.org/api/v2/resource/image/PD6xhxddlUESIwAV
// @match           *://*/start.ghtml*
// @run-at          document-end
// @website         https://github.com/ucxn/Bro-Stat
// @supportURL      https://space.bilibili.com/501430041
// @license         LicenseRef-BR-BY-NC-1.0+ OR (SUL-1.0 AND BroTech Additional License+)
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self || window.__BRO_ONT__) return;

  const VER = (typeof GM_info !== 'undefined' && GM_info.script?.version) || '1.0.0';
  console.log(`🚀 哥哥科技 光猫版 V${VER} 已装载...`);

  // ======== [0] 用户极客环境变量配置区 ========
  const CONFIG = {
    refreshInterval: 5,   // 【快组】外网（PON）与无线终端速率的轮询间隔（秒）。光猫性能弱，不建议低于 3
    slowEvery: 6,         // 【慢组】LAN口 / Wi-Fi口 / 设备清单每 N 个快周期读一次（默认 6×5s=30s）
    zeroGrace: 3,         // 计数器连续 N 次轮询无增长，才判定速率为 0（沿用小米引擎的取值）
    wanMinBytes: 1e8,     // 外网口选择：GEMPORT 累计收发总量达到 100MB 即锁定为外网口，之后不再切换
    ratioExtremeUp: 10,   // 极端上传判定阈值（上行/下行 > 1000%）
    ratioWarnUp: 0.12,    // 重度上传警告阈值（> 12%）
    ratioExtremeDown: 0.01, // 极端下载判定阈值（< 1%）
    maskMac: true,        // 面板里把 MAC 前三段打码，便于录屏截图分享
    autoStart: false      // true：页面加载后自动开始采样；false：首次点开悬浮球才开始
  };

  // ======== [1] 工具 ========
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gbk = new TextDecoder('gb18030'), u8 = new TextDecoder('utf-8');
  // Transfer_meaning 的值是 \xNN 转义（可能是 UTF-8 多字节），按字节还原
  const unesc = s => s.replace(/(?:\\x[0-9a-fA-F]{2})+/g, m => {
    const b = new Uint8Array(m.length / 4);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(m.substr(i * 4 + 2, 2), 16);
    return u8.decode(b);
  });
  const htmlNum = s => s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  const nM = m => String(m || '').toLowerCase();
  const maskMac = m => CONFIG.maskMac ? '••:••:••:' + m.split(':').slice(3).join(':') : m;
  const fBps = v => v >= 1e9 ? (v / 1e9).toFixed(2) + ' Gbps' : v >= 1e6 ? (v / 1e6).toFixed(2) + ' Mbps' : v >= 1e3 ? (v / 1e3).toFixed(1) + ' Kbps' : Math.round(v) + ' bps';
  const fBy = bytes => {
    const u = ['B', 'KiB', 'MiB', 'GiB', 'TiB']; let i = 0;
    while (bytes >= 1024 && i < 4) { bytes /= 1024; i++; }
    return (i ? bytes.toFixed(bytes >= 100 ? 1 : 2) : Math.round(bytes)) + ' ' + u[i];
  };
  const fVol = bits => fBy(bits / 8); // 内部统一用比特，展示成字节
  const fDur = s => { s = +s; if (!isFinite(s) || s < 0) return '--'; const d = s / 86400 | 0, h = s % 86400 / 3600 | 0, m = s % 3600 / 60 | 0; return d ? `${d}天${h}时` : h ? `${h}时${m}分` : `${m}分`; };

  // ======== [2] 取数与解析（光猫页面是 gb2312 的老式表格页） ========
  async function getPage(name) {
    const r = await fetch(`/getpage.gch?pid=1002&nextpage=${name}.gch`, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer(), n = performance.now(); // 以响应到达时刻为本页数据的时间
    return { t: gbk.decode(buf), n };
  }
  function meaning(t) {
    const d = {}, re = /Transfer_meaning\('([^']*)','((?:[^'\\]|\\.)*)'\)/g; let m;
    while ((m = re.exec(t))) d[m[1]] = unesc(m[2]);
    return d;
  }
  function kvRows(t) {
    const out = [], re = /<td[^>]*class="tdleft"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class="tdright"[^>]*>([\s\S]*?)<\/td>/g; let m;
    while ((m = re.exec(t))) out.push([m[1].replace(/<[^>]*>/g, '').trim(), m[2].replace(/<[^>]*>/g, '').trim()]);
    return out;
  }
  const slashBytes = v => +String(v).split('/')[1];

  function parsePon(t) {
    const ports = []; let cur = null;
    for (const [k, v] of kvRows(t)) {
      if (k === '端口名称') ports.push(cur = { name: v });
      else if (cur) {
        if (k === '接收字节数') cur.rxB = +v; else if (k === '发送字节数') cur.txB = +v;
      }
    }
    const r = ports.filter(p => isFinite(p.rxB) && isFinite(p.txB));
    if (!r.length) throw new Error('PON 页无有效数据（会话过期或固件不同）');
    return r;
  }
  function parseLan(t) {
    const ports = []; let cur = null;
    for (const [k, v] of kvRows(t)) {
      if (k === '端口名称') ports.push(cur = { name: v });
      else if (cur) {
        if (k === '状态') cur.state = v; else if (k === '速率') cur.speed = v;
        else if (k === '收包数/字节数') cur.rxB = slashBytes(v); else if (k === '发包数/字节数') cur.txB = slashBytes(v);
      }
    }
    const d = meaning(t), cnt = +d.IF_INSTNUM || 0, list = [];
    for (let i = 0; i < cnt; i++) {
      if (!d['IPAddr' + i]) continue;
      list.push({ mac: nM(d['MACAddr' + i]), ip: d['IPAddr' + i], name: d['HostName' + i], lease: +d['ExpiredTime' + i], port: d['PhyPortName' + i], type: d['PhyType' + i], rssi: d['Rssi' + i], speed: d['Speed' + i] });
    }
    const lp = ports.filter(p => isFinite(p.rxB) && isFinite(p.txB));
    if (!lp.length && !list.length) throw new Error('LAN 页无有效数据');
    return { ports: lp, list };
  }
  function parseWlan(t) {
    const d = meaning(t), ks = Object.keys(d).map(k => /^WLAN_SSID(\d+)$/.exec(k)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
    const blocks = []; let cur = null;
    for (const [k, v] of kvRows(t)) {
      if (k === '无线网络连接状态') blocks.push(cur = {});
      else if (cur) {
        if (k === '信道') cur.ch = +v; else if (k === '收包数/字节数') cur.rxB = slashBytes(v); else if (k === '发包数/字节数') cur.txB = slashBytes(v);
      }
    }
    const out = blocks.map((b, i) => {
      const k = ks[i] ?? i, ssid = htmlNum(d['ESSID' + k] || '');
      return { ...b, name: `SSID${k + 1}`, ssid, band: (b.ch > 14 || (!b.ch && k >= 4)) ? '5G' : '2.4G' };
    }).filter(b => isFinite(b.rxB) && isFinite(b.txB));
    if (!out.length) throw new Error('Wi-Fi 页无有效数据');
    return out;
  }
  function parseTopo(t) {
    const d = meaning(t), nodes = [], devs = [];
    for (const k in d) {
      let m = /^DeviceName(\w+)$/.exec(k);
      if (m) nodes.push({ sfx: m[1], name: d[k], ip: d['IPAddr' + m[1]], mac: nM(d['MACAddr' + m[1]]), link: d['LinkSpeed' + m[1]], ver: d['SoftwareVer' + m[1]], role: d['INST_' + m[1]] });
      m = /^HostName(.+AD)$/.exec(k);
      if (m) {
        const s = m[1];
        devs.push({
          mac: nM(d['MACAddr' + s]), name: d[k], ip: d['IPAddr' + s], owner: s.replace(/\d+AD$/, ''),
          access: d['AccessType' + s], assoc: +d['AssocTime' + s], rssi: d['Rssi' + s], mode: d['WirelessMode' + s],
          // 页面源码：“上行速率”列取 RxRateBps（AP 接收＝终端上传），“下行速率”列取 TxRateBps，单位按页面口径（÷1e6=Mbps）即比特/秒
          up: +d['RxRateBps' + s] || 0, dn: +d['TxRateBps' + s] || 0, phyTx: d['TxPhyRate' + s], phyRx: d['RxPhyRate' + s]
        });
      }
    }
    if (!nodes.length) throw new Error('拓扑页无有效数据');
    return { nodes, devs: devs.filter(x => x.mac) };
  }

  // ======== [3] 求导与积分引擎（移植自小米 WAN 微分引擎） ========
  // 计数器求导：时间戳只在“计数器真的变化”时更新，速率＝增量／距上次变化的时间；
  // 连续 zeroGrace 次无增长才判零，判零后每次轮询都重置时间戳；回退按清零处理并重置基准。
  class Diff {
    constructor() { this.b = null; this.l = 0; this.lt = 0; this.z = 0; this.rate = 0; this.acc = 0; this.o = 0; }
    feed(bits, n) {
      this.o = bits;
      if (this.b === null) { this.b = this.l = bits; this.lt = n; }
      if (bits < this.l) { this.acc += this.l - this.b; this.b = this.l = bits; this.lt = n; this.rate = this.z = 0; } // 与小米不同：清零前的累计并入 acc，不丢
      if (bits > this.l) { this.rate = (bits - this.l) / ((n - this.lt) * .001); this.l = bits; this.lt = n; this.z = 0; }
      else if (++this.z > CONFIG.zeroGrace) { this.rate = 0; this.lt = n; }
      return this.rate;
    }
    get total() { return this.acc + Math.max(0, this.o - this.b); } // 打开页面以来的累计（比特）
  }
  // 速率积分：事件驱动，速率变化时才结算；从 0 起步按“流量发生在区间中点”估一半
  class Integ {
    constructor() { this.tot = 0; this.inst = 0; this.t = undefined; }
    feed(rate, n) {
      if (this.t === undefined) this.t = n;
      else if (rate !== this.inst) {
        const dt = n - this.t;
        if (this.inst > 0) this.tot += (this.inst + rate) * dt * 0.0005;
        else if (rate > 0) this.tot += rate * 0.5 * CONFIG.refreshInterval;
        this.t = n;
      }
      this.inst = rate;
    }
    close(n) { // 设备消失：按半个区间结算最后一段，速率归零
      if (this.inst > 0) this.tot += this.inst * Math.min(n - (this.t ?? n), CONFIG.refreshInterval * 1000) * 0.0005;
      this.inst = 0; this.t = n;
    }
  }

  // ======== [4] 状态与入库 ========
  const S = {
    run: false, busy: false, tick: 0, ok: {}, err: {}, fail: {},
    gem: {}, lock: null, wanName: '', wanUp: 0, wanDn: 0, wanIntU: new Integ(), wanIntD: new Integ(), wanRawU: 0, wanRawD: 0,
    devs: new Map(), nodes: [], list: [], lanP: {}, wlanP: {}, lanInfo: [], wlanInfo: [],
    hist: { u: [], d: [] }, topoN: 0
  };
  const diffOf = (store, key) => store[key] ??= new Diff();

  function ingestPon(ports, n) {
    for (const p of ports) {
      const g = S.gem[p.name] ??= { dn: new Diff(), up: new Diff(), rxB: 0, txB: 0 };
      g.rxB = p.rxB; g.txB = p.txB;
      g.dn.feed(p.rxB * 8, n); g.up.feed(p.txB * 8, n); // PON 接收＝来自 OLT＝下行
    }
    if (!S.lock) {
      let best = null;
      for (const p of ports) if (!best || p.rxB + p.txB > best.rxB + best.txB) best = p;
      S.wanName = best.name;
      if (best.rxB + best.txB >= CONFIG.wanMinBytes) S.lock = best.name;
    } else S.wanName = S.lock;
    const g = S.gem[S.wanName];
    S.wanUp = g.up.rate; S.wanDn = g.dn.rate; S.wanRawU = g.txB; S.wanRawD = g.rxB;
    S.wanIntU.feed(S.wanUp, n); S.wanIntD.feed(S.wanDn, n);
    S.hist.u.push(S.wanUp); S.hist.d.push(S.wanDn);
    if (S.hist.u.length > 360) { S.hist.u.shift(); S.hist.d.shift(); }
  }
  function ingestTopo(r, n) {
    S.nodes = r.nodes; S.topoN = n;
    const seen = new Set();
    for (const x of r.devs) {
      seen.add(x.mac);
      const d = S.devs.get(x.mac) ?? { mac: x.mac, iu: new Integ(), id: new Integ() };
      Object.assign(d, { name: x.name, ip: x.ip, access: x.access, assoc: x.assoc, rssi: x.rssi, mode: x.mode, phyTx: x.phyTx, phyRx: x.phyRx, up: x.up, dn: x.dn, online: true });
      d.iu.feed(x.up, n); d.id.feed(x.dn, n);
      S.devs.set(x.mac, d);
    }
    for (const [m, d] of S.devs) if (!seen.has(m) && d.online) { d.iu.close(n); d.id.close(n); d.up = d.dn = 0; d.online = false; }
  }
  function ingestLan(r, n) {
    S.list = r.list; S.lanInfo = r.ports;
    for (const p of r.ports) { diffOf(S.lanP, p.name + ':up').feed(p.rxB * 8, n); diffOf(S.lanP, p.name + ':dn').feed(p.txB * 8, n); } // 从 LAN 口看：收＝终端上传
  }
  function ingestWlan(r, n) {
    S.wlanInfo = r;
    for (const p of r) { diffOf(S.wlanP, p.name + ':up').feed(p.rxB * 8, n); diffOf(S.wlanP, p.name + ':dn').feed(p.txB * 8, n); }
  }

  // ======== [5] 调度 ========
  async function run(key, fn) {
    try { await fn(); S.ok[key] = Date.now(); S.err[key] = null; S.fail[key] = 0; }
    catch (e) { S.err[key] = e.message; S.fail[key] = (S.fail[key] || 0) + 1; console.warn(`[哥哥科技 光猫版] ${key} 失败:`, e.message); }
  }
  async function cycle() {
    if (!S.run || S.busy) return;
    S.busy = true; const t0 = performance.now();
    try {
      await run('pon', async () => { const { t, n } = await getPage('pon_status_stat_info_t'); ingestPon(parsePon(t), n); });
      await run('topo', async () => { const { t, n } = await getPage('topo_t'); ingestTopo(parseTopo(t), n); });
      if (S.tick % CONFIG.slowEvery === 0) {
        await run('lan', async () => { const { t, n } = await getPage('status_lan_info_t'); ingestLan(parseLan(t), n); });
        await run('wlan', async () => { const { t, n } = await getPage('e8_status_wlan_info_t'); ingestWlan(parseWlan(t), n); });
      }
    } finally {
      S.tick++; S.busy = false;
      if ((S.fail.pon || 0) >= 5 && (S.fail.topo || 0) >= 5) { S.run = false; S.paused = true; }
      render();
      if (S.run) setTimeout(cycle, Math.max(0, CONFIG.refreshInterval * 1000 - (performance.now() - t0)));
    }
  }
  function start() { if (S.run) return; S.run = true; S.paused = false; S.fail = {}; cycle(); }

  // ======== [6] 界面 ========
  const CSS = `
#bro-ont-ball{position:fixed;right:22px;bottom:150px;width:48px;height:48px;border-radius:50%;border:0;background:#0059fa;color:#fff;font-size:26px;line-height:48px;text-align:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,89,250,.45);z-index:2147483000;padding:0}
#bro-ont-ball:hover{transform:scale(1.08)}
#bro-ont-ov{position:fixed;inset:4vh 3vw 3vh 3vw;background:#f3f4f5;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);z-index:2147483001;display:none;flex-direction:column;font:13px/1.5 "Microsoft YaHei",system-ui,sans-serif;color:#222}
#bro-ont-ov{text-align:left}
#bro-ont-ov *{box-sizing:border-box}
#bro-ont-ov .hd{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#0059fa;color:#fff;border-radius:10px 10px 0 0}
#bro-ont-ov .hd b{font-size:15px}#bro-ont-ov .hd .st{flex:1;font-size:12px;opacity:.9}
#bro-ont-ov .hd button{background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:4px;padding:2px 10px;cursor:pointer;font-size:14px}
#bro-ont-ov .bd{flex:1;overflow:auto;padding:14px 16px}
#bro-ont-ov section{background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
#bro-ont-ov h3{margin:0 0 8px;font-size:13px;color:#0059fa}
#bro-ont-ov .big{display:flex;flex-wrap:wrap;gap:24px;align-items:baseline}
#bro-ont-ov .big span{font:600 24px Consolas,monospace}.up{color:#e8590c}.dn{color:#0059fa}.mu{color:#777;font-size:12px}
#bro-ont-ov table{border-collapse:collapse;width:100%}#bro-ont-ov th,#bro-ont-ov td{padding:5px 8px;text-align:right;border-bottom:1px solid #eee;white-space:nowrap}
#bro-ont-ov th{color:#666;font-weight:600;background:#fafafa}#bro-ont-ov td:first-child,#bro-ont-ov th:first-child{text-align:left}
#bro-ont-ov .off{opacity:.45}.warn{color:#d6001c;font-weight:700}.cool{color:#1c7ed6}
#bro-ont-ov .bar{display:inline-block;width:70px;height:6px;background:#eee;border-radius:3px;vertical-align:middle;overflow:hidden;margin-left:4px}
#bro-ont-ov .bar i{display:block;height:100%}
#bro-ont-ov .chip{display:inline-block;margin:0 8px 4px 0;padding:2px 8px;background:#eef3ff;border-radius:10px;font-size:12px}
#bro-ont-ov .alert{background:#fff3cd;color:#856404;border-left:5px solid #ffc107;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-weight:600}
#bro-ont-ov .stale section{opacity:.45}
#bro-ont-ov .ft{text-align:center;color:#777;font-size:12px;padding:8px 0 2px}.ft a{color:#0059fa;text-decoration:none;font-weight:700}
#zo-spark{width:100%;height:90px;display:block;margin-top:8px;background:#fafcff;border-radius:4px}`;

  function build() {
    if ($('#bro-ont-ball')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ball = document.createElement('button'); ball.id = 'bro-ont-ball'; ball.type = 'button'; ball.title = '哥哥科技 光猫监控'; ball.textContent = '🛸';
    const ov = document.createElement('div'); ov.id = 'bro-ont-ov';
    ov.innerHTML = `<div class="hd"><b>🛸 哥哥科技 · 光猫监控</b><span class="st" id="zo-st"></span><button type="button" id="zo-x">✕</button></div>
<div class="bd"><div id="zo-alert"></div>
<section><h3>外网（PON 口求导）</h3><div id="zo-wan"></div><canvas id="zo-spark"></canvas></section>
<section><h3>网关节点</h3><div id="zo-nodes"></div></section>
<section><h3>无线终端（逐设备实时速率 + 本次积分）</h3><div id="zo-devs"></div></section>
<section><h3>端口与 Wi-Fi（累计字节求导，慢组采样）</h3><div id="zo-ports"></div></section>
<section><h3>其它在线设备（光猫侧不提供逐设备速率）</h3><div id="zo-other"></div></section>
<div class="ft"><i>“在一个文明社会，干净的、不被监视与吸血的网络，是我们每个人的基本权利。”</i><br>Bro-Stat 光猫版 ${esc(VER)} | Copyright © 2026 <a href="https://space.bilibili.com/501430041" target="_blank" rel="noopener">哥哥科技</a> (BroTech) | All Rights Reserved</div></div>`;
    document.body.append(ball, ov);
    const toggle = show => { ov.style.display = show ? 'flex' : 'none'; if (show) { start(); render(); } };
    ball.onclick = () => toggle(ov.style.display !== 'flex');
    $('#zo-x', ov).onclick = () => toggle(false);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.style.display === 'flex') toggle(false); });
    if (CONFIG.autoStart) start();
  }

  function ratioCell(u, d) {
    if (u + d < 8e6) return '<span class="mu">--</span>';
    const r = d > 0 ? u / d : Infinity;
    const txt = r === Infinity ? '∞' : (r * 100).toFixed(r < 1 ? 1 : 0) + '%';
    if (r > CONFIG.ratioExtremeUp) return `<span class="warn">⚠ ${txt}</span>`;
    if (r > CONFIG.ratioWarnUp) return `<span class="warn">${txt}</span>`;
    if (r < CONFIG.ratioExtremeDown) return `<span class="cool">${txt}</span>`;
    return txt;
  }
  const bandOf = a => a === '1' ? '2.4G' : a === '2' ? '5G' : a === '0' ? '有线' : '?';

  function render() {
    const ov = $('#bro-ont-ov'); if (!ov || ov.style.display !== 'flex') return;
    // 顶部状态与告警
    const errs = Object.entries(S.err).filter(([, v]) => v).map(([k, v]) => `${k}: ${esc(v)}`);
    $('#zo-st').textContent = `采样 ${CONFIG.refreshInterval}s · 轮次 ${S.tick}` + (S.ok.pon ? ' · 最近成功 ' + new Date(S.ok.pon).toLocaleTimeString() : '');
    $('#zo-alert').innerHTML = (S.paused ? '<div class="alert">⛔ 已暂停：外网与拓扑连续读取失败。请刷新页面重新登录后再试；若仍失败，请联系开发者（带 F12 抓包）。</div>' : '')
      + (errs.length && !S.paused ? `<div class="alert">⚠ 部分数据读取失败：${errs.join('；')}</div>` : '');
    $('.bd', ov).classList.toggle('stale', !!S.paused); // 暂停后数据停留在最后一次成功采样，变灰提示
    // 外网
    const g = S.gem[S.wanName];
    $('#zo-wan').innerHTML = g ? `<div class="big"><span class="up">🔼 ${fBps(S.wanUp)}</span><span class="dn">🔽 ${fBps(S.wanDn)}</span></div>
<div class="mu" style="margin-top:6px">选用端口 ${esc(S.wanName)}${S.lock ? '（已锁定）' : '（累计未达 100MB，暂定）'}　|
本次页面求导累计：🔼 ${fVol(g.up.total)}　🔽 ${fVol(g.dn.total)}　|　积分：🔼 ${fVol(S.wanIntU.tot)}　🔽 ${fVol(S.wanIntD.tot)}　|　光猫计数器（官方累计）：🔼 ${fBy(S.wanRawU)}　🔽 ${fBy(S.wanRawD)}</div>` : '<div class="mu">采样中…</div>';
    drawSpark();
    // 节点
    $('#zo-nodes').innerHTML = S.nodes.length ? S.nodes.map(n => `<span class="chip">${esc(n.name)} · ${esc(n.ip)} · ${esc(maskMac(n.mac))} · ${esc(n.role || '')}${n.link && n.link !== '0' ? ' · ' + esc(n.link) + 'M' : ''} · ${esc(n.ver || '')}</span>`).join('') : '<span class="mu">--</span>';
    // 无线终端
    const devs = [...S.devs.values()].sort((a, b) => (b.online - a.online) || ((b.up + b.dn) - (a.up + a.dn)));
    let su = 0, sd = 0; for (const d of devs) { su += d.iu.tot; sd += d.id.tot; }
    const sumU = devs.reduce((s, d) => s + d.up, 0), sumD = devs.reduce((s, d) => s + d.dn, 0);
    $('#zo-devs').innerHTML = devs.length ? `<div class="mu" style="margin-bottom:6px">终端速率之和：🔼 ${fBps(sumU)}　🔽 ${fBps(sumD)}</div>
<table><tr><th>设备</th><th>IP</th><th>MAC</th><th>频段</th><th>RSSI</th><th>协商 Tx/Rx</th><th>🔼 实时</th><th>🔽 实时</th><th>🔼 本次</th><th>🔽 本次</th><th>上/下</th><th>占比 🔼/🔽</th><th>在线</th></tr>`
      + devs.map(d => {
        const pu = su > 0 ? d.iu.tot / su * 100 : 0, pd = sd > 0 ? d.id.tot / sd * 100 : 0;
        return `<tr class="${d.online ? '' : 'off'}"><td>${esc(d.name || '未知')}</td><td>${esc(d.ip)}</td><td>${esc(maskMac(d.mac))}</td><td>${bandOf(d.access)}${d.mode ? ' ' + esc(d.mode.replace('802.11', '')) : ''}</td><td>${esc(d.rssi)}</td><td>${esc(d.phyTx)}/${esc(d.phyRx)}</td>
<td class="up">${fBps(d.up)}</td><td class="dn">${fBps(d.dn)}</td><td>${fVol(d.iu.tot)}</td><td>${fVol(d.id.tot)}</td><td>${ratioCell(d.iu.tot, d.id.tot)}</td>
<td><span class="bar"><i style="width:${pu.toFixed(0)}%;background:#e8590c"></i></span><span class="bar"><i style="width:${pd.toFixed(0)}%;background:#0059fa"></i></span></td><td>${d.online ? fDur(d.assoc) : '离线'}</td></tr>`;
      }).join('') + '</table>' : '<span class="mu">暂无无线终端数据</span>';
    // 端口
    const prow = (label, key, info, store, extra) => {
      const u = store[key + ':up'], d = store[key + ':dn']; if (!u || !d) return '';
      return `<tr><td>${label}</td><td>${extra}</td><td class="up">${fBps(u.rate)}</td><td class="dn">${fBps(d.rate)}</td><td>${fVol(u.total)}</td><td>${fVol(d.total)}</td><td>${fBy(info.rxB)} / ${fBy(info.txB)}</td></tr>`;
    };
    const rows = S.lanInfo.map(p => prow(esc(p.name), p.name, p, S.lanP, `${esc(p.state)} ${esc(p.speed)}`)).join('') + S.wlanInfo.map(p => prow(`Wi-Fi ${p.band} (${esc(p.ssid)})`, p.name, p, S.wlanP, `信道 ${p.ch}`)).join('');
    $('#zo-ports').innerHTML = rows ? `<table><tr><th>端口</th><th>状态</th><th>🔼 速率(30s)</th><th>🔽 速率(30s)</th><th>🔼 本次</th><th>🔽 本次</th><th>官方累计 收/发</th></tr>${rows}</table>` : '<span class="mu">采样中…（慢组首次约需数秒）</span>';
    // 其它设备
    const wl = new Set([...S.devs.values()].filter(d => d.online).map(d => d.mac));
    const oth = S.list.filter(x => !wl.has(x.mac));
    $('#zo-other').innerHTML = oth.length ? `<table><tr><th>设备</th><th>IP</th><th>MAC</th><th>端口</th><th>类型</th><th>RSSI</th><th>协商</th><th>剩余租期</th></tr>`
      + oth.map(x => `<tr class="${/^SSID/.test(x.port) && !x.rssi ? 'off' : ''}"><td>${esc(x.name)}</td><td>${esc(x.ip)}</td><td>${esc(maskMac(x.mac))}</td><td>${esc(x.port)}</td><td>${esc(x.type)}</td><td>${esc(x.rssi || '--')}</td><td>${esc(x.speed || '--')}</td><td>${fDur(x.lease)}</td></tr>`).join('') + '</table>' : '<span class="mu">--</span>';
  }

  function drawSpark() {
    const cv = $('#zo-spark'); if (!cv || !cv.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, w = cv.width = cv.clientWidth * dpr, h = cv.height = cv.clientHeight * dpr, x = cv.getContext('2d');
    const U = S.hist.u, D = S.hist.d, n = U.length; if (n < 2) return;
    const mx = Math.max(1e5, ...U, ...D) * 1.1, px = i => i / 359 * w + (w - (n - 1) / 359 * w), py = v => h - 4 - v / mx * (h - 8);
    const line = (arr, c, fill) => {
      x.beginPath(); arr.forEach((v, i) => i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v)));
      x.strokeStyle = c; x.lineWidth = 1.6 * dpr; x.stroke();
      if (fill) { x.lineTo(px(n - 1), h); x.lineTo(px(0), h); x.closePath(); x.fillStyle = fill; x.fill(); }
    };
    line(D, '#0059fa', 'rgba(0,89,250,.12)'); line(U, '#e8590c');
    x.fillStyle = '#888'; x.font = `${10 * dpr}px sans-serif`; x.fillText(fBps(mx / 1.1), 4 * dpr, 12 * dpr);
  }

  window.__BRO_ONT__ = { S, CONFIG, start, render, Diff, Integ }; // 供控制台调试
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
