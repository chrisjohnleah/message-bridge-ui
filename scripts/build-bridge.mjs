import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const bridgeDirectory = resolve(desktopDirectory, "third_party", "whatsapp-mcp");
const outputDirectory = resolve(desktopDirectory, "resources", "bin");
const executable = process.platform === "win32" ? "whatsapp-bridge.exe" : "whatsapp-bridge";
const outputPath = resolve(outputDirectory, executable);

mkdirSync(outputDirectory, { recursive: true });
const result = spawnSync("go", ["build", "-trimpath", "-o", outputPath, "."], {
  cwd: bridgeDirectory,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
