import { spawn } from "node:child_process";

const DEFAULT_URL = "http://127.0.0.1:4321";
const targetUrl = process.argv[2] ?? DEFAULT_URL;

let parsed;
try {
  parsed = new URL(targetUrl);
} catch {
  console.error(`[terminal-browser-pilot] Invalid URL: ${targetUrl}`);
  process.exit(2);
}

if (!["http:", "https:"].includes(parsed.protocol)) {
  console.error("[terminal-browser-pilot] Only http(s) URLs are allowed.");
  process.exit(2);
}

const env = {
  ...process.env,
  // Keep this bounded pilot privacy-first. Users can explicitly override it.
  TERMINAL_BROWSER_NO_TELEMETRY:
    process.env.TERMINAL_BROWSER_NO_TELEMETRY ?? "1",
};

console.log(`[terminal-browser-pilot] Opening ${parsed.href}`);
console.log(
  "[terminal-browser-pilot] Telemetry default: off for this pilot (override with TERMINAL_BROWSER_NO_TELEMETRY=0).",
);

const child = spawn(
  "terminal-browser",
  ["open", "--split", "right", parsed.href],
  {
    stdio: "inherit",
    env,
  },
);

child.on("error", (error) => {
  if (error && error.code === "ENOENT") {
    console.error(
      "[terminal-browser-pilot] terminal-browser is not installed. Install with: brew install terminal-browser",
    );
  } else {
    console.error("[terminal-browser-pilot] Failed to launch:", error);
  }
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[terminal-browser-pilot] Exited by signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
