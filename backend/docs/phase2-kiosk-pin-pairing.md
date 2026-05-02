# Phase 2 Kiosk PIN and Pairing

## PIN model

- Employees stay organization-scoped.
- A kiosk PIN is unique within one organization through `employees.organization_id + employees.pin_lookup_key`.
- `employees.pin_hash` is used for verification.
- `employees.pin_ciphertext` stores the current PIN encrypted at rest so authorized owners/admins can reveal it when needed.
- `employee_pin_events` records `generated`, `manual_set`, `revealed`, and `reset` actions without storing plaintext PINs.

## Pairing model

- Devices stay property-scoped through `property_devices.property_id`.
- QR pairing uses short-lived single-use rows in `property_device_pairing_tokens`.
- The QR token is exchanged once, then the kiosk receives a real property device auth token.
- Login pairing uses the existing authenticated property device registration endpoint and the same `property_devices` table.

## Request flow

1. Owner/admin creates or resets an employee PIN.
2. Property admin area generates a short-lived QR pairing token or a manager/admin pairs with login.
3. Kiosk stores the returned device auth token locally.
4. Kiosk submits a 6-digit PIN to `POST /api/public/time/devices/verify-pin`.
5. Backend resolves the employee by org-scoped PIN lookup, validates assignment to the kiosk property, and returns the next action.
6. Kiosk submits the real punch to the existing public punch endpoint.

## Guard rules

- Org membership is always checked first on authenticated client routes.
- Property scope is validated before device registration or QR generation.
- Employee resolution remains organization-scoped.
- Workforce eligibility still comes from `employee_property_assignments`.
- Raw punches remain immutable; manual edits only affect normalized shifts plus `time_adjustments`.
