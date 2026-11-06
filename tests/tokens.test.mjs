// Unit tests for CSS tokens, color conversions, architecture, and scheme conformance.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";

import {
  ROOT,
  getDistCss,
  getCoreCss,
  getLayerCss,
  getDistMinCss,
  getLayerMinCss,
  getSrcTokensCss,
  getSrcBaseCss,
  getSrcLayoutCss,
  getSrcComponentsCss,
  getSrcFormsCss,
  getSrcContentCss,
  getReadme,
  getDemoHtml,
} from "./helpers/fixtures.mjs";

import {
  expandHex,
  relativeLuminance,
  contrastRatio,
  mixSrgb,
  stripCssComments,
  schemeColor,
  achromaticColor,
  parseLightDark,
  parseVarCall,
  parseCssBlock,
  parseTokens,
  getPicotolTokens,
  tolData,
} from "./helpers/tokens.mjs";

import {
  lintDerivedTokenFallbacks,
  parseVarCalls,
} from "../tools/lint.mjs";

describe("Color Space Utilities and Conversions", () => {
  test("parseLightDark: parses light and dark values correctly and handles edge cases", () => {
    assert.deepEqual(parseLightDark("light-dark(#FFFFFF, #000000)"), {
      light: "#FFFFFF",
      dark: "#000000",
    });

    // Nested var() expressions
    assert.deepEqual(parseLightDark("light-dark(var(--pt-p1), var(--pt-p4))"), {
      light: "var(--pt-p1)",
      dark: "var(--pt-p4)",
    });

    // Nested light-dark or parentheses inside fallback
    assert.deepEqual(parseLightDark("light-dark(var(--a, rgb(0, 0, 0)), #111)"), {
      light: "var(--a, rgb(0, 0, 0))",
      dark: "#111",
    });

    // Invalid format returns null
    assert.equal(parseLightDark("color-mix(in srgb, #fff, #000)"), null);
    assert.equal(parseLightDark("light-dark(#fff)"), null);
  });

  test("parseVarCall: parses variable names and complex fallbacks with balanced parentheses", () => {
    assert.deepEqual(parseVarCall("var(--pt-brand)"), {
      name: "--pt-brand",
      fallback: null,
    });

    assert.deepEqual(parseVarCall("var(--pt-brand, #4477AA)"), {
      name: "--pt-brand",
      fallback: "#4477AA",
    });

    // Nested var call inside fallback
    assert.deepEqual(parseVarCall("var(--pt-primary, var(--pt-fallback, #2255AA))"), {
      name: "--pt-primary",
      fallback: "var(--pt-fallback, #2255AA)",
    });
  });
});

describe("Token Parser and CSS Extraction", () => {
  test("parseTokens: isolates accents without root pollution on fixture CSS and resolves getPicotolTokens() dynamically", () => {
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
    assert.equal(tokens.getToken("--pt-p3", "light", "blue"), "#4477AA");
    assert.equal(tokens.getToken("--pt-p3", "dark", "blue"), "#4477AA");

    // Cyan, purple, and magenta resolve to their isolated accent maps
    assert.equal(tokens.getToken("--pt-p3", "light", "cyan"), "#0077BB");
    assert.equal(tokens.getToken("--pt-p3", "light", "purple"), "#AA4499");
    assert.equal(tokens.getToken("--pt-p3", "light", "magenta"), "#BB4488");

    // Verify that rootDecls retains the blue default and is not overwritten by subsequent [data-accent] rules
    assert.equal(expandHex(tokens.rootDecls["--pt-p3"]), "#4477AA");

    // Verify live dist/picotol.css integration via getPicotolTokens() using dynamic schemeColor lookups (zero literal hexes)
    const liveTokens = getPicotolTokens();

    // Blue accent ladder (--pt-p1..--pt-p5)
    assert.equal(liveTokens.getToken("--pt-p1", "light", "blue"), schemeColor("pale", 0));
    assert.equal(liveTokens.getToken("--pt-p2", "light", "blue"), schemeColor("light", "light_blue"));
    assert.equal(liveTokens.getToken("--pt-p3", "light", "blue"), schemeColor("bright", "blue"));
    assert.equal(liveTokens.getToken("--pt-p4", "light", "blue"), schemeColor("dark", 3));
    assert.equal(liveTokens.getToken("--pt-p5", "light", "blue"), schemeColor("high-contrast", "blue"));

    // Cyan accent ladder (--pt-p1..--pt-p5)
    assert.equal(liveTokens.getToken("--pt-p1", "light", "cyan"), schemeColor("pale", 1));
    assert.equal(liveTokens.getToken("--pt-p2", "light", "cyan"), schemeColor("light", "light_cyan"));
    assert.equal(liveTokens.getToken("--pt-p3", "light", "cyan"), schemeColor("vibrant", "blue"));
    assert.equal(liveTokens.getToken("--pt-p4", "light", "cyan"), schemeColor("dark", 6));
    assert.equal(liveTokens.getToken("--pt-p5", "light", "cyan"), schemeColor("high-contrast", "blue"));

    // Purple accent ladder (--pt-p1..--pt-p5)
    assert.equal(liveTokens.getToken("--pt-p1", "light", "purple"), schemeColor("prgn", 3));
    assert.equal(liveTokens.getToken("--pt-p2", "light", "purple"), schemeColor("prgn", 2));
    assert.equal(liveTokens.getToken("--pt-p3", "light", "purple"), schemeColor("muted", "purple"));
    assert.equal(liveTokens.getToken("--pt-p4", "light", "purple"), schemeColor("prgn", 0));
    assert.equal(liveTokens.getToken("--pt-p5", "light", "purple"), schemeColor("muted", "indigo"));

    // Magenta accent ladder (--pt-p1..--pt-p5)
    assert.equal(liveTokens.getToken("--pt-p1", "light", "magenta"), schemeColor("pale", 5));
    assert.equal(liveTokens.getToken("--pt-p2", "light", "magenta"), schemeColor("light", "pink"));
    assert.equal(liveTokens.getToken("--pt-p3", "light", "magenta"), schemeColor("dark", 8));
    assert.equal(liveTokens.getToken("--pt-p4", "light", "magenta"), schemeColor("dark", 4));
    assert.equal(liveTokens.getToken("--pt-p5", "light", "magenta"), schemeColor("muted", "wine"));

    // Dead severity tokens removed in Issue #213 (B5)
    assert.equal(liveTokens.rootDecls["--pt-red"], undefined);
    assert.equal(liveTokens.rootDecls["--pt-yellow"], undefined);
    assert.equal(liveTokens.rootDecls["--pt-cyan"], undefined);

    // Canonical semantic status tokens (light + dark)
    assert.equal(liveTokens.getToken("--pt-valid", "light"), schemeColor("dark", 5));
    assert.equal(liveTokens.getToken("--pt-valid", "dark"), schemeColor("light", "mint"));
    assert.equal(liveTokens.getToken("--pt-warning", "light"), schemeColor("dark", 9));
    assert.equal(liveTokens.getToken("--pt-warning", "dark"), schemeColor("light", "light_yellow"));
    assert.equal(liveTokens.getToken("--pt-invalid", "light"), schemeColor("vibrant", "red"));
    assert.equal(liveTokens.getToken("--pt-invalid", "dark"), schemeColor("bright", "red"));
    assert.equal(liveTokens.getToken("--pt-mark-bg", "light"), schemeColor("pale", 3));
    assert.equal(liveTokens.getToken("--pt-mark-bg", "dark"), schemeColor("dark", 9));

    assert.equal(liveTokens.getToken("--pt-status-ok-fg", "light"), schemeColor("bright", "green"));
    assert.equal(liveTokens.getToken("--pt-status-ok-fg", "dark"), schemeColor("muted", "teal"));
    assert.equal(liveTokens.getToken("--pt-status-ok-border", "light"), schemeColor("bright", "green"));
    assert.equal(liveTokens.getToken("--pt-status-ok-border", "dark"), schemeColor("muted", "teal"));

    assert.equal(liveTokens.getToken("--pt-status-warning-fg", "light"), schemeColor("ylorbr", 1));
    assert.equal(liveTokens.getToken("--pt-status-warning-fg", "dark"), schemeColor("high-contrast", "yellow"));
    assert.equal(liveTokens.getToken("--pt-status-warning-border", "light"), schemeColor("high-contrast", "yellow"));
    assert.equal(liveTokens.getToken("--pt-status-warning-border", "dark"), schemeColor("light", "orange"));

    assert.equal(liveTokens.getToken("--pt-status-critical-fg", "light"), schemeColor("vibrant", "red"));
    assert.equal(liveTokens.getToken("--pt-status-critical-fg", "dark"), schemeColor("bright", "red"));
    assert.equal(liveTokens.getToken("--pt-status-critical-border", "light"), schemeColor("vibrant", "red"));
    assert.equal(liveTokens.getToken("--pt-status-critical-border", "dark"), schemeColor("bright", "red"));

    assert.equal(liveTokens.getToken("--pt-status-info-fg", "light"), schemeColor("bright", "blue"));
    assert.equal(liveTokens.getToken("--pt-status-info-fg", "dark"), schemeColor("bright", "cyan"));
    assert.equal(liveTokens.getToken("--pt-status-info-border", "light"), schemeColor("bright", "blue"));
    assert.equal(liveTokens.getToken("--pt-status-info-border", "dark"), schemeColor("bright", "cyan"));

    // Each callout variant (default, ok, critical, warning, info) must define its own --pt-callout-border
    for (const variant of ["default", "ok", "critical", "warning", "info"]) {
      assert.ok(
        Object.hasOwn(liveTokens.calloutDecls[variant], "--pt-callout-border"),
        `Callout variant "${variant}" must explicitly define --pt-callout-border`
      );
    }
    assert.equal(liveTokens.getCalloutToken("--pt-callout-border", "light", "default"), achromaticColor("grey-500"));
    assert.equal(liveTokens.getCalloutToken("--pt-callout-border", "light", "ok"), schemeColor("bright", "green"));
    assert.equal(liveTokens.getCalloutToken("--pt-callout-border", "light", "critical"), schemeColor("vibrant", "red"));
    assert.equal(liveTokens.getCalloutToken("--pt-callout-border", "light", "warning"), schemeColor("high-contrast", "yellow"));
    assert.equal(liveTokens.getCalloutToken("--pt-callout-border", "light", "info"), schemeColor("bright", "blue"));
  });

  test("parseTokens: getToken and getSecondaryToken throw readable errors on missing tokens without root fallback", () => {
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
      () => tokens.getToken("--pt-missing"),
      /Token --pt-missing not found/
    );

    // Dangling var() reference throws "Token X not found"
    assert.throws(
      () => tokens.getToken("--pt-dangling"),
      /Token --pt-does-not-exist not found/
    );

    // Secondary rule with nested &:hover block still extracts --pt-primary-bg
    assert.equal(tokens.getSecondaryToken("--pt-primary-bg", "light"), "#DDDDDD");
    assert.equal(tokens.getSecondaryToken("--pt-primary-bg", "dark"), "#444444");

    // Missing secondary token throws instead of falling back to rootDecls['--pt-p1']
    assert.throws(
      () => tokens.getSecondaryToken("--pt-p1", "light"),
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
    assert.equal(partialTokens.getToken("--pt-p5", "light", "blue"), "#004488");
    assert.equal(partialTokens.getToken("--pt-p1", "light", "purple"), "#E7D4E8");
    assert.throws(
      () => partialTokens.getToken("--pt-p5", "light", "purple"),
      /Token --pt-p5 not found/,
      'Omitting --pt-p5 in [data-accent="purple"] must throw rather than falling back to blue/root'
    );
    assert.throws(
      () => partialTokens.getToken("--pt-primary-hover", "light", "purple"),
      /Token --pt-p5 not found/,
      'Resolving var(--pt-p5) for purple must also throw rather than falling back to blue/root'
    );
  });

  test("parseTokens: brace-depth awareness supports nested & accent rules and rejects @media / [data-theme] / state overrides in @layer tokens", () => {
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
    assert.equal(tokens.getToken("--pt-p3", "light", "blue"), "#4477AA");
    assert.equal(tokens.getToken("--pt-p3", "light", "cyan"), "#0077BB");

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

  test("parseTokens: cycle guard throws on recursive CSS custom properties", () => {
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
      () => tokens.getToken("--pt-a"),
      /Cycle detected resolving CSS variable: --pt-[ab]/
    );
  });

  test("parseTokens: throws if required layers (tokens, reset, base) are missing", () => {
    assert.throws(
      () => parseTokens(":root { --pt-color: #000; }"),
      /Missing @layer tokens/
    );

    assert.throws(
      () => parseTokens("@layer tokens { :root { --pt-color: #000; } }"),
      /Missing @layer reset delimiter/
    );

    assert.throws(
      () => parseTokens("@layer tokens { :root { --pt-color: #000; } } @layer reset { * { box-sizing: border-box; } }"),
      /Missing @layer base in CSS content/
    );

    assert.throws(
      () =>
        parseTokens(
          "@layer tokens { :root { --pt-a: #4477AA; } } @layer tokens { :root { --pt-b: #0077BB; } } @layer reset { * { box-sizing: border-box; } } @layer base { body { margin: 0; } }"
        ),
      /Multiple @layer tokens blocks found in CSS content/
    );
  });

  test("parseTokens: CSS comments, /* inside strings, and unquoted url(data:...;base64,...) semicolons do not corrupt parsing", () => {
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
    assert.equal(tokens.getToken("--pt-bg", "light"), "#FFFFFF");
    assert.equal(tokens.rootDecls["--pt-str-comment"], '"/* inside double quotes"');
    assert.equal(tokens.rootDecls["--pt-url-comment"], "url(https://example.com/*not-a-comment*/icon.svg)");
    assert.equal(tokens.rootDecls["--pt-icon"], "url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)");
    assert.equal(
      stripCssComments('a { content: "/* keep"; /* strip */ background: url(http://x/*keep*/y); }'),
      'a { content: "/* keep";  background: url(http://x/*keep*/y); }'
    );

    const block = parseCssBlock("background: url(data:image/png;base64,AAAA); color: #4477AA;");
    assert.equal(block.declarations.background, "url(data:image/png;base64,AAAA)");
    assert.equal(block.declarations.color, "#4477AA");
  });

  test("parseTokens: non-hex, transparent (#0000 / #00000000), and invalid mixSrgb inputs throw strict validation errors", () => {
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

    assert.equal(expandHex("#0000"), "#0000", "expandHex must not turn transparent #0000 into opaque black #000000");
    assert.equal(expandHex("#00000000"), "#00000000", "expandHex must not turn transparent #00000000 into opaque black #000000");

    const tokens = parseTokens(nonHexCss);
    assert.throws(
      () => tokens.getToken("--pt-bad"),
      /Token "--pt-bad" resolved to non-hex value/
    );
    assert.throws(
      () => tokens.getToken("--pt-transparent-4"),
      /Token "--pt-transparent-4" resolved to non-hex value/
    );
    assert.throws(
      () => tokens.getToken("--pt-transparent-8"),
      /Token "--pt-transparent-8" resolved to non-hex value/
    );
    assert.throws(
      () => relativeLuminance("#0000"),
      /Invalid 6-digit opaque hex color/
    );
    assert.throws(() => mixSrgb("#0000", 8, "#FFFFFF"), /Invalid 6-digit opaque hex color for borderHex/);
    assert.throws(() => mixSrgb("#4477AA", 8, "transparent"), /Invalid 6-digit opaque hex color for bgHex/);
    assert.throws(() => mixSrgb("#4477AA", -1, "#FFFFFF"), /Invalid alphaPct in mixSrgb/);
    assert.throws(() => mixSrgb("#4477AA", 101, "#FFFFFF"), /Invalid alphaPct in mixSrgb/);
    assert.throws(() => mixSrgb("#4477AA", Number.NaN, "#FFFFFF"), /Invalid alphaPct in mixSrgb/);
    assert.throws(() => mixSrgb("#4477AA", "8", "#FFFFFF"), /Invalid alphaPct in mixSrgb/);
  });
});

describe("Paul Tol Hex Purity and Conformance", () => {
  test("100% Paul Tol Hex Purity: all hex colors in src/ and dist/ belong to canonical Paul Tol schemes", () => {
    const allowedHexSet = new Set(tolData.allowedHexes.map((h) => h.toUpperCase()));

    const filesToCheck = [
      ...fs.readdirSync(path.join(ROOT, "src")).map((f) => path.join(ROOT, "src", f)),
      path.join(ROOT, "dist/picotol.core.css"),
      path.join(ROOT, "dist/picotol.core.min.css"),
      path.join(ROOT, "dist/picotol.css"),
      path.join(ROOT, "dist/picotol.min.css"),
      path.join(ROOT, "dist/picotol.layer.css"),
      path.join(ROOT, "dist/picotol.layer.min.css"),
    ];

    const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");

      let match;
      while ((match = hexRegex.exec(content)) !== null) {
        const fullHex = match[0];
        let normalized = fullHex.toUpperCase();

        if (normalized.length === 4) {
          normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
        }

        if (normalized.length === 7) {
          assert.ok(
            allowedHexSet.has(normalized),
            `Disallowed non-Paul-Tol color ${fullHex} (normalized: ${normalized}) found in ${path.relative(ROOT, filePath)}`
          );
        }
      }
    }
  });
});

describe("Architecture, Cascade Layers, and Token Scoping", () => {
  test("Architecture & Selector Invariants: @layer cascade, --pt-* tokens, [data-theme], and [data-accent]", () => {
    const fullCss = getDistCss();
    const demoHtml = getDemoHtml();

    const layers = ["tokens", "reset", "base", "components", "utilities"];
    let lastIdx = -1;
    for (const layer of layers) {
      const idx = fullCss.indexOf(`@layer picotol.${layer}`);
      assert.ok(idx > lastIdx, `Expected @layer picotol.${layer} in order inside dist/picotol.css`);
      lastIdx = idx;
    }

    assert.ok(fullCss.includes("--pt-bg:"), "Must use --pt-* token namespace");
    assert.ok(!fullCss.includes("--tc-"), "Legacy --tc-* token namespace must be completely migrated");

    for (const theme of ["light", "dark"]) {
      assert.ok(fullCss.includes(`[data-theme="${theme}"]`));
    }
    for (const accent of ["blue", "cyan", "purple", "magenta"]) {
      assert.ok(fullCss.includes(`[data-accent="${accent}"]`));
    }
    for (const retired of ["green", "yellow", "red", "teal", "indigo"]) {
      assert.ok(
        !fullCss.includes(`[data-accent="${retired}"]`) && !fullCss.includes(`[data-accent=${retired}]`),
        `Retired accent ${retired} must not be present in [data-accent]`
      );
    }
    assert.ok(!demoHtml.includes("kt-toggle"), "Demo HTML must not include [kidthales] mode toggle");
    assert.ok(demoHtml.includes("picotol"), "Interactive demo HTML generated with picotol branding");
  });

  test("Secondary Button Decoupling: neutral slate ladder prevents collision with cyan and all accents", () => {
    const fullCss = getDistCss();
    const coreCss = getCoreCss();

    const secondarySelector = ':where(.secondary, [type="reset"])';
    assert.ok(fullCss.includes(secondarySelector), "Secondary selector present in dist/picotol.css");
    assert.ok(coreCss.includes(secondarySelector), "Secondary selector present in dist/picotol.core.css");

    const tokens = getPicotolTokens();
    const secondaryLadder = {
      p1: tokens.getSecondaryToken("--pt-primary-bg", "light"),
      p2: tokens.getSecondaryToken("--pt-primary-hover-bg", "light"),
      p3: tokens.getSecondaryToken("--pt-primary-hover-bg", "dark"),
      p4: tokens.getSecondaryToken("--pt-primary-bg", "dark"),
    };

    const lightText = tokens.getToken("--pt-color", "light");
    const darkText = tokens.getToken("--pt-color", "dark");

    const lightCR = contrastRatio(secondaryLadder.p1, lightText);
    const lightHoverCR = contrastRatio(secondaryLadder.p2, lightText);
    const darkCR = contrastRatio(secondaryLadder.p4, darkText);
    const darkHoverCR = contrastRatio(secondaryLadder.p3, darkText);

    assert.ok(lightCR >= 7.0);
    assert.ok(lightHoverCR >= 4.5);
    assert.ok(darkCR >= 7.0);
    assert.ok(darkHoverCR >= 4.5);
  });

  test("Semantic State Token Contrast: --pt-valid, --pt-warning, --pt-invalid, and --pt-mark-bg certify WCAG 2.2 AA", () => {
    const tokens = getPicotolTokens();
    const lightBg = tokens.getToken("--pt-bg", "light");
    const darkBg = tokens.getToken("--pt-bg", "dark");
    const lightText = tokens.getToken("--pt-color", "light");
    const darkText = tokens.getToken("--pt-color", "dark");

    const validLight = tokens.getToken("--pt-valid", "light");
    const validDark = tokens.getToken("--pt-valid", "dark");
    const warningLight = tokens.getToken("--pt-warning", "light");
    const warningDark = tokens.getToken("--pt-warning", "dark");
    const invalidLight = tokens.getToken("--pt-invalid", "light");
    const invalidDark = tokens.getToken("--pt-invalid", "dark");

    assert.ok(contrastRatio(validLight, lightBg) >= 4.5, "Valid light contrast >= 4.5:1");
    assert.ok(contrastRatio(validDark, darkBg) >= 4.5, "Valid dark contrast >= 4.5:1");
    assert.ok(contrastRatio(warningLight, lightBg) >= 4.5, "Warning light contrast >= 4.5:1");
    assert.ok(contrastRatio(warningDark, darkBg) >= 4.5, "Warning dark contrast >= 4.5:1");
    assert.ok(contrastRatio(invalidLight, lightBg) >= 4.5, "Invalid light contrast >= 4.5:1");
    assert.ok(contrastRatio(invalidDark, darkBg) >= 4.5, "Invalid dark contrast >= 4.5:1");

    const markLight = tokens.getToken("--pt-mark-bg", "light");
    const markDark = tokens.getToken("--pt-mark-bg", "dark");
    assert.ok(contrastRatio(markLight, lightText) >= 4.5, "Mark light background contrast vs text >= 4.5:1");
    assert.ok(contrastRatio(markDark, darkText) >= 4.5, "Mark dark background contrast vs text >= 4.5:1");
  });

  test("Color Scheme Scoping & Data-Accent Isolation: [data-accent] must not override inherited color-scheme", () => {
    const fullCss = getDistCss();
    const coreCss = getCoreCss();

    for (const css of [fullCss, coreCss]) {
      assert.ok(
        css.includes("color-scheme: light dark;"),
        "color-scheme: light dark must be present in tokens"
      );

      const accentRulesWithColorScheme = css.match(/\[data-accent[^}]*color-scheme/g);
      assert.equal(
        accentRulesWithColorScheme,
        null,
        "No [data-accent] selector may declare color-scheme"
      );

      assert.ok(
        css.includes(":where([data-accent])") && css.includes("--pt-primary: light-dark(var(--pt-p4), var(--pt-p2))"),
        "CSS tokens must re-declare --pt-primary under :where([data-accent]) to enable container subtree theming"
      );
    }

    const tokens = getPicotolTokens();
    const purpleP4 = tokens.getToken("--pt-p4", "light", "purple");
    const lightBg = tokens.getToken("--pt-bg", "light");
    const purpleLightCR = contrastRatio(purpleP4, lightBg);
    assert.ok(
      purpleLightCR >= 7.0,
      `Purple Light Mode primary (${purpleP4}) vs white CR=${purpleLightCR.toFixed(2)} must satisfy WCAG AAA (>= 7.0:1)`
    );
  });

  test("Consumer @layer Guide: README documents canonical 4-layer cascade architecture, host encapsulation, and token bridges", () => {
    const readme = getReadme();

    assert.ok(
      readme.includes("Using with CSS Cascade Layers"),
      "README must include 'Using with CSS Cascade Layers' section"
    );
    assert.ok(
      readme.includes("@layer reset, picotol, theme, app;"),
      "README must document canonical 4-layer cascade declaration (@layer reset, picotol, theme, app;)"
    );
    assert.ok(
      readme.includes("@layer app") && readme.includes("dashboard-card"),
      "README must include clean code snippet showing host application style encapsulation inside @layer app"
    );
    assert.ok(
      readme.includes("@layer theme") && readme.includes("--pt-primary: var(--host-brand-primary") && readme.includes("color-scheme: dark;"),
      "README must detail interaction with host CSS custom property bridges and dark/light mode toggles"
    );
    assert.ok(
      readme.includes("Body Layout Reset & Sticky Footer Integration") &&
      readme.includes("min-height: 100dvh") &&
      readme.includes("flex-direction: column"),
      "README must document body flex column layout reset, sticky footer, and host layer overrides"
    );
  });

  test("Semantic Status Tokens and Dark Mode Contrast Calibration (Issue #126)", () => {
    const tokensCss = getSrcTokensCss();
    const compCss = getSrcComponentsCss();
    const coreCss = getCoreCss();
    const fullCss = getDistCss();
    const layerCss = getLayerCss();

    const expectedTokens = [
      "--pt-status-ok-fg",
      "--pt-status-ok-border",
      "--pt-status-ok-bg",
      "--pt-status-warning-fg",
      "--pt-status-warning-border",
      "--pt-status-warning-bg",
      "--pt-status-critical-fg",
      "--pt-status-critical-border",
      "--pt-status-critical-bg",
      "--pt-status-info-fg",
      "--pt-status-info-border",
      "--pt-status-info-bg",
    ];

    for (const token of expectedTokens) {
      assert.ok(tokensCss.includes(token), `tokens.css must define ${token}`);
      assert.ok(coreCss.includes(token), `picotol.core.css must include ${token}`);
      assert.ok(fullCss.includes(token), `picotol.css must include ${token}`);
      assert.ok(layerCss.includes(token), `picotol.layer.css must include ${token}`);
    }

    const tokens = getPicotolTokens();
    assert.equal(tokens.getToken("--pt-status-ok-fg", "light"), schemeColor("bright", "green"), "OK light fg must map to Tol bright green");
    assert.equal(tokens.getToken("--pt-status-ok-fg", "dark"), schemeColor("muted", "teal"), "OK dark fg must map to Tol muted teal");
    assert.equal(tokens.getToken("--pt-status-ok-border", "light"), schemeColor("bright", "green"), "OK light border must map to Tol bright green");
    assert.equal(tokens.getToken("--pt-status-ok-border", "dark"), schemeColor("muted", "teal"), "OK dark border must map to Tol muted teal");

    assert.equal(tokens.getToken("--pt-status-warning-fg", "light"), schemeColor("ylorbr", 1), "Warning light fg must map to Tol ylorbr brown");
    assert.equal(tokens.getToken("--pt-status-warning-fg", "dark"), schemeColor("high-contrast", "yellow"), "Warning dark fg must map to Tol high-contrast yellow");
    assert.equal(tokens.getToken("--pt-status-warning-border", "light"), schemeColor("high-contrast", "yellow"), "Warning light border must map to Tol high-contrast yellow");
    assert.equal(tokens.getToken("--pt-status-warning-border", "dark"), schemeColor("light", "orange"), "Warning dark border must map to Tol light orange");

    assert.equal(tokens.getToken("--pt-status-critical-fg", "light"), schemeColor("vibrant", "red"), "Critical light fg must map to Tol vibrant red");
    assert.equal(tokens.getToken("--pt-status-critical-fg", "dark"), schemeColor("bright", "red"), "Critical dark fg must map to Tol bright red");
    assert.equal(tokens.getToken("--pt-status-critical-border", "light"), schemeColor("vibrant", "red"), "Critical light border must map to Tol vibrant red");
    assert.equal(tokens.getToken("--pt-status-critical-border", "dark"), schemeColor("bright", "red"), "Critical dark border must map to Tol bright red");

    assert.equal(tokens.getToken("--pt-status-info-fg", "light"), schemeColor("bright", "blue"), "Info light fg must map to Tol bright blue");
    assert.equal(tokens.getToken("--pt-status-info-fg", "dark"), schemeColor("bright", "cyan"), "Info dark fg must map to Tol bright cyan");
    assert.equal(tokens.getToken("--pt-status-info-border", "light"), schemeColor("bright", "blue"), "Info light border must map to Tol bright blue");
    assert.equal(tokens.getToken("--pt-status-info-border", "dark"), schemeColor("bright", "cyan"), "Info dark border must map to Tol bright cyan");

    const darkRoot = tokens.getToken("--pt-bg", "dark");
    const darkSurface = tokens.getToken("--pt-surface", "dark");
    const lightRoot = tokens.getToken("--pt-bg", "light");

    const warnFgDark = tokens.getToken("--pt-status-warning-fg", "dark");
    const warnBorderDark = tokens.getToken("--pt-status-warning-border", "dark");
    const okFgLight = tokens.getToken("--pt-status-ok-fg", "light");
    const okFgDark = tokens.getToken("--pt-status-ok-fg", "dark");
    const critFgLight = tokens.getToken("--pt-status-critical-fg", "light");
    const critFgDark = tokens.getToken("--pt-status-critical-fg", "dark");
    const infoFgLight = tokens.getToken("--pt-status-info-fg", "light");
    const infoFgDark = tokens.getToken("--pt-status-info-fg", "dark");

    const crWarnFgDarkRoot = contrastRatio(warnFgDark, darkRoot);
    const crWarnFgDarkSurface = contrastRatio(warnFgDark, darkSurface);
    assert.ok(
      crWarnFgDarkRoot >= 4.5,
      `Warning text ${warnFgDark} on dark root ${darkRoot} must be >= 4.5:1 (got ${crWarnFgDarkRoot.toFixed(2)}:1)`
    );
    assert.ok(
      crWarnFgDarkSurface >= 4.5,
      `Warning text ${warnFgDark} on dark surface ${darkSurface} must be >= 4.5:1 (got ${crWarnFgDarkSurface.toFixed(2)}:1)`
    );

    const crWarnBorderDarkRoot = contrastRatio(warnBorderDark, darkRoot);
    const crWarnBorderDarkSurface = contrastRatio(warnBorderDark, darkSurface);
    assert.ok(
      crWarnBorderDarkRoot >= 3.0,
      `Warning border ${warnBorderDark} on dark root ${darkRoot} must be >= 3.0:1 (got ${crWarnBorderDarkRoot.toFixed(2)}:1)`
    );
    assert.ok(
      crWarnBorderDarkSurface >= 3.0,
      `Warning border ${warnBorderDark} on dark surface ${darkSurface} must be >= 3.0:1 (got ${crWarnBorderDarkSurface.toFixed(2)}:1)`
    );

    const crOkLight = contrastRatio(okFgLight, lightRoot);
    assert.ok(crOkLight >= 4.5, `OK text ${okFgLight} on white must be >= 4.5:1 (got ${crOkLight.toFixed(2)}:1)`);
    const crOkDarkRoot = contrastRatio(okFgDark, darkRoot);
    const crOkDarkSurface = contrastRatio(okFgDark, darkSurface);
    assert.ok(crOkDarkRoot >= 4.5, `OK text/border ${okFgDark} on dark root must be >= 4.5:1 (got ${crOkDarkRoot.toFixed(2)}:1)`);
    assert.ok(crOkDarkSurface >= 3.0, `OK border ${okFgDark} on dark surface must be >= 3.0:1 (got ${crOkDarkSurface.toFixed(2)}:1)`);

    const crCritLight = contrastRatio(critFgLight, lightRoot);
    assert.ok(crCritLight >= 4.5, `Critical text ${critFgLight} on white must be >= 4.5:1 (got ${crCritLight.toFixed(2)}:1)`);
    const crCritDarkRoot = contrastRatio(critFgDark, darkRoot);
    const crCritDarkSurface = contrastRatio(critFgDark, darkSurface);
    assert.ok(crCritDarkRoot >= 4.5, `Critical text/border ${critFgDark} on dark root must be >= 4.5:1 (got ${crCritDarkRoot.toFixed(2)}:1)`);
    assert.ok(crCritDarkSurface >= 3.0, `Critical border ${critFgDark} on dark surface must be >= 3.0:1 (got ${crCritDarkSurface.toFixed(2)}:1)`);

    const crInfoLight = contrastRatio(infoFgLight, lightRoot);
    assert.ok(crInfoLight >= 4.5, `Info text ${infoFgLight} on white must be >= 4.5:1 (got ${crInfoLight.toFixed(2)}:1)`);
    const crInfoDarkRoot = contrastRatio(infoFgDark, darkRoot);
    const crInfoDarkSurface = contrastRatio(infoFgDark, darkSurface);
    assert.ok(crInfoDarkRoot >= 4.5, `Info text/border ${infoFgDark} on dark root must be >= 4.5:1 (got ${crInfoDarkRoot.toFixed(2)}:1)`);
    assert.ok(crInfoDarkSurface >= 4.5, `Info border ${infoFgDark} on dark surface must be >= 4.5:1 (got ${crInfoDarkSurface.toFixed(2)}:1)`);

    assert.ok(
      compCss.includes("var(--pt-status-ok-border") &&
      compCss.includes("var(--pt-status-warning-border") &&
      compCss.includes("var(--pt-status-critical-border") &&
      compCss.includes("var(--pt-status-info-border"),
      "src/components.css must wire status dots to semantic status border tokens"
    );
    assert.ok(
      fullCss.includes("var(--pt-status-ok-border") &&
      fullCss.includes("var(--pt-status-warning-border") &&
      fullCss.includes("var(--pt-status-critical-border") &&
      fullCss.includes("var(--pt-status-info-border"),
      "dist/picotol.css must include status dot semantic token wiring"
    );

    assert.ok(
      compCss.includes("var(--pt-status-ok-bg)") &&
      compCss.includes("var(--pt-status-warning-bg)") &&
      compCss.includes("var(--pt-status-critical-bg)") &&
      compCss.includes("var(--pt-status-info-bg)"),
      "src/components.css must wire callout backgrounds to semantic status bg tokens"
    );

    assert.ok(
      compCss.includes("--pt-marker-color: var(--pt-status-ok-border)") &&
      compCss.includes("--pt-marker-color: var(--pt-status-warning-border)") &&
      compCss.includes("color: var(--pt-status-warning-fg)") &&
      compCss.includes("--pt-marker-color: var(--pt-status-critical-border)") &&
      compCss.includes("--pt-marker-color: var(--pt-status-info-border)"),
      "src/components.css must wire gauge marker pins and labels to calibrated status tokens"
    );
  });

  test("Downstream CSS @layer Cascade Ordering Guide (Issue #141)", () => {
    const readme = getReadme();

    assert.ok(
      readme.includes("Downstream Cascade Layer Ordering Guide"),
      "README must include dedicated downstream cascade layer ordering guide section"
    );
    assert.ok(
      readme.includes("@layer picotol, app-theme, app-components, app-utilities;"),
      "README must document canonical downstream layer order declaration (@layer picotol, app-theme, app-components, app-utilities;)"
    );
    assert.ok(
      readme.includes("dist/picotol.layer.min.css"),
      "README must cross-reference dist/picotol.layer.min.css"
    );
    assert.ok(
      readme.includes("unlayered") && readme.includes("!important"),
      "README must explain unlayered styles precedence and !important interaction"
    );
    assert.ok(
      readme.includes('@import "@kidthales/picotol/layer"'),
      "README must provide CSS @import / @layer snippet"
    );
    assert.ok(
      readme.includes('<link rel="stylesheet"') && readme.includes('layer="app-theme"'),
      "README must provide HTML <link> snippet with layer attribute"
    );
  });

  test("Configurable Typography Floor (--pt-font-size-floor) for Compact Density (Issue #152)", () => {
    const tokensCss = getSrcTokensCss();
    const compCss = getSrcComponentsCss();
    const fullCss = getDistCss();
    const coreCss = getCoreCss();
    const fullMin = getDistMinCss();
    const layerMin = getLayerMinCss();
    const readme = getReadme();

    for (const css of [tokensCss, fullCss, coreCss]) {
      assert.ok(
        css.includes("--pt-font-size-floor: 12px;"),
        "Must define default --pt-font-size-floor: 12px; in tokens"
      );
      assert.ok(
        /--pt-font-size-xs:\s*max\(var\(--pt-font-size-floor,\s*12px\),\s*0?\.75rem\);/.test(css),
        "Must clamp --pt-font-size-xs using max(var(--pt-font-size-floor, 12px), 0.75rem)"
      );
    }

    for (const minCss of [fullMin, layerMin]) {
      assert.ok(
        minCss.includes("--pt-font-size-floor:12px;"),
        "Minified bundles must include --pt-font-size-floor:12px;"
      );
      assert.ok(
        minCss.includes("--pt-font-size-xs:max(var(--pt-font-size-floor,12px), .75rem)"),
        "Minified bundles must clamp --pt-font-size-xs"
      );
    }

    assert.ok(
      compCss.includes("font-size: var(--pt-font-size-xs, 0.75em);"),
      ".pt-badge and .pt-indicator must wire font-size to --pt-font-size-xs"
    );
    assert.ok(
      tokensCss.includes('[data-density="tight"]') && tokensCss.includes("font-size: var(--pt-font-size-xs);"),
      "[data-density=\"tight\"] must wire font-size to --pt-font-size-xs"
    );

    function resolveEffectiveFontSizeXs(rootFontSizePx, customFloorPx = null) {
      const floor = customFloorPx !== null ? customFloorPx : 12;
      const remValuePx = 0.75 * rootFontSizePx;
      return Math.max(floor, remValuePx);
    }

    assert.strictEqual(resolveEffectiveFontSizeXs(16), 12, "Standard 16px root must compute to 12px");
    assert.strictEqual(resolveEffectiveFontSizeXs(14), 12, "Constrained 14px root must clamp to 12px floor");
    assert.strictEqual(resolveEffectiveFontSizeXs(12), 12, "Ultra-compact 12px root must clamp to 12px floor");
    assert.strictEqual(resolveEffectiveFontSizeXs(10), 12, "Extreme micro 10px root must clamp to 12px floor");
    assert.strictEqual(resolveEffectiveFontSizeXs(20), 15, "Large 20px root must scale above floor to 15px");
    assert.strictEqual(resolveEffectiveFontSizeXs(14, 14), 14, "Custom 14px floor on 14px root must clamp to 14px");
    assert.strictEqual(resolveEffectiveFontSizeXs(16, 14), 14, "Custom 14px floor on 16px root must clamp to 14px");

    assert.ok(
      readme.includes("--pt-font-size-floor"),
      "README.md must document --pt-font-size-floor"
    );
    assert.ok(
      readme.includes("Configurable Typography Floor"),
      "README.md must include Configurable Typography Floor section"
    );
  });

  test("Nested @layer Taxonomy, Sublayer Preamble, and Downstream Extensibility (Issue #153)", () => {
    const layerCss = getLayerCss();
    const layerMin = getLayerMinCss();
    const fullCss = getDistCss();
    const coreCss = getCoreCss();
    const tokensCss = getSrcTokensCss();
    const baseCss = getSrcBaseCss();
    const layoutCss = getSrcLayoutCss();
    const compCss = getSrcComponentsCss();
    const readme = getReadme();

    const expectedPreamble = "@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;";
    const expectedMinPreamble = "@layer picotol.tokens,picotol.reset,picotol.base,picotol.components,picotol.utilities;";

    assert.ok(
      layerCss.includes(expectedPreamble),
      "dist/picotol.layer.css must declare nested sublayer preamble upfront"
    );
    assert.ok(
      layerMin.includes(expectedMinPreamble),
      "dist/picotol.layer.min.css must minify nested sublayer preamble upfront"
    );

    assert.ok(
      tokensCss.includes("@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;"),
      "src/tokens.css must declare 5-tier layer ordering"
    );
    let fullIdx = -1;
    for (const l of ["picotol.tokens", "picotol.reset", "picotol.base", "picotol.components", "picotol.utilities"]) {
      const idx = fullCss.indexOf(`@layer ${l}`);
      assert.ok(idx > fullIdx, `dist/picotol.css must preserve @layer ${l} in sequential cascade order`);
      fullIdx = idx;
    }
    let coreIdx = -1;
    for (const l of ["picotol.tokens", "picotol.reset", "picotol.base", "picotol.utilities"]) {
      const idx = coreCss.indexOf(`@layer ${l}`);
      assert.ok(idx > coreIdx, `dist/picotol.core.css must preserve @layer ${l} in sequential cascade order`);
      coreIdx = idx;
    }

    let layerIdx = -1;
    for (const l of ["picotol.tokens", "picotol.reset", "picotol.base", "picotol.components", "picotol.utilities"]) {
      const idx = layerCss.indexOf(`@layer ${l}`);
      assert.ok(idx > layerIdx, `dist/picotol.layer.css must preserve @layer ${l} in sequential cascade order`);
      layerIdx = idx;
    }

    // Verify all 6 dist files contain zero un-namespaced @layer declarations
    const distFiles = [
      "dist/picotol.css",
      "dist/picotol.min.css",
      "dist/picotol.core.css",
      "dist/picotol.core.min.css",
      "dist/picotol.layer.css",
      "dist/picotol.layer.min.css",
    ];
    const unnamespacedLayerRegex = /@layer\s+(?:tokens|reset|base|components|utilities)[\s,{]/;
    for (const file of distFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      assert.ok(
        !unnamespacedLayerRegex.test(content),
        `${file} must not contain un-namespaced @layer declarations`
      );
    }

    assert.ok(baseCss.includes("@layer picotol.reset {"), "src/base.css must define @layer picotol.reset");
    assert.ok(baseCss.includes("@layer picotol.base {"), "src/base.css must define @layer picotol.base");
    assert.ok(baseCss.includes("@layer picotol.utilities {"), "src/base.css must define @layer picotol.utilities");
    assert.ok(layoutCss.includes("@layer picotol.base {"), "src/layout.css must define @layer picotol.base");
    assert.ok(layoutCss.includes("@layer picotol.utilities {"), "src/layout.css must define @layer picotol.utilities");
    assert.ok(compCss.includes("@layer picotol.components {"), "src/components.css must define @layer picotol.components");

    const downstreamSnippet = `
      @layer picotol.tokens, my-theme, picotol.reset, picotol.base, picotol.components, my-components, picotol.utilities;
      @layer picotol.tokens {
        :root { --pt-primary: #123456; }
      }
      @layer picotol.components {
        article.card { border-radius: 1.5rem; }
      }
      @layer my-components {
        article.card { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
      }
    `;
    const downstreamTransformed = transform({
      filename: "downstream-test.css",
      code: Buffer.from(downstreamSnippet, "utf8"),
      minify: true,
    }).code.toString("utf8");
    assert.ok(
      downstreamTransformed.includes("picotol.tokens") && downstreamTransformed.includes("picotol.components"),
      "LightningCSS must cleanly transform and retain downstream @layer picotol.* references"
    );

    const utilitiesIdx = layerCss.indexOf("@layer picotol.utilities {");
    assert.ok(utilitiesIdx !== -1, "@layer picotol.utilities must be defined in dist/picotol.layer.css");
    assert.ok(
      layerCss.indexOf(".skip-to-content:is(:focus, :focus-visible)", utilitiesIdx) !== -1,
      ".skip-to-content focus rule must compile inside @layer picotol.utilities"
    );
    assert.ok(
      layerCss.indexOf(".sr-only", utilitiesIdx) !== -1,
      ".sr-only utility must compile inside @layer picotol.utilities"
    );
    assert.ok(
      layerCss.indexOf(".table-container", utilitiesIdx) !== -1,
      ".table-container utility must compile inside @layer picotol.utilities"
    );

    assert.ok(
      readme.includes("@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;"),
      "README must document 5-tier architecture layer declaration"
    );
    const defaultLightPrimary = getPicotolTokens().getToken("--pt-primary", "light", "blue");
    assert.ok(
      readme.includes("@layer picotol.tokens") &&
        readme.includes(`var(--brand-primary, ${defaultLightPrimary})`),
      `README must document downstream @layer picotol.tokens override pattern with token-derived fallback (${defaultLightPrimary})`
    );
    assert.ok(
      readme.includes("@layer picotol.components") && readme.includes("article.card"),
      "README must document downstream @layer picotol.components override pattern"
    );
  });

  test("Late-bind density tokens via fallback chains + static cascade check (Issue #203)", () => {
    const tokensCss = getSrcTokensCss();
    const formsCss = getSrcFormsCss();
    const contentCss = getSrcContentCss();
    const compCss = getSrcComponentsCss();

    const deprecatedTokens = [
      "--pt-form-element-spacing-vertical",
      "--pt-form-element-spacing-horizontal",
      "--pt-btn-padding-block",
    ];
    for (const token of deprecatedTokens) {
      const re = new RegExp(`${token}:[^;]+;\\s*/\\*\\s*@deprecated:\\s*removed in v0\\.6\\.0\\s*\\*/`);
      assert.match(
        tokensCss,
        re,
        `tokens.css :root must declare ${token} with deprecation comment /* @deprecated: removed in v0.6.0 */`
      );
    }

    assert.match(
      formsCss,
      /padding:\s*var\(--pt-form-element-spacing-vertical,\s*var\(--pt-form-y\)\)\s*var\(--pt-form-element-spacing-horizontal,\s*var\(--pt-form-x\)\)/,
      "forms.css must consume spacing tokens with fallback to base tokens (--pt-form-y, --pt-form-x)"
    );
    assert.match(
      contentCss,
      /padding:\s*var\(--pt-btn-padding-block,\s*var\(--pt-form-y\)\)\s*var\(--pt-form-x\)/,
      "content.css button padding must consume --pt-btn-padding-block with fallback to var(--pt-form-y)"
    );
    assert.match(
      compCss,
      /padding-block:\s*var\(--pt-btn-padding-block,\s*var\(--pt-form-y\)\)/,
      "components.css must consume --pt-btn-padding-block with fallback to var(--pt-form-y)"
    );

    const badSnippet1 = "button { padding: var(--pt-btn-padding-block); }";
    const errors1 = lintDerivedTokenFallbacks(badSnippet1, "test-bad1.css");
    assert.ok(errors1.length > 0, "Static cascade check must fail on var(--pt-btn-padding-block) without fallback");
    assert.match(errors1[0], /--pt-btn-padding-block.*--pt-form-y/, "Error must cite expected base token");

    const badSnippet2 = "input { padding-block: var(--pt-form-element-spacing-vertical); }";
    const errors2 = lintDerivedTokenFallbacks(badSnippet2, "test-bad2.css");
    assert.ok(errors2.length > 0, "Static cascade check must fail on var(--pt-form-element-spacing-vertical) without fallback");
    assert.match(errors2[0], /--pt-form-element-spacing-vertical.*--pt-form-y/, "Error must cite expected base token");

    const badSnippet3 = "input { padding-inline: var(--pt-form-element-spacing-horizontal); }";
    const errors3 = lintDerivedTokenFallbacks(badSnippet3, "test-bad3.css");
    assert.ok(errors3.length > 0, "Static cascade check must fail on var(--pt-form-element-spacing-horizontal) without fallback");
    assert.match(errors3[0], /--pt-form-element-spacing-horizontal.*--pt-form-x/, "Error must cite expected base token");

    const goodSnippet = "button { padding-block: var(--pt-btn-padding-block, var(--pt-form-y)); }";
    const goodErrors = lintDerivedTokenFallbacks(goodSnippet, "test-good.css");
    assert.deepEqual(goodErrors, [], "Static cascade check must pass when fallback is supplied");

    const srcFiles = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".css") && f !== "tokens.css" && f !== "palettes.css");
    for (const file of srcFiles) {
      const fileContent = fs.readFileSync(path.join(ROOT, "src", file), "utf8");
      const fileErrors = lintDerivedTokenFallbacks(fileContent, `src/${file}`);
      assert.deepEqual(fileErrors, [], `src/${file} must have 0 static cascade check errors`);
    }

    function resolveFallbackChain(chainString, env) {
      const calls = parseVarCalls(chainString);
      if (calls.length === 0) return chainString;
      const { varName, fallback } = calls[0];
      if (env[varName] !== undefined) {
        return env[varName];
      }
      if (fallback) {
        return resolveFallbackChain(fallback, env);
      }
      return undefined;
    }

    const btnPaddingChain = "var(--pt-btn-padding-block, var(--pt-form-y))";
    const formSpacingChain = "var(--pt-form-element-spacing-vertical, var(--pt-form-y))";

    const rootEnv = { "--pt-form-y": "0.5rem" };
    const smallEnv = { "--pt-form-y": "0.25rem" };
    const compactEnv = { "--pt-form-y": "0.25rem" };
    const tightEnv = { "--pt-form-y": "0.125rem" };

    const defaultBtnPadding = resolveFallbackChain(btnPaddingChain, rootEnv);
    const smallBtnPadding = resolveFallbackChain(btnPaddingChain, smallEnv);
    const compactBtnPadding = resolveFallbackChain(btnPaddingChain, compactEnv);
    const tightBtnPadding = resolveFallbackChain(btnPaddingChain, tightEnv);

    assert.equal(defaultBtnPadding, "0.5rem", "Default button vertical padding resolves to 0.5rem");
    assert.equal(smallBtnPadding, "0.25rem", ".small button vertical padding resolves to 0.25rem");
    assert.equal(compactBtnPadding, "0.25rem", "Compact button vertical padding resolves to 0.25rem");
    assert.equal(tightBtnPadding, "0.125rem", "Tight button vertical padding resolves to 0.125rem");

    assert.ok(
      parseFloat(smallBtnPadding) < parseFloat(defaultBtnPadding),
      ".small demonstrably shrinks button vertical padding (0.25rem < 0.5rem)"
    );
    assert.ok(
      parseFloat(compactBtnPadding) < parseFloat(defaultBtnPadding),
      "Compact density demonstrably shrinks button vertical padding (0.25rem < 0.5rem)"
    );
    assert.ok(
      parseFloat(tightBtnPadding) < parseFloat(compactBtnPadding),
      "Tight density demonstrably shrinks button vertical padding (0.125rem < 0.25rem)"
    );

    const defaultFormSpacing = resolveFallbackChain(formSpacingChain, rootEnv);
    const smallFormSpacing = resolveFallbackChain(formSpacingChain, smallEnv);
    const compactFormSpacing = resolveFallbackChain(formSpacingChain, compactEnv);
    assert.equal(defaultFormSpacing, "0.5rem");
    assert.equal(smallFormSpacing, "0.25rem");
    assert.equal(compactFormSpacing, "0.25rem");
    assert.ok(parseFloat(smallFormSpacing) < parseFloat(defaultFormSpacing));
    assert.ok(parseFloat(compactFormSpacing) < parseFloat(defaultFormSpacing));
  });
});
