import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL(
  "../third_party/whatsapp-mcp/UPSTREAM.json",
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const ref = `refs/heads/${manifest.branch}`;

let response;
try {
  response = execFileSync("git", ["ls-remote", manifest.repository, ref], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch (error) {
  const detail = error.stderr?.toString().trim() || error.message;
  console.error(`Unable to query upstream: ${detail}`);
  process.exit(1);
}

const [latestCommit] = response.split(/\s+/);
if (!latestCommit) {
  console.error(`Upstream branch not found: ${manifest.repository} ${manifest.branch}`);
  process.exit(1);
}

const updateAvailable = latestCommit !== manifest.commit;
console.log(`Tracked upstream: ${manifest.commit}`);
console.log(`Latest upstream:  ${latestCommit}`);
console.log(updateAvailable ? "An upstream update is available." : "Upstream is up to date.");

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `update_available=${updateAvailable}`,
      `tracked_commit=${manifest.commit}`,
      `latest_commit=${latestCommit}`,
      `repository=${manifest.repository}`,
      "",
    ].join("\n"),
  );
}

if (updateAvailable && !process.env.GITHUB_OUTPUT) {
  process.exitCode = 2;
}
