#!/bin/sh
# staff-bootstrap.sh — entrypoint for the EMS Guardian production image.
#
# Guarantees /staff/ can never come up unauthenticated. On every boot,
# before nginx starts, exactly one of these holds:
#   1. an existing credential file is reused (survives container recreation),
#   2. STAFF_USER + STAFF_PASSWORD generate it (bcrypt),
#   3. STAFF_GENERATE_PASSWORD=true generates a strong random password,
#      logged exactly once to startup output,
#   4. nothing is available -> the container refuses to start (exit 1).
#
# Layout: the durable store is the bind-mounted directory /etc/nginx/staff/
# (host: ./nginx/staff/, file: staff.htpasswd). The nginx.conf staff block is
# frozen by the go-live spec and reads the fixed path
# /etc/nginx/staff.htpasswd, so the entrypoint copies store -> read path on
# every boot. The store is a directory mount (not single-file) so first-boot
# generation can write to it and the Docker missing-file directory-bind
# gotcha cannot recur.
#
# Precedence: existing file > explicit STAFF_PASSWORD > generated password.

set -eu

STORE_DIR="/etc/nginx/staff"
STORE_FILE="$STORE_DIR/staff.htpasswd"
READ_FILE="/etc/nginx/staff.htpasswd"

log() { echo "[staff-bootstrap] $*"; }
fail() {
    echo "[staff-bootstrap] ERROR: $*" >&2
    echo "[staff-bootstrap] Refusing to start: /staff/ must never be reachable unauthenticated." >&2
    exit 1
}

# Strong random password from the kernel CSPRNG: 24 bytes -> 48 hex chars
# (192 bits). Hex keeps it copy/paste-safe in logs and basic-auth prompts.
random_password() {
    od -An -N24 -tx1 /dev/urandom | tr -d ' \n'
}

generate() {  # args: username password
    bs_user="$1"
    bs_pass="$2"
    mkdir -p "$STORE_DIR" || fail "Cannot create $STORE_DIR."
    htpasswd -bcB "$STORE_FILE" "$bs_user" "$bs_pass" \
        || fail "htpasswd could not write $STORE_FILE (read-only or unwritable mount?)."
    # Best effort: htpasswd already writes 644; the chmod only matters when
    # a restrictive umask or pre-existing ownership gets in the way.
    chmod 644 "$STORE_FILE" 2>/dev/null || true
}

if [ -s "$STORE_FILE" ]; then
    log "Existing staff credential file found at $STORE_FILE - using it (env ignored)."
elif [ -n "${STAFF_USER:-}" ] && [ -n "${STAFF_PASSWORD:-}" ]; then
    generate "$STAFF_USER" "$STAFF_PASSWORD"
    log "Generated staff credentials at $STORE_FILE from STAFF_USER/STAFF_PASSWORD (bcrypt)."
elif [ "${STAFF_GENERATE_PASSWORD:-}" = "true" ]; then
    # STAFF_USER is optional here so the feature works from a single env var.
    generated_user="${STAFF_USER:-staff}"
    generated_pass="$(random_password)"
    generate "$generated_user" "$generated_pass"
    log "Generated staff credential file at $STORE_FILE (bcrypt)."
    log "Staff username: $generated_user"
    log "Staff password: $generated_pass"
    log "Shown exactly once - copy it now. Rotate later by updating $STORE_FILE and recreating the container."
else
    fail "No staff credential file at $STORE_FILE and no way to create one. Set one of:
  STAFF_USER + STAFF_PASSWORD   (bootstrap credentials from env)
  STAFF_GENERATE_PASSWORD=true  (strong random password, logged once)
  or place an htpasswd file at nginx/staff/staff.htpasswd on the host."
fi

# Publish the durable store at the fixed path nginx.conf reads.
cp "$STORE_FILE" "$READ_FILE" || fail "Cannot copy $STORE_FILE -> $READ_FILE."
chmod 644 "$READ_FILE"
[ -s "$READ_FILE" ] || fail "Credential materialization produced an empty file at $READ_FILE."

log "Staff credential materialized; handing off to nginx."
exec /docker-entrypoint.sh "$@"
