#!/bin/sh
# Genera Core/Config.swift (ignorado por git) con la URL y la clave PÚBLICA de Supabase, leídas del .env de la raíz.
# No imprime ningún valor. Uso: sh apps/ios/scripts/write-config.sh
set -eu
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/apps/ios/balance/balance/Core/Config.swift"
URL="$(grep '^SUPABASE_URL=' "$ROOT/.env" | cut -d= -f2-)"
KEY="$(grep '^SUPABASE_PUBLISHABLE_KEY=' "$ROOT/.env" | cut -d= -f2-)"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en .env" >&2; exit 1; }
cat > "$OUT" <<SWIFT
// GENERADO por apps/ios/scripts/write-config.sh desde .env. Ignorado por git. No editar.
import Foundation

enum Config {
    static let supabaseURL = URL(string: "$URL")!
    static let supabaseKey = "$KEY"
}
SWIFT
echo "Config.swift escrito"
