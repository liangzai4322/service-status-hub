/* State history is additive; the snapshot renderer keeps its existing contract. */
(function (root) {
  'use strict';
  const severity = {healthy: 0, maintenance: 1, degraded: 2, unknown: 3, down: 4};
  function buckets(history) {
    const start = Date.parse(history.from);
    const end = Date.parse(history.to);
    const width = (end - start) / 96;
    return Array.from({length: 96}, (_, index) => {
      const from = start + index * width;
      const to = index === 95 ? end : start + (index + 1) * width;
      let state = null;
      let covered = 0;
      for (const interval of history.intervals || []) {
        const overlap = Math.min(to, Date.parse(interval.to)) - Math.max(from, Date.parse(interval.from));
        if (overlap <= 0) continue;
        covered += overlap;
        if (state === null || severity[interval.state] > severity[state]) state = interval.state;
      }
      if (covered < to - from - 1 && (state === null || severity.unknown > severity[state])) state = 'unknown';
      return {from, to, state: state || 'unknown'};
    });
  }
  function markup(history, colors, escape) {
    const labels = {healthy: '正常', degraded: '部分异常', down: '已停止', maintenance: '维护中', unknown: '未知'};
    const format = ms => new Date(ms).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      second: '2-digit', hour12: false, timeZoneName: 'short'
    });
    const cells = buckets(history).map(cell => {
      const title = format(cell.from) + ' — ' + format(cell.to) + ' · ' + labels[cell.state];
      return '<span class="history-cell" style="background:' + colors[cell.state] +
        '" title="' + escape(title) + '" aria-label="' + escape(title) + '"></span>';
    }).join('');
    const percent = (Math.floor(history.uptime_ratio * 10000) / 100).toFixed(2);
    return '<div class="history-heading"><span>过去 24 小时</span><b title="正常时长 / 完整 24 小时；其余状态均不计入正常时长">Uptime ' +
      percent + '%</b></div><div class="history-bar" role="img" aria-label="过去 24 小时状态，正常时长占比 ' +
      percent + '%">' + cells + '</div><div class="history-axis"><span>24 小时前</span><span>现在</span></div>';
  }
  root.StatusHistory = {buckets, markup};
})(typeof window === 'undefined' ? globalThis : window);

