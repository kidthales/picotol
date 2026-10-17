// Generates a self-contained, offline-capable interactive HTML5 kitchen-sink
// showcase of tol-css into dist/demo/index.html.
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
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
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
    lightBg: '#AACCEE',
    lightBgToken: '--tol-pale-0',
    darkFg: '#77AADD',
    darkFgToken: '--tol-light-light_blue',
    darkBg: '#2255AA',
    darkBgToken: '--tol-dark-3',
  },
  {
    accent: 'cyan',
    lightFg: '#117788',
    lightFgToken: '--tol-dark-6',
    lightBg: '#CCEEFF',
    lightBgToken: '--tol-pale-1',
    darkFg: '#66CCEE',
    darkFgToken: '--tol-bright-cyan',
    darkBg: '#117788',
    darkBgToken: '--tol-dark-6',
  },
  {
    accent: 'green',
    lightFg: '#006644',
    lightFgToken: '--tol-dark-5',
    lightBg: '#BBDDBB',
    lightBgToken: '--tol-pale-2',
    darkFg: '#44BB99',
    darkFgToken: '--tol-light-mint',
    darkBg: '#006644',
    darkBgToken: '--tol-dark-5',
  },
  {
    accent: 'yellow',
    lightFg: '#775500',
    lightFgToken: '--tol-dark-9',
    lightBg: '#EEEEBB',
    lightBgToken: '--tol-pale-3',
    darkFg: '#DDAA33',
    darkFgToken: '--tol-high-contrast-yellow',
    darkBg: '#775500',
    darkBgToken: '--tol-dark-9',
  },
  {
    accent: 'red',
    lightFg: '#993366',
    lightFgToken: '--tol-dark-4',
    lightBg: '#FFBBCC',
    lightBgToken: '--tol-pale-4',
    darkFg: '#FFAABB',
    darkFgToken: '--tol-light-pink',
    darkBg: '#993366',
    darkBgToken: '--tol-dark-4',
  },
  {
    accent: 'purple',
    lightFg: '#882288',
    lightFgToken: '--tol-dark-7',
    lightBg: '#EEBBDD',
    lightBgToken: '--tol-pale-5',
    darkFg: '#EEBBDD',
    darkFgToken: '--tol-pale-5',
    darkBg: '#882288',
    darkBgToken: '--tol-dark-7',
  },
];

export function generateDemoHtml(fullMinCss, stats) {
  loadSnapshot();
  const rowsHtml = ACCENT_TABLE.map((row) => {
    const crLight = contrastRatio(row.lightFg, '#FFFFFF').toFixed(2);
    const crDark = contrastRatio(row.darkFg, '#000000').toFixed(2);
    const crLightBtn = contrastRatio('#000000', row.lightBg).toFixed(2);
    const crDarkBtn = contrastRatio('#FFFFFF', row.darkBg).toFixed(2);
    return `            <tr>
              <td><strong><code>${row.accent}</code></strong></td>
              <td><code>${row.lightFg}</code> <small>(${row.lightFgToken})</small> — <strong>${crLight}:1</strong></td>
              <td><code>${row.lightBg}</code> <small>(${row.lightBgToken})</small> — <strong>${crLightBtn}:1</strong></td>
              <td><code>${row.darkFg}</code> <small>(${row.darkFgToken})</small> — <strong>${crDark}:1</strong></td>
              <td><code>${row.darkBg}</code> <small>(${row.darkBgToken})</small> — <strong>${crDarkBtn}:1</strong></td>
            </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-accent="blue">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>tol-css — Pure-CSS Semantic Framework Powered by Paul Tol Colour Schemes</title>
  <style>${fullMinCss}</style>
</head>
<body>
  <a href="#main-content" class="skip-to-content">Skip to main content</a>
  <header>
    <nav>
      <ul>
        <li class="brand"><strong>tol-css</strong></li>
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
        <li><button type="button" id="kt-toggle" class="outline secondary" style="padding-block:0.25rem;">[kidthales] mode</button></li>
        <li><button type="button" id="theme-toggle" class="outline" style="padding-block:0.25rem;">Toggle theme</button></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <header>
      <nav aria-label="breadcrumb">
        <ul>
          <li><a href="#">kidthales</a></li>
          <li><a href="#scorecard">tol-palettes</a></li>
          <li><a href="#main-content" aria-current="page">tol-css</a></li>
        </ul>
      </nav>
      <hgroup>
        <h1>tol-css Semantic Kitchen Sink</h1>
        <p>100% pure modern CSS • Strictly Paul Tol colour sets • Zero Sass • LightningCSS AST-minified</p>
      </hgroup>
    </header>

    <section id="scorecard">
      <h2>1. Bundle Size &amp; WCAG 2.x Contrast Scorecard</h2>
      <div class="grid">
        <article>
          <header><strong>Core Bundle (<code>tol-css.core.min.css</code>)</strong></header>
          <p><strong>${stats.coreMinBytes} bytes</strong> (${(stats.coreMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.coreGzipBytes} B</strong> gzip)</p>
          <footer><small>Landmarks, .grid, typography, tables, forms, nav</small></footer>
        </article>
        <article>
          <header><strong>Full Bundle (<code>tol-css.min.css</code>)</strong></header>
          <p><strong>${stats.fullMinBytes} bytes</strong> (${(stats.fullMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.fullGzipBytes} B</strong> gzip)</p>
          <footer><small>${((1 - stats.fullMinBytes / 83319) * 100).toFixed(1)}% smaller than upstream pico.min.css (83.3 KB)</small></footer>
        </article>
      </div>
      <div class="overflow-auto">
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
      <p>Body copy uses the system font stack with fluid root sizing via <code>clamp(100%, 95% + 0.4vw, 131.25%)</code>. Links like <a href="#typography">primary link</a>, <a href="#typography" class="secondary">secondary link</a>, and <a href="#typography" class="contrast">contrast link</a> step along Paul Tol's qualitative lightness ladder on hover.</p>
      <p>Inline elements include <strong>strong</strong>, <em>emphasis</em>, <mark>highlighted mark</mark>, <ins>inserted text</ins>, <del>deleted text</del>, <code>inline code</code>, <kbd>Ctrl + K</kbd>, and <abbr title="Paul Tol Colour Schemes">PTCS</abbr> (<span data-tooltip="Pure CSS tooltip via [data-tooltip]">hover for tooltip</span>).</p>
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
  --tc-bg: light-dark(var(--tol-white), var(--tol-black));
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
            <input type="text" placeholder="tol-css" required>
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
            <input id="valid-input" type="text" value="#4477AA" aria-invalid="false">
            <small>Matches Paul Tol Bright Blue.</small>
          </div>
          <div>
            <label for="invalid-input">Invalid Input (<code>aria-invalid="true"</code>)</label>
            <input id="invalid-input" type="text" value="#123456" aria-invalid="true">
            <small>Hex literal is not in tol-palettes.</small>
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
      <dialog id="demo-modal">
        <article>
          <header>
            <strong>Paul Tol Colour Verification Modal</strong>
          </header>
          <p>This native HTML5 <code>&lt;dialog&gt;</code> element is styled purely with <code>tol-css.min.css</code>.</p>
          <footer>
            <button type="button" onclick="document.getElementById('demo-modal').close()">Close</button>
          </footer>
        </article>
      </dialog>
    </section>
  </main>

  <footer>
    <small><strong>tol-css</strong> • MIT License • Colour values from Paul Tol (3-clause BSD) via <code>tol-palettes</code>.</small>
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
    let ktMode = false;
    document.getElementById('kt-toggle').addEventListener('click', () => {
      ktMode = !ktMode;
      root.style.setProperty('--tc-nav-prefix', ktMode ? '"["' : '""');
      root.style.setProperty('--tc-nav-suffix', ktMode ? '"]"' : '""');
      root.style.setProperty('--tc-list-style', ktMode ? 'square' : 'disc');
    });
  </script>
</body>
</html>
`;
}
