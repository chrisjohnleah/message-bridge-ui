# Releasing Message Bridge

The release workflow builds macOS Apple Silicon, macOS Intel, and Windows x64
artifacts from a version tag. macOS artifacts must be signed with a Developer
ID Application certificate issued to the approved legal publisher, Happy Webs
Limited (Apple team `59HH2JHF3G`), and notarized by Apple. Windows application
binaries and the NSIS installer must be Authenticode-signed under the verified
publisher Happy Webs Limited using Azure Artifact Signing.

Happy Webs Limited is the certificate publisher only. The product remains
branded “Message Bridge”; do not add Happy Webs product branding, accounts,
subscriptions, or proprietary licensing. Do not use a development, Mac App
Store distribution, ad-hoc, or different company identity.

Unsigned Windows installers must not be attached to GitHub Releases.

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

## Windows credentials

Direct Windows downloads use Azure Artifact Signing's Public Trust model.
Configure a Basic Artifact Signing account, complete organisation identity
validation for Happy Webs Limited, and create one Public Trust certificate
profile.

Use GitHub OpenID Connect rather than a client secret. The Azure app
registration or managed identity needs only the **Artifact Signing Certificate
Profile Signer** role scoped to the Message Bridge certificate profile. Its
federated credential must trust only the `release-signing` GitHub environment.
Configure that environment to accept protected version tags matching
`v*.*.*`; do not allow arbitrary branches or tags to use the signing identity.

Configure these GitHub Actions `release-signing` environment secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Configure these `release-signing` environment variables:

- `AZURE_ARTIFACT_SIGNING_ENDPOINT`
- `AZURE_ARTIFACT_SIGNING_ACCOUNT`
- `AZURE_ARTIFACT_SIGNING_PROFILE`

The Windows job builds an unpacked application, signs the Message Bridge and
bundled Go bridge executables, creates the NSIS installer from that signed
application, then signs and timestamps the installer. It verifies every
project-owned executable and the installer before uploading the installer.
The GitHub release job does not run unless all Windows signatures are valid.

Artifact Signing certificates are short-lived, so RFC 3161 timestamping is
mandatory. No private signing key or client secret is stored in GitHub.

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

The Windows job additionally requires:

- valid Authenticode signatures on `Message Bridge.exe`,
  `whatsapp-bridge.exe`, and the downloadable NSIS installer
- a Happy Webs Limited signer identity
- an RFC 3161 timestamp on every signature

If signing configuration is absent, any signature is invalid, notarization
fails, or an operating-system trust check fails, the workflow stops without
publishing a GitHub release.
