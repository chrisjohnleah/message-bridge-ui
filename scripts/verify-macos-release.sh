#!/usr/bin/env bash

set -euo pipefail

expected_authority="Developer ID Application: Happy Webs Limited (59HH2JHF3G)"
expected_team_id="59HH2JHF3G"

if (( $# == 0 )); then
  echo "Usage: $0 <release.dmg> [release.dmg ...]" >&2
  exit 2
fi

mounted_path=""

cleanup() {
  if [[ -n "${mounted_path}" ]]; then
    hdiutil detach "${mounted_path}" >/dev/null 2>&1 || true
    rmdir "${mounted_path}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

for dmg_path in "$@"; do
  if [[ ! -f "${dmg_path}" ]]; then
    echo "macOS release artifact not found: ${dmg_path}" >&2
    exit 1
  fi

  hdiutil verify "${dmg_path}"

  mounted_path="$(mktemp -d "${RUNNER_TEMP:-/tmp}/message-bridge-release.XXXXXX")"
  hdiutil attach \
    -nobrowse \
    -readonly \
    -mountpoint "${mounted_path}" \
    "${dmg_path}" >/dev/null

  app_paths=("${mounted_path}"/*.app)
  if (( ${#app_paths[@]} != 1 )) || [[ ! -d "${app_paths[0]}" ]]; then
    echo "Expected exactly one app bundle in ${dmg_path}" >&2
    exit 1
  fi

  app_path="${app_paths[0]}"
  bridge_path="${app_path}/Contents/Resources/bin/whatsapp-bridge"

  codesign --verify --deep --strict --verbose=2 "${app_path}"
  signature_details="$(codesign --display --verbose=4 "${app_path}" 2>&1)"
  if ! grep -Fqx "Authority=${expected_authority}" <<< "${signature_details}"; then
    echo "App is not signed by the approved publisher: ${expected_authority}" >&2
    exit 1
  fi
  if ! grep -Fqx "TeamIdentifier=${expected_team_id}" <<< "${signature_details}"; then
    echo "App signature does not use the approved Apple team: ${expected_team_id}" >&2
    exit 1
  fi

  if [[ ! -x "${bridge_path}" ]]; then
    echo "Bundled bridge executable is missing or not executable" >&2
    exit 1
  fi
  codesign --verify --strict --verbose=2 "${bridge_path}"

  xcrun stapler validate "${app_path}"
  spctl --assess --type execute --verbose=4 "${app_path}"

  hdiutil detach "${mounted_path}" >/dev/null
  rmdir "${mounted_path}"
  mounted_path=""
done
