# Releasing Message Bridge

The release workflow builds the macOS Apple Silicon, macOS Intel, and Windows
x64 artifacts from a version tag. macOS artifacts must be signed with a
Developer ID Application certificate issued for Message Bridge's maintainer
and notarized by Apple before GitHub Actions will upload them.

Do not use a development, Mac App Store distribution, ad-hoc, or unrelated
company identity. A release certificate may identify the maintainer, but it
must not introduce unrelated product branding.

## macOS credentials

Configure these GitHub Actions repository secrets:

- `MACOS_CSC_LINK`: the base64-encoded Developer ID Application `.p12`
- `MACOS_CSC_KEY_PASSWORD`: the password used when exporting the `.p12`
- `APPLE_API_KEY_P8_BASE64`: the base64-encoded App Store Connect API `.p8`
- `APPLE_API_KEY_ID`: the App Store Connect API key ID
- `APPLE_API_ISSUER`: the App Store Connect API issuer ID

The certificate and API key are different credentials. The certificate signs
the application; the API key authorizes submission to Apple's notary service.
Grant the API key only the access needed for notarization and store every value
as a GitHub Actions secret.

On macOS, encode each binary credential without line wrapping:

```sh
base64 -i DeveloperIDApplication.p12 | tr -d '\n'
base64 -i AuthKey_KEYID.p8 | tr -d '\n'
```

Never commit certificates, private keys, passwords, or decoded credentials.

## Release checks

Before tagging a release, update the version in `package.json` and
`package-lock.json`, then add matching notes at
`docs/releases/vX.Y.Z.md`. The release workflow rejects a tag when its version
or notes do not match.

Run:

```sh
npm run upstream:check
npm run notices
npm run typecheck
npm test
(cd third_party/whatsapp-mcp && go test ./...)
npm run build
```

The macOS jobs additionally mount each DMG and require:

- a structurally valid disk image
- a strict, complete code signature
- a Developer ID Application signing authority
- a signed bundled Go bridge
- a stapled Apple notarization ticket
- a successful Gatekeeper assessment

If credentials are absent, signing is incomplete, notarization fails, or
Gatekeeper rejects the app, the workflow fails before any release artifact is
uploaded.
