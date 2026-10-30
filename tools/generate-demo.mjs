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
    lightFgHover: '#004488',
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
  {
    accent: 'magenta',
    lightFg: '#993366',
    lightFgToken: '--tol-dark-4',
    lightFgHover: '#882255',
    lightBg: '#EEBBDD',
    lightBgToken: '--tol-pale-5',
    lightBgHover: '#FFAABB',
    darkFg: '#FFAABB',
    darkFgToken: '--tol-light-pink',
    darkFgHover: '#EEBBDD',
    darkBg: '#993366',
    darkBgToken: '--tol-dark-4',
    darkBgHover: '#BB4488',
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
  return `<span class="swatch" aria-hidden="true" style="background:${hex};"></span>`;
}

function formatScoreCell(hex, token, ratioNum, hoverHex, hoverRatioNum) {
  const ratio = ratioNum.toFixed(2);
  const hoverRatio = hoverRatioNum.toFixed(2);
  return `<div class="nowrap">${swatchHtml(hex)}<code>${hex}</code> · <strong>${ratio}:1</strong> ${badgeHtml(ratioNum)} <small>(${token})</small></div><small class="nowrap">Hover: ${swatchHtml(hoverHex)}<code>${hoverHex}</code> · <strong>${hoverRatio}:1</strong> ${badgeHtml(hoverRatioNum)}</small>`;
}

export function generateDemoHtml(fullMinCss, stats) {
  const snapshot = loadSnapshot();
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

  const QUAL_SCHEMES = [
    'bright',
    'dark',
    'high-contrast',
    'light',
    'medium-contrast',
    'muted',
    'pale',
    'vibrant',
  ];
  const PFX = {
    'bright': 'bright',
    'dark': 'dark',
    'high-contrast': 'hc',
    'light': 'light',
    'medium-contrast': 'mc',
    'muted': 'muted',
    'pale': 'pale',
    'vibrant': 'vibrant',
  };

  const swatches = [];
  const seenTokens = new Set();

  for (const sId of QUAL_SCHEMES) {
    const scheme = snapshot.schemes[sId];
    if (!scheme) continue;
    const pfx = PFX[sId];
    scheme.colors.forEach((c, idx) => {
      const key = c.name ? c.name.replace(/^light_/, '').replace(/_/g, '-') : String(idx);
      const token = `--tol-${pfx}-${key}`;
      if (seenTokens.has(token)) return;
      seenTokens.add(token);
      swatches.push({
        scheme: sId,
        name: c.name || key,
        token,
        hex: c.hex,
      });
    });
  }

  const swatchCardsHtml = swatches.map((sw) => `        <article data-swatch="true" data-search="${sw.scheme} ${sw.name} ${sw.token} ${sw.hex.toLowerCase()}" class="mb-0" style="cursor:pointer;" tabindex="0" role="button" aria-label="Copy ${sw.token} (${sw.hex}) to clipboard">
          <div style="height:3.5rem;background:${sw.hex};border-radius:var(--pt-border-radius);border:1px solid var(--pt-muted-border);margin-bottom:0.75rem;" aria-hidden="true"></div>
          <div style="display:flex;flex-direction:column;gap:0.35rem;">
            <p style="margin:0;font-size:0.95rem;"><strong><code>${sw.token}</code></strong></p>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <code style="font-size:0.85rem;">${sw.hex}</code>
              <span class="badge" style="font-size:0.75rem;">${sw.scheme}</span>
            </div>
          </div>
        </article>`).join('\n');

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
        <li><a href="#subtrees">Subtrees</a></li>
        <li><a href="#typography">Typography</a></li>
        <li><a href="#buttons">Buttons</a></li>
        <li><a href="#forms">Forms</a></li>
        <li><a href="#tables">Tables</a></li>
        <li><a href="#components">Components</a></li>
        <li><a href="#dashboard">Dashboard</a></li>
        <li><a href="#palettes">Palettes</a></li>
      </ul>
      <ul>
        <li>
          <div role="group" aria-label="Visual Accent Selector" class="mb-0">
            <button type="button" class="outline small" data-set-accent="blue" title="Blue Accent">Blue</button>
            <button type="button" class="outline small" data-set-accent="cyan" title="Cyan Accent">Cyan</button>
            <button type="button" class="outline small" data-set-accent="purple" title="Purple Accent">Purple</button>
            <button type="button" class="outline small" data-set-accent="magenta" title="Magenta Accent">Magenta</button>
          </div>
        </li>
        <li>
          <select id="accent-select" class="small mb-0" aria-label="Select Paul Tol accent hue">
            <option value="blue">Accent: Blue</option>
            <option value="cyan">Accent: Cyan</option>
            <option value="purple">Accent: Purple</option>
            <option value="magenta">Accent: Magenta</option>
          </select>
        </li>
        <li><button type="button" id="theme-toggle" class="outline small">☀️ Light</button></li>
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
          <main>
            <p><strong>${stats.coreMinBytes} bytes</strong> (${(stats.coreMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.coreGzipBytes} B</strong> gzip)</p>
          </main>
          <footer><small>Landmarks, .grid, typography, tables, forms, nav</small></footer>
        </article>
        <article>
          <header><strong>Full Bundle (<code>picotol.min.css</code>)</strong></header>
          <main>
            <p><strong>${stats.fullMinBytes} bytes</strong> (${(stats.fullMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.fullGzipBytes} B</strong> gzip)</p>
          </main>
          <footer><small>${((1 - stats.fullMinBytes / 83319) * 100).toFixed(1)}% smaller than upstream pico.min.css (83.3 KB)</small></footer>
        </article>
        <article>
          <header><strong>Layer Build (<code>picotol.layer.min.css</code>)</strong></header>
          <main>
            <p><strong>${stats.layerMinBytes} bytes</strong> (${(stats.layerMinBytes / 1024).toFixed(2)} KB minified · <strong>${stats.layerGzipBytes} B</strong> gzip)</p>
          </main>
          <footer><small>Wrapped in <code>@layer picotol { ... }</code> for cascade containment</small></footer>
        </article>
      </div>
      <aside>
        <p><strong>Host Cascade Integration (<code>@layer picotol</code>):</strong> For applications using CSS <code>@layer</code>, import the layered build to guarantee seamless token overriding without specificity conflicts:</p>
        <pre><code>@layer host, picotol, overrides;
@import "@kidthales/picotol/layer";</code></pre>
      </aside>
      <p><small><strong>How to read contrast ratios:</strong> Luminance contrast ranges from <code>1:1</code> (invisible) to <code>21:1</code> (pure black on white). <ins><strong>✓ AAA</strong></ins> (<code>&ge; 7.0:1</code>) is the highest W3C tier (enhanced low-vision legibility); <mark><strong>✓ AA</strong></mark> (<code>&ge; 4.5:1</code>) is the standard pass threshold for normal body text and UI controls.</small></p>
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

    <section id="subtrees">
      <h2>2. Concurrent Subtree Theming</h2>
      <p>Picotol provides container-level <code>[data-accent]</code> scoping without color-scheme leakage. Multiple distinct accent trees run concurrently side-by-side in isolated container scopes with distinct buttons, switches, badges, and progress indicators.</p>
      <div class="grid">
        <article data-accent="blue">
          <header><strong>Blue Subtree</strong></header>
          <p><span class="badge primary">Blue Accent</span> <span class="badge">Neutral</span></p>
          <p><button type="button">Primary</button></p>
          <p><button type="button" class="outline">Outline</button></p>
          <label><input type="checkbox" role="switch" checked> Active Switch</label>
          <progress value="65" max="100"></progress>
          <footer><small>Scoped via <code>data-accent="blue"</code></small></footer>
        </article>
        <article data-accent="cyan">
          <header><strong>Cyan Subtree</strong></header>
          <p><span class="badge primary">Cyan Accent</span> <span class="badge">Neutral</span></p>
          <p><button type="button">Primary</button></p>
          <p><button type="button" class="outline">Outline</button></p>
          <label><input type="checkbox" role="switch" checked> Active Switch</label>
          <progress value="80" max="100"></progress>
          <footer><small>Scoped via <code>data-accent="cyan"</code></small></footer>
        </article>
        <article data-accent="purple">
          <header><strong>Purple Subtree</strong></header>
          <p><span class="badge primary">Purple Accent</span> <span class="badge">Neutral</span></p>
          <p><button type="button">Primary</button></p>
          <p><button type="button" class="outline">Outline</button></p>
          <label><input type="checkbox" role="switch" checked> Active Switch</label>
          <progress value="45" max="100"></progress>
          <footer><small>Scoped via <code>data-accent="purple"</code></small></footer>
        </article>
        <article data-accent="magenta">
          <header><strong>Magenta Subtree</strong></header>
          <p><span class="badge primary">Magenta Accent</span> <span class="badge">Neutral</span></p>
          <p><button type="button">Primary</button></p>
          <p><button type="button" class="outline">Outline</button></p>
          <label><input type="checkbox" role="switch" checked> Active Switch</label>
          <progress value="90" max="100"></progress>
          <footer><small>Scoped via <code>data-accent="magenta"</code></small></footer>
        </article>
      </div>
    </section>

    <hr>

    <section id="typography">
      <h2>3. Typography &amp; Inline Semantics</h2>
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
      <h2>4. Buttons &amp; Role Variants</h2>
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
      <h3>Connected Button Group Toolbar</h3>
      <div role="group" aria-label="Document actions">
        <button type="button">Cut</button>
        <button type="button" class="outline">Copy</button>
        <button type="button" class="outline">Paste</button>
        <button type="button" class="secondary">Format</button>
      </div>
      <h3>Class Parity (.btn, .button) &amp; Compact Sizing (.small, .sm)</h3>
      <p>
        <a href="#buttons" class="btn" role="button">Link as .btn</a>
        <a href="#buttons" class="button secondary" role="button">Link as .button</a>
        <button type="button" class="btn small">Compact .btn.small</button>
        <button type="button" class="outline sm">Compact Outline .sm</button>
      </p>
      <h3>Dedicated Square Icon Buttons (<code>.btn-icon</code>, <code>.icon-btn</code>)</h3>
      <p style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn-icon" aria-label="Search" title="Search">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <button type="button" class="btn-icon secondary" aria-label="Settings" title="Settings">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
        <button type="button" class="icon-btn outline" aria-label="Refresh" title="Refresh">
          <svg class="icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        </button>
        <button type="button" class="icon-btn contrast" aria-label="Bookmark" title="Bookmark">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </button>
        <button type="button" class="btn-icon small outline secondary" aria-label="Filter (Compact)" title="Filter">
          <svg class="icon" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        </button>
      </p>
    </section>

    <hr>

    <section id="forms">
      <h2>5. Native Forms &amp; Extended Controls</h2>
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
        <div class="grid">
          <div>
            <label for="file-upload">Attachment Upload</label>
            <input id="file-upload" type="file">
          </div>
          <div>
            <label for="color-picker">Accent Color Sample</label>
            <input id="color-picker" type="color" value="#4477AA">
          </div>
        </div>
        <label for="notes-textarea">Release Notes &amp; Specification</label>
        <textarea id="notes-textarea" rows="3" placeholder="Enter changelog or design system notes..."></textarea>
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
        <div role="group" aria-label="Form Submission Controls">
          <button type="submit">Submit Form</button>
          <button type="reset" class="secondary">Reset</button>
          <button type="button" class="outline contrast">Cancel</button>
        </div>
        <div role="search">
          <input type="search" placeholder="Search Paul Tol tokens...">
          <button type="submit">Search</button>
        </div>
        <h3>Horizontal Form Row Alignment (.form-row, .inline-form)</h3>
        <div class="form-row">
          <input type="email" placeholder="user@example.com" aria-label="Email address">
          <select aria-label="Role selection">
            <option>Editor</option>
            <option>Admin</option>
            <option>Viewer</option>
          </select>
          <button type="button" class="btn">Invite User</button>
        </div>
      </form>
    </section>

    <hr>

    <section id="tables">
      <h2>6. Semantic Data Tables &amp; Operational Monitor</h2>
      <p>Data tables feature automatic tabular numeric alignment, alternating zebra stripes via <code>table.striped</code>, status dot indicators, and horizontal scrolling via responsive <code>figure:has(&gt; table)</code> and <code>.overflow-auto</code>.</p>
      <figure>
        <figcaption>Cluster Infrastructure Node Fleet Status (Production US-East)</figcaption>
        <table class="striped">
          <thead>
            <tr>
              <th scope="col">Node ID</th>
              <th scope="col">Region</th>
              <th scope="col">CPU %</th>
              <th scope="col">Memory</th>
              <th scope="col">Latency</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>edge-us-east-01</code></td>
              <td>us-east-1a</td>
              <td class="tabular-nums">24.5%</td>
              <td class="tabular-nums">3.8 / 16 GB</td>
              <td class="tabular-nums">12 ms</td>
              <td><span class="status-dot success"></span><span class="badge valid">Operational</span></td>
            </tr>
            <tr>
              <td><code>edge-us-east-02</code></td>
              <td>us-east-1b</td>
              <td class="tabular-nums">78.2%</td>
              <td class="tabular-nums">14.1 / 16 GB</td>
              <td class="tabular-nums">28 ms</td>
              <td><span class="status-dot warning"></span><span class="badge warning">Warning</span></td>
            </tr>
            <tr>
              <td><code>edge-us-east-03</code></td>
              <td>us-east-1c</td>
              <td class="tabular-nums">96.8%</td>
              <td class="tabular-nums">15.9 / 16 GB</td>
              <td class="tabular-nums">145 ms</td>
              <td><span class="status-dot danger"></span><span class="badge invalid">Critical</span></td>
            </tr>
            <tr>
              <td><code>edge-us-east-04</code></td>
              <td>us-east-1d</td>
              <td class="tabular-nums">18.0%</td>
              <td class="tabular-nums">2.4 / 16 GB</td>
              <td class="tabular-nums">9 ms</td>
              <td><span class="status-dot success"></span><span class="badge valid">Operational</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Cluster Average / Total</th>
              <td>4 Active Nodes</td>
              <td class="tabular-nums">54.4% Avg</td>
              <td class="tabular-nums">36.2 / 64 GB</td>
              <td class="tabular-nums">48 ms P95</td>
              <td><span class="status-dot info"></span><span class="badge primary">4 Monitored</span></td>
            </tr>
          </tfoot>
        </table>
      </figure>

      <h3>Table Container Utility (<code>.overflow-auto</code> / <code>.table-container</code>)</h3>
      <p>Multi-column wide tabular datasets wrapped in <code>.overflow-auto</code> or <code>.table-container</code> maintain localized horizontal scrolling without window blowouts:</p>
      <div class="overflow-auto table-container">
        <table class="striped">
          <thead>
            <tr>
              <th scope="col">Service Name</th>
              <th scope="col">Health</th>
              <th scope="col">Inbound RPS</th>
              <th scope="col">Outbound RPS</th>
              <th scope="col">Error Rate</th>
              <th scope="col">P50</th>
              <th scope="col">P99</th>
              <th scope="col">Replica Count</th>
              <th scope="col">Uptime</th>
              <th scope="col">Host Zone</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>auth-service</strong></td>
              <td><span class="status-dot success"></span>Healthy</td>
              <td class="tabular-nums">1,240 req/s</td>
              <td class="tabular-nums">1,180 req/s</td>
              <td class="tabular-nums">0.01%</td>
              <td class="tabular-nums">4.2 ms</td>
              <td class="tabular-nums">18.4 ms</td>
              <td class="tabular-nums">8 / 8</td>
              <td class="tabular-nums">99.99%</td>
              <td><code>us-east-1a</code></td>
            </tr>
            <tr>
              <td><strong>billing-gateway</strong></td>
              <td><span class="status-dot warning"></span>Degraded</td>
              <td class="tabular-nums">420 req/s</td>
              <td class="tabular-nums">390 req/s</td>
              <td class="tabular-nums">1.45%</td>
              <td class="tabular-nums">42.1 ms</td>
              <td class="tabular-nums">280.0 ms</td>
              <td class="tabular-nums">4 / 4</td>
              <td class="tabular-nums">99.82%</td>
              <td><code>us-east-1b</code></td>
            </tr>
            <tr>
              <td><strong>telemetry-pipe</strong></td>
              <td><span class="status-dot success"></span>Healthy</td>
              <td class="tabular-nums">18,500 req/s</td>
              <td class="tabular-nums">18,490 req/s</td>
              <td class="tabular-nums">0.00%</td>
              <td class="tabular-nums">1.1 ms</td>
              <td class="tabular-nums">6.8 ms</td>
              <td class="tabular-nums">16 / 16</td>
              <td class="tabular-nums">100.0%</td>
              <td><code>us-east-1c</code></td>
            </tr>
            <tr>
              <td><strong>worker-ingest</strong></td>
              <td><span class="status-dot danger"></span>Failing</td>
              <td class="tabular-nums">85 req/s</td>
              <td class="tabular-nums">12 req/s</td>
              <td class="tabular-nums">24.8%</td>
              <td class="tabular-nums">340.5 ms</td>
              <td class="tabular-nums">1,820 ms</td>
              <td class="tabular-nums">1 / 4</td>
              <td class="tabular-nums">98.12%</td>
              <td><code>us-east-1d</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <hr>

    <section id="components">
      <h2>7. Extended Components</h2>
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
          <p><strong>Slide-Over Drawers (&lt;dialog class="sheet"&gt;)</strong></p>
          <div class="grid">
            <button type="button" class="outline" onclick="document.getElementById('demo-sheet-right').showModal()">Open Right Drawer</button>
            <button type="button" class="outline" onclick="document.getElementById('demo-sheet-left').showModal()">Open Left Drawer</button>
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
      <dialog id="demo-sheet-right" class="sheet sheet-right" aria-labelledby="sheet-right-title">
        <div class="sheet-header">
          <strong id="sheet-right-title">Telemetry &amp; Audit Drawer</strong>
          <button type="button" aria-label="Close" class="close" onclick="document.getElementById('demo-sheet-right').close()"></button>
        </div>
        <div class="sheet-body">
          <p>Edge-anchored native <code>&lt;dialog class="sheet"&gt;</code> primitive with scrollable content.</p>
          <p>Features pure CSS slide transition, native <code>::backdrop</code>, and responsive full-width collapse on viewports &le; 600px.</p>
        </div>
        <div class="sheet-footer">
          <button type="button" onclick="document.getElementById('demo-sheet-right').close()">Close</button>
        </div>
      </dialog>
      <dialog id="demo-sheet-left" class="sheet sheet-left" aria-labelledby="sheet-left-title">
        <div class="sheet-header">
          <strong id="sheet-left-title">Navigation Drawer (Left)</strong>
          <button type="button" aria-label="Close" class="close" onclick="document.getElementById('demo-sheet-left').close()"></button>
        </div>
        <div class="sheet-body">
          <p>Left-docked modifier <code>&lt;dialog class="sheet sheet-left"&gt;</code> for side navigation and drawers.</p>
        </div>
        <div class="sheet-footer">
          <button type="button" onclick="document.getElementById('demo-sheet-left').close()">Close</button>
        </div>
      </dialog>
      <h3>Card Component Parity (&lt;article&gt; vs .card)</h3>
      <div class="grid">
        <article>
          <header><strong>Native &lt;article&gt; Card</strong></header>
          <main>
            <p>Semantic HTML5 article element styled automatically with zero classes.</p>
            <p><small>Features flex column layout, auto-expanding <code>&lt;main&gt;</code>, and flush auto-docking footers.</small></p>
          </main>
          <footer><small>Footer landmark (auto-docked)</small></footer>
        </article>
        <div class="card">
          <header><strong>Class Parity <code>.card</code></strong></header>
          <div class="card-body">
            <p>Generic div or section styled with <code>.card</code> for ergonomic framework interoperability.</p>
          </div>
          <footer><small>Footer landmark (auto-docked)</small></footer>
        </div>
      </div>
      <h3>Status Dots &amp; Narrow-Corridor Reflow</h3>
      <div class="grid">
        <article>
          <header><strong>Tokenized Status Dots (<code>.pt-dot</code>)</strong></header>
          <main>
            <p><span class="pt-dot pt-dot--ok"></span><strong>Operational</strong> <code>.pt-dot.pt-dot--ok</code></p>
            <p><span class="pt-dot pt-dot--warning"></span><strong>Warning</strong> <code>.pt-dot.pt-dot--warning</code></p>
            <p><span class="pt-dot pt-dot--critical"></span><strong>Critical</strong> <code>.pt-dot.pt-dot--critical</code></p>
            <p><span class="pt-dot pt-dot--info"></span><strong>Informational</strong> <code>.pt-dot.pt-dot--info</code></p>
            <p><span class="pt-dot pt-dot--critical pt-dot--pulse"></span><strong>Pulsing Alert</strong> <code>.pt-dot--pulse</code></p>
            <p><span class="pt-dot"></span><strong>Neutral Default</strong> <code>.pt-dot</code></p>
          </main>
          <footer><small>Tokenized 0.5rem primitive with wash halo and forced-colors border</small></footer>
        </article>
        <article>
          <header><strong>Paul Tol Status Dots (<code>.status-dot</code>)</strong></header>
          <main>
            <p><span class="status-dot success"></span><strong>Operational</strong> <code>.status-dot.success</code></p>
            <p><span class="status-dot warning"></span><strong>Warning</strong> <code>.status-dot.warning</code></p>
            <p><span class="status-dot danger"></span><strong>Critical</strong> <code>.status-dot.danger</code></p>
            <p><span class="status-dot info"></span><strong>Active</strong> <code>.status-dot.info</code></p>
            <p><span class="status-dot neutral"></span><strong>Neutral</strong> <code>.status-dot.neutral</code></p>
            <p><span class="status-dot idle" data-status="idle"></span><strong>Idle</strong> <code>.status-dot.idle</code></p>
          </main>
          <footer><small>WCAG 2.2 §1.4.11 contrast compliant (&ge; 3:1) with forced-colors outline</small></footer>
        </article>
        <article>
          <header><strong>Badge &amp; Dot Pairing</strong></header>
          <main>
            <p><span class="badge"><span class="status-dot success"></span> Cluster Healthy</span></p>
            <p><span class="badge warning"><span class="status-dot warning"></span> Memory Pressure</span></p>
            <p><span class="badge invalid"><span class="status-dot danger"></span> Node Offline</span></p>
            <p><span class="badge primary"><span class="status-dot info"></span> Job Running</span></p>
            <p><span class="badge"><span class="status-dot idle" data-status="idle"></span> Service Idle</span></p>
            <p style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;"><span class="status-dot success no-margin" style="flex-shrink: 0;"></span><small style="white-space: nowrap;">Flex gap layout (<code>.no-margin</code> / <code>.m-0</code>)</small></p>
          </main>
          <footer><small>Contextual inline spacing without margin compounding</small></footer>
        </article>
        <article>
          <header><strong>Narrow-Corridor Reflow (320px)</strong></header>
          <main>
            <p><small>Flex and grid children declare <code>min-width: 0</code> to prevent wide controls or long titles from blowing out containers.</small></p>
            <div class="form-row">
              <span class="status-dot success"></span>
              <input type="text" value="cluster-telemetry-node-01.us-east.internal" class="small" readonly>
              <button type="button" class="btn small">Ping</button>
            </div>
          </main>
          <footer><small>Shrinks cleanly without horizontal document overflow</small></footer>
        </article>
        <article>
          <header><strong>High-Density Flex Containment (gap: 4px)</strong></header>
          <main>
            <p><small>Child <code>section</code>, <code>article</code>, and <code>hr</code> elements automatically zero their block margins in flex and grid containers, preventing compound spacing.</small></p>
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 0.5rem; background: var(--pt-surface-subtle); border-radius: var(--pt-border-radius);">
              <div style="font-size: 0.8125rem; font-weight: 600;">Flex Shell (gap: 4px)</div>
              <section style="padding: 0.25rem 0.5rem; background: var(--pt-card-bg); border: var(--pt-border); border-radius: var(--pt-border-radius); font-size: 0.8125rem;">
                Tier 1 Section (margin-bottom: 0)
              </section>
              <hr style="border-top: 1px solid var(--pt-muted-border);">
              <article style="padding: 0.25rem 0.5rem; background: var(--pt-card-bg); border: var(--pt-border); border-radius: var(--pt-border-radius); font-size: 0.8125rem;">
                Tier 2 Card (margin-bottom: 0)
              </article>
            </div>
          </main>
          <footer><small>No vertical margin compounding; exact 4px rhythm preserved</small></footer>
        </article>
      </div>
      <h3>Compact Mode &amp; Tabular Numerics (<code>[data-density="compact"]</code> / <code>.pt-compact</code> / <code>.pt-tabular</code>)</h3>
      <div class="grid">
        <article>
          <header><strong>Standard Density</strong></header>
          <main>
            <p>Default density uses standard spacing tokens and typography scale.</p>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div>Row A Latency: <span class="pt-tabular">1,234.56 ms</span></div>
              <div>Row B Latency: <span class="pt-tabular">0,098.10 ms</span></div>
            </div>
          </main>
          <footer><small>Default <code>--pt-spacing</code> (1rem)</small></footer>
        </article>
        <article data-density="compact">
          <header><strong>Compact Mode (<code>data-density="compact"</code>)</strong></header>
          <main>
            <p>Cascading padding into inputs, buttons, tables, and grid gaps.</p>
            <table class="striped" style="margin-bottom: 0.5rem;">
              <thead><tr><th>Node</th><th>Status</th><th>P99</th></tr></thead>
              <tbody>
                <tr><td>edge-01</td><td><span class="pt-status-dot pt-status-dot-success"></span> Online</td><td class="pt-tabular">12.4ms</td></tr>
                <tr><td>edge-02</td><td><span class="pt-status-dot pt-status-dot-warning"></span> Degraded</td><td class="pt-tabular">45.8ms</td></tr>
              </tbody>
            </table>
            <div class="form-row">
              <input type="text" value="cluster-us-east" readonly>
              <button type="button" class="btn">Deploy</button>
            </div>
          </main>
          <footer><small>Cascades <code>--pt-table-cell-padding-*</code> and <code>--pt-form-element-spacing-*</code></small></footer>
        </article>
        <div class="card pt-compact">
          <header><strong>Compact Utility (<code>.pt-compact</code>)</strong></header>
          <div class="card-body">
            <p>Applied via class modifier to any container or component.</p>
            <div class="form-row">
              <input type="text" value="compact-node-01" class="small" readonly>
              <button type="button" class="btn small">Inspect</button>
            </div>
          </div>
          <footer><small>Zero margin compounding on nested sections/cards</small></footer>
        </div>
        <article data-density="tight">
          <header><strong>Tight Density (<code>data-density="tight"</code>)</strong></header>
          <main>
            <p>Ultra-compact 0.25rem spacing and micro-type for narrow embedded panels.</p>
            <div class="form-row">
              <input type="text" value="worker-01.local" readonly>
              <button type="button" class="btn">Sync</button>
            </div>
            <div class="card pt-card--dense">
              <header><strong>Nested Card (<small>&lt; 300px width</small>)</strong></header>
              <main><small>Nested cards inherit <code>min-width: 0</code> with zero scroll blowout.</small></main>
            </div>
          </main>
          <footer><small>Ultra-compact <code>--pt-spacing: 0.25rem</code></small></footer>
        </article>
        <div class="card pt-card--dense pt-tight">
          <header><strong>Dense Card Modifier (<code>.pt-card--dense</code>)</strong></header>
          <div class="card-body">
            <p>Direct card-level <code>--pt-card-padding: 0.25rem</code> modifier.</p>
            <div class="card pt-card--dense">
              <header><strong>Sub-Panel Layer</strong></header>
              <main><small>No horizontal blowout or text clipping.</small></main>
            </div>
          </div>
          <footer><small>Class-level density scoping</small></footer>
        </div>
      </div>
      <h3>Meters, Progressbars &amp; Gauge Threshold Pins (<code>.pt-progress</code> / <code>.pt-gauge-marker</code>)</h3>
      <div class="grid">
        <article>
          <header><strong>Native &lt;progress&gt; &amp; Status</strong></header>
          <main>
            <p><small>Default accent, compact height, and Paul Tol semantic modifiers.</small></p>
            <progress value="65" max="100"></progress>
            <progress value="85" max="100" class="pt-progress-success"></progress>
            <progress value="50" max="100" class="pt-progress-warning"></progress>
            <progress value="92" max="100" class="pt-progress-danger"></progress>
          </main>
          <footer><small>Native engine rendering via <code>--pt-progress-*</code> tokens</small></footer>
        </article>
        <article>
          <header><strong>Accessible Fallback (<code>.pt-progress</code>)</strong></header>
          <main>
            <p><small>Cross-webview fallback with explicit <code>role="progressbar"</code> and ARIA semantics.</small></p>
            <div class="pt-progress" role="progressbar" aria-valuenow="72" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 72%;">
              <div class="pt-progress-fill"></div>
            </div>
            <div class="pt-progress pt-progress-success" role="progressbar" aria-valuenow="94" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 94%;">
              <div class="pt-progress-fill"></div>
            </div>
            <div class="pt-progress pt-progress-warning" role="progressbar" aria-valuenow="48" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 48%;">
              <div class="pt-progress-fill"></div>
            </div>
          </main>
          <footer><small>Pure CSS variable-driven <code>--pt-progress-value</code></small></footer>
        </article>
        <article>
          <header><strong>Gauge Threshold Markers &amp; Range Bands (<code>.pt-meter</code>)</strong></header>
          <main>
            <p><small>Positioned threshold pins with canonical <code>data-placement</code>, <code>.pt-meter-label</code>, and shaded <code>.pt-meter-range</code> bands.</small></p>
            <div class="pt-meter">
              <div class="pt-meter-range ok" style="--pt-range-start: 0%; --pt-range-end: 60%;"></div>
              <div class="pt-meter-range warning" style="--pt-range-start: 60%; --pt-range-end: 85%;"></div>
              <div class="pt-meter-range critical" style="--pt-range-start: 85%; --pt-range-end: 100%;"></div>
              <div class="pt-progress" role="progressbar" aria-valuenow="78" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 78%;">
                <div class="pt-progress-fill pt-meter-fill"></div>
                <div class="pt-meter-mark" data-placement="top" style="--pt-marker-pos: 80%;"><span class="pt-meter-label">80% SLA</span></div>
              </div>
            </div>
            <div class="pt-meter" style="margin-top: 1.5rem;">
              <div class="pt-progress pt-progress-danger" role="progressbar" aria-valuenow="92" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 92%;">
                <div class="pt-progress-fill pt-meter-fill"></div>
                <div class="pt-gauge-marker pt-progress-warning" style="--marker-pos: 70%;"><span class="pt-gauge-label">70% Warn</span></div>
                <div class="pt-meter-mark critical" data-placement="bottom" style="--pt-marker-pos: 90%;"><span class="pt-meter-label" data-label>90% Crit</span></div>
              </div>
            </div>
            <div class="pt-meter" style="margin-top: 2.75rem;">
              <div class="pt-progress" role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100" style="--pt-progress-value: 65%;">
                <div class="pt-progress-fill pt-meter-fill"></div>
                <div class="pt-meter-mark pt-meter-mark--start" data-placement="top" data-align="start" style="--pt-marker-pos: 0%;"><span class="pt-meter-label">0% Min</span></div>
                <div class="pt-meter-mark" data-placement="top" style="--pt-marker-pos: 50%;"><span class="pt-meter-label">50% Mid</span></div>
                <div class="pt-meter-mark pt-meter-mark--end" data-placement="top" data-align="end" style="--pt-marker-pos: 100%;"><span class="pt-meter-label">100% Max</span></div>
              </div>
            </div>
          </main>
          <footer><small>Layered via <code>--pt-meter-*-z</code> stacking tokens, <code>data-placement="top|bottom"</code>, <code>data-align="start|end"</code> (<code>.pt-meter-mark--start|--end</code>), and <code>.pt-meter-range</code></small></footer>
        </article>
      </div>
      <h3>Accessible Callouts, Status Dots &amp; Copy Pills (<code>.pt-callout</code> / <code>.pt-copy-pill</code>)</h3>
      <div class="grid">
        <aside class="pt-callout pt-callout-critical">
          <strong>Critical Incident (#379)</strong>
          <p><span class="pt-status-dot pt-status-dot-danger pulse"></span> High-severity degradation on primary cluster node.</p>
          <p><button type="button" class="pt-copy-pill">kubectl logs pod/cluster-edge-01</button> <span class="pt-chip">p0-crit</span></p>
        </aside>
        <aside class="pt-callout pt-callout-warning">
          <strong>Capacity Warning (#360)</strong>
          <p><span class="pt-status-dot pt-status-dot-warning"></span> Memory threshold approaching 85% headroom limit.</p>
          <p><button type="button" class="pt-copy-pill">curl -X POST /api/scale</button> <span class="pt-chip">warning</span></p>
        </aside>
        <aside class="pt-callout pt-callout-info">
          <strong>Operational Notice</strong>
          <p><span class="pt-status-dot pt-status-dot-success"></span> All satellite sync nodes operational and healthy.</p>
          <p><button type="button" class="pt-copy-pill">git status --short</button> <span class="pt-chip">steady</span></p>
        </aside>
      </div>

      <h3>Native Status Badges, Indicators &amp; Triads (<code>.pt-badge</code> / <code>.pt-indicator</code>)</h3>
      <div class="grid">
        <article class="card">
          <header><strong>Status Triad Badges (<code>.pt-badge</code>)</strong></header>
          <main>
            <p><span class="pt-badge" data-status="ok"><span class="pt-status-dot ok"></span> Operational</span> <code>[data-status="ok"]</code></p>
            <p><span class="pt-badge warning"><span class="pt-status-dot warning"></span> Degraded</span> <code>.warning</code></p>
            <p><span class="pt-badge critical"><span class="pt-status-dot critical"></span> Outage</span> <code>.critical</code></p>
            <p><span class="pt-badge info"><span class="pt-status-dot info"></span> Rebalancing</span> <code>.info</code></p>
          </main>
          <footer><small>Natively bound to <code>--pt-status-*-{fg,bg,border}</code></small></footer>
        </article>
        <article class="card">
          <header><strong>Status Indicators &amp; Semantic Chips (<code>.pt-indicator</code> / <code>.pt-chip</code>)</strong></header>
          <main>
            <p><span class="pt-indicator ok">Online</span> <span class="pt-chip ok">v0.4.1</span> <code>.ok</code></p>
            <p><span class="pt-indicator warning">Pressure</span> <span class="pt-chip warning">high-load</span> <code>.warning</code></p>
            <p><span class="pt-indicator critical">Failing</span> <span class="pt-chip critical">p0-crit</span> <code>.critical</code></p>
            <p><span class="pt-indicator info">Syncing</span> <span class="pt-chip info">telemetry</span> <code>.info</code></p>
          </main>
          <footer><small>Inline-flex alignment with zero boilerplate overrides</small></footer>
        </article>
        <article class="card">
          <header><strong>Tabular Numbers &amp; Dynamic Badges (<code>.pt-badge--numeric</code>)</strong></header>
          <main>
            <p><span class="pt-badge pt-badge--numeric" data-status="ok"><span class="pt-status-dot ok"></span> 99.98%</span> Uptime SLA</p>
            <p><span class="pt-badge pt-badge--numeric warning"><span class="pt-status-dot warning"></span> 1,420 ms</span> P99 Latency</p>
            <p><span class="pt-badge pt-badge--numeric critical"><span class="pt-status-dot critical"></span> 0.042%</span> Drop Rate</p>
            <p><span class="pt-indicator pt-indicator--numeric info" id="live-indicator-count">Turn #042</span> <span class="pt-badge pt-badge--numeric info" id="live-badge-count">1,842 tok/s</span></p>
            <p style="display: flex; justify-content: space-between; align-items: center;"><code>.pt-tabular--align-end</code> <span class="pt-tabular pt-tabular--align-end">42,810 ops/sec</span></p>
          </main>
          <footer><small><code>font-variant-numeric: tabular-nums lining-nums</code> and <code>font-feature-settings: "tnum" 1</code> eliminate layout jitter</small></footer>
        </article>
      </div>

      <h3>Native Accessible Disclosures, Accordion Cards &amp; Popovers (<code>.pt-details</code> / <code>.accordion-card</code> / <code>.pt-popover</code>)</h3>
      <div class="grid">
        <article class="card accordion-card">
          <details class="pt-card-disclosure" open>
            <summary>Platform Architecture &amp; Layer Isolation</summary>
            <p>Strict five-tier nested cascade layer isolation ensures design tokens and reset styles never bleed into extended component boundaries.</p>
          </details>
          <details class="pt-card-disclosure">
            <summary>Zero-JS Keyboard &amp; Screen Reader Accessibility</summary>
            <p>Native HTML5 <code>&lt;details&gt;</code> and <code>&lt;summary&gt;</code> elements provide keyboard navigation (<code>Enter</code> / <code>Space</code>) and screen reader announcements without runtime JavaScript.</p>
          </details>
          <details class="pt-card-disclosure">
            <summary>Monotonic Greyscale Luminance Separation</summary>
            <p>Every severity tier (critical, warning, notice) is certified to maintain distinct relative luminance steps across greyscale conversions.</p>
          </details>
        </article>
        <div>
          <details class="card accordion-card pt-card-disclosure" open>
            <summary>Standalone Collapsible Card (<code>.pt-card-disclosure</code>)</summary>
            <p>Self-contained disclosure card with integrated surface styling, elevated header transition, and flush content padding.</p>
          </details>
          <div class="grid" style="margin-top: 1rem;">
            <details class="pt-popover pt-popover--start">
              <summary role="button">Action Popover (Start)</summary>
              <div class="pt-popover-content pt-popover-menu">
                <a href="#components">View Telemetry</a>
                <a href="#components">Download SRI Hash</a>
                <hr>
                <button type="button" class="pt-menu-item">Trigger Sync</button>
              </div>
            </details>
            <details class="pt-popover pt-popover--end" role="menu">
              <summary role="button" class="secondary">Options (End)</summary>
              <div class="pt-popover-content pt-popover-menu end">
                <a href="#components">Export Config</a>
                <a href="#components">Verify Contrast</a>
              </div>
            </details>
          </div>
        </div>
      </div>

      <h3>Equal-Fill Segmented Controls (<code>.segmented.segmented-fill</code> / <code>.segmented-equal</code>)</h3>
      <div class="grid">
        <div>
          <p><small>Equal distribution across items (<code>flex: 1 1 0</code>) with automatic text ellipsis on narrow containers.</small></p>
          <div role="tablist" class="segmented segmented-fill" aria-label="Equal fill view options">
            <button type="button" role="tab" aria-selected="true">Daily View</button>
            <button type="button" role="tab" aria-selected="false">Weekly View</button>
            <button type="button" role="tab" aria-selected="false">Monthly View</button>
            <button type="button" role="tab" aria-selected="false">Quarterly Long-Term</button>
          </div>
        </div>
        <div>
          <p><small>Toolbar mode switch with <code>.segmented-equal</code> alias and compact viewport resilience.</small></p>
          <nav role="tablist" class="segmented segmented-equal" aria-label="Display mode switch">
            <button type="button" role="tab" aria-selected="false">Grid</button>
            <button type="button" role="tab" aria-selected="true">List</button>
            <button type="button" role="tab" aria-selected="false">Kanban</button>
          </nav>
        </div>
      </div>
    </section>

    <hr>

    <section id="dashboard">
      <h2>8. Operational Dashboard Console</h2>
      <p>A simulated real-time operational monitor featuring accessible tabpanel switching, zero-CLS skeleton loading transitions, KPI metric stat cards, and status alerts.</p>

      <!-- View Selector and Time Period Filter -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
        <nav role="tablist" aria-label="Dashboard views" style="margin-bottom:0;border-bottom:0;">
          <button type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true">Overview</button>
          <button type="button" role="tab" id="tab-analytics" aria-controls="panel-analytics" aria-selected="false">Analytics</button>
          <button type="button" role="tab" id="tab-logs" aria-controls="panel-logs" aria-selected="false">System Logs</button>
        </nav>
        <div role="tablist" class="segmented" id="time-filter" aria-label="Time period filter">
          <button type="button" role="tab" data-period="1H" aria-selected="false">1H</button>
          <button type="button" role="tab" data-period="24H" aria-selected="true">24H</button>
          <button type="button" role="tab" data-period="7D" aria-selected="false">7D</button>
          <button type="button" role="tab" data-period="30D" aria-selected="false">30D</button>
        </div>
      </div>

      <!-- Tabpanel 1: Overview -->
      <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
        <!-- KPI Stat Cards -->
        <dl class="stats">
          <div class="stat">
            <dt>Total Network Throughput</dt>
            <dd id="stat-throughput" class="tabular-nums">1.42 TB</dd>
            <div class="trend"><span class="badge valid">+12.4%</span> vs previous period</div>
          </div>
          <div class="stat">
            <dt>Active Edge Clusters</dt>
            <dd id="stat-clusters" class="tabular-nums">128 / 130</dd>
            <div class="trend"><span class="badge primary">98.5%</span> online</div>
          </div>
          <div class="stat">
            <dt>Mean Edge Latency</dt>
            <dd id="stat-latency" class="tabular-nums">18.4 ms</dd>
            <div class="trend"><span class="badge valid">-2.1 ms</span> p95 response</div>
          </div>
          <div class="stat">
            <dt>Unresolved Error Rate</dt>
            <dd id="stat-errors" class="tabular-nums">0.012%</dd>
            <div class="trend"><span class="badge invalid">+0.003%</span> 3 throttles</div>
          </div>
        </dl>

        <div class="grid">
          <article class="stat">
            <header><strong>CPU Fleet Utilization</strong></header>
            <strong id="stat-cpu" class="tabular-nums" style="font-size:2rem;">42.8%</strong>
            <progress id="stat-cpu-progress" value="43" max="100"></progress>
            <footer><small>Calculated across 512 virtual cores</small></footer>
          </article>
          <article class="stat">
            <header><strong>Memory Allocation</strong></header>
            <strong id="stat-mem" class="tabular-nums" style="font-size:2rem;">64.2%</strong>
            <progress id="stat-mem-progress" value="64" max="100"></progress>
            <footer><small>263 GB utilized of 410 GB pool</small></footer>
          </article>
        </div>

        <aside class="valid">
          <p><strong>System Health Normal:</strong> All cluster telemetry reporting within nominal Paul Tol accessible thresholds.</p>
        </aside>
      </div>

      <!-- Tabpanel 2: Analytics -->
      <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics" hidden>
        <div class="grid">
          <article>
            <header><strong>Traffic Ingestion Pipeline</strong></header>
            <p>Ingestion pipeline telemetry streaming at <strong>48.6 MB/s</strong> across 6 regional endpoints.</p>
            <p><span class="badge valid">Healthy</span> <span class="badge" data-accent="purple">Buffering: 1.2%</span></p>
          </article>
          <article>
            <header><strong>Cache Hit Ratio</strong></header>
            <p>Edge cache hit efficiency: <strong>94.2%</strong> with zero cold-start evictions.</p>
            <progress value="94" max="100"></progress>
          </article>
        </div>
      </div>

      <!-- Tabpanel 3: System Logs -->
      <div id="panel-logs" role="tabpanel" aria-labelledby="tab-logs" hidden>
        <aside role="alert">
          <p><strong>System Log Notice:</strong> Automated failover drill completed successfully on <code>edge-us-east-03</code>.</p>
        </aside>
        <pre><code>[2026-10-19T18:20:00Z] INFO [telemetry] Heartbeat verified for 128 nodes.
[2026-10-19T18:22:15Z] WARN [ingress] High burst load detected on us-east-1c (96.8% CPU).
[2026-10-19T18:24:00Z] INFO [orchestrator] Autoscaled +4 container instances.</code></pre>
      </div>

      <!-- Status Badges & Universal Icons in Action -->
      <p>
        <span class="badge">Neutral Badge</span>
        <span class="badge primary">Primary Accent</span>
        <span class="pt-badge ok">Operational</span>
        <span class="pt-badge warning">Warning</span>
        <span class="pt-badge critical">Critical</span>
        <span class="pt-badge info">Information</span>
        <span class="badge" data-accent="purple">Purple Accent</span>
        <span class="pt-badge pt-badge--numeric ok">99.98%</span>
        <span class="pt-indicator pt-indicator--numeric info">Turn #042</span>
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

    <hr>

    <section id="palettes">
      <h2>9. Paul Tol Canonical Palette Explorer</h2>
      <p>Explore canonical color-blind safe palettes authored by Dr. Paul Tol. Click any swatch or token to copy its CSS custom property to the clipboard.</p>
      <div role="search">
        <input type="search" id="palette-search" placeholder="Search by scheme (e.g. vibrant), name (e.g. cyan), token, or hex..." aria-label="Search Paul Tol palettes">
      </div>
      <div id="palette-grid" class="grid" style="grid-template-columns:repeat(auto-fill, minmax(13rem, 1fr));gap:1rem;">
${swatchCardsHtml}
      </div>
      <p id="palette-empty" hidden>No matching Paul Tol color tokens found.</p>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </section>
  </main>

  <footer>
    <small><strong>picotol</strong> • MIT License • Colour values from Paul Tol (3-clause BSD) via <code>tol-palettes</code>.</small>
  </footer>

  <script>
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

    // Native modal backdrop click-to-close
    const modal = document.getElementById('demo-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.close();
        }
      });
    }

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

          statEls.forEach((el) => { if (el) el.classList.add('skeleton'); });

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

            statEls.forEach((el) => { if (el) el.classList.remove('skeleton'); });
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
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
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
  </script>
</body>
</html>
`;
}
