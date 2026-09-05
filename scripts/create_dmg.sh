#!/usr/bin/env bash
set -euo pipefail

app_name="Dictation Tool"
version="$(node -p "require('./package.json').version")"
app_path="dist/mac-arm64/${app_name}.app"
output_path="dist/${app_name}-${version}-arm64.dmg"
staging_directory="$(mktemp -d "${TMPDIR:-/tmp}/dictation-dmg.XXXXXX")"
staged_app_path="${staging_directory}/${app_name}.app"

cleanup() {
  rm -rf "$staging_directory"
}
trap cleanup EXIT

if [[ ! -d "$app_path" ]]; then
  echo "Packaged application not found: $app_path" >&2
  exit 1
fi

# electron-builder's DMG target omitted Electron Framework.framework/Electron
# Framework on this machine. Build the image directly from its valid --dir app
# output so macOS receives the complete app bundle. Stage it outside Desktop
# without extended attributes; Finder and file-provider metadata prevents
# macOS from signing an app bundle in place.
ditto --noextattr --norsrc "$app_path" "$staged_app_path"
codesign --force --deep --sign - "$staged_app_path"

hdiutil create \
  -volname "${app_name} ${version}" \
  -srcfolder "$staged_app_path" \
  -ov \
  -format UDZO \
  "$output_path"

echo "Created ${output_path}"
