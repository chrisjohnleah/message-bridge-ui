# Message Bridge

Message Bridge is a free, open-source desktop interface for a local messaging
bridge. It gives you a unified inbox, isolated linked-account profiles,
optional AI-assisted drafts, local memory controls, and an MCP interface whose
read and send permissions are granted separately.

> [!WARNING]
> This is unofficial compatibility software. It is not affiliated with,
> endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc. Automated
> or unsupported use may breach provider terms and could cause account
> restrictions or bans. There is no guarantee that the bridge will keep working.
> Use a non-critical account and assess the current terms yourself.

## Principles

- Free software: no subscription, activation key, hosted account, or telemetry.
- Local by default: linked sessions, the message archive, configuration, and
  assistant memory are stored on your computer.
- Explicit boundaries: AI is optional, MCP is disabled for every new account,
  and MCP sending requires an additional per-account opt-in.
- Honest disclosure: an AI provider receives selected conversation and memory
  context when you request a draft. An MCP client may send retrieved data to
  its own model provider.

## Status

This is an early community project. It is suitable for development and
evaluation, not a promise of uninterrupted service. Back up important data and
do not rely on it for emergency or regulated communications.

## Download

Release downloads are distributed through
[GitHub Releases](https://github.com/chrisjohnleah/message-bridge-ui/releases/latest):

- signed and Apple-notarized macOS builds for Apple Silicon and Intel
- an Authenticode-signed Windows 64-bit installer

The macOS artifacts in v0.1.0 were published without a complete Developer ID
signature or Apple notarization. Current macOS versions may therefore report
that the app is damaged even though its checksum is valid. This is a known
release defect; use v0.1.1 or later. The v0.1.0 Windows installer is also
unsigned and may show an unverified-publisher warning; use the signed installer
from v0.1.1 or later instead.

Always verify a download against the release's `SHA256SUMS.txt`. Windows
installers should report **Happy Webs Limited** as the verified publisher.
Proceed only if you trust this repository and its source.

## Development

Prerequisites:

- Node.js 24
- Go version declared in `third_party/whatsapp-mcp/go.mod`

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm test
(cd third_party/whatsapp-mcp && go test ./...)
npm run build
```

The app stores development data in Electron's application data directory.
Provider API keys use the operating system's secure credential storage when it
is available. The app refuses to store a key using Electron's Linux
`basic_text` fallback.

## MCP permissions

Open **Connections**, copy the configuration for your MCP client, then grant
access only to the accounts it needs:

1. **Read access** permits chat search and message retrieval.
2. **Send access** appears as a separate opt-in and cannot be enabled without
   read access.
3. Turning read access off also turns send access off.

Message Bridge must be running for the local MCP server to work.

## Upstream and attribution

The bundled bridge is derived from the MIT-licensed
[whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) project by Luke Harries
and later work published by
[Very Good Plugins](https://github.com/verygoodplugins/whatsapp-mcp).
It uses `whatsmeow` (MPL-2.0) and `libsignal` (GPL-3.0).

See [NOTICE](NOTICE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the
full texts under [LICENSES](LICENSES).

The exact bundled bridge revision is recorded in
[`third_party/whatsapp-mcp/UPSTREAM.json`](third_party/whatsapp-mcp/UPSTREAM.json).
Upstream is checked weekly; see
[`docs/UPSTREAM.md`](docs/UPSTREAM.md) for the reviewed update process.

Release maintainers should also follow
[`docs/RELEASING.md`](docs/RELEASING.md) so macOS artifacts are signed,
notarized, and Gatekeeper-tested, while Windows application binaries and the
installer are Authenticode-signed and verified before publication.

## Licence

Message Bridge is distributed under **GPL-3.0-only**. Individual third-party
components remain under their stated licences. See [LICENSE](LICENSE).

Contributions are welcome under the same project licence. Read
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[PRIVACY.md](PRIVACY.md) before contributing or deploying.
