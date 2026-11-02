// Unit tests for tests/helpers/tokens.mjs CSS token parser and resolvers.
// Because this file tests the parser itself (rather than WCAG contrast rules),
// assertions intentionally compare parser output against known literal hex inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expandHex,
  parseLightDark,
  parseVarCall,
  parseTokens,
} from './helpers/tokens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

test('parseTokens: resolves blue --pt-p3 to #4477AA and isolates accents without root pollution', () => {
  const fullCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const tokens = parseTokens(fullCss);

  // Blue default accent resolves to canonical Paul Tol bright blue (#4477AA)
  assert.equal(tokens.getToken('--pt-p3', 'light', 'blue'), '#4477AA');
  assert.equal(tokens.getToken('--pt-p3', 'dark', 'blue'), '#4477AA');

  // Cyan resolves to its distinct ladder
  assert.equal(tokens.getToken('--pt-p3', 'light', 'cyan'), '#0077BB');

  // Purple resolves to its distinct ladder
  assert.equal(tokens.getToken('--pt-p3', 'light', 'purple'), '#AA4499');

  // Magenta resolves to its distinct ladder
  assert.equal(tokens.getToken('--pt-p3', 'light', 'magenta'), '#BB4488');

  // Verify that rootDecls retains the blue default and is not overwritten by cyan/purple/magenta.
  // LightningCSS may shorten #4477AA to #47a in dist/picotol.css, so expandHex normalizes it to 6-digit hex.
  assert.equal(expandHex(tokens.rootDecls['--pt-p3']), '#4477AA');
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
});

test('parseTokens: brace-depth awareness supports nested & accent rules and rejects @media / [data-theme] / state overrides in @layer tokens', () => {
  const nestedAccentCss = `
    @layer tokens {
      :root {
        --pt-p3: #4477AA;
        &[data-accent="cyan"] {
          --pt-p3: #0077BB;
        }
      }
    }
    @layer reset {
      * { box-sizing: border-box; }
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
  `;

  const tokens = parseTokens(cyclicCss);
  assert.throws(
    () => tokens.getToken('--pt-a'),
    /Cycle detected resolving CSS variable: --pt-[ab]/
  );
});

test('parseTokens: throws if required layers are missing', () => {
  assert.throws(
    () => parseTokens(':root { --pt-color: #000; }'),
    /Missing @layer tokens/
  );

  assert.throws(
    () => parseTokens('@layer tokens { :root { --pt-color: #000; } }'),
    /Missing @layer reset delimiter/
  );
});

test('parseTokens: CSS comments containing delimiters do not corrupt parsing', () => {
  const commentedCss = `
    /* Comment with { braces: inside; } and ; colons */
    @layer tokens {
      /* Another comment { foo: bar; } */
      :root, :host {
        --pt-bg: #FFFFFF;
      }
    }
    @layer reset {
      body { margin: 0; }
    }
  `;

  const tokens = parseTokens(commentedCss);
  assert.equal(tokens.getToken('--pt-bg', 'light'), '#FFFFFF');
});

test('parseTokens: non-hex resolved values throw strict validation errors in getToken', () => {
  const nonHexCss = `
    @layer tokens {
      :root {
        --pt-bad: red;
      }
    }
    @layer reset {
      body { margin: 0; }
    }
  `;

  const tokens = parseTokens(nonHexCss);
  assert.throws(
    () => tokens.getToken('--pt-bad'),
    /Token "--pt-bad" resolved to non-hex value/
  );
});
