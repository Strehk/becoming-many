<!--
Purpose: Track unsafe handling of station Wi-Fi credentials.
Context: The flash page stores and logs the complete configure command.
Responsibility: Keep passwords out of persistent browser state and visible logs.
Boundary: This does not introduce credential management infrastructure.
-->

# Stop Persisting and Logging Wi-Fi Passwords

**Status:** Open
**Priority:** Security

## Problem

The flash page writes the Wi-Fi password to `localStorage` and logs the complete
configuration command, including the password, into the visible technician log.

## Affected Files

- `src/flash/flash-page.ts`
- `tests/flash/` if a focused test file is added
- `src/flash/README.md`
- `docs/direction/controls-m5.md`
- `docs/current-status.md`

## Smallest YAGNI Solution

Persist only SSID and device ID. Redact the password before logging a configure
command. Do not add encryption, Keychain integration, accounts, or a secret
service; the password can be entered for each setup session.

## Verification

Confirm storage contains no password and the page log never renders it.
