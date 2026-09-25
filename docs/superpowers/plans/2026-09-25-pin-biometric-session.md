# PIN and Biometric Session Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a valid Visit Control JWT securely and protect every restored mobile session with a mandatory four-digit PIN plus optional iOS/Android biometrics.

**Architecture:** A versioned session record in `expo-secure-store` is the durable source for the token, PIN verifier, attempt counter, and biometric preference. Redux Saga owns the explicit session state machine and backend validation, while a root session gate and one lifecycle hook prevent protected routes from rendering before local unlock and `GET /user` validation.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, Expo Router, Redux Toolkit, Redux Saga, Axios, `expo-secure-store`, `expo-local-authentication`, `expo-crypto`, `expo-screen-capture`, AsyncStorage, Jest, jest-expo, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-pin-biometric-session-design.md`

## Global Constraints

- Start from `origin/develop-darya`; client-only change.
- API base URL remains `http://93.77.168.178/api` for the current test stand.
- Insecure HTTP is allowed only in explicit test builds; production iOS configuration must retain ATS.
- Backend JWT lifetime is one hour and there is no refresh token.
- Cold launch with a saved session always requires local unlock.
- Background timeout is exactly 300,000 milliseconds.
- PIN is exactly four decimal digits and is always the fallback.
- Fifth failed PIN attempt clears the full local session.
- Authenticated `401` clears the session; offline, timeout, and `5xx` do not.
- No credential may appear in source, tests, fixtures, logs, or committed environment files.
- Existing registration, children, and attendance flows must remain functional.

## Review Focus

- Corrupt or future-version secure records must be removed and lead to sign-in, never crash or partially restore.
- Process termination after token persistence but before PIN completion must resume PIN setup without showing protected data.
- Concurrent authenticated `401` responses must cause one idempotent cleanup and no redirect loop.
- Resume just below, exactly at, and above 300,000 ms must produce deterministic privacy-shield and lock behaviour.
- Enabled biometrics becoming unavailable, unenrolled, cancelled, or locked out must leave PIN usable and must not consume a PIN attempt.

---

### Task 1: Native dependencies, test harness, and PIN cryptography

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Create: `app.config.ts`
- Create: `services/auth/pin-crypto.ts`
- Test: `services/auth/pin-crypto.test.ts`

**Interfaces:**
- Consumes: Expo SDK 54 package resolution.
- Produces: `isFourDigitPin(value: string): boolean`, `createPinSalt(): Promise<string>`, `derivePinVerifier(pin: string, salt: string): Promise<string>`, a test-only iOS HTTP switch, and a working `npm test` command.

- [ ] **Step 1: Install SDK-compatible runtime and test dependencies**

Run:

```bash
npx expo install expo-secure-store expo-local-authentication expo-crypto expo-screen-capture @react-native-async-storage/async-storage
npx expo install --dev jest jest-expo @testing-library/react-native @types/jest
```

Expected: package files contain Expo SDK 54-compatible versions and `npm install` exits 0.

- [ ] **Step 2: Configure Jest and native biometric metadata**

Add scripts and Jest config:

```json
"scripts": {
  "test": "jest",
  "test:ci": "jest --runInBand",
  "typecheck": "tsc --noEmit"
}
```

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
};
```

Add `expo-local-authentication` to `app.json` plugins with `faceIDPermission` set to `Разрешите Visit Control использовать Face ID для входа в приложение`. Create `app.config.ts` that imports the static config and sets `ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads = true` only when `EXPO_PUBLIC_ALLOW_INSECURE_HTTP=1`; omit that key for production. Add config checks for both modes so a test-only exception cannot leak into production.

- [ ] **Step 3: Write failing PIN crypto tests**

```ts
describe('PIN cryptography', () => {
  it.each(['', '123', '12345', '12a4', '１２３４'])('rejects %p', (pin) => {
    expect(isFourDigitPin(pin)).toBe(false);
  });

  it('accepts four ASCII digits', () => {
    expect(isFourDigitPin('0427')).toBe(true);
  });

  it('derives stable salted verifiers without storing the PIN', async () => {
    await expect(derivePinVerifier('1234', 'salt-a')).resolves.toBe(
      await derivePinVerifier('1234', 'salt-a'),
    );
    await expect(derivePinVerifier('1234', 'salt-a')).resolves.not.toBe(
      await derivePinVerifier('1234', 'salt-b'),
    );
  });
});
```

- [ ] **Step 4: Run the focused test and verify RED**

Run: `npm test -- services/auth/pin-crypto.test.ts --runInBand`

Expected: FAIL because `pin-crypto.ts` exports do not exist.

- [ ] **Step 5: Implement minimal PIN primitives**

Use ASCII-only validation, `await Crypto.getRandomBytesAsync(16)` encoded as hex, and `Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`)`. The synchronous random API is forbidden because Expo documents a `Math.random` development fallback.

- [ ] **Step 6: Run focused tests and static checks**

Run: `npm test -- services/auth/pin-crypto.test.ts --runInBand && test "$(npx jest --listTests | wc -l | tr -d ' ')" -gt 0 && npm run typecheck && npm run lint`

Expected: PASS, and Jest reports at least one discovered test from this `.worktrees` checkout; the one pre-existing `register.tsx` hook warning may remain.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json app.config.ts jest.config.js jest.setup.ts services/auth/pin-crypto.ts services/auth/pin-crypto.test.ts
git commit -m "test: add auth security test harness"
```

### Task 2: Versioned protected-session repository

**Files:**
- Create: `services/auth/protected-session.ts`
- Test: `services/auth/protected-session.test.ts`
- Create: `services/auth/install-marker.ts`
- Test: `services/auth/install-marker.test.ts`
- Modify: `services/auth/auth-token.ts`

**Interfaces:**
- Consumes: `derivePinVerifier(pin, salt)` from Task 1 and `expo-secure-store`.
- Produces: `ProtectedSessionRecord`, `PinAttemptResult`, `ProtectedSessionRepository`, `createProtectedSessionRepository(storage)`, singleton `protectedSessionRepository`, and `ensureCurrentInstallation(markerStore, repository): Promise<void>`.

```ts
export type ProtectedSessionRecord = {
  version: 1;
  token: string;
  status: 'pin_setup_required' | 'ready';
  pinSalt: string | null;
  pinVerifier: string | null;
  failedPinAttempts: number;
  biometricsEnabled: boolean;
};

export type PinAttemptResult =
  | { kind: 'success'; record: ProtectedSessionRecord }
  | { kind: 'failure'; remainingAttempts: number }
  | { kind: 'sessionCleared' };
```

- [ ] **Step 1: Write repository tests against an in-memory adapter**

Cover `beginSession`, incomplete-session reload, `completePinSetup`, correct PIN, persisted wrong attempts, clearing on attempt five, reset after success, biometric preference, and explicit clear. Validate non-empty token; exact 32-hex salt and 64-hex verifier; integer attempt range `0..4`; `ready` requiring salt/verifier; setup state requiring null PIN fields, zero attempts, and disabled biometrics. Cover malformed JSON, unsupported version, read/write/delete rejection, and promise-chain recovery after a rejected write.

```ts
it('clears the record on the fifth wrong PIN', async () => {
  const repo = createProtectedSessionRepository(memoryStorage());
  await repo.beginSession('jwt');
  await repo.completePinSetup('1234');
  for (let attempt = 1; attempt < 5; attempt += 1) {
    await expect(repo.verifyPin('9999')).resolves.toEqual({
      kind: 'failure', remainingAttempts: 5 - attempt,
    });
  }
  await expect(repo.verifyPin('9999')).resolves.toEqual({ kind: 'sessionCleared' });
  await expect(repo.load()).resolves.toBeNull();
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- services/auth/protected-session.test.ts --runInBand`

Expected: FAIL because the repository is missing.

- [ ] **Step 3: Implement strict record parsing and serialized writes**

Use one key (`visit-control.protected-session.v1`), enforce every cross-field invariant from Step 1, and delete invalid/future records. Serialize read-modify-write operations with `writeChain = writeChain.catch(() => undefined).then(operation)` so one native rejection cannot poison all future operations. Native storage errors must fail closed: no protected UI is opened, and bootstrap receives a retryable storage error rather than a partial session.

- [ ] **Step 4: Implement and test the fresh-install marker**

Store a non-secret installation marker in AsyncStorage. Before loading SecureStore, if the marker is absent, clear any stale Keychain session and then create the marker. Test first install, normal upgrade with marker preserved, iOS-style reinstall with a stale Keychain record but missing marker, and AsyncStorage read/write failure. This prevents silent session restoration after reinstall while keeping upgrades intact.

- [ ] **Step 5: Keep the in-memory bearer bridge narrow**

Remove the obsolete future-storage comment from `auth-token.ts`. Keep `getAuthToken`, `setAuthToken`, and `clearAuthToken`; durable operations must remain in the repository rather than leaking into the Axios client.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test -- services/auth/protected-session.test.ts services/auth/install-marker.test.ts --runInBand && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add services/auth/protected-session.ts services/auth/protected-session.test.ts services/auth/install-marker.ts services/auth/install-marker.test.ts services/auth/auth-token.ts
git commit -m "feat: persist protected mobile sessions"
```

### Task 3: Cross-platform biometric adapter

**Files:**
- Create: `services/auth/biometrics.ts`
- Test: `services/auth/biometrics.test.ts`

**Interfaces:**
- Produces: `BiometricCapability`, `BiometricPromptResult`, `getBiometricCapability()`, and `promptForBiometricUnlock()`.

```ts
export type BiometricPromptResult =
  | { kind: 'success' }
  | { kind: 'cancelled' }
  | { kind: 'lockedOut' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };
```

- [ ] **Step 1: Write adapter tests with mocked LocalAuthentication APIs**

Exercise no hardware, no enrolment, Android `SecurityLevel.BIOMETRIC_WEAK`, Android `SecurityLevel.BIOMETRIC_STRONG`, supported types, success, user cancel, system cancel, lockout, failed authentication, and thrown native errors. Assert that weak-only Android capability is unavailable, prompt options contain `disableDeviceFallback: true` and `biometricsSecurityLevel: 'strong'`, and two rapid requests share or reject the second prompt instead of opening native prompts in parallel.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- services/auth/biometrics.test.ts --runInBand`

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement capability and result normalisation**

Call `hasHardwareAsync`, `isEnrolledAsync`, `getEnrolledLevelAsync`, `supportedAuthenticationTypesAsync`, and `authenticateAsync`. Require `SecurityLevel.BIOMETRIC_STRONG` on Android and serialize prompts behind one in-flight promise. Never throw native biometric errors through to UI and never mutate PIN attempts.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- services/auth/biometrics.test.ts --runInBand
git add services/auth/biometrics.ts services/auth/biometrics.test.ts
git commit -m "feat: add biometric unlock adapter"
```

### Task 4: Redux session state machine, sagas, and idempotent expiry

**Files:**
- Modify: `store/types/auth.ts`
- Modify: `store/reducers/auth.ts`
- Modify: `store/sagas/auth.ts`
- Modify: `store/index.ts`
- Modify: `services/auth/auth-token.ts`
- Test: `store/reducers/auth.test.ts`
- Test: `store/sagas/auth.test.ts`

**Interfaces:**
- Consumes: install marker and repository from Task 2, biometrics from Task 3, `visitControlApi.login`, and `visitControlApi.getMe`.
- Produces: the exact state and action contract below. Secret-bearing actions are transient commands and are sanitised from Redux DevTools; `AuthState` never contains token, PIN, or password.

```ts
export type AuthPhase =
  | 'bootstrapping'
  | 'unauthenticated'
  | 'pinSetupRequired'
  | 'locked'
  | 'validating'
  | 'authenticated'
  | 'validationUnavailable'
  | 'storageUnavailable';
export type SetupStep = 'createPin' | 'offerBiometrics' | null;
export type LogoutReason = 'user' | 'switchAccount' | 'expired';

export interface AuthState {
  phase: AuthPhase;
  setupStep: SetupStep;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  user: User | null;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  remainingPinAttempts: number;
  sessionEpoch: number;
}

bootstrapSession(): PayloadAction<void>;
bootstrapUnauthenticated(payload?: { notice?: string }): PayloadAction<...>;
bootstrapPinSetupRequired(): PayloadAction<void>;
bootstrapLocked(payload: { biometricsEnabled: boolean }): PayloadAction<...>;
loginStart(payload: LoginCredentials): PayloadAction<LoginCredentials>;
loginFailure(payload: string): PayloadAction<string>;
completePinSetup(payload: { pin: string }): PayloadAction<...>;
pinSetupCompleted(payload: { biometricsAvailable: boolean }): PayloadAction<...>;
submitBiometricPreference(payload: { enabled: boolean }): PayloadAction<...>;
unlockWithPin(payload: { pin: string }): PayloadAction<...>;
unlockWithBiometrics(): PayloadAction<void>;
validationStarted(): PayloadAction<void>;
validationSucceeded(payload: User): PayloadAction<User>;
sessionValidationUnavailable(payload: string): PayloadAction<string>;
retrySessionValidation(): PayloadAction<void>;
storageUnavailable(payload: string): PayloadAction<string>;
retryProtectedStorage(): PayloadAction<void>;
lockSession(): PayloadAction<void>;
logoutRequested(payload: { reason: Exclude<LogoutReason, 'expired'> }): PayloadAction<...>;
sessionExpired(): PayloadAction<void>;
logoutCompleted(payload: { reason: LogoutReason; notice?: string }): PayloadAction<...>;
```

- [ ] **Step 1: Write reducer transition tests**

Pin transitions for missing/incomplete/complete bootstrap records, login-to-PIN setup, PIN-to-biometric offer, local lock, validation success, validation unavailable, logout, and session-expired notice. Assert `sessionEpoch` increments whenever a new token is accepted and when cleanup completes, and assert the state never contains token, PIN, or password.

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `npm test -- store/reducers/auth.test.ts --runInBand`

Expected: FAIL because the new state/actions do not exist.

- [ ] **Step 3: Implement the typed reducer state machine**

Replace independent booleans as routing authority with `phase` and remove `token` from Redux. Derive authentication from `phase === 'authenticated'`; do not preserve a second routing boolean. Implement every action signature above and migrate old `loginSuccess`/`logout` consumers to `validationSucceeded`/`logoutCompleted`.

- [ ] **Step 4: Write saga tests for all orchestration paths**

Use `runSaga` with mocked repository/API services. Cover:

```ts
it('resumes PIN setup when a token was saved before process death', async () => {
  repository.load.mockResolvedValue(incompleteRecord);
  await runBootstrapSaga();
  expect(dispatched).toContainEqual(
    expect.objectContaining({ type: bootstrapPinSetupRequired.type }),
  );
});

it('keeps the record on network validation failure', async () => {
  api.getMe.mockRejectedValue(networkApiError);
  await runValidationSaga();
  expect(repository.clear).not.toHaveBeenCalled();
  expect(dispatched).toContainEqual(
    expect.objectContaining({ type: sessionValidationUnavailable.type }),
  );
});
```

Also cover valid restore, authenticated `401`, `5xx`, biometric unavailable, biometric cancellation, correct PIN, wrong PIN, fifth failure, full-sign-in fallback, and explicit logout. Cover rejection from `ensureCurrentInstallation`, `load`, `beginSession`, and `completePinSetup`: protected UI remains closed, the phase becomes `storageUnavailable`, and any token already placed in memory is cleared immediately. Retrying protected storage reruns bootstrap without reusing credentials.

- [ ] **Step 5: Run saga tests and verify RED**

Run: `npm test -- store/sagas/auth.test.ts --runInBand`

Expected: FAIL until orchestration is implemented.

- [ ] **Step 6: Implement sagas and backend validation**

Login flow: call `/token`, set the in-memory token, persist `pin_setup_required`, then enter PIN setup. If persistence fails after `setAuthToken`, clear the memory token immediately and enter `storageUnavailable`. PIN completion enters biometric offer when available; submitting preference calls `GET /user`. Restore unlock calls `GET /user`; the Axios expiry handler owns authenticated `401` cleanup, while the validation saga ignores that already-handled error. Network/timeout/`5xx` enters `validationUnavailable` without clearing. Every installation-marker or SecureStore failure keeps protected UI unmounted and offers only a protected-storage retry.

- [ ] **Step 7: Make unauthorized cleanup idempotent**

Register the Axios unauthorized callback to dispatch `sessionExpired()` unconditionally. Both `sessionExpired()` and `logoutRequested()` enter one cleanup saga guarded by a module-local in-flight flag. That saga clears SecureStore and memory once, then dispatches `logoutCompleted({ reason })`; domain reducers reset on `logoutCompleted` so sign-in is not shown before cleanup finishes.

- [ ] **Step 8: Sanitize credential-bearing Redux actions and state**

Configure Redux DevTools with an `actionSanitizer` that replaces payloads for `loginStart`, `completePinSetup`, and `unlockWithPin` with `[REDACTED]`, and a `stateSanitizer` that exposes no credential or JWT material. Remove auth debug logs and add unit assertions for both sanitizers.

- [ ] **Step 9: Run auth tests and static checks**

Run: `npm test -- store/reducers/auth.test.ts store/sagas/auth.test.ts --runInBand && npm run typecheck && npm run lint`

Expected: PASS with no new warning.

- [ ] **Step 10: Commit**

```bash
git add store/types/auth.ts store/reducers/auth.ts store/sagas/auth.ts store/index.ts services/auth/auth-token.ts store/reducers/auth.test.ts store/sagas/auth.test.ts
git commit -m "feat: add protected session state machine"
```

### Task 5: Five-minute lifecycle lock and privacy shield

**Files:**
- Create: `services/auth/session-lock.ts`
- Test: `services/auth/session-lock.test.ts`
- Create: `hooks/use-session-lifecycle.ts`
- Test: `hooks/use-session-lifecycle.test.tsx`
- Create: `components/session/privacy-shield.tsx`
- Create: `services/auth/screen-privacy.ts`
- Test: `services/auth/screen-privacy.test.ts`

**Interfaces:**
- Consumes: `lockSession()` from Task 4 and React Native `AppState`.
- Produces: `SESSION_LOCK_TIMEOUT_MS = 300_000`, `shouldLockAfterBackground(startedAt, now)`, `enableProtectedScreenPrivacy()`, `disableProtectedScreenPrivacy()`, and `useSessionLifecycle(phase)` returning `{ privacyShieldVisible }`.

- [ ] **Step 1: Write exact threshold tests**

```ts
expect(shouldLockAfterBackground(1_000, 300_999)).toBe(false);
expect(shouldLockAfterBackground(1_000, 301_000)).toBe(true);
expect(shouldLockAfterBackground(1_000, 301_001)).toBe(true);
```

Hook tests must assert that inactive/background immediately shows the React shield, short resume hides it without dispatch, long resume dispatches `lockSession` before hiding it, and duplicate events do not reset the original timestamp. Native privacy tests assert protected phases call `preventScreenCaptureAsync('visit-control-session')`, iOS enables app-switcher protection, unauthenticated cleanup re-allows capture and disables iOS protection, and native failures retain the React shield without crashing.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `npm test -- services/auth/session-lock.test.ts services/auth/screen-privacy.test.ts hooks/use-session-lifecycle.test.tsx --runInBand`

Expected: FAIL because lifecycle modules are missing.

- [ ] **Step 3: Implement the monotonic lifecycle controller**

Use `performance.now()` through an injectable clock. Only an authenticated session records the background timestamp. Treat process restart as cold bootstrap rather than persisting the timestamp.

- [ ] **Step 4: Implement native and React privacy protection**

Use `expo-screen-capture`: protected phases call `preventScreenCaptureAsync('visit-control-session')`; iOS additionally calls `enableAppSwitcherProtectionAsync(1)`; cleanup calls the matching allow/disable methods. Keep a full-screen, non-transparent React view with the application name and activity indicator as UI fallback; it must contain no child/profile data. Do not request screenshot-detection media permissions.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- services/auth/session-lock.test.ts services/auth/screen-privacy.test.ts hooks/use-session-lifecycle.test.tsx --runInBand
git add services/auth/session-lock.ts services/auth/session-lock.test.ts services/auth/screen-privacy.ts services/auth/screen-privacy.test.ts hooks/use-session-lifecycle.ts hooks/use-session-lifecycle.test.tsx components/session/privacy-shield.tsx
git commit -m "feat: lock sessions after background timeout"
```

### Task 6: PIN setup, biometric opt-in, and unlock UI

**Files:**
- Create: `components/session/pin-pad.tsx`
- Test: `components/session/pin-pad.test.tsx`
- Create: `components/session/create-pin-screen.tsx`
- Test: `components/session/create-pin-screen.test.tsx`
- Create: `components/session/biometric-setup-screen.tsx`
- Test: `components/session/biometric-setup-screen.test.tsx`
- Create: `components/session/unlock-screen.tsx`
- Test: `components/session/unlock-screen.test.tsx`
- Create: `components/session/storage-error-screen.tsx`
- Test: `components/session/storage-error-screen.test.tsx`

**Interfaces:**
- Consumes: Task 4 actions/state and Task 3 capability/result labels.
- Produces: self-contained screens rendered by the root session gate.

- [ ] **Step 1: Write accessible PIN-pad tests**

Assert digit entry, backspace, automatic four-digit submit, disabled state, no PIN text exposure, and accessibility labels for digits and deletion.

- [ ] **Step 2: Run the PIN-pad test and verify RED**

Run: `npm test -- components/session/pin-pad.test.tsx --runInBand`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the shared PIN pad**

Keep entered digits in component memory only, clear after submission, use four filled/empty indicators, and emit only a complete four-digit string.

- [ ] **Step 4: Write setup-screen tests**

Cover first entry, confirmation, mismatch reset/message, exact dispatch with a matching PIN, inability to bypass setup, biometric enable, biometric skip, and hiding the offer when capability is unavailable.

- [ ] **Step 5: Implement setup screens minimally**

Use Russian copy, safe-area layout, disabled controls while Redux is loading, and no navigation call that can enter protected screens independently of state.

- [ ] **Step 6: Write unlock-screen tests**

Cover automatic biometric request once, manual retry, cancellation fallback, PIN submit, remaining attempts, fifth-attempt transition, validating spinner, validation-unavailable retry, and “Войти по email и паролю”. Add a storage-error screen test that shows no protected/public navigation, explains the local storage failure, and dispatches only `retryProtectedStorage()` from its retry button.

- [ ] **Step 7: Implement the unlock screen minimally**

Biometric errors remain on the PIN screen. `validationUnavailable` renders “Не удалось проверить сессию” plus retry and full-sign-in controls.

- [ ] **Step 8: Run all component tests and commit**

```bash
npm test -- components/session --runInBand
git add components/session
git commit -m "feat: add PIN and biometric session screens"
```

### Task 7: Root session gate, navigation, login, and logout integration

**Files:**
- Create: `components/session/session-gate.tsx`
- Test: `components/session/session-gate.test.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`
- Modify: `app/auth.tsx`
- Modify: `app/children.tsx`
- Modify: `app/menu.tsx`
- Modify: `store/reducers/children.ts`
- Modify: `store/sagas/children.ts`
- Test: `store/sagas/children.test.ts`

**Interfaces:**
- Consumes: all Task 4-6 state/actions/components.
- Produces: one root authority that mounts protected navigation only in `authenticated` phase.

- [ ] **Step 1: Write session-gate matrix tests**

```ts
it.each([
  ['bootstrapping', 'privacy-shield'],
  ['unauthenticated', 'public-navigation'],
  ['pinSetupRequired:createPin', 'create-pin-screen'],
  ['pinSetupRequired:offerBiometrics', 'biometric-setup-screen'],
  ['locked', 'unlock-screen'],
  ['validating', 'unlock-screen'],
  ['validationUnavailable', 'unlock-screen'],
  ['storageUnavailable', 'storage-error-screen'],
  ['authenticated', 'protected-navigation'],
])('renders %s without protected-content flash', (state, expected) => {
  expect(renderGate(state).getByTestId(expected)).toBeTruthy();
});
```

Also assert bootstrap is dispatched once; the privacy shield covers authenticated navigation during background transitions; `/children` and `/menu` deep links cannot render while bootstrapping, unauthenticated, or locked; registration remains accessible only while unauthenticated; and back gestures cannot bypass setup or lock.

- [ ] **Step 2: Run gate tests and verify RED**

Run: `npm test -- components/session/session-gate.test.tsx --runInBand`

Expected: FAIL because the gate is missing.

- [ ] **Step 3: Implement and mount the root gate**

Place `SessionGate` inside Redux `Provider`. During setup, locked, validating, validation-unavailable, and storage-unavailable phases it renders the corresponding session screen instead of a router. Otherwise it renders an Expo Router `Stack`: keep `index` as the anchor; wrap `auth`, `register`, and `registration-sent` in `Stack.Protected guard={phase === 'unauthenticated'}`; wrap `children`, `menu`, and `modal` in `Stack.Protected guard={phase === 'authenticated'}`. `index.tsx` redirects only within the currently allowed tree. This SDK 54 structure removes invalid history entries and blocks deep links without duplicating routes.

- [ ] **Step 4: Remove screen-owned auth redirects and debug credential-adjacent logs**

`auth.tsx` no longer routes on `isAuthenticated`; the state gate owns the transition. Remove `[Auth Screen]` state/submit logs. Keep input validation and registration navigation.

- [ ] **Step 5: Wire explicit logout from user-facing UI**

Replace the existing children-screen logout dispatch with `logoutRequested()` and add the same action to the menu screen. Reset children on `logoutCompleted`. Every children saga captures `auth.sessionEpoch` before an API call and compares it again before dispatching success/failure; results from an older epoch are ignored. Test logout during `GET /child-representative/children`, immediate login as another user, and a late old response: no old child or status data may re-enter the store.

- [ ] **Step 6: Run integration tests and static checks**

Run: `npm test -- components/session/session-gate.test.tsx --runInBand && npm run typecheck && npm run lint`

Expected: PASS; no protected screen is rendered in any non-authenticated phase.

- [ ] **Step 7: Commit**

```bash
git add components/session/session-gate.tsx components/session/session-gate.test.tsx app/_layout.tsx app/index.tsx app/auth.tsx app/children.tsx app/menu.tsx store/reducers/children.ts store/sagas/children.ts store/sagas/children.test.ts
git commit -m "feat: gate protected routes behind local unlock"
```

### Task 8: Documentation, full verification, live API smoke test, and delivery

**Files:**
- Create: `docs/pin-biometric-session.md`
- Modify: `docs/backend-integration.md`
- Modify if required: `eas.json` (an existing `preview` APK profile is already present)

**Interfaces:**
- Consumes: completed feature and deployed test API.
- Produces: verified branch, operational documentation, PR, and an installable Android artifact when local device verification is unavailable and build credentials permit it.

- [ ] **Step 1: Write operator and tester documentation**

Document the state flow, five-minute rule, one-hour backend token lifetime, no refresh token, fifth-attempt reset, biometric fallbacks, Expo Go Face ID limitation, local commands, and a manual iOS/Android checklist. Explain that iOS HTTP access exists only when `EXPO_PUBLIC_ALLOW_INSECURE_HTTP=1` in a test build and production still requires HTTPS. Correct the stale 24-hour/decode-`exp` guidance in `docs/backend-integration.md`; server `GET /user` and authenticated `401` are authoritative.

- [ ] **Step 2: Run the complete automated verification suite**

Run:

```bash
npm run test:ci
npm run typecheck
npm run lint
npx expo config --type public
npx expo-doctor
git diff --check origin/develop-darya...HEAD
```

Expected: all commands exit 0. Record any inherited warning separately; do not describe it as introduced by this branch.

- [ ] **Step 3: Smoke-test the deployed API without printing credentials**

Use an uncommitted environment variable or interactive prompt for the test password. Verify `/actuator/health`, `/token`, and authenticated `/user`; never enable shell tracing and never print the JWT. Confirm an invalid bearer token produces the server behaviour currently observed, and bind client expectations to the actual status.

- [ ] **Step 4: Run the local mobile flow where supported**

Check `adb devices` and available iOS simulators, then run the feasible target with `npm run android` and/or `npm run ios`. Manually verify login, PIN confirmation, cold restart, short background, five-minute lock through an injected development clock, wrong attempts, biometric fallback, logout, and network retry.

- [ ] **Step 5: Produce an Android APK when device verification is unavailable**

No Android device is currently connected, so do not use `expo run:android` as the build primitive. Run `npx expo prebuild --platform android --no-install`, then `./android/gradlew -p android assembleRelease` and record the APK path plus SHA-256 checksum; do not commit generated native files. If the local SDK/signing setup cannot build, reuse the existing EAS `preview` profile (`android.buildType: "apk"`) with `npx eas-cli@latest build --platform android --profile preview`; stop only if EAS authentication or signing authority requires the user. Save the returned artifact URL, never signing credentials.

- [ ] **Step 6: Review the whole branch before publication**

Compare `origin/develop-darya...HEAD` for secrets, credential literals, unintended generated native files, route regressions, missing cleanup, and test gaps. Re-run the full suite after every review fix.

- [ ] **Step 7: Commit documentation and optional build profile**

```bash
git add docs/pin-biometric-session.md docs/backend-integration.md
git diff --quiet -- eas.json || git add eas.json
git commit -m "docs: describe protected session operations"
```

- [ ] **Step 8: Push and create the pull request**

```bash
git fetch origin develop-darya
gh auth status
git push -u origin codex/pin-biometric-auth
```

Compose the `gh pr create --body` value only after Steps 2-5 have concrete results. It must contain: feature summary; security limits; test count and PASS status; typecheck/lint/Expo Doctor status; live health and `/user` status codes; tested iOS/Android targets; APK URL or local path plus checksum; and every remaining physical-device check. Create the PR against `develop-darya`, then attach its returned URL to the Codex task with `attach_artifact`.
