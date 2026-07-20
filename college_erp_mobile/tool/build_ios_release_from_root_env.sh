#!/usr/bin/env bash
set -euo pipefail

mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$mobile_root/.." && pwd)"
env_path="$repo_root/.env"

if [[ ! -f "$env_path" ]]; then
  echo "Root .env was not found at $env_path" >&2
  exit 1
fi

get_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$env_path" | tail -n 1 | cut -d '=' -f 2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

cd "$mobile_root"

flutter build ipa --release \
  --dart-define="FIREBASE_API_KEY=$(get_env_value VITE_FIREBASE_API_KEY)" \
  --dart-define="FIREBASE_AUTH_DOMAIN=$(get_env_value VITE_FIREBASE_AUTH_DOMAIN)" \
  --dart-define="FIREBASE_PROJECT_ID=$(get_env_value VITE_FIREBASE_PROJECT_ID)" \
  --dart-define="FIREBASE_STORAGE_BUCKET=$(get_env_value VITE_FIREBASE_STORAGE_BUCKET)" \
  --dart-define="FIREBASE_MESSAGING_SENDER_ID=$(get_env_value VITE_FIREBASE_MESSAGING_SENDER_ID)" \
  --dart-define="FIREBASE_APP_ID=$(get_env_value VITE_FIREBASE_APP_ID)" \
  --dart-define="FIREBASE_MEASUREMENT_ID=$(get_env_value VITE_FIREBASE_MEASUREMENT_ID)" \
  --dart-define="FIREBASE_IOS_BUNDLE_ID=com.devlofttech.collegesoft"
