import { callNativeAsync } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
import { unwrapSecureResult } from "./unwrap-secure-result.js";
const hasSecureItem = async (key) => unwrapSecureResult(await callNativeAsync(MODULE, "hasSecureItem", key), `check "${key}"`);
export {
  hasSecureItem
};
