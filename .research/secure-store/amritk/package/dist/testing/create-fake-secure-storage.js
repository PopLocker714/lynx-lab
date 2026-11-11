import { MAX_VALUE_BYTES } from "../native-module.js";
const createFakeSecureStorage = () => {
  const items = /* @__PURE__ */ new Map();
  let available = true;
  let locked = false;
  let keysetCorrupted = false;
  let keystoreBroken = false;
  let installedFlag = true;
  let checkedThisProcess = true;
  const failure = (error, message) => ({ ok: false, error, message });
  const ensureInstalled = () => {
    if (checkedThisProcess)
      return;
    checkedThisProcess = true;
    if (installedFlag)
      return;
    items.clear();
    installedFlag = true;
  };
  const open = () => {
    ensureInstalled();
    if (!available)
      return failure("unavailable", "the platform secure store is not available on this device");
    if (keystoreBroken)
      return failure("keystoreFailure", "the keystore key could not be used");
    if (keysetCorrupted) {
      keysetCorrupted = false;
      items.clear();
    }
    return null;
  };
  const withheld = (accessibility) => locked && accessibility === "whenUnlocked";
  const utf8Length = (value) => {
    let bytes = 0;
    for (const character of value) {
      const code = character.codePointAt(0) ?? 0;
      bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
    }
    return bytes;
  };
  const module = {
    getSecureItem: (key, done) => {
      const blocked = open();
      if (blocked)
        return done(blocked);
      const item = items.get(key);
      if (item === void 0)
        return done({ ok: true, value: null });
      if (withheld(item.accessibility)) {
        return done(failure("unavailable", "the device is locked and this item is only readable while unlocked"));
      }
      done({ ok: true, value: item.value });
    },
    setSecureItem: (key, value, options, done) => {
      const blocked = open();
      if (blocked)
        return done(blocked);
      if (utf8Length(value) > MAX_VALUE_BYTES) {
        return done(failure("tooLarge", `a value may be at most ${MAX_VALUE_BYTES} bytes`));
      }
      const accessibility = options?.accessibility ?? "afterFirstUnlock";
      if (withheld(accessibility)) {
        return done(failure("unavailable", "the device is locked and this item may only be written while unlocked"));
      }
      items.set(key, { value, accessibility });
      done({ ok: true });
    },
    removeSecureItem: (key, done) => {
      const blocked = open();
      if (blocked)
        return done(blocked);
      items.delete(key);
      done({ ok: true });
    },
    hasSecureItem: (key, done) => {
      const blocked = open();
      if (blocked)
        return done(blocked);
      const item = items.get(key);
      if (item === void 0)
        return done({ ok: true, value: false });
      if (withheld(item.accessibility)) {
        return done(failure("unavailable", "the device is locked and this item is only readable while unlocked"));
      }
      done({ ok: true, value: true });
    },
    clearSecureStorage: (done) => {
      const blocked = open();
      if (blocked)
        return done(blocked);
      items.clear();
      done({ ok: true });
    },
    isSecureStorageAvailable: (done) => {
      done(available && !keystoreBroken);
    }
  };
  return {
    module,
    stored: () => Object.fromEntries(items),
    setAvailable: (next) => {
      available = next;
    },
    setDeviceLocked: (next) => {
      locked = next;
    },
    corruptKeyset: () => {
      keysetCorrupted = true;
    },
    breakKeystore: (next) => {
      keystoreBroken = next;
    },
    restartProcess: () => {
      checkedThisProcess = false;
    },
    reinstall: () => {
      installedFlag = false;
      checkedThisProcess = false;
    }
  };
};
export {
  createFakeSecureStorage
};
