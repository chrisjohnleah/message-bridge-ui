# Upstream bridge maintenance

Message Bridge vendors the Go bridge from
[`verygoodplugins/whatsapp-mcp`](https://github.com/verygoodplugins/whatsapp-mcp)
under `third_party/whatsapp-mcp/`. The exact source revision used by this
project is recorded in `third_party/whatsapp-mcp/UPSTREAM.json`.

The vendored copy is intentionally not a Git submodule. Message Bridge adds a
desktop API and pairing-state integration to the bridge, so upstream changes
must be reviewed and tested rather than merged automatically.

## Update policy

- A scheduled GitHub Actions check compares the recorded revision with
  upstream `main` every Monday.
- When upstream moves, the workflow opens one issue named
  **Upstream bridge update available**.
- Upstream security and compatibility fixes should be reviewed promptly.
- A Message Bridge release must identify the upstream revision it contains.

## Applying an update

1. Fetch the configured upstream repository.
2. Review changes under upstream's `whatsapp-bridge/` directory since the
   commit recorded in `UPSTREAM.json`.
3. Port the applicable changes into `third_party/whatsapp-mcp/`, preserving
   `desktop_api.go`, `pairing_state.go`, and their integration hooks in
   `main.go`.
4. Update `UPSTREAM.json` only after the source changes have been applied.
5. Run:

   ```sh
   npm run upstream:check
   npm run notices
   npm run typecheck
   npm test
   (cd third_party/whatsapp-mcp && go test ./...)
   npm run build
   ```

6. Record the new upstream commit in the next release notes.

`npm run upstream:check` exits successfully when the recorded revision matches
the tip of the configured upstream branch. It exits with status 2 when an
update is available.
