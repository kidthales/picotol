// Generates a self-contained, offline-capable interactive HTML5 kitchen-sink
// showcase of picotol into dist/demo/index.html.
import { loadSnapshot } from './sync-tokens.mjs';

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export const ACCENT_TABLE = [
  {
    accent: 'blue',
    lightFg: '#2255AA',
    lightFgToken: '--tol-dark-3',
    lightFgHover: '#004488',
    lightBg: '#AACCEE',
    lightBgToken: '--tol-pale-0',
    lightBgHover: '#77AADD',
    darkFg: '#77AADD',
    darkFgToken: '--tol-light-blue',
    darkFgHover: '#AACCEE',
    darkBg: '#2255AA',
    darkBgToken: '--tol-dark-3',
    darkBgHover: '#4477AA',
  },
  {
    accent: 'cyan',
    lightFg: '#117788',
    lightFgToken: '--tol-dark-6',
    lightFgHover: '#006644',
    lightBg: '#CCEEFF',
    lightBgToken: '--tol-pale-1',
    lightBgHover: '#99DDFF',
    darkFg: '#99DDFF',
    darkFgToken: '--tol-light-cyan',
    darkFgHover: '#CCEEFF',
    darkBg: '#117788',
    darkBgToken: '--tol-dark-6',
    darkBgHover: '#0077BB',
  },
  {
    accent: 'green',
    lightFg: '#006644',
    lightFgToken: '--tol-dark-5',
    lightFgHover: '#117733',
    lightBg: '#BBDDBB',
    lightBgToken: '--tol-pale-2',
    lightBgHover: '#44BB99',
    darkFg: '#44BB99',
    darkFgToken: '--tol-light-mint',
    darkFgHover: '#BBDDBB',
    darkBg: '#006644',
    darkBgToken: '--tol-dark-5',
    darkBgHover: '#228833',
  },
  {
    accent: 'yellow',
    lightFg: '#775500',
    lightFgToken: '--tol-dark-9',
    lightFgHover: '#662506',
    lightBg: '#EEEEBB',
    lightBgToken: '--tol-pale-3',
    lightBgHover: '#DDAA33',
    darkFg: '#DDAA33',
    darkFgToken: '--tol-hc-yellow',
    darkFgHover: '#EEEEBB',
    darkBg: '#775500',
    darkBgToken: '--tol-dark-9',
    darkBgHover: '#993404',
  },
  {
    accent: 'red',
    lightFg: '#CC3311',
    lightFgToken: '--tol-vibrant-red',
    lightFgHover: '#994455',
    lightBg: '#EE8866',
    lightBgToken: '--tol-light-orange',
    lightBgHover: '#EE6677',
    darkFg: '#EE6677',
    darkFgToken: '--tol-bright-red',
    darkFgHover: '#EE8866',
    darkBg: '#CC3311',
    darkBgToken: '--tol-vibrant-red',
    darkBgHover: '#CC4466',
  },
  {
    accent: 'purple',
    lightFg: '#762A83',
    lightFgToken: '--tol-prgn-0',
    lightFgHover: '#332288',
    lightBg: '#E7D4E8',
    lightBgToken: '--tol-prgn-3',
    lightBgHover: '#C2A5CF',
    darkFg: '#C2A5CF',
    darkFgToken: '--tol-prgn-2',
    darkFgHover: '#E7D4E8',
    darkBg: '#762A83',
    darkBgToken: '--tol-prgn-0',
    darkBgHover: '#AA4499',
  },
];

function badgeHtml(ratioNum) {
  return ratioNum >= 7.0
    ? '<ins title="Exceeds WCAG 2.2 AAA enhanced contrast (>= 7.0:1)"><strong>✓ AAA</strong></ins>'
    : ratioNum >= 4.5
      ? '<mark title="Meets WCAG 2.2 AA standard contrast (>= 4.5:1)"><strong>✓ AA</strong></mark>'
      : '<del title="Below WCAG 2.2 AA 4.5:1 minimum"><strong>✗ Fail</strong></del>';
}

function swatchHtml(hex) {
  return `<span aria-hidden="true" style="display:inline-block;width:0.8em;height:0.8em;margin-inline-end:0.3em;border-radius:2px;background:${hex};border:1px solid var(--pt-muted-border);vertical-align:-0.08em;"></span>`;
}

function formatScoreCell(hex, token, ratioNum, hoverHex, hoverRatioNum) {
  const ratio = ratioNum.toFixed(2);
  const hoverRatio = hoverRatioNum.toFixed(2);
  return `<div style="white-space:nowrap">${swatchHtml(hex)}<code>${hex}</code> · <strong>${ratio}:1</strong> ${badgeHtml(ratioNum)} <small>(${token})</small></div><small style="white-space:nowrap">Hover: ${swatchHtml(hoverHex)}<code>${hoverHex}</code> · <strong>${hoverRatio}:1</strong> ${badgeHtml(hoverRatioNum)}</small>`;
}

export function generateDemoHtml(fullMinCss, stats) {
  loadSnapshot();
  const rowsHtml = ACCENT_TABLE.map((row) => {
    const crLight = contrastRatio(row.lightFg, '#FFFFFF');
    const crLightHover = contrastRatio(row.lightFgHover, '#FFFFFF');
    const crLightBtn = contrastRatio('#000000', row.lightBg);
    const crLightBtnHover = contrastRatio('#000000', row.lightBgHover);
    const crDark = contrastRatio(row.darkFg, '#000000');
    const crDarkHover = contrastRatio(row.darkFgHover, '#000000');
    const crDarkBtn = contrastRatio('#FFFFFF', row.darkBg);
    const crDarkBtnHover = contrastRatio('#FFFFFF', row.darkBgHover);
    return `            <tr>
              <td><strong><code>${row.accent}</code></strong></td>
              <td>${formatScoreCell(row.lightFg, row.lightFgToken, crLight, row.lightFgHover, crLightHover)}</td>
              <td>${formatScoreCell(row.lightBg, row.lightBgToken, crLightBtn, row.lightBgHover, crLightBtnHover)}</td>
              <td>${formatScoreCell(row.darkFg, row.darkFgToken, crDark, row.darkFgHover, crDarkHover)}</td>
              <td>${formatScoreCell(row.darkBg, row.darkBgToken, crDarkBtn, row.darkBgHover, crDarkBtnHover)}</td>
            </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-accent="blue">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>picotol — Pure-CSS Semantic Framework Powered by Paul Tol Colour Schemes</title>
  <style>${fullMinCss}</style>
</head>
<body>
  <a href="#main-content" class="skip-to-content">Skip to main content</a>
  <header>
    <nav>
      <ul>
        <li><strong>picotol</strong></li>
        <li><a href="#scorecard">Scorecard</a></li>
        <li><a href="#typography">Typography</a></li>
        <li><a href="#buttons">Buttons</a></li>
        <li><a href="#forms">Forms</a></li>
        <li><a href="#tables">Tables</a></li>
        <li><a href="#components">Components</a></li>
      </ul>
      <ul>
        <li>
          <select id="accent-select" aria-label="Select Paul Tol accent hue" style="margin-bottom:0;padding-block:0.25rem;">
            <option value="blue">Accent: Blue</option>
            <option value="cyan">Accent: Cyan</option>
            <option value="green">Accent: Green</option>
            <option value="yellow">Accent: Yellow</option>
            <option value="red">Accent: Red</option>
            <option value="purple">Accent: Purple</option>
          </select>
        </li>
        <li><button type="button" id="theme-toggle" class="outline" style="padding-block:0.25rem;">Toggle theme</button></li>
      </ul>
    </nav>
  </header>

  <main id="main-content" tabindex="-1">
    <header>
      <nav aria-label="breadcrumb">
        <ul>
          <li><a href="#">kidthales</a></li>
          <li><a href="#scorecard">tol-palettes</a></li>
          <li><a href="#main-content" aria-current="page">picotol</a></li>
        </ul>
      </nav>
      <hgroup>
        <h1>picotol Semantic Kitchen Sink</h1>
        <p>100% pure modern CSS • Strictly Paul Tol colour sets • Zero Sass • LightningCSS AST-minified</p>
      </hgroup>
    </header>

    <section id="scorecard">
      <h2>1. Bundle Size &amp; WCAG 2.2 Contrast Scorecard</h2>
      <div class="grid">
        <article>
          <header><strong>Core Bundle (<code>picotol.core.min.css</code>)</strong></header>
          <p><strong>${stats.coreMinBytes} bytes</strong> (${(stats.coreMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.coreGzipBytes} B</strong> gzip)</p>
          <footer><small>Landmarks, .grid, typography, tables, forms, nav</small></footer>
        </article>
        <article>
          <header><strong>Full Bundle (<code>picotol.min.css</code>)</strong></header>
          <p><strong>${stats.fullMinBytes} bytes</strong> (${(stats.fullMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.fullGzipBytes} B</strong> gzip)</p>
          <footer><small>${((1 - stats.fullMinBytes / 83319) * 100).toFixed(1)}% smaller than upstream pico.min.css (83.3 KB)</small></footer>
        </article>
      </div>
      <p><small><strong>How to read contrast ratios:</strong> Luminance contrast ranges from <code>1:1</code> (invisible) to <code>21:1</code> (pure black on white). <ins><strong>✓ AAA</strong></ins> (<code>&ge; 7.0:1</code>) is the highest W3C tier (enhanced low-vision legibility); <mark><strong>✓ AA</strong></mark> (<code>&ge; 4.5:1</code>) is the standard pass threshold for normal body text and UI controls.</small></p>
      <div id="tables" class="overflow-auto">
        <table class="striped">
          <thead>
            <tr>
              <th>Accent (<code>[data-accent]</code>)</th>
              <th>Light Link / Primary vs <code>#FFF</code></th>
              <th>Light Button Fill vs <code>#000</code></th>
              <th>Dark Link / Primary vs <code>#000</code></th>
              <th>Dark Button Fill vs <code>#FFF</code></th>
            </tr>
          </thead>
          <tbody>
${rowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <hr>

    <section id="typography">
      <h2>2. Typography &amp; Inline Semantics</h2>
      <p class="measure">Body copy uses the system font stack with fluid root sizing via <code>clamp(100%, 95% + 0.4vw, 125%)</code> and an opt-in <code>75ch</code> reading measure via <code>:where(.measure, .prose)</code>. Links like <a href="#typography">primary link</a>, <a href="#typography" class="secondary">secondary link</a>, <a href="#typography" class="contrast">contrast link</a>, and <a href="https://github.com/kidthales/tol-palettes" target="_blank" rel="noopener noreferrer">external link<span class="sr-only"> (opens in a new tab)</span></a> step along Paul Tol's qualitative lightness ladder on hover.</p>
      <p>Inline elements include <strong>strong</strong>, <em>emphasis</em>, <mark>highlighted mark</mark>, <ins>inserted text</ins>, <del>deleted text</del>, <code>inline code</code>, <kbd>Ctrl + K</kbd>, and <abbr title="Paul Tol Colour Schemes">PTCS</abbr> (<span data-tooltip="Pure CSS tooltip via [data-tooltip]" aria-label="hover or focus for tooltip: Pure CSS tooltip via [data-tooltip]" tabindex="0">hover or focus for tooltip</span>).</p>
      <blockquote>
        "The contrast ratio between each colour in the dark scheme and white is at least 4.5 for people with moderately low vision."
        <footer>— <cite>Paul Tol, SRON Notes on Colour Schemes</cite></footer>
      </blockquote>
      <div class="grid">
        <div>
          <h3>Unordered List</h3>
          <ul>
            <li>Qualitative schemes: Bright, High-Contrast, Vibrant, Muted</li>
            <li>Cell-highlight schemes: Pale and Light</li>
            <li>Text &amp; line scheme: Dark</li>
          </ul>
        </div>
        <div>
          <h3>Preformatted Code</h3>
          <pre><code>:root {
  color-scheme: light dark;
  --pt-bg: light-dark(var(--tol-white), var(--tol-black));
}</code></pre>
        </div>
      </div>
    </section>

    <hr>

    <section id="buttons">
      <h2>3. Buttons &amp; Role Variants</h2>
      <p>
        <button type="button">Primary</button>
        <button type="button" class="secondary">Secondary</button>
        <button type="button" class="contrast">Contrast</button>
        <button type="button" disabled>Disabled</button>
      </p>
      <p>
        <button type="button" class="outline">Primary Outline</button>
        <button type="button" class="outline secondary">Secondary Outline</button>
        <button type="button" class="outline contrast">Contrast Outline</button>
        <button type="button" aria-busy="true">Loading</button>
      </p>
    </section>

    <hr>

    <section id="forms">
      <h2>4. Semantic Forms &amp; Validation States</h2>
      <form onsubmit="event.preventDefault()">
        <div class="grid">
          <label>
            Project Name
            <input type="text" placeholder="picotol" required>
          </label>
          <label>
            Scheme Family
            <select>
              <option>Qualitative (Bright / Pale / Dark)</option>
              <option>Diverging (Sunset / Nightfall)</option>
              <option>Sequential (Iridescent / YlOrBr)</option>
            </select>
          </label>
        </div>
        <div class="grid">
          <div>
            <label for="valid-input">Verified Input (<code>aria-invalid="false"</code>)</label>
            <input id="valid-input" type="text" value="#4477AA" aria-invalid="false" aria-describedby="valid-help">
            <small id="valid-help">Matches Paul Tol Bright Blue.</small>
          </div>
          <div>
            <label for="invalid-input">Invalid Input (<code>aria-invalid="true"</code>)</label>
            <input id="invalid-input" type="text" value="#123456" aria-invalid="true" aria-describedby="invalid-help">
            <small id="invalid-help">Hex literal is not in tol-palettes.</small>
          </div>
        </div>
        <fieldset>
          <legend>Preferences &amp; Controls</legend>
          <label><input type="checkbox" checked> Enforce Hex Purity</label>
          <label><input type="checkbox" role="switch" checked> Enable Dark Mode Sync</label>
          <label><input type="radio" name="tier" checked> Core Bundle</label>
          <label><input type="radio" name="tier"> Full Bundle</label>
        </fieldset>
        <label>
          Contrast Threshold Range
          <input type="range" min="1" max="21" value="7">
        </label>
        <div role="search">
          <input type="search" placeholder="Search Paul Tol tokens...">
          <button type="submit">Search</button>
        </div>
      </form>
    </section>

    <hr>

    <section id="components">
      <h2>5. Extended Components</h2>
      <div class="grid">
        <div>
          <details open>
            <summary>Accordion: Why drop Sass/SCSS?</summary>
            <p>Modern Baseline CSS provides <code>light-dark()</code>, <code>color-mix()</code>, <code>clamp()</code>, and <code>@layer</code> natively, eliminating 3x duplicated variable blocks and shrinking the stylesheet by over 85%.</p>
          </details>
          <details>
            <summary>Accordion: Strict Paul Tol Lightness Ladder</summary>
            <p>All solid UI states step across <code>pale</code>, <code>light</code>, <code>medium-contrast</code>, <code>bright</code>, <code>dark</code>, and <code>high-contrast</code> schemes.</p>
          </details>
        </div>
        <div>
          <p><strong>Progress Indicator</strong></p>
          <progress value="85" max="100"></progress>
          <p><strong>Dropdown Menu &amp; Modal Dialog</strong></p>
          <div class="grid">
            <details class="dropdown">
              <summary>Select Scheme</summary>
              <ul>
                <li><a href="#components">Bright (7 colours)</a></li>
                <li><a href="#components">High-Contrast (3 colours)</a></li>
                <li><a href="#components">Pale (7 colours)</a></li>
              </ul>
            </details>
            <button type="button" class="secondary" onclick="document.getElementById('demo-modal').showModal()">Open Modal</button>
          </div>
        </div>
      </div>
      <dialog id="demo-modal" aria-labelledby="modal-title">
        <article>
          <header>
            <strong id="modal-title">Paul Tol Colour Verification Modal</strong>
            <button type="button" aria-label="Close" class="close" onclick="document.getElementById('demo-modal').close()"></button>
          </header>
          <p>This native HTML5 <code>&lt;dialog&gt;</code> element is styled purely with <code>picotol.min.css</code>.</p>
          <footer>
            <button type="button" onclick="document.getElementById('demo-modal').close()">Close</button>
          </footer>
        </article>
      </dialog>
    </section>

    <hr>

    <section id="dashboard">
      <h2>6. Dashboard Fixtures, Tabs, Badges &amp; Universal Icons</h2>

      <!-- Accessible Tabs -->
      <nav role="tablist">
        <button type="button" role="tab" aria-selected="true">Overview</button>
        <button type="button" role="tab" aria-selected="false">Analytics</button>
        <button type="button" role="tab" aria-selected="false">Reports</button>
      </nav>

      <!-- Segmented Pill Tabs -->
      <div role="tablist" class="segmented">
        <button type="button" role="tab" aria-selected="true">Daily</button>
        <button type="button" role="tab" aria-selected="false">Weekly</button>
        <button type="button" role="tab" aria-selected="false">Monthly</button>
      </div>

      <!-- KPI Stat Cards -->
      <div class="grid" style="margin-top: 1rem;">
        <article class="stat">
          <small>Total Revenue</small>
          <strong>$128,430</strong>
          <footer>
            <span class="badge valid">
              <svg class="icon" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
              +14.2%
            </span>
            vs last month
          </footer>
        </article>
        <article class="stat">
          <small>Active Users</small>
          <strong>24,512</strong>
          <footer>
            <span class="badge valid">
              <svg class="icon" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
              +3.8%
            </span>
            vs last month
          </footer>
        </article>
        <article class="stat">
          <small>Conversion Rate</small>
          <strong>3.64%</strong>
          <footer>
            <span class="badge invalid">
              <svg class="icon" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
              -0.42%
            </span>
            vs last month
          </footer>
        </article>
        <article class="stat">
          <small>Avg Session Duration</small>
          <div class="skeleton" style="height: 2.2rem; margin-block: 0.25rem;"></div>
          <footer>
            <span class="skeleton" style="width: 60%; height: 1rem;"></span>
          </footer>
        </article>
      </div>

      <!-- Semantic Callouts -->
      <aside>
        <p><strong>Neutral Callout:</strong> Default informational callouts use neutral borders and text, decoupled from the theme accent.</p>
      </aside>
      <aside class="primary">
        <p><strong>Primary Callout:</strong> Explicit opt-in styling via <code>.primary</code> or <code>[data-accent]</code>.</p>
      </aside>
      <aside class="success">
        <p><strong>Audit Passed:</strong> 100% Paul Tol color-blind accessible hex purity across all components.</p>
      </aside>
      <aside role="alert">
        <p><strong>High Severity Alert:</strong> 3 login attempts throttled from unverified subnet.</p>
      </aside>

      <!-- Status Badges & Universal Icons in Action -->
      <p>
        <span class="badge">Neutral Badge</span>
        <span class="badge primary">Primary Accent</span>
        <span class="badge valid">Active</span>
        <span class="badge invalid">Failed</span>
        <span class="badge" data-accent="purple">Purple Accent</span>
      </p>

      <p>
        <button type="button">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Info Action
        </button>
        <button type="button" class="outline">
          <svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button type="button" aria-label="Settings">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </p>
    </section>
  </main>

  <footer>
    <small><strong>picotol</strong> • MIT License • Colour values from Paul Tol (3-clause BSD) via <code>tol-palettes</code>.</small>
  </footer>

  <script>
    const root = document.documentElement;
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const cur = root.getAttribute('data-theme');
      const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    });
    document.getElementById('accent-select').addEventListener('change', (e) => {
      root.setAttribute('data-accent', e.target.value);
    });
  </script>
</body>
</html>
`;
}
