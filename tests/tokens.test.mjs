// Unit tests for tests/helpers/tokens.mjs CSS token parser and resolvers.
// All literal hex assertions in this file run exclusively against inline fixture CSS
// so legitimate palette updates in data/tol-qualitative.json cannot break parser unit tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  expandHex,
  relativeLuminance,
  mixSrgb,
  stripCssComments,
  schemeColor,
  achromaticColor,
  parseLightDark,
  parseVarCall,
  parseCssBlock,
  parseTokens,
  getPicotolTokens,
} from './helpers/tokens.mjs';

test('parseLightDark: parses light and dark values correctly and handles edge cases', () => {
  assert.deepEqual(parseLightDark('light-dark(#FFFFFF, #000000)'), {
    light: '#FFFFFF',
    dark: '#000000',
  });

  // Nested var() expressions
  assert.deepEqual(parseLightDark('light-dark(var(--pt-p1), var(--pt-p4))'), {
    light: 'var(--pt-p1)',
    dark: 'var(--pt-p4)',
  });

  // Nested light-dark or parentheses inside fallback
  assert.deepEqual(parseLightDark('light-dark(var(--a, rgb(0, 0, 0)), #111)'), {
    light: 'var(--a, rgb(0, 0, 0))',
    dark: '#111',
  });

  // Invalid format returns null
  assert.equal(parseLightDark('color-mix(in srgb, #fff, #000)'), null);
  assert.equal(parseLightDark('light-dark(#fff)'), null);
});

test('parseVarCall: parses variable names and complex fallbacks with balanced parentheses', () => {
  assert.deepEqual(parseVarCall('var(--pt-brand)'), {
    name: '--pt-brand',
    fallback: null,
  });

  assert.deepEqual(parseVarCall('var(--pt-brand, #4477AA)'), {
    name: '--pt-brand',
    fallback: '#4477AA',
  });

  // Nested var call inside fallback
  assert.deepEqual(parseVarCall('var(--pt-primary, var(--pt-fallback, #2255AA))'), {
    name: '--pt-primary',
    fallback: 'var(--pt-fallback, #2255AA)',
  });
});

test('parseTokens: isolates accents without root pollution on fixture CSS and resolves getPicotolTokens() dynamically', () => {
  const fixtureCss = `
    @layer tokens {
      :root, :host, [data-accent="blue"] {
        --pt-p3: #47a;
      }
      [data-accent="cyan"] {
        --pt-p3: #0077BB;
      }
      [data-accent="purple"] {
        --pt-p3: #AA4499;
      }
      [data-accent="magenta"] {
        --pt-p3: #BB4488;
      }
    }
    @layer reset {
      * { box-sizing: border-box; }
    }
    @layer base {
      body { margin: 0; }
    }
  `;
  const tokens = parseTokens(fixtureCss);

  // Blue default accent expands 3-digit #47a to 6-digit #4477AA
  assert.equal(tokens.getToken('--pt-p3', 'light', 'blue'), '#4477AA');
  assert.equal(tokens.getToken('--pt-p3', 'dark', 'blue'), '#4477AA');

  // Cyan, purple, and magenta resolve to their isolated accent maps
  assert.equal(tokens.getToken('--pt-p3', 'light', 'cyan'), '#0077BB');
  assert.equal(tokens.getToken('--pt-p3', 'light', 'purple'), '#AA4499');
  assert.equal(tokens.getToken('--pt-p3', 'light', 'magenta'), '#BB4488');

  // Verify that rootDecls retains the blue default and is not overwritten by subsequent [data-accent] rules
  assert.equal(expandHex(tokens.rootDecls['--pt-p3']), '#4477AA');

  // Verify live dist/picotol.css integration via getPicotolTokens() using dynamic schemeColor lookups (zero literal hexes)
  const liveTokens = getPicotolTokens();

  // Blue accent ladder (--pt-p1..--pt-p5)
  assert.equal(liveTokens.getToken('--pt-p1', 'light', 'blue'), schemeColor('pale', 0));
  assert.equal(liveTokens.getToken('--pt-p2', 'light', 'blue'), schemeColor('light', 'light_blue'));
  assert.equal(liveTokens.getToken('--pt-p3', 'light', 'blue'), schemeColor('bright', 'blue'));
  assert.equal(liveTokens.getToken('--pt-p4', 'light', 'blue'), schemeColor('dark', 3));
  assert.equal(liveTokens.getToken('--pt-p5', 'light', 'blue'), schemeColor('high-contrast', 'blue'));

  // Cyan accent ladder (--pt-p1..--pt-p5)
  assert.equal(liveTokens.getToken('--pt-p1', 'light', 'cyan'), schemeColor('pale', 1));
  assert.equal(liveTokens.getToken('--pt-p2', 'light', 'cyan'), schemeColor('light', 'light_cyan'));
  assert.equal(liveTokens.getToken('--pt-p3', 'light', 'cyan'), schemeColor('vibrant', 'blue'));
  assert.equal(liveTokens.getToken('--pt-p4', 'light', 'cyan'), schemeColor('dark', 6));
  assert.equal(liveTokens.getToken('--pt-p5', 'light', 'cyan'), schemeColor('high-contrast', 'blue'));

  // Purple accent ladder (--pt-p1..--pt-p5)
  assert.equal(liveTokens.getToken('--pt-p1', 'light', 'purple'), schemeColor('prgn', 3));
  assert.equal(liveTokens.getToken('--pt-p2', 'light', 'purple'), schemeColor('prgn', 2));
  assert.equal(liveTokens.getToken('--pt-p3', 'light', 'purple'), schemeColor('muted', 'purple'));
  assert.equal(liveTokens.getToken('--pt-p4', 'light', 'purple'), schemeColor('prgn', 0));
  assert.equal(liveTokens.getToken('--pt-p5', 'light', 'purple'), schemeColor('muted', 'indigo'));

  // Magenta accent ladder (--pt-p1..--pt-p5)
  assert.equal(liveTokens.getToken('--pt-p1', 'light', 'magenta'), schemeColor('pale', 5));
  assert.equal(liveTokens.getToken('--pt-p2', 'light', 'magenta'), schemeColor('light', 'pink'));
  assert.equal(liveTokens.getToken('--pt-p3', 'light', 'magenta'), schemeColor('dark', 8));
  assert.equal(liveTokens.getToken('--pt-p4', 'light', 'magenta'), schemeColor('dark', 4));
  assert.equal(liveTokens.getToken('--pt-p5', 'light', 'magenta'), schemeColor('muted', 'wine'));

  // Dead severity tokens removed in Issue #213 (B5)
  assert.equal(liveTokens.rootDecls['--pt-red'], undefined);
  assert.equal(liveTokens.rootDecls['--pt-yellow'], undefined);
  assert.equal(liveTokens.rootDecls['--pt-cyan'], undefined);

  // Canonical semantic status tokens (light + dark)

  assert.equal(liveTokens.getToken('--pt-valid', 'light'), schemeColor('dark', 5));
  assert.equal(liveTokens.getToken('--pt-valid', 'dark'), schemeColor('light', 'mint'));
  assert.equal(liveTokens.getToken('--pt-warning', 'light'), schemeColor('dark', 9));
  assert.equal(liveTokens.getToken('--pt-warning', 'dark'), schemeColor('light', 'light_yellow'));
  assert.equal(liveTokens.getToken('--pt-invalid', 'light'), schemeColor('vibrant', 'red'));
  assert.equal(liveTokens.getToken('--pt-invalid', 'dark'), schemeColor('bright', 'red'));
  assert.equal(liveTokens.getToken('--pt-mark-bg', 'light'), schemeColor('pale', 3));
  assert.equal(liveTokens.getToken('--pt-mark-bg', 'dark'), schemeColor('dark', 9));

  assert.equal(liveTokens.getToken('--pt-status-ok-fg', 'light'), schemeColor('bright', 'green'));
  assert.equal(liveTokens.getToken('--pt-status-ok-fg', 'dark'), schemeColor('muted', 'teal'));
  assert.equal(liveTokens.getToken('--pt-status-ok-border', 'light'), schemeColor('bright', 'green'));
  assert.equal(liveTokens.getToken('--pt-status-ok-border', 'dark'), schemeColor('muted', 'teal'));

  assert.equal(liveTokens.getToken('--pt-status-warning-fg', 'light'), schemeColor('ylorbr', 1));
  assert.equal(liveTokens.getToken('--pt-status-warning-fg', 'dark'), schemeColor('high-contrast', 'yellow'));
  assert.equal(liveTokens.getToken('--pt-status-warning-border', 'light'), schemeColor('high-contrast', 'yellow'));
  assert.equal(liveTokens.getToken('--pt-status-warning-border', 'dark'), schemeColor('light', 'orange'));

  assert.equal(liveTokens.getToken('--pt-status-critical-fg', 'light'), schemeColor('vibrant', 'red'));
  assert.equal(liveTokens.getToken('--pt-status-critical-fg', 'dark'), schemeColor('bright', 'red'));
  assert.equal(liveTokens.getToken('--pt-status-critical-border', 'light'), schemeColor('vibrant', 'red'));
  assert.equal(liveTokens.getToken('--pt-status-critical-border', 'dark'), schemeColor('bright', 'red'));

  assert.equal(liveTokens.getToken('--pt-status-info-fg', 'light'), schemeColor('bright', 'blue'));
  assert.equal(liveTokens.getToken('--pt-status-info-fg', 'dark'), schemeColor('bright', 'cyan'));
  assert.equal(liveTokens.getToken('--pt-status-info-border', 'light'), schemeColor('bright', 'blue'));
  assert.equal(liveTokens.getToken('--pt-status-info-border', 'dark'), schemeColor('bright', 'cyan'));

  // Each callout variant (default, ok, critical, warning, info) must define its own --pt-callout-border
  for (const variant of ['default', 'ok', 'critical', 'warning', 'info']) {
    assert.ok(
      Object.hasOwn(liveTokens.calloutDecls[variant], '--pt-callout-border'),
      `Callout variant "${variant}" must explicitly define --pt-callout-border`
    );
  }
  assert.equal(liveTokens.getCalloutToken('--pt-callout-border', 'light', 'default'), achromaticColor('grey-500'));
  assert.equal(liveTokens.getCalloutToken('--pt-callout-border', 'light', 'ok'), schemeColor('bright', 'green'));
  assert.equal(liveTokens.getCalloutToken('--pt-callout-border', 'light', 'critical'), schemeColor('vibrant', 'red'));
  assert.equal(liveTokens.getCalloutToken('--pt-callout-border', 'light', 'warning'), schemeColor('high-contrast', 'yellow'));
  assert.equal(liveTokens.getCalloutToken('--pt-callout-border', 'light', 'info'), schemeColor('bright', 'blue'));
});

test('parseTokens: getToken and getSecondaryToken throw readable errors on missing tokens without root fallback', () => {
  const css = `
    @layer tokens {
      :root {
        --pt-p1: #AACCEE;
        --pt-surface: light-dark(#DDDDDD, #444444);
        --pt-dangling: var(--pt-does-not-exist);
      }
    }
    @layer reset {
      * { box-sizing: border-box; }
    }
    @layer base {
      :where(.secondary, [type="reset"]) {
        --pt-primary-bg: var(--pt-surface);
        &:hover {
          opacity: 0.9;
        }
      }
    }
  `;

  const tokens = parseTokens(css);

  // Missing token in getToken throws "Token X not found"
  assert.throws(
    () => tokens.getToken('--pt-missing'),
    /Token --pt-missing not found/
  );

  // Dangling var() reference throws "Token X not found"
  assert.throws(
    () => tokens.getToken('--pt-dangling'),
    /Token --pt-does-not-exist not found/
  );

  // Secondary rule with nested &:hover block still extracts --pt-primary-bg
  assert.equal(tokens.getSecondaryToken('--pt-primary-bg', 'light'), '#DDDDDD');
  assert.equal(tokens.getSecondaryToken('--pt-primary-bg', 'dark'), '#444444');

  // Missing secondary token throws instead of falling back to rootDecls['--pt-p1']
  assert.throws(
    () => tokens.getSecondaryToken('--pt-p1', 'light'),
    /Token --pt-p1 not found in secondaryDecls/
  );

  // Missing accent ladder token (--pt-p1..--pt-p5) in an accent block throws instead of falling back to root/blue
  const partialAccentCss = `
    @layer tokens {
      :root, :host, [data-accent="blue"] {
        --pt-p1: #AACCEE;
        --pt-p5: #004488;
      }
      :root, :host, :where([data-accent]) {
        --pt-primary-hover: light-dark(var(--pt-p5), var(--pt-p1));
      }
      [data-accent="purple"] {
        --pt-p1: #E7D4E8;
      }
    }
    @layer reset { * { box-sizing: border-box; } }
    @layer base { body { margin: 0; } }
  `;
  const partialTokens = parseTokens(partialAccentCss);
  assert.equal(partialTokens.getToken('--pt-p5', 'light', 'blue'), '#004488');
  assert.equal(partialTokens.getToken('--pt-p1', 'light', 'purple'), '#E7D4E8');
  assert.throws(
    () => partialTokens.getToken('--pt-p5', 'light', 'purple'),
    /Token --pt-p5 not found/,
    'Omitting --pt-p5 in [data-accent="purple"] must throw rather than falling back to blue/root'
  );
  assert.throws(
    () => partialTokens.getToken('--pt-primary-hover', 'light', 'purple'),
    /Token --pt-p5 not found/,
    'Resolving var(--pt-p5) for purple must also throw rather than falling back to blue/root'
  );
});

test('parseTokens: brace-depth awareness supports nested & accent rules and rejects @media / [data-theme] / state overrides in @layer tokens', () => {
  const nestedAccentCss = `
    @layer tokens {
      :root {
        &[data-accent="blue"] {
          --pt-p3: #4477AA;
        }
        &[data-accent="cyan"] {
          --pt-p3: #0077BB;
        }
      }
    }
    @layer reset {
      * { box-sizing: border-box; }
    }
    @layer base {
      body { margin: 0; }
    }
  `;

  const tokens = parseTokens(nestedAccentCss);
  assert.equal(tokens.getToken('--pt-p3', 'light', 'blue'), '#4477AA');
  assert.equal(tokens.getToken('--pt-p3', 'light', 'cyan'), '#0077BB');

  // @media wrapper with custom properties in @layer tokens must throw
  const mediaTokenCss = `
    @layer tokens {
      :root { --pt-bg: #FFFFFF; }
      @media (prefers-color-scheme: dark) {
        :root { --pt-bg: #000000; }
      }
    }
    @layer reset { * { box-sizing: border-box; } }
    @layer base { body { margin: 0; } }
  `;
  assert.throws(
    () => parseTokens(mediaTokenCss),
    /Conditional at-rule wrapper not allowed for custom properties in @layer tokens/
  );

  // [data-theme="dark"] custom property override in @layer tokens must throw
  const themeOverrideCss = `
    @layer tokens {
      :root { --pt-bg: #FFFFFF; }
      [data-theme="dark"] { --pt-bg: #000000; }
    }
    @layer reset { * { box-sizing: border-box; } }
    @layer base { body { margin: 0; } }
  `;
  assert.throws(
    () => parseTokens(themeOverrideCss),
    /Explicit \[data-theme\] token override not allowed in @layer tokens/
  );

  // :root:hover state override in @layer tokens must throw
  const stateOverrideCss = `
    @layer tokens {
      :root { --pt-bg: #FFFFFF; }
      :root:hover { --pt-bg: #000000; }
    }
    @layer reset { * { box-sizing: border-box; } }
    @layer base { body { margin: 0; } }
  `;
  assert.throws(
    () => parseTokens(stateOverrideCss),
    /Pseudo-class state override on :root\/:host not allowed in @layer tokens/
  );
});

test('parseTokens: cycle guard throws on recursive CSS custom properties', () => {
  const cyclicCss = `
    @layer tokens {
      :root {
        --pt-a: var(--pt-b);
        --pt-b: var(--pt-a);
      }
    }
    @layer reset {
      * { box-sizing: border-box; }
    }
    @layer base {
      body { margin: 0; }
    }
  `;

  const tokens = parseTokens(cyclicCss);
  assert.throws(
    () => tokens.getToken('--pt-a'),
    /Cycle detected resolving CSS variable: --pt-[ab]/
  );
});

test('parseTokens: throws if required layers (tokens, reset, base) are missing', () => {
  assert.throws(
    () => parseTokens(':root { --pt-color: #000; }'),
    /Missing @layer tokens/
  );

  assert.throws(
    () => parseTokens('@layer tokens { :root { --pt-color: #000; } }'),
    /Missing @layer reset delimiter/
  );

  assert.throws(
    () => parseTokens('@layer tokens { :root { --pt-color: #000; } } @layer reset { * { box-sizing: border-box; } }'),
    /Missing @layer base in CSS content/
  );

  // Duplicate @layer block must throw instead of silently ignoring the second block
  assert.throws(
    () =>
      parseTokens(
        '@layer tokens { :root { --pt-a: #4477AA; } } @layer tokens { :root { --pt-b: #0077BB; } } @layer reset { * { box-sizing: border-box; } } @layer base { body { margin: 0; } }'
      ),
    /Multiple @layer tokens blocks found in CSS content/
  );
});

test('parseTokens: CSS comments, /* inside strings, and unquoted url(data:...;base64,...) semicolons do not corrupt parsing', () => {
  const commentedCss = `
    /* Comment with { braces: inside; } and ; colons */
    @layer tokens {
      /* Another comment { foo: bar; } */
      :root, :host {
        --pt-str-comment: "/* inside double quotes";
        --pt-url-comment: url(https://example.com/*not-a-comment*/icon.svg);
        --pt-icon: url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=);
        --pt-bg: #FFFFFF;
        --pt-str-close: "*/";
      }
    }
    @layer reset {
      body { margin: 0; }
    }
    @layer base {
      body { margin: 0; }
    }
  `;

  const tokens = parseTokens(commentedCss);
  assert.equal(tokens.getToken('--pt-bg', 'light'), '#FFFFFF');
  assert.equal(tokens.rootDecls['--pt-str-comment'], '"/* inside double quotes"');
  assert.equal(tokens.rootDecls['--pt-url-comment'], 'url(https://example.com/*not-a-comment*/icon.svg)');
  assert.equal(tokens.rootDecls['--pt-icon'], 'url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)');
  assert.equal(
    stripCssComments('a { content: "/* keep"; /* strip */ background: url(http://x/*keep*/y); }'),
    'a { content: "/* keep";  background: url(http://x/*keep*/y); }'
  );

  const block = parseCssBlock('background: url(data:image/png;base64,AAAA); color: #4477AA;');
  assert.equal(block.declarations.background, 'url(data:image/png;base64,AAAA)');
  assert.equal(block.declarations.color, '#4477AA');
});

test('parseTokens: non-hex, transparent (#0000 / #00000000), and invalid mixSrgb inputs throw strict validation errors', () => {
  const nonHexCss = `
    @layer tokens {
      :root {
        --pt-bad: red;
        --pt-transparent-4: #0000;
        --pt-transparent-8: #00000000;
      }
    }
    @layer reset {
      body { margin: 0; }
    }
    @layer base {
      body { margin: 0; }
    }
  `;

  assert.equal(expandHex('#0000'), '#0000', 'expandHex must not turn transparent #0000 into opaque black #000000');
  assert.equal(expandHex('#00000000'), '#00000000', 'expandHex must not turn transparent #00000000 into opaque black #000000');

  const tokens = parseTokens(nonHexCss);
  assert.throws(
    () => tokens.getToken('--pt-bad'),
    /Token "--pt-bad" resolved to non-hex value/
  );
  assert.throws(
    () => tokens.getToken('--pt-transparent-4'),
    /Token "--pt-transparent-4" resolved to non-hex value/
  );
  assert.throws(
    () => tokens.getToken('--pt-transparent-8'),
    /Token "--pt-transparent-8" resolved to non-hex value/
  );
  assert.throws(
    () => relativeLuminance('#0000'),
    /Invalid 6-digit opaque hex color/
  );
  assert.throws(() => mixSrgb('#0000', 8, '#FFFFFF'), /Invalid 6-digit opaque hex color for borderHex/);
  assert.throws(() => mixSrgb('#4477AA', 8, 'transparent'), /Invalid 6-digit opaque hex color for bgHex/);
  assert.throws(() => mixSrgb('#4477AA', -1, '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
  assert.throws(() => mixSrgb('#4477AA', 101, '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
  assert.throws(() => mixSrgb('#4477AA', Number.NaN, '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
  assert.throws(() => mixSrgb('#4477AA', '8', '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
});
