# Releasing Message Bridge

The release workflow builds macOS Apple Silicon, macOS Intel, and Windows x64
artifacts from a version tag. macOS artifacts must be signed with a Developer
ID Application certificate issued to the approved legal publisher, Happy Webs
Limited (Apple team `59HH2JHF3G`), and notarized by Apple. Windows is packaged
for Microsoft Store, where Microsoft signs and delivers the package under the
verified publisher “Happy Webs”.

Happy Webs Limited is the certificate publisher only. The product remains
branded “Message Bridge”; do not add Happy Webs product branding, accounts,
subscriptions, or proprietary licensing. Do not use a development, Mac App
Store distribution, ad-hoc, or different company identity.

Unsigned Windows installers must not be attached to GitHub Releases. GitHub
Releases contain only the notarized macOS artifacts and their checksums.

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

## Windows Store credentials

Message Bridge has the following Microsoft Store identity:

- Store product ID: `9PBD74ZRV6ZT`
- Package identity name: `HappyWebs.MessageBridge`
- Package publisher: `CN=4D83A70F-1C90-4ECF-B70B-11A526955C12`
- Publisher display name: `Happy Webs`

Configure a dedicated Microsoft Entra application with only the Partner Center
permissions needed to update Message Bridge. Do not use an interactive user
password or grant unrelated product access. Configure these GitHub Actions
repository secrets:

- `PARTNER_CENTER_TENANT_ID`
- `PARTNER_CENTER_SELLER_ID`
- `PARTNER_CENTER_CLIENT_ID`
- `PARTNER_CENTER_CLIENT_SECRET`

The client secret is a CI credential. Store it only in GitHub Actions encrypted
secrets, set an expiry and rotation reminder, and revoke it immediately if it
is exposed. Never put it in workflow YAML, shell history, release notes, or the
repository.

The Windows job builds an AppX package, inspects its archive entries, and checks
the reserved Store identity, verified publisher, application name, executable
declaration, and bundled bridge. It then submits the package using Microsoft's
Store Developer CLI. The GitHub release job does not run unless Store
submission succeeds.

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
- the approved Happy Webs Limited Developer ID Application signing authority
- Apple team identifier `59HH2JHF3G`
- a signed bundled Go bridge
- a stapled Apple notarization ticket
- a successful Gatekeeper assessment

If signing credentials are absent, signing is incomplete, notarization fails,
Gatekeeper rejects the app, the AppX identity is wrong, or Microsoft Store
submission fails, the workflow fails without publishing a GitHub release.
