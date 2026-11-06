// Unit and integration tests for WCAG 2.2 accessibility, contrast, and assistive tech.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  getDistCss,
  getDistMinCss,
  getCoreCss,
  getCoreMinCss,
  getLayerCss,
  getSrcBaseCss,
  getSrcComponentsCss,
  getSrcNavCss,
  getReadme,
  getDemoHtml,
} from "./helpers/fixtures.mjs";

import {
  expandHex,
  relativeLuminance,
  contrastRatio,
  mixSrgb,
  schemeColor,
  getPicotolTokens,
} from "./helpers/tokens.mjs";

describe("WCAG 2.2 Contrast Verification", () => {
  test("WCAG 2.2 Contrast Verification across Light and Dark surfaces, all 4 Paul Tol Accent Ladders (Normal + Hover), and SC 1.4.11 Borders", () => {
    const tokens = getPicotolTokens();
    const lightBg = tokens.getToken("--pt-bg", "light");
    const lightText = tokens.getToken("--pt-color", "light");
    const lightMuted = tokens.getToken("--pt-muted-color", "light");
    const lightBorder = tokens.getToken("--pt-muted-border", "light");

    const darkBg = tokens.getToken("--pt-bg", "dark");
    const darkText = tokens.getToken("--pt-color", "dark");
    const darkMuted = tokens.getToken("--pt-muted-color", "dark");
    const darkBorder = tokens.getToken("--pt-muted-border", "dark");

    assert.ok(contrastRatio(lightText, lightBg) >= 7.0, "Light mode primary text AAA contrast");
    assert.ok(contrastRatio(lightMuted, lightBg) >= 7.0, "Light mode muted text AAA contrast");
    assert.ok(contrastRatio(darkText, darkBg) >= 7.0, "Dark mode primary text AAA contrast");
    assert.ok(contrastRatio(darkMuted, darkBg) >= 7.0, "Dark mode muted text AAA contrast");

    assert.ok(
      contrastRatio(lightBorder, lightBg) >= 3.0,
      `Light mode border (${lightBorder}) vs white bg must be >= 3.0:1 (SC 1.4.11)`
    );
    assert.ok(
      contrastRatio(darkBorder, darkBg) >= 3.0,
      `Dark mode border (${darkBorder}) vs black bg must be >= 3.0:1 (SC 1.4.11)`
    );

    const accents = ["blue", "cyan", "purple", "magenta"].map((name) => ({
      name,
      p1: tokens.getToken("--pt-p1", "light", name),
      p2: tokens.getToken("--pt-p2", "light", name),
      p3: tokens.getToken("--pt-p3", "light", name),
      p4: tokens.getToken("--pt-p4", "light", name),
      p5: tokens.getToken("--pt-p5", "light", name),
    }));

    for (const acc of accents) {
      assert.notEqual(
        expandHex(acc.p1),
        expandHex(acc.p2),
        `[${acc.name}] p1 (${acc.p1}) and p2 (${acc.p2}) must be distinct for visible hover state`
      );
      assert.notEqual(
        expandHex(acc.p4),
        expandHex(acc.p3),
        `[${acc.name}] p4 (${acc.p4}) and p3 (${acc.p3}) must be distinct for dark button hover state`
      );
      assert.notEqual(
        expandHex(acc.p4),
        expandHex(acc.p5),
        `[${acc.name}] p4 (${acc.p4}) and p5 (${acc.p5}) must be distinct for light link hover state`
      );

      const lightTextCR = contrastRatio(acc.p4, lightBg);
      const lightTextHoverCR = contrastRatio(acc.p5, lightBg);
      const lightBtnCR = contrastRatio(acc.p1, lightText);
      const lightBtnHoverCR = contrastRatio(acc.p2, lightText);

      const darkTextCR = contrastRatio(acc.p2, darkBg);
      const darkTextHoverCR = contrastRatio(acc.p1, darkBg);
      const darkBtnCR = contrastRatio(acc.p4, darkText);
      const darkBtnHoverCR = contrastRatio(acc.p3, darkText);

      assert.ok(
        lightTextCR >= 4.5,
        `[${acc.name}] Light mode primary (${acc.p4}) vs white bg CR=${lightTextCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        lightTextHoverCR >= 4.5,
        `[${acc.name}] Light mode primary hover (${acc.p5}) vs white bg CR=${lightTextHoverCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        lightBtnCR >= 4.5,
        `[${acc.name}] Light mode button (${acc.p1}) vs black text CR=${lightBtnCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        lightBtnHoverCR >= 4.5,
        `[${acc.name}] Light mode button hover (${acc.p2}) vs black text CR=${lightBtnHoverCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        darkTextCR >= 4.5,
        `[${acc.name}] Dark mode primary (${acc.p2}) vs black bg CR=${darkTextCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        darkTextHoverCR >= 4.5,
        `[${acc.name}] Dark mode primary hover (${acc.p1}) vs black bg CR=${darkTextHoverCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        darkBtnCR >= 4.5,
        `[${acc.name}] Dark mode button (${acc.p4}) vs white text CR=${darkBtnCR.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        darkBtnHoverCR >= 4.5,
        `[${acc.name}] Dark mode button hover (${acc.p3}) vs white text CR=${darkBtnHoverCR.toFixed(2)} must be >= 4.5`
      );
    }

    const purpleAcc = accents.find((a) => a.name === "purple");
    const magentaAcc = accents.find((a) => a.name === "magenta");
    assert.notEqual(expandHex(purpleAcc.p1), expandHex(magentaAcc.p1));
    assert.notEqual(expandHex(purpleAcc.p2), expandHex(magentaAcc.p2));
    assert.notEqual(expandHex(purpleAcc.p4), expandHex(magentaAcc.p4));
  });

  test("WCAG 2.2 AAA Contrast Compliance and Color-Blind Greyscale Distinction for Status Triads (Issue #156)", () => {
    const fullCss = getDistCss();
    const coreCss = getCoreCss();
    const layerCss = getLayerCss();

    assert.ok(
      coreCss.includes("--pt-status-warning-fg"),
      "picotol.core.css must define --pt-status-warning-fg"
    );
    assert.ok(
      fullCss.includes("--pt-status-warning-fg"),
      "picotol.css must define --pt-status-warning-fg"
    );
    assert.ok(
      layerCss.includes("--pt-status-warning-fg"),
      "picotol.layer.css must define --pt-status-warning-fg"
    );

    const tokens = getPicotolTokens();
    assert.equal(
      tokens.getToken("--pt-status-warning-fg", "light"),
      schemeColor("ylorbr", 1),
      "--pt-status-warning-fg light mode must calibrate to Tol ylorbr brown"
    );
    assert.equal(
      tokens.getToken("--pt-status-warning-fg", "dark"),
      schemeColor("high-contrast", "yellow"),
      "--pt-status-warning-fg dark mode must calibrate to Tol high-contrast yellow"
    );
    const lightRoot = tokens.getToken("--pt-bg", "light");
    const lightSurface = tokens.getToken("--pt-surface", "light");

    const warnFg = tokens.getToken("--pt-status-warning-fg", "light");
    const warnBorder = tokens.getToken("--pt-status-warning-border", "light");
    const warnBgOnRoot = mixSrgb(warnBorder, 8, lightRoot);
    const warnBgOnSurface = mixSrgb(warnBorder, 8, lightSurface);

    const crWarnRoot = contrastRatio(warnFg, lightRoot);
    const crWarnSurface = contrastRatio(warnFg, lightSurface);
    const crWarnBadgeRoot = contrastRatio(warnFg, warnBgOnRoot);
    const crWarnBadgeSurface = contrastRatio(warnFg, warnBgOnSurface);

    assert.ok(
      crWarnRoot >= 7.0,
      `Warning fg ${warnFg} on white root must achieve WCAG 2.2 AAA >= 7:1 (got ${crWarnRoot.toFixed(2)}:1)`
    );
    assert.ok(
      crWarnSurface >= 7.0,
      `Warning fg ${warnFg} on light surface must achieve WCAG 2.2 AAA >= 7:1 (got ${crWarnSurface.toFixed(2)}:1)`
    );
    assert.ok(
      crWarnBadgeRoot >= 7.0,
      `Warning fg ${warnFg} on 8% badge wash (root) must achieve WCAG 2.2 AAA >= 7:1 (got ${crWarnBadgeRoot.toFixed(2)}:1)`
    );
    assert.ok(
      crWarnBadgeSurface >= 7.0,
      `Warning fg ${warnFg} on 8% badge wash (surface) must achieve WCAG 2.2 AAA >= 7:1 (got ${crWarnBadgeRoot.toFixed(2)}:1)`
    );

    const okFg = tokens.getToken("--pt-status-ok-fg", "light");
    const critFg = tokens.getToken("--pt-status-critical-fg", "light");
    const infoFg = tokens.getToken("--pt-status-info-fg", "light");

    const crOkRoot = contrastRatio(okFg, lightRoot);
    const crCritRoot = contrastRatio(critFg, lightRoot);
    const crInfoRoot = contrastRatio(infoFg, lightRoot);

    assert.ok(crOkRoot >= 4.5, `OK fg on light root must achieve >= 4.5:1 (got ${crOkRoot.toFixed(2)}:1)`);
    assert.ok(crCritRoot >= 4.5, `Critical fg on light root must achieve >= 4.5:1 (got ${crCritRoot.toFixed(2)}:1)`);
    assert.ok(crInfoRoot >= 4.5, `Info fg on light root must achieve >= 4.5:1 (got ${crInfoRoot.toFixed(2)}:1)`);

    const greyscaleRatioWarnVsOk = contrastRatio(warnFg, okFg);
    const greyscaleRatioWarnVsCrit = contrastRatio(warnFg, critFg);
    const greyscaleRatioWarnVsInfo = contrastRatio(warnFg, infoFg);

    assert.ok(
      greyscaleRatioWarnVsOk >= 2.0,
      `Greyscale contrast between Warning fg and OK fg must be >= 2.0:1 (got ${greyscaleRatioWarnVsOk.toFixed(2)}:1)`
    );
    assert.ok(
      greyscaleRatioWarnVsCrit >= 2.0,
      `Greyscale contrast between Warning fg and Critical fg must be >= 2.0:1 (got ${greyscaleRatioWarnVsCrit.toFixed(2)}:1)`
    );
    assert.ok(
      greyscaleRatioWarnVsInfo >= 2.0,
      `Greyscale contrast between Warning fg and Info fg must be >= 2.0:1 (got ${greyscaleRatioWarnVsInfo.toFixed(2)}:1)`
    );

    const lumWarnBorder = relativeLuminance(warnBorder);
    const lumOkBorder = relativeLuminance(okFg);
    const lumCritBorder = relativeLuminance(critFg);
    const lumInfoBorder = relativeLuminance(infoFg);

    assert.ok(
      Math.abs(lumWarnBorder - lumOkBorder) > 0.2,
      "Warning border must maintain > 0.2 luminance separation from OK border in greyscale"
    );
    assert.ok(
      Math.abs(lumWarnBorder - lumCritBorder) > 0.2,
      "Warning border must maintain > 0.2 luminance separation from Critical border in greyscale"
    );
    assert.ok(
      Math.abs(lumWarnBorder - lumInfoBorder) > 0.2,
      "Warning border must maintain > 0.2 luminance separation from Info border in greyscale"
    );
  });

  test("Status Callout & Badge Body Foreground Contrast Policy (Issue #202)", () => {
    const compCss = getSrcComponentsCss();
    const tokens = getPicotolTokens();

    assert.ok(
      compCss.includes(':where(.badge, .pt-badge, .pt-indicator)') &&
      compCss.includes("color: var(--pt-color)"),
      "src/components.css must establish color: var(--pt-color) on baseline status badges and indicators"
    );
    assert.ok(
      compCss.includes(":where(.pt-callout)") &&
      compCss.includes("color: var(--pt-color)"),
      "src/components.css must establish color: var(--pt-color) on .pt-callout banners"
    );

    for (const status of ["ok", "warning", "critical", "info"]) {
      const triadRegex = new RegExp(`\\.pt-badge\\[data-status="${status}"\\][^{]*\\{[^}]*color:\\s*var\\(--pt-color\\)`);
      assert.match(
        compCss,
        triadRegex,
        `src/components.css must bind .pt-badge[data-status="${status}"] to color: var(--pt-color)`
      );
    }

    const lightBg = tokens.getToken("--pt-bg", "light");
    const darkBg = tokens.getToken("--pt-bg", "dark");
    const lightSurface = tokens.getToken("--pt-surface", "light");
    const darkSurface = tokens.getToken("--pt-surface", "dark");
    const lightColor = tokens.getToken("--pt-color", "light");
    const darkColor = tokens.getToken("--pt-color", "dark");

    const statusTriads = [
      { name: "ok", token: "--pt-status-ok-border", fgToken: "--pt-status-ok-fg" },
      { name: "warning", token: "--pt-status-warning-border", fgToken: "--pt-status-warning-fg" },
      { name: "critical", token: "--pt-status-critical-border", fgToken: "--pt-status-critical-fg" },
      { name: "info", token: "--pt-status-info-border", fgToken: "--pt-status-info-fg" },
    ];

    for (const { name, token, fgToken } of statusTriads) {
      const borderLight = tokens.getToken(token, "light");
      const borderDark = tokens.getToken(token, "dark");

      const washLightRoot = mixSrgb(borderLight, 8, lightBg);
      const washLightSurface = mixSrgb(borderLight, 8, lightSurface);

      const crLightRoot = contrastRatio(lightColor, washLightRoot);
      const crLightSurface = contrastRatio(lightColor, washLightSurface);

      assert.ok(
        crLightRoot >= 4.5,
        `[light] ${name} badge text (--pt-color) on 8% root wash (${washLightRoot}) must meet WCAG 2.2 AA >= 4.5:1 (got ${crLightRoot.toFixed(2)}:1)`
      );
      assert.ok(
        crLightSurface >= 4.5,
        `[light] ${name} badge text (--pt-color) on 8% surface wash (${washLightSurface}) must meet WCAG 2.2 AA >= 4.5:1 (got ${crLightSurface.toFixed(2)}:1)`
      );

      const washDarkRoot = mixSrgb(borderDark, 8, darkBg);
      const washDarkSurface = mixSrgb(borderDark, 8, darkSurface);

      const crDarkRoot = contrastRatio(darkColor, washDarkRoot);
      const crDarkSurface = contrastRatio(darkColor, washDarkSurface);

      assert.ok(
        crDarkRoot >= 4.5,
        `[dark] ${name} badge text (--pt-color) on 8% root wash (${washDarkRoot}) must meet WCAG 2.2 AA >= 4.5:1 (got ${crDarkRoot.toFixed(2)}:1)`
      );
      assert.ok(
        crDarkSurface >= 4.5,
        `[dark] ${name} badge text (--pt-color) on 8% surface wash (${washDarkSurface}) must meet WCAG 2.2 AA >= 4.5:1 (got ${crDarkSurface.toFixed(2)}:1)`
      );

      if (name === "ok" || name === "info") {
        const oldFgLight = tokens.getToken(fgToken, "light");
        const oldCr = contrastRatio(oldFgLight, washLightRoot);
        assert.ok(
          oldCr < 4.5,
          `Expected historical ${name} text (${oldFgLight}) on 8% wash to fail AA (< 4.5:1, got ${oldCr.toFixed(2)}:1) demonstrating the necessity of --pt-color`
        );
      }
    }
  });

  test("Accessible Switch Thumb Contrast and Boundary Ratio (Issue #202)", () => {
    const compCss = getSrcComponentsCss();
    const fullCss = getDistCss();
    const tokens = getPicotolTokens();

    assert.ok(
      compCss.includes('[role="switch"]') && compCss.includes("box-shadow: 0 0 0 1px var(--pt-color)"),
      'src/components.css must declare box-shadow: 0 0 0 1px var(--pt-color) on [role="switch"]::before'
    );
    assert.ok(
      fullCss.includes('[role="switch"]') && fullCss.includes("box-shadow: 0 0 0 1px var(--pt-color)"),
      'dist/picotol.css must compile box-shadow: 0 0 0 1px var(--pt-color) on [role="switch"]::before'
    );

    const lightBg = tokens.getToken("--pt-bg", "light");
    const darkBg = tokens.getToken("--pt-bg", "dark");
    const lightSurface = tokens.getToken("--pt-surface", "light");
    const darkSurface = tokens.getToken("--pt-surface", "dark");
    const lightFg = tokens.getToken("--pt-color", "light");
    const darkFg = tokens.getToken("--pt-color", "dark");

    const crLightThumbTrack = contrastRatio(lightFg, lightSurface);
    const crDarkThumbTrack = contrastRatio(darkFg, darkSurface);

    assert.ok(
      crLightThumbTrack >= 3.0,
      `Inactive switch thumb boundary vs track in light mode must be >= 3:1 (got ${crLightThumbTrack.toFixed(2)}:1)`
    );
    assert.ok(
      crDarkThumbTrack >= 3.0,
      `Inactive switch thumb boundary vs track in dark mode must be >= 3:1 (got ${crDarkThumbTrack.toFixed(2)}:1)`
    );

    const crLightThumbBody = contrastRatio(lightFg, lightBg);
    const crDarkThumbBody = contrastRatio(darkFg, darkBg);

    assert.ok(
      crLightThumbBody >= 3.0,
      `Switch thumb boundary vs thumb body in light mode must be >= 3:1 (got ${crLightThumbBody.toFixed(2)}:1)`
    );
    assert.ok(
      crDarkThumbBody >= 3.0,
      `Switch thumb boundary vs thumb body in dark mode must be >= 3:1 (got ${crDarkThumbBody.toFixed(2)}:1)`
    );

    const accents = ["blue", "cyan", "purple", "magenta"];
    for (const mode of ["light", "dark"]) {
      const bg = tokens.getToken("--pt-bg", mode);
      for (const accent of accents) {
        const primary = tokens.getToken("--pt-primary", mode, accent);
        const crChecked = contrastRatio(bg, primary);
        assert.ok(
          crChecked >= 3.0,
          `[${mode}:${accent}] Checked switch thumb vs track must be >= 3:1 (got ${crChecked.toFixed(2)}:1)`
        );
      }
    }
  });
});

describe("Component Semantics and Non-Text Affordances", () => {
  test("Paul Tol Accessible Status Dots: .status-dot dimensions, semantic mapping, forced-colors, and SC 1.4.11 contrast", () => {
    const fullCss = getDistCss();
    const fullMin = getDistMinCss();

    assert.ok(fullCss.includes(".status-dot"), "Full CSS must include .status-dot");
    assert.ok(fullMin.includes("status-dot"), "Minified CSS must include status-dot");

    assert.ok(
      fullCss.includes("width: .5rem;") && fullCss.includes("height: .5rem;") && fullCss.includes("50%"),
      "Status dot must declare 0.5rem dimensions and 50% radius"
    );

    assert.ok(fullCss.includes("var(--pt-valid)"), "Status dot maps success/valid to --pt-valid");
    assert.ok(fullCss.includes("var(--pt-warning)"), "Status dot maps warning to --pt-warning");
    assert.ok(fullCss.includes("var(--pt-invalid)"), "Status dot maps danger/invalid to --pt-invalid");
    assert.ok(fullCss.includes("var(--pt-primary)"), "Status dot maps info/primary to --pt-primary");
    assert.ok(fullCss.includes("var(--pt-muted-border)"), "Status dot maps neutral/idle to --pt-muted-border");

    assert.ok(
      fullCss.includes(".neutral") && fullCss.includes(".idle"),
      "Status dot must support .neutral and .idle class modifiers"
    );
    assert.ok(
      fullCss.includes('[data-status="neutral"]'),
      "Status dot must support data-status=neutral"
    );
    assert.ok(
      fullCss.includes('[data-status="idle"]'),
      "Status dot must support data-status=idle"
    );
    assert.ok(
      fullCss.includes('[data-status="backlog"]'),
      "Status dot must support data-status=backlog"
    );
    assert.ok(
      fullCss.includes('[data-status="no-status"]'),
      "Status dot must support data-status=no-status"
    );

    assert.ok(
      fullCss.includes(":where(:not(:only-child, :last-child))"),
      "Status dot default margin selector must be wrapped in :where() to maintain (0,0,0) specificity"
    );
    assert.ok(
      fullCss.includes("margin-inline-end: .35rem"),
      "Status dot preserves default inline spacing when not only or last child"
    );
    assert.ok(
      fullCss.includes(".no-margin") && fullCss.includes(".m-0"),
      "Status dot must support .no-margin and .m-0 modifiers"
    );
    assert.ok(
      fullCss.includes("margin-inline-end: 0"),
      "Status dot must eliminate margin compounding within flex/gap parent containers"
    );

    assert.ok(
      /outline:\s*1px\s+solid\s+canvastext/i.test(fullCss) && /outline:1px solid canvastext/i.test(fullMin),
      "Status dot must provide CanvasText outline in forced-colors mode"
    );

    const tokens = getPicotolTokens();
    const lightBg = tokens.getToken("--pt-bg", "light");
    const darkBg = tokens.getToken("--pt-bg", "dark");

    const lightValid = tokens.getToken("--pt-valid", "light");
    const lightWarning = tokens.getToken("--pt-warning", "light");
    const lightInvalid = tokens.getToken("--pt-invalid", "light");
    const lightMuted = tokens.getToken("--pt-muted-border", "light");

    const darkValid = tokens.getToken("--pt-valid", "dark");
    const darkWarning = tokens.getToken("--pt-warning", "dark");
    const darkInvalid = tokens.getToken("--pt-invalid", "dark");
    const darkMuted = tokens.getToken("--pt-muted-border", "dark");

    assert.ok(contrastRatio(lightValid, lightBg) >= 3.0, "Status dot success >= 3:1 in light mode");
    assert.ok(contrastRatio(lightWarning, lightBg) >= 3.0, "Status dot warning >= 3:1 in light mode");
    assert.ok(contrastRatio(lightInvalid, lightBg) >= 3.0, "Status dot danger >= 3:1 in light mode");
    assert.ok(contrastRatio(lightMuted, lightBg) >= 3.0, "Status dot default/neutral >= 3:1 in light mode");

    assert.ok(contrastRatio(darkValid, darkBg) >= 3.0, "Status dot success >= 3:1 in dark mode");
    assert.ok(contrastRatio(darkWarning, darkBg) >= 3.0, "Status dot warning >= 3:1 in dark mode");
    assert.ok(contrastRatio(darkInvalid, darkBg) >= 3.0, "Status dot danger >= 3:1 in dark mode");
    assert.ok(contrastRatio(darkMuted, darkBg) >= 3.0, "Status dot default/neutral >= 3:1 in dark mode");
  });

  test("Documented Status Examples Contain Text Label or Icon (Issue #202)", () => {
    const readme = getReadme();
    const demoHtml = getDemoHtml();

    const statusElementRegex = /<(?:span|aside|div)[^>]*(?:class=["'][^"']*(?:badge|indicator|chip|callout)[^"']*|role=["'](?:status|alert)["'])[^>]*>([\s\S]*?)<\/(?:span|aside|div)>/gi;

    const sources = [
      { file: "README.md", content: readme },
      { file: "dist/demo/index.html", content: demoHtml },
    ];

    let totalInspected = 0;
    for (const { file, content } of sources) {
      statusElementRegex.lastIndex = 0;
      let match;
      while ((match = statusElementRegex.exec(content)) !== null) {
        const fullTag = match[0];
        if (/\b(?:aria-live|toast)\b/i.test(fullTag)) {
          continue;
        }

        const innerHtml = match[1];
        const textContent = innerHtml.replace(/<[^>]+>/g, "").trim();
        const hasIcon = /<(?:svg|\w+[^>]*class=["'][^"']*(?:dot|icon)[^"']*)/i.test(innerHtml);
        const hasText = textContent.length > 0;

        assert.ok(
          hasText || hasIcon,
          `Documented status example in ${file} must contain a text label or icon (found empty/color-only status component: "${fullTag}")`
        );
        totalInspected++;
      }
    }

    assert.ok(totalInspected >= 20, `Must inspect at least 20 documented status examples (inspected ${totalInspected})`);
  });
});

describe("Assistive Technology, Media Queries, and CSP", () => {
  test("WCAG 2.2 Accessibility, Reflow, Typography Measure, Screen Reader UX, and SRI Manifest Invariants", () => {
    const fullCss = getDistCss();
    const demoHtml = getDemoHtml();
    const sriPath = path.join(ROOT, "dist/sri.json");

    for (const selector of [
      ".skip-to-content",
      ".sr-only",
      ".visually-hidden",
      ".sr-only-focusable",
      ".visually-hidden-focusable",
      '[tabindex="-1"]:focus:not(:focus-visible)',
      ".measure",
      ".prose",
      "75ch",
      ".overflow-auto",
      ":focus-visible",
      "forced-colors: active",
      "@media print",
    ]) {
      assert.ok(
        fullCss.includes(selector),
        `Expected accessibility/reflow selector "${selector}" in dist/picotol.css`
      );
    }

    assert.ok(
      !/:where\(p[,\s][^)]*\)\s*\{[^}]*max-width:\s*75ch/i.test(fullCss),
      "General :where(p) must not be restricted by max-width: 75ch"
    );

    assert.ok(
      !/outline\s*:\s*(?:none|0)\b/i.test(fullCss),
      "dist/picotol.css must not suppress focus outlines with outline: none/0"
    );

    assert.ok(demoHtml.includes('id="main-content" tabindex="-1"'), "Demo main landmark must include tabindex=-1 for skip link target");
    assert.ok(demoHtml.includes('id="subtrees"'), "Demo HTML must include #subtrees landmark for subtree theming");
    assert.ok(demoHtml.includes('id="tables"'), "Demo HTML must include #tables landmark for nav anchor");
    assert.ok(
      /:where\(figure:has\(\s*>\s*table\)\)/.test(fullCss),
      "Full CSS must include responsive figure table containment (:where(figure:has(> table)))"
    );
    assert.ok(
      /<figure[^>]*>[\s\S]*?<table[\s\S]*?<\/table>[\s\S]*?<\/figure>/.test(demoHtml),
      "Demo HTML must contain operational table wrapped in <figure>"
    );
    assert.ok(demoHtml.includes('id="palettes"'), "Demo HTML must include #palettes landmark for palette explorer");
    assert.ok(demoHtml.includes('id="palette-search"'), "Demo HTML must include palette search input");
    assert.ok(demoHtml.includes('aria-controls="panel-overview"'), "Demo dashboard tabs must include aria-controls");
    assert.ok(demoHtml.includes('id="panel-overview" role="tabpanel"'), "Demo dashboard must include tabpanel landmarks");
    assert.ok(demoHtml.includes('aria-labelledby="modal-title"'), "Demo dialog must include aria-labelledby");
    assert.ok(demoHtml.includes('tabindex="0"'), "Demo tooltip span must be keyboard focusable via tabindex=0");

    assert.ok(fs.existsSync(sriPath), "dist/sri.json must exist");
    const sri = JSON.parse(fs.readFileSync(sriPath, "utf8"));
    assert.equal(sri.package, "@kidthales/picotol");
    for (const relPath of ["dist/picotol.core.min.css", "dist/picotol.min.css", "dist/picotol.layer.min.css"]) {
      assert.ok(sri.files[relPath], `dist/sri.json must include entry for ${relPath}`);
      assert.match(sri.files[relPath].integrity, /^sha384-[A-Za-z0-9+/=]+$/);
      assert.equal(sri.files[relPath].bytes, fs.statSync(path.join(ROOT, relPath)).size);
    }
  });

  test("a11y: forced-colors fallbacks, silent breadcrumb separator, reduced-motion spinner (Issue #221)", () => {
    const baseCss = getSrcBaseCss();
    const navCss = getSrcNavCss();
    const compCss = getSrcComponentsCss();
    const fullCss = getDistCss();
    const fullMin = getDistMinCss();
    const coreCss = getCoreCss();
    const coreMin = getCoreMinCss();

    assert.ok(
      navCss.includes('content: ">" / "";'),
      'src/nav.css must declare content: ">" / "" for breadcrumb separator'
    );
    assert.ok(
      fullCss.includes('content: ">" / "";') && coreCss.includes('content: ">" / "";'),
      'dist/picotol.css and dist/picotol.core.css must preserve content: ">" / "" for breadcrumbs'
    );
    assert.ok(
      fullMin.includes('content:">" / ""') && coreMin.includes('content:">" / ""'),
      'dist/picotol.min.css and dist/picotol.core.min.css must compile content:">" / "" for breadcrumbs'
    );

    assert.ok(
      !baseCss.includes(':not([aria-busy="true"])'),
      'src/base.css must not exempt [aria-busy="true"] from prefers-reduced-motion: reduce'
    );
    assert.ok(
      baseCss.includes('animation: none !important;'),
      'src/base.css must cancel animation: none !important universally under prefers-reduced-motion: reduce'
    );

    assert.ok(
      compCss.includes('@media (prefers-reduced-motion: reduce)') &&
        compCss.includes('[aria-busy="true"]:not(input, select, textarea, html, form, summary)::before') &&
        /\[aria-busy="true"\][\s\S]*?animation:\s*none;/.test(compCss),
      'src/components.css must disable spinner animation under prefers-reduced-motion: reduce'
    );
    assert.ok(
      fullCss.includes('animation: none;') && fullMin.includes('animation:none'),
      'dist/picotol.css and dist/picotol.min.css must compile reduced-motion spinner rule'
    );

    assert.ok(
      compCss.includes('progress::-webkit-progress-value') &&
        compCss.includes('progress::-moz-progress-bar'),
      'src/components.css must style progress::-webkit-progress-value and progress::-moz-progress-bar under forced-colors'
    );
    assert.ok(
      fullCss.includes('progress::-webkit-progress-value') &&
        fullCss.includes('progress::-moz-progress-bar') &&
        /progress::-webkit-progress-value\s*\{\s*background-color:\s*highlight;/i.test(fullCss),
      'dist/picotol.css must assign highlight background-color to native progress pseudo-elements in forced-colors mode'
    );
    assert.ok(
      fullMin.includes('progress::-webkit-progress-value{background-color:highlight}') &&
        fullMin.includes('progress::-moz-progress-bar{background-color:highlight}'),
      'dist/picotol.min.css must compile highlight background-color for progress::-webkit-progress-value and progress::-moz-progress-bar'
    );

    assert.ok(
      compCss.includes(':where(.pt-meter-range)') &&
        compCss.includes('outline: 1px solid CanvasText;'),
      'src/components.css must assign CanvasText outline to :where(.pt-meter-range) in forced-colors mode'
    );
    assert.ok(
      /where\(\.pt-meter-range\)\s*\{[\s\S]*?outline:\s*1px\s+solid\s+canvastext;/i.test(fullCss),
      'dist/picotol.css must declare CanvasText outline for .pt-meter-range under forced-colors'
    );
    assert.ok(
      fullMin.includes('outline:1px solid canvastext') && fullMin.includes('pt-meter-range'),
      'dist/picotol.min.css must compile CanvasText outline for .pt-meter-range in forced-colors mode'
    );

    assert.ok(
      compCss.includes('outline: 2px solid Highlight;') &&
        compCss.includes('background-color: Highlight;'),
      'src/components.css must assign 2px Highlight outline and Highlight background to segmented selected items in forced-colors mode'
    );
    assert.ok(
      /outline:\s*2px\s+solid\s+highlight;/i.test(fullCss) &&
        /background-color:\s*highlight;/i.test(fullCss),
      'dist/picotol.css must include Highlight outline and background for segmented selected items in forced-colors mode'
    );
    assert.ok(
      fullMin.includes('outline:2px solid highlight') &&
        fullMin.includes('background-color:highlight'),
      'dist/picotol.min.css must compile Highlight outline and background for segmented selected items in forced-colors mode'
    );
  });

  test("Demo accessibility and CSP compliance (Issue #222)", () => {
    const demoHtml = getDemoHtml();
    const demoJs = fs.readFileSync(path.join(ROOT, "dist/demo/demo.js"), "utf8");

    assert.match(
      demoHtml,
      /<script src="demo\.js"><\/script>/,
      "dist/demo/index.html must load demo.js externally"
    );
    assert.ok(
      !demoHtml.includes("<script>"),
      "dist/demo/index.html must not contain inline <script> tags"
    );
    assert.match(
      demoHtml,
      /http-equiv="Content-Security-Policy"[^>]*script-src 'self'/,
      "dist/demo/index.html must declare script-src 'self' Content-Security-Policy"
    );

    const cleanMarkup = demoHtml
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    const inlineHandlers = cleanMarkup.match(/\b(on[a-z]+)\s*=/gi);
    assert.equal(
      inlineHandlers,
      null,
      `dist/demo/index.html must contain zero inline event handlers, found: ${inlineHandlers?.join(', ')}`
    );

    const detailsRoleMenu = cleanMarkup.match(/<details\b[^>]*\brole=["']?menu\b/gi);
    assert.equal(
      detailsRoleMenu,
      null,
      "dist/demo/index.html must not use role=\"menu\" on <details>"
    );

    const svgTags = [...cleanMarkup.matchAll(/<svg\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)];
    assert.ok(svgTags.length >= 8, `Expected at least 8 SVGs in demo, found ${svgTags.length}`);
    for (const [, attrs] of svgTags) {
      assert.match(
        attrs,
        /\baria-hidden=["']true["']/i,
        "Every SVG in demo must have aria-hidden=\"true\""
      );
    }

    const openTags = [...cleanMarkup.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];
    const labelForIds = new Set();
    for (const [, tag, attrs] of openTags) {
      if (tag.toLowerCase() === 'label') {
        const m = attrs.match(/\bfor\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
        if (m) labelForIds.add(m[1] ?? m[2] ?? m[3]);
      }
    }
    const allTags = [...cleanMarkup.matchAll(/<(\/)?([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];
    let labelDepth = 0;
    let inputCount = 0;
    for (const [, isClose, tag, attrs] of allTags) {
      const lowerTag = tag.toLowerCase();
      if (isClose) {
        if (lowerTag === 'label') labelDepth = Math.max(0, labelDepth - 1);
        continue;
      }
      if (lowerTag === 'label') {
        labelDepth++;
        continue;
      }
      if (lowerTag === 'input') {
        inputCount++;
        const isHidden = /\btype\s*=\s*(?:"hidden"|'hidden'|hidden\b)/i.test(attrs);
        const isButtonType = /\btype\s*=\s*(?:"(?:submit|button|reset)"|'(?:submit|button|reset)'|(?:submit|button|reset)\b)/i.test(attrs);
        const valMatch = attrs.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
        const hasValue = !!(valMatch && (valMatch[1] ?? valMatch[2] ?? valMatch[3]).trim().length > 0);
        const ariaLabelMatch = attrs.match(/\baria-label\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
        const hasAriaLabel = !!(ariaLabelMatch && (ariaLabelMatch[1] ?? ariaLabelMatch[2] ?? ariaLabelMatch[3]).trim().length > 0);
        const ariaLabelledbyMatch = attrs.match(/\baria-labelledby\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
        const hasAriaLabelledby = !!(ariaLabelledbyMatch && (ariaLabelledbyMatch[1] ?? ariaLabelledbyMatch[2] ?? ariaLabelledbyMatch[3]).trim().length > 0);
        const idMatch = attrs.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
        const inputId = idMatch ? (idMatch[1] ?? idMatch[2] ?? idMatch[3]) : null;
        const hasAssociatedLabel = inputId ? labelForIds.has(inputId) : false;
        const isEnclosedInLabel = labelDepth > 0;
        const isAccessible = isHidden || (isButtonType && hasValue) || hasAriaLabel || hasAriaLabelledby || hasAssociatedLabel || isEnclosedInLabel;
        assert.ok(
          isAccessible,
          `Input #${inputCount} (${attrs}) in dist/demo/index.html must have an accessible name`
        );
      }
    }
    assert.ok(inputCount >= 20, `Expected at least 20 inputs in demo HTML, found ${inputCount}`);

    assert.match(demoJs, /data-dialog-open/, "demo.js must handle [data-dialog-open]");
    assert.match(demoJs, /data-dialog-close/, "demo.js must handle [data-dialog-close]");
    assert.match(demoJs, /preventDefault/, "demo.js must handle form submit event prevention");
  });
});
