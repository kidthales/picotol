import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const tscJs = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");

function runTsc(args, options = {}) {
  return spawnSync(process.execPath, [tscJs, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
}

test("tsc --noEmit smoke fixture imports JSON subpaths under moduleResolution: bundler", () => {
  const tsconfigPath = path.join(ROOT, "tests/fixtures/tsc/tsconfig.bundler.json");
  const result = runTsc(["-p", tsconfigPath, "--noEmit"]);
  assert.equal(
    result.status,
    0,
    `tsc bundler smoke test failed with code ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
});

test("tsc --noEmit smoke fixture imports JSON subpaths under moduleResolution: node16", () => {
  const tsconfigPath = path.join(ROOT, "tests/fixtures/tsc/tsconfig.node16.json");
  const result = runTsc(["-p", tsconfigPath, "--noEmit"]);
  assert.equal(
    result.status,
    0,
    `tsc node16 smoke test failed with code ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
});

test("tsc rejects imports from CSS subpaths that no longer provide types conditions", () => {
  const tempDir = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/tsc/.tmp-css-test-"));
  try {
    const invalidTs = path.join(tempDir, "invalid.ts");
    fs.writeFileSync(invalidTs, "import styles from '@kidthales/picotol/css';\nvoid styles;\n", "utf8");

    const tempConfig = path.join(tempDir, "tsconfig.json");
    fs.writeFileSync(
      tempConfig,
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2022",
            module: "node16",
            moduleResolution: "node16",
            noEmit: true,
            strict: true,
            skipLibCheck: true,
          },
          include: ["invalid.ts"],
        },
        null,
        2
      ),
      "utf8"
    );

    const result = runTsc(["-p", tempConfig, "--noEmit"]);
    assert.notEqual(result.status, 0, "Importing CSS subpath in TypeScript must fail compilation");
    assert.match(
      result.stdout,
      /error TS2307: Cannot find module '@kidthales\/picotol\/css'/,
      "Expected TS2307 Cannot find module error for CSS subpath"
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("tsc enforces shape contracts for palette-data and sri JSON modules", () => {
  const tempDir = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/tsc/.tmp-shape-test-"));
  try {
    const invalidTs = path.join(tempDir, "invalid-shape.ts");
    fs.writeFileSync(
      invalidTs,
      `import paletteData from '@kidthales/picotol/palette-data';
import sri from '@kidthales/picotol/sri';

// Invalid property assignment must be caught by tsc
const wrongNum: number = paletteData.schemes;
const wrongPackage: number = sri.package;
void wrongNum;
void wrongPackage;
`,
      "utf8"
    );

    const tempConfig = path.join(tempDir, "tsconfig.json");
    fs.writeFileSync(
      tempConfig,
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2022",
            module: "node16",
            moduleResolution: "node16",
            noEmit: true,
            strict: true,
            skipLibCheck: true,
          },
          include: ["invalid-shape.ts"],
        },
        null,
        2
      ),
      "utf8"
    );

    const result = runTsc(["-p", tempConfig, "--noEmit"]);
    assert.notEqual(result.status, 0, "Invalid type assignments must fail compilation");
    assert.match(result.stdout, /error TS2322:/, "Expected TS2322 Type mismatch error");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
