# PIN and Biometric Session Unlock Design

## Status

Approved conversational design for the Visit Control mobile client. This document is the implementation contract for the client-only feature.

## Purpose

After a parent signs in with email and password, reopening Visit Control must not require the credentials again while the backend session is still valid. The saved session must be protected locally by a mandatory four-digit PIN, with optional device biometrics as a faster unlock path.

The feature must behave consistently on iOS and Android, prevent protected child data from flashing before unlock, and return the user to full authentication whenever the backend session is no longer valid.

## Confirmed Constraints

- Start from `origin/develop-darya`.
- Change the React Native client only; do not change the backend.
- The deployed API is available under `http://93.77.168.178/api`.
- The current backend issues a JWT with a one-hour lifetime (`JWT_TTL_MS=3600000`).
- The backend has no refresh-token flow.
- A cold application launch always requires PIN or biometric unlock when a saved session exists.
- Returning from the background in less than five minutes does not require unlock.
- Returning after five minutes or more requires unlock.
- Five failed PIN attempts delete the local session and require email/password authentication.
- PIN is the mandatory fallback. Biometrics are optional.
- Test credentials are never committed, logged, or stored in application configuration.

## Non-goals

- Refresh tokens or any backend authentication change.
- Password recovery or backend account recovery.
- Remote PIN recovery.
- A web implementation of the mobile unlock flow.
- Broad dependency remediation unrelated to this feature.
- Treating a four-digit PIN as cryptographic protection against a compromised device.

## User Flows

### First sign-in

1. The user signs in with email and password through the existing `/token` endpoint.
2. The client keeps the token and routes to mandatory PIN creation instead of protected content.
3. The user enters a four-digit PIN twice.
4. Mismatched PIN entries are rejected and the confirmation step is restarted.
5. The client stores the completed protected session.
6. If supported and enrolled device biometrics are available, the client offers to enable them.
7. The user may enable biometrics or skip them.
8. The client loads the current user through `GET /user` and opens the protected application.

If the process is terminated after sign-in but before PIN creation is complete, the next launch resumes the mandatory PIN setup. It must not expose protected screens.

### Cold launch

1. The application reads the protected session record.
2. If no record exists, it shows email/password authentication.
3. If the record is incomplete, it resumes PIN setup.
4. If a complete record exists, it shows the unlock screen.
5. When biometrics are enabled and currently available, the application may prompt automatically once.
6. A successful PIN or biometric check resets failed PIN attempts and triggers `GET /user`.
7. A successful API response restores the Redux user state and opens protected screens.

### Background and foreground

- On transition to inactive or background, the application immediately draws a privacy shield so protected data is not captured in the system application switcher.
- The application records a monotonic in-process timestamp.
- On return before 300,000 milliseconds, it removes the privacy shield without requiring unlock.
- On return after 300,000 milliseconds, it changes the session to locked before removing the shield.
- If the operating system killed the process, the next launch follows the cold-launch flow and therefore always locks.

### PIN failures

- Each wrong PIN increments a persisted protected counter.
- The screen tells the user how many attempts remain.
- A successful PIN or biometric unlock resets the counter.
- The fifth wrong PIN atomically removes the local session and routes to email/password authentication.
- The unlock screen also offers “Sign in with email and password”; choosing it removes the local session first.

### Logout and session expiry

- Explicit logout removes the protected session record, in-memory token, PIN verifier, failed-attempt counter, and biometric preference.
- An authenticated API response with status `401` performs the same idempotent cleanup and shows “Session expired. Sign in again.”
- Multiple concurrent `401` responses must not cause redirect loops or repeated cleanup races.

## Session State Model

The root session gate owns navigation and exposes one of these explicit states:

- `bootstrapping`: protected storage is being read; no application route is rendered.
- `unauthenticated`: no reusable session exists; show email/password sign-in.
- `pinSetupRequired`: a token exists but PIN setup is incomplete.
- `locked`: a complete local session exists but is not locally unlocked.
- `validating`: local unlock succeeded and `GET /user` is checking the backend session.
- `authenticated`: local unlock and backend validation both succeeded.
- `validationUnavailable`: validation failed because of connectivity, timeout, or a server error; allow retry or full sign-in.

The root gate, rather than individual screens, decides which navigation tree is mounted. This prevents protected data from appearing briefly before authentication state is known.

## Client Components

### Protected session storage

A focused storage service wraps `expo-secure-store`. It stores a single versioned JSON record so related fields are updated together:

- access token;
- setup status;
- random PIN salt;
- salted PIN verifier;
- failed PIN attempt count;
- biometric opt-in flag;
- storage schema version.

The PIN itself is never stored. The verifier is derived with `expo-crypto`. A salt prevents identical PINs from producing identical stored values, but the design explicitly does not claim that a four-digit PIN resists offline brute force on a fully compromised device. The operating-system Keychain/Keystore remains the primary protection for the JWT.

The service provides narrow operations such as load, begin setup, complete setup, verify PIN, record failure, reset failures, update biometric preference, and clear. Callers do not manipulate storage keys directly.

On first launch after a fresh installation, an installation marker is compared with protected storage. If platform uninstall behaviour leaves an old Keychain record behind, the stale record is cleared rather than silently restoring a previous installation.

### In-memory token bridge

The existing API client continues to obtain the bearer token through the auth-token module. Bootstrapping loads the saved token into memory only when needed for validation. Clearing a session always clears both protected storage and this in-memory bridge.

### Local authentication service

A wrapper around `expo-local-authentication` is responsible for:

- checking hardware support;
- checking whether biometrics are enrolled;
- checking supported authentication types;
- prompting with device fallback disabled;
- requesting strong biometrics on Android;
- normalising success, cancellation, temporary lockout, unavailable hardware, and other errors.

Biometric cancellation or failure returns to PIN entry and never consumes a PIN attempt. Adding or removing enrolled biometrics does not make PIN unusable.

### Lifecycle lock controller

A single `AppState` listener owns the privacy shield, monotonic background timestamp, and five-minute decision. Screen components do not implement independent timers.

### API session expiry handler

The Axios response interceptor distinguishes authenticated `401` responses from network and server failures. It invokes one idempotent session-expired action. It does not clear the session on timeouts, offline errors, or `5xx` responses.

## Screens

### Create PIN

- Four-digit numeric input.
- Confirmation entry.
- Clear mismatch feedback.
- Back navigation cannot bypass setup into protected screens.

### Enable biometrics

- Shown only when supported biometrics are enrolled.
- Explains that biometrics speed up unlock and PIN remains available.
- Supports enable and skip.

### Unlock

- Four PIN indicators and numeric keypad.
- Automatic one-time biometric prompt when enabled.
- Explicit biometric retry control when available.
- Remaining-attempt feedback after a wrong PIN.
- Full sign-in option that clears the saved session.
- Validation loading state and retryable validation-unavailable state.

## Error Handling

### Backend session invalid

`401` from `GET /user`, or any other authenticated request, is authoritative. The client clears all local session material and routes to sign-in with a session-expired message.

The client does not need to decode JWT expiry locally; server validation is the source of truth.

### Network unavailable, timeout, or `5xx`

These failures do not prove expiry. The client retains the saved session, keeps protected content unmounted, and offers:

- Retry session validation.
- Sign in with email and password, which explicitly clears the saved session.

### Biometric errors

- User cancellation: remain on PIN screen.
- Authentication failure: remain on PIN screen and allow retry.
- System lockout: disable the immediate biometric prompt and use PIN.
- Hardware unavailable or enrolment removed: use PIN and leave the saved session intact.

## Platform Configuration

- Add `expo-secure-store`, `expo-local-authentication`, and `expo-crypto` using Expo SDK 54-compatible versions.
- Configure the LocalAuthentication plugin and a human-readable Face ID usage message in the Expo application configuration.
- Use `disableDeviceFallback: true` so a device passcode does not replace the application's PIN flow.
- Request strong biometric security on Android.
- PIN flows can be exercised in Expo Go, but Face ID requires an iOS development build. Final biometric acceptance therefore uses native development/release builds on physical devices where needed.

## Testing Strategy

The project currently has no test script or test runner. Add Jest configured for Expo and React Native Testing Library, keeping most logic in small pure modules so behaviour can be verified without native hardware.

Automated coverage must include:

- protected record creation, loading, migration/version rejection, and clearing;
- PIN confirmation match and mismatch;
- correct and incorrect PIN verification;
- persisted failed-attempt increments and deletion on the fifth failure;
- reset of failed attempts after successful PIN or biometric unlock;
- bootstrap transitions for missing, incomplete, and complete records;
- foreground return just below, at, and above five minutes;
- privacy shield behaviour;
- successful `GET /user` restoration;
- `401` cleanup and idempotence;
- offline, timeout, and `5xx` retry state without session deletion;
- biometric success, cancellation, failure, lockout, and unavailability;
- explicit logout and full-sign-in fallback cleanup.

Verification also includes:

- TypeScript compilation;
- Expo lint;
- Expo configuration validation;
- focused manual login, cold launch, background timeout, logout, and expiry checks against the deployed API;
- Android emulator or physical-device run when the local environment supports it;
- iOS simulator/device checks where available, noting that Face ID needs a development build and appropriate device support.

No test may contain real credentials. Manual credentials are supplied interactively or through uncommitted local environment data.

## Acceptance Criteria

- A signed-in user creates a mandatory four-digit PIN once per saved session.
- The user may opt into supported device biometrics and can always fall back to PIN.
- A valid saved JWT survives application restarts without asking for email/password.
- A cold start never displays protected content before local unlock and backend validation.
- Less than five minutes in the background does not prompt for unlock.
- Five minutes or more in the background prompts for unlock.
- Five incorrect PIN entries remove the local session.
- Backend `401` removes the local session and clearly requests full sign-in.
- Connectivity and `5xx` failures retain the session and support retry.
- Logout removes every local authentication artifact.
- The feature works on both iOS and Android with platform-appropriate biometric behaviour.
- Existing sign-in, registration, and protected application flows continue to work.

## Delivery

Implementation is developed on `codex/pin-biometric-auth` from `origin/develop-darya`. After automated and feasible local device verification, create a GitHub pull request. If device verification cannot be completed locally, produce an installable Android build when the available Android/EAS environment and credentials allow it, and document any remaining physical-device checks precisely.
