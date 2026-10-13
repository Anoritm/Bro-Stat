const csvQ = s => `"${s.replaceAll('"', '""')}"`; // RFC 4180：字段整体加引号，内部双引号翻倍
    const csvE = v => {
      let s = String(v ?? '');
      if (typeof v === 'string' && /^(?:\s*[=+\-@＝＋－＠]|[\t\r\n])/.test(s)) s = "'" + s; // 防表格公式注入
      return csvQ(s);
    };
    const csvRow = a => a.map(csvE).join(',');
    const csvRowT = a => a.map(v => csvQ(String(v ?? ''))).join(','); // 仅限脚本自带可信常量
    return ((sp, now, start) => '\uFEFF' + [
      csvRow([`哥哥科技 硬路由 NPU 增强系列：专用组件 ${版本号} 生成`]),