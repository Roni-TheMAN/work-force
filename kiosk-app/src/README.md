# Kiosk Flow Notes

## Pairing model

- The kiosk is intentionally property-bound, not org-global.
- A successful pairing always resolves `organization + property + device` together.
- The frontend persists only the minimum mocked device session needed to reopen directly into kiosk mode after restart.

## Mocked today

- QR token parsing and pairing validation
- authorized admin login and property selection
- employee PIN validation
- clock event creation
- property branding/config lookup
- kiosk health responses

The service abstraction lives in [`src/services/kiosk-service.ts`](C:\Users\ronil\WebstormProjects\work-force\kiosk-app\src\services\kiosk-service.ts) and is intended to be replaced by real API calls later without changing the screen flow.

## Future API hook points

- `generatePairingToken(propertyId)` for admin/property management
- `pairKioskWithQr(payload, deviceName)` for short-lived single-use token exchange
- `authenticatePairingUser(credentials)` and `pairKioskWithAuthorizedLogin(...)`
- `fetchCurrentKioskDeviceBinding(deviceId)`
- `unpairKiosk(binding)`
- `validateEmployeePin(binding, pin)`
- `createClockEvent(...)`
- `fetchPropertyBranding(binding)`

## Property-scoped employee validation

- Employees stay organization-scoped.
- Kiosk access is allowed only when the employee is assigned to the kiosk's current property.
- The mock service mirrors the current backend shape by checking property assignment rather than duplicating employee records per property.

## Hidden panel trigger

- The hidden trigger is implemented in [`src/components/HiddenAdminTrigger.tsx`](C:\Users\ronil\WebstormProjects\work-force\kiosk-app\src\components\HiddenAdminTrigger.tsx).
- Change `ADMIN_TRIGGER_TAP_COUNT` or `ADMIN_TRIGGER_WINDOW_MS` in [`src/lib/constants.ts`](C:\Users\ronil\WebstormProjects\work-force\kiosk-app\src\lib\constants.ts) to adjust the gesture.
