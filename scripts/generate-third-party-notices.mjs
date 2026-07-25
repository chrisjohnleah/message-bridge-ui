import { access, readFile } from "node:fs/promises";

const required = [
  ["package-lock.json", "JavaScript dependency lockfile"],
  ["third_party/whatsapp-mcp/go.mod", "Go dependency manifest"],
  ["third_party/whatsapp-mcp/go.sum", "Go dependency checksums"],
  ["LICENSES/MIT-whatsapp-mcp.txt", "whatsapp-mcp MIT licence"],
  ["LICENSES/MPL-2.0.txt", "whatsmeow MPL-2.0 licence"],
  ["LICENSES/GPL-3.0-only.txt", "libsignal GPL-3.0 licence"],
  ["THIRD_PARTY_NOTICES.md", "third-party notice summary"]
];

for (const [path, description] of required) {
  await access(path).catch(() => {
    throw new Error(`Missing ${description}: ${path}`);
  });
}

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
if (lock.name !== "message-bridge-ui") {
  throw new Error("package-lock.json does not describe message-bridge-ui");
}

console.log(`Validated ${required.length} dependency and licence records.`);
