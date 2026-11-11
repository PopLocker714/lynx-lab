export interface SecureStorageSetOptions {
    /**
     * When true, the OS will require biometric authentication on every
     * subsequent `getItem` of this key.
     *
     * - iOS: stored with `kSecAccessControlBiometryCurrentSet`. The OS shows
     *   the Face ID / Touch ID prompt automatically inside the Keychain
     *   query — no extra JS call is needed.
     * - Android: a per-key Keystore RSA pair is generated with
     *   `setUserAuthenticationRequired(true)`, binding the requirement to the
     *   private half. Writing wraps a one-shot AES key with the public half,
     *   so it never prompts; `getItem` drives a `BiometricPrompt` to
     *   authorise the unwrap, which is why [SecureStorageGetOptions] exposes
     *   `biometricPrompt`.
     */
    requireBiometric?: boolean;
}
export interface SecureStorageBiometricPrompt {
    /** iOS: localizedReason for LAContext. Android: prompt subtitle. */
    reason: string;
    /** Android only — prompt title. Defaults to "Authenticate". */
    title?: string;
}
export interface SecureStorageGetOptions {
    /**
     * Required when the key was stored with `requireBiometric: true`.
     * Android needs the strings to render `BiometricPrompt`; iOS only uses
     * `reason` (the OS prompt title is fixed).
     */
    biometricPrompt?: SecureStorageBiometricPrompt;
}
/**
 * Encrypted at-rest key-value storage — iOS Keychain, Android Keystore +
 * EncryptedSharedPreferences.
 *
 * For plaintext settings use [`@sigx/lynx-storage`](../lynx-storage). Use
 * this package for credentials, refresh tokens, PII, and anything else
 * that must survive a casual filesystem dump.
 *
 * Pairs with [`@sigx/lynx-biometric`](../lynx-biometric) when you also need
 * an explicit auth gate (e.g. unlock-on-launch). The `requireBiometric`
 * flag here gates the *individual key* via the OS Keychain / Keystore;
 * use lynx-biometric for the broader "unlock the app" flow.
 *
 * Every method **throws** on failure (C3/C4), always as a `SigxError` with a
 * `code` to branch on: `'invalid_argument'` for a bad key or value,
 * `'module_unavailable'` when the native module isn't linked (core's
 * descriptive `getModule` error), and `'native_error'` for a failure reported
 * by the platform — the natives resolve their callback with `{ error }` rather
 * than rejecting, so each call unwraps that envelope.
 *
 * `hasKey` is the one exception on the argument guard: it is a predicate, so
 * an unusable key resolves `false` rather than throwing `'invalid_argument'` —
 * the same answer native gives for a key that was never stored. It still
 * throws for the other two codes.
 *
 * There is no `cancelled` result here: dismissing the biometric prompt is one
 * of those native failures (`error: 'userCancel'` on both platforms —
 * `ios/SecureStorageModule.swift:136`, `android/…/SecureStorageModule.kt:270`)
 * and always was, so it throws like the rest. A caller that wants to treat a
 * dismiss as ordinary matches on the message until the findings on #903 give
 * these a `code` of their own.
 *
 * The one non-throwing "nothing there" is a key that was never stored:
 * `getItem` resolves `null` and `hasKey` resolves `false`.
 *
 * @example
 * ```ts
 * import { SecureStorage } from '@sigx/lynx-secure-storage';
 *
 * await SecureStorage.setItem('access_token', token, { requireBiometric: true });
 *
 * const value = await SecureStorage.getItem('access_token', {
 *     biometricPrompt: { reason: 'Unlock your account', title: 'Acme Bank' },
 * });
 * ```
 */
export declare const SecureStorage: {
    /**
     * Store an encrypted string. Overwrites any existing value for `key`.
     * Setting `requireBiometric: true` makes future `getItem` calls prompt
     * for biometrics; the `setItem` call itself never prompts.
     */
    readonly setItem: (key: string, value: string, opts?: SecureStorageSetOptions) => Promise<void>;
    /**
     * Read an encrypted string. Returns `null` if the key is not present.
     *
     * For keys stored with `requireBiometric: true`, the OS shows a prompt
     * before the value is returned. Pass `biometricPrompt.reason` to set
     * the displayed string; if omitted (or empty), a generic
     * "Authenticate to read secure data" default is used so the prompt
     * still appears.
     *
     * - **iOS**: `reason` is passed as `kSecUseOperationPrompt` on the
     *   Keychain query.
     * - **Android**: `reason` becomes the `BiometricPrompt` subtitle and
     *   `title` (or "Authenticate") becomes the prompt title.
     *
     * Dismissing that prompt throws (`… failed: userCancel`) — it is not the
     * same as `null`, which means the key isn't stored.
     */
    readonly getItem: (key: string, opts?: SecureStorageGetOptions) => Promise<string | null>;
    /** Remove a single key. No-op if the key doesn't exist. */
    readonly removeItem: (key: string) => Promise<void>;
    /**
     * Delete every key owned by this module's service identifier. Does NOT
     * touch other apps' Keychain items, nor other Lynx packages'
     * SharedPreferences.
     */
    readonly clear: () => Promise<void>;
    /**
     * Check whether a key is present without decrypting it (no biometric
     * prompt). Safe to call on every render.
     */
    readonly hasKey: (key: string) => Promise<boolean>;
    /** Whether the native module is wired in the current build. */
    readonly isAvailable: () => boolean;
};
//# sourceMappingURL=secure-storage.d.ts.map