#!/bin/sh
set -eu

PWFILE="/tmp/mosquitto_pwfile"
ACLFILE="/tmp/mosquitto_acl.conf"
rm -f "$PWFILE" "$ACLFILE"

BACKEND_USER="${MQTT_BACKEND_USER:-agritech_backend}"
BACKEND_PASS="${MQTT_BACKEND_PASSWORD:-agritech_backend_dev_pwd}"
SIM_USER="${MQTT_SIMULATOR_USER:-agritech_simulator}"
SIM_PASS="${MQTT_SIMULATOR_PASSWORD:-agritech_simulator_dev_pwd}"

validate_username() {
    name="$1"
    label="$2"
    case "$name" in
        ""|*[!A-Za-z0-9._-]*)
            echo "ERROR: Invalid $label '$name' (allowed characters: A-Z, a-z, 0-9, '.', '_', '-')" >&2
            exit 1
            ;;
    esac
}

validate_username "$BACKEND_USER" "MQTT_BACKEND_USER"
validate_username "$SIM_USER" "MQTT_SIMULATOR_USER"

if [ "$BACKEND_USER" = "$SIM_USER" ]; then
    echo "ERROR: MQTT_BACKEND_USER and MQTT_SIMULATOR_USER must be distinct for least-privilege ACLs." >&2
    exit 1
fi

# Generate hashed password file in-place via -U (avoids leaking passwords via /proc/<pid>/cmdline)
umask 077
printf '%s:%s\n%s:%s\n' "$BACKEND_USER" "$BACKEND_PASS" "$SIM_USER" "$SIM_PASS" > "$PWFILE"
mosquitto_passwd -U "$PWFILE"
chown mosquitto:mosquitto "$PWFILE"
chmod 0600 "$PWFILE"

# Render ACL file dynamically for configured usernames with strict 0600 mosquitto ownership
sed \
    -e "s/^user agritech_backend$/user ${BACKEND_USER}/" \
    -e "s/^user agritech_simulator$/user ${SIM_USER}/" \
    /mosquitto/config/acl.conf > "$ACLFILE"
chown mosquitto:mosquitto "$ACLFILE"
chmod 0600 "$ACLFILE"

# Ensure writable data/log directories are owned by mosquitto without touching :ro config mounts
chown -R mosquitto:mosquitto /mosquitto/data /mosquitto/log 2>/dev/null || true

exec "$@"
