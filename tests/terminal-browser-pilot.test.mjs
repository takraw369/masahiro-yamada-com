import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("terminal-browser pilot stays development-only and privacy-first", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const launcher = fs.readFileSync(
    new URL("../scripts/terminal-browser-pilot.mjs", import.meta.url),
    "utf8",
  );

  assert.equal(
    pkg.scripts["pilot:terminal-browser"],
    "node scripts/terminal-browser-pilot.mjs",
  );
  assert.match(launcher, /TERMINAL_BROWSER_NO_TELEMETRY/);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:4321/);
  assert.match(
    launcher,
    /\["open", "--split", "right", parsed\.href\]/,
  );

  for (const productionScript of ["build", "preview", "deploy"]) {
    assert.doesNotMatch(
      pkg.scripts[productionScript],
      /terminal-browser|pilot:terminal-browser/,
    );
  }

  assert.equal(pkg.dependencies["terminal-browser"], undefined);
  assert.equal(pkg.devDependencies["terminal-browser"], undefined);
});
