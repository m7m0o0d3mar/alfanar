#!/bin/bash
# ==============================================================================
# pgTAP Test Runner for Supabase
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
#   bash run_pgtap.sh
#
# Prerequisites:
#   - pg_prove installed (brew install pg_tap || apt-get install pgtap)
#   - pgTAP extension installed in the database: CREATE EXTENSION IF NOT EXISTS pgtap;
# ==============================================================================

set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-}"
TEST_DIR="$(dirname "$0")/pgtap"
REPORT_DIR="$(dirname "$0")/../tests/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$REPORT_DIR"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL environment variable is not set."
  echo ""
  echo "Usage:"
  echo "  export SUPABASE_DB_URL=\"postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres\""
  echo "  bash $0"
  exit 1
fi

echo "=========================================="
echo "  pgTAP Test Runner"
echo "  DB URL: $DB_URL"
echo "  Time:   $(date)"
echo "=========================================="

run_test_file() {
  local file="$1"
  local name=$(basename "$file" .sql)
  local output_file="$REPORT_DIR/${name}_${TIMESTAMP}.txt"
  local json_file="$REPORT_DIR/${name}_${TIMESTAMP}.json"

  echo ""
  echo "--- Running: $name ---"

  if command -v pg_prove &> /dev/null; then
    pg_prove -d "$DB_URL" --format tap "$file" 2>&1 | tee "$output_file" || true
  else
    psql "$DB_URL" -tA -f "$file" 2>&1 | tee "$output_file" || true
  fi

  echo "  Output: $output_file"
}

for test_file in "$TEST_DIR"/test_*.sql; do
  if [ -f "$test_file" ]; then
    run_test_file "$test_file"
  fi
done

echo ""
echo "=========================================="
echo "  pgTAP Tests Complete"
echo "  Reports: $REPORT_DIR"
echo "=========================================="
