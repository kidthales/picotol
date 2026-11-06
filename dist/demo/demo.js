// Client-side interactions for the picotol demo showcase.
// Runs under strict Content-Security-Policy: script-src 'self'.
(function () {
  'use strict';

  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const accentSelect = document.getElementById('accent-select');

  function updateThemeButton(theme) {
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '🌙 Dark' : '☀️ Light';
      themeBtn.setAttribute('aria-label', 'Active theme: ' + theme + '. Click to toggle.');
    }
  }

  const savedTheme = localStorage.getItem('picotol-theme');
  if (savedTheme) {
    root.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    updateThemeButton(prefersDark ? 'dark' : 'light');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const cur = root.getAttribute('data-theme');
      const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      const nextTheme = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', nextTheme);
      localStorage.setItem('picotol-theme', nextTheme);
      updateThemeButton(nextTheme);
    });
  }

  function setAccent(accent) {
    root.setAttribute('data-accent', accent);
    if (accentSelect) accentSelect.value = accent;
    localStorage.setItem('picotol-accent', accent);
  }

  const savedAccent = localStorage.getItem('picotol-accent');
  if (savedAccent) {
    setAccent(savedAccent);
  }

  if (accentSelect) {
    accentSelect.addEventListener('change', (e) => setAccent(e.target.value));
  }

  document.querySelectorAll('[data-set-accent]').forEach((btn) => {
    btn.addEventListener('click', () => setAccent(btn.getAttribute('data-set-accent')));
  });

  // Dialog open and close controls (CSP-safe, replacing inline onclick)
  document.querySelectorAll('[data-dialog-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-dialog-open');
      const dialog = document.getElementById(targetId);
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    });
  });

  document.querySelectorAll('[data-dialog-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-dialog-close');
      const dialog = targetId ? document.getElementById(targetId) : btn.closest('dialog');
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    });
  });

  // Native dialog backdrop click-to-close
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });

  // Prevent default submit on showcase demo forms
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  });

  // Dashboard tab switching
  const tabs = [
    { tab: document.getElementById('tab-overview'), panel: document.getElementById('panel-overview') },
    { tab: document.getElementById('tab-analytics'), panel: document.getElementById('panel-analytics') },
    { tab: document.getElementById('tab-logs'), panel: document.getElementById('panel-logs') },
  ];

  tabs.forEach(({ tab, panel }) => {
    if (!tab || !panel) return;
    tab.addEventListener('click', () => {
      tabs.forEach(({ tab: t, panel: p }) => {
        const isSelected = t === tab;
        t.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
          p.removeAttribute('hidden');
        } else {
          p.setAttribute('hidden', '');
        }
      });
    });
  });

  // Segmented time filter with 300ms zero-CLS skeleton loader pulse
  const timeFilter = document.getElementById('time-filter');
  const periodData = {
    '1H': {
      throughput: '124 GB',
      clusters: '128 / 130',
      latency: '16.2 ms',
      errors: '0.008%',
      cpu: '38.4%',
      cpuVal: 38,
      mem: '58.1%',
      memVal: 58,
    },
    '24H': {
      throughput: '1.42 TB',
      clusters: '128 / 130',
      latency: '18.4 ms',
      errors: '0.012%',
      cpu: '42.8%',
      cpuVal: 43,
      mem: '64.2%',
      memVal: 64,
    },
    '7D': {
      throughput: '8.94 TB',
      clusters: '129 / 130',
      latency: '19.1 ms',
      errors: '0.015%',
      cpu: '45.2%',
      cpuVal: 45,
      mem: '67.5%',
      memVal: 68,
    },
    '30D': {
      throughput: '38.6 TB',
      clusters: '130 / 130',
      latency: '17.8 ms',
      errors: '0.011%',
      cpu: '44.0%',
      cpuVal: 44,
      mem: '66.0%',
      memVal: 66,
    },
  };

  if (timeFilter) {
    timeFilter.querySelectorAll('button[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        const data = periodData[period];
        if (!data) return;

        timeFilter.querySelectorAll('button[data-period]').forEach((b) => {
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });

        const statEls = [
          document.getElementById('stat-throughput'),
          document.getElementById('stat-clusters'),
          document.getElementById('stat-latency'),
          document.getElementById('stat-errors'),
          document.getElementById('stat-cpu'),
          document.getElementById('stat-mem'),
        ];

        statEls.forEach((el) => { if (el) el.classList.add('pt-skeleton'); });

        setTimeout(() => {
          const st = document.getElementById('stat-throughput');
          const sc = document.getElementById('stat-clusters');
          const sl = document.getElementById('stat-latency');
          const se = document.getElementById('stat-errors');
          const scpu = document.getElementById('stat-cpu');
          const smem = document.getElementById('stat-mem');
          const pcpu = document.getElementById('stat-cpu-progress');
          const pmem = document.getElementById('stat-mem-progress');

          if (st) st.textContent = data.throughput;
          if (sc) sc.textContent = data.clusters;
          if (sl) sl.textContent = data.latency;
          if (se) se.textContent = data.errors;
          if (scpu) scpu.textContent = data.cpu;
          if (smem) smem.textContent = data.mem;
          if (pcpu) pcpu.value = data.cpuVal;
          if (pmem) pmem.value = data.memVal;

          statEls.forEach((el) => { if (el) el.classList.remove('pt-skeleton'); });
        }, 300);
      });
    });
  }

  // Dynamic streaming telemetry ticker for tabular number badges
  const liveIndicator = document.getElementById('live-indicator-count');
  const liveBadge = document.getElementById('live-badge-count');
  if (liveIndicator && liveBadge) {
    let turn = 42;
    let tok = 1842;
    setInterval(() => {
      turn = (turn + 1) % 1000;
      tok = 1800 + Math.floor(Math.sin(turn * 0.2) * 50) + Math.floor(Math.random() * 20);
      liveIndicator.textContent = 'Turn #' + String(turn).padStart(3, '0');
      liveBadge.textContent = tok.toLocaleString() + ' tok/s';
    }, 1500);
  }

  // Palette Explorer live search and click-to-copy
  const paletteSearch = document.getElementById('palette-search');
  const swatches = document.querySelectorAll('[data-swatch]');
  const emptyMsg = document.getElementById('palette-empty');
  const toast = document.getElementById('toast');
  let toastTimeout;

  function showToast(msg) {
    if (!toast) return;
    toast.classList.add('pt-show');
    toast.textContent = msg;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('pt-show');
    }, 2000);
  }

  if (paletteSearch) {
    paletteSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      let visibleCount = 0;
      swatches.forEach((sw) => {
        const haystack = (sw.getAttribute('data-search') || '').toLowerCase();
        const matches = !query || haystack.includes(query);
        sw.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
      });
      if (emptyMsg) {
        emptyMsg.hidden = visibleCount > 0;
      }
    });
  }

  swatches.forEach((sw) => {
    const copyVal = sw.querySelector('strong code')?.textContent?.trim() || '';
    const hexVal = sw.querySelector('div code')?.textContent?.trim() || '';
    const copy = () => {
      if (!copyVal) return;
      navigator.clipboard.writeText(copyVal).then(() => {
        showToast('Copied ' + copyVal + ' (' + hexVal + ') to clipboard!');
      }).catch(() => {
        showToast('Copied ' + copyVal + '!');
      });
    };
    sw.addEventListener('click', copy);
    sw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copy();
      }
    });
  });
})();
