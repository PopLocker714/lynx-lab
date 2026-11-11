import type { SecureAccessibility } from '../types.js';
/** One stored item, with the attribute the platforms keep beside the value. */
export type FakeSecureItem = {
    readonly value: string;
    /** What the write asked for, defaulted the way the native halves default it. */
    readonly accessibility: SecureAccessibility;
};
/** The fake module, plus the handles a test needs to play the platform's part. */
export type FakeSecureStorage = {
    /** Register this under `MODULE` in the registry handed to `installNativeBridge`. */
    readonly module: Readonly<Record<string, unknown>>;
    /**
     * Everything currently in the store, keyed exactly as it was written.
     *
     * For asserting that a write happened and with which attribute — not for
     * driving the facade, which is what the module is for.
     */
    stored(): Readonly<Record<string, FakeSecureItem>>;
    /**
     * Whether the platform's store answers at all. True by default; false is a
     * host that did not link the native half properly, or a simulator build with
     * no keychain-access entitlement, and it is what `unavailable` reports.
     */
    setAvailable(available: boolean): void;
    /**
     * Locks or unlocks the device.
     *
     * Only `whenUnlocked` items notice, which is the point: reading one while the
     * screen is locked is `errSecInteractionNotAllowed` on a real device, and it
     * is the failure that makes `afterFirstUnlock` the default. An
     * `afterFirstUnlock` item stays readable, exactly as it does on a phone in a
     * pocket.
     */
    setDeviceLocked(locked: boolean): void;
    /**
     * Stages a keyset that can no longer be read — a restored backup, or a device
     * that dropped its Keystore keys when the lock screen changed.
     *
     * The next call **recovers**: the store is discarded and recreated empty, and
     * the call succeeds. That is what the Android half does and it is not a
     * detail — propagating the exception instead is a crash loop on launch, which
     * is the worst outcome available here. Everything written before this is gone
     * afterwards, and reads answer `null` rather than failing.
     */
    corruptKeyset(): void;
    /**
     * Breaks the keystore in the way that does **not** recover: the key itself is
     * unusable, so every call answers `keystoreFailure` until this is cleared.
     *
     * This is the case that makes the facade throw instead of answering `null`,
     * and a consumer cannot stage it on a device at all.
     */
    breakKeystore(broken: boolean): void;
    /**
     * A process restart: the app was killed and launched again.
     *
     * Stored values survive, because they are on the disk. The first-run flag
     * survives too — it is in `NSUserDefaults`, which survives a restart — so
     * nothing is cleared. Pair it with `reinstall` to tell the two apart.
     */
    restartProcess(): void;
    /**
     * A reinstall: the app was deleted and installed again.
     *
     * Keychain items **survive an uninstall on iOS**, so the values are still
     * there — but `NSUserDefaults` does not, so the first-run flag is gone, and
     * the native half reads that as a fresh install and clears the store. The net
     * effect is an empty store, and reproducing the mechanism rather than the net
     * effect is what makes this fake able to catch a regression in it.
     */
    reinstall(): void;
};
/**
 * An in-memory stand-in for the native secure-storage module.
 *
 * The point of this is not to test the facade's plumbing — that is three lines
 * per function and the bridge's own suite already covers the wire. It is that
 * **the two native implementations cannot be run here at all**, so the contract
 * between JavaScript and native is otherwise pinned by nothing. This fake is
 * that contract, executable: it implements the same method names, arities and
 * call forms the Kotlin and the Objective-C do, and the suite drives the real
 * facade against it.
 *
 * What it emphatically does **not** verify is that the Kotlin and the
 * Objective-C match it. Nothing in this repository can — see `AGENTS.md`.
 *
 * ## It reproduces the platforms rather than smoothing them over
 *
 * The four things worth staging here are the four a consumer cannot stage on a
 * device: a store that does not answer (`setAvailable`), a locked device with a
 * `whenUnlocked` item behind it (`setDeviceLocked`), a keyset that has to be
 * discarded to be usable again (`corruptKeyset`), and a keystore that is simply
 * broken (`breakKeystore`). `restartProcess` and `reinstall` are the fifth:
 * they differ only in that a reinstall clears `NSUserDefaults`, and that one
 * difference is the whole reason a reinstalled app does not find the previous
 * install's session.
 *
 * Every one of those answers through the same result union the real halves use,
 * so a test drives them through the real facade and sees exactly what an app
 * would see.
 *
 * What it does not model is the cryptography — nothing here is encrypted, and
 * a test that asserted otherwise would be asserting against a `Map`. It also
 * treats `removeSecureItem` and `clearSecureStorage` as reachable on a locked
 * device, where a real Keychain may refuse to delete an item it cannot decrypt.
 *
 * @example
 * ```ts
 * const storage = createFakeSecureStorage()
 * installNativeBridge({ peer, emitter, modules: { [MODULE]: storage.module } })
 *
 * await setSecureItem('session', 'token')
 * storage.reinstall()
 * expect(await getSecureItem('session')).toBeNull()
 * ```
 */
export declare const createFakeSecureStorage: () => FakeSecureStorage;
