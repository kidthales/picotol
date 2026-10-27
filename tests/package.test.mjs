import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("npm pack --dry-run enforces size budgets and excludes demo/dev/CI files", () => {
  const raw = execSync("npm pack --dry-run --json", { cwd: ROOT, encoding: "utf8" });
  const [info] = JSON.parse(raw);

  assert.equal(info.name, "@kidthales/picotol");
  assert.ok(info.size <= 42 * 1024, `Tarball size ${info.size} B exceeds 42 KB budget`);
  assert.ok(info.unpackedSize <= 230 * 1024, `Unpacked size ${info.unpackedSize} B exceeds 230 KB budget`);

  const paths = info.files.map((f) => f.path);
  assert.ok(paths.includes("LICENSE"), "LICENSE must be included in tarball");
  assert.ok(paths.includes("NOTICE"), "NOTICE must be included in tarball");
  assert.ok(paths.includes("README.md"), "README.md must be included in tarball");
  assert.ok(paths.includes("dist/picotol.min.css"), "dist/picotol.min.css must be included");
  assert.ok(paths.includes("dist/picotol.core.min.css"), "dist/picotol.core.min.css must be included");
  assert.ok(paths.includes("dist/picotol.layer.min.css"), "dist/picotol.layer.min.css must be included");
  assert.ok(paths.includes("dist/sri.json"), "dist/sri.json must be included");

  for (const p of paths) {
    assert.doesNotMatch(
      p,
      /^(\.github|tests|tools|dist\/demo)\//,
      `Demo/dev/CI file "${p}" must not leak into npm tarball`
    );
  }
});

test("all 11 package.json subpath exports resolve to valid files", () => {
  const expectedExports = [
    ".",
    "./css",
    "./core",
    "./core/css",
    "./layer",
    "./layer/css",
    "./tokens",
    "./palettes",
    "./palette-data",
    "./sri",
    "./package.json",
  ];
  for (const exp of expectedExports) {
    assert.ok(pkg.exports[exp], `Missing export "${exp}" in package.json`);
    const targetPath = path.join(ROOT, pkg.exports[exp]);
    assert.ok(fs.existsSync(targetPath), `Export "${exp}" target "${pkg.exports[exp]}" does not exist`);
  }
});

test("package.json is configured for public npm release", () => {
  assert.equal(pkg.private, undefined, "package.json must not have 'private: true'");
  assert.equal(pkg.publishConfig?.access, "public", "package.json must specify publishConfig.access: 'public'");
});
