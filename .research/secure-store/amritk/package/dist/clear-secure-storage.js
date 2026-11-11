import { callNativeAsync } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
import { unwrapSecureResult } from "./unwrap-secure-result.js";
const clearSecureStorage = async () => {
  unwrapSecureResult(await callNativeAsync(MODULE, "clearSecureStorage"), "be cleared");
};
export {
  clearSecureStorage
};
