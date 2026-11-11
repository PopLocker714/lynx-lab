import { callNativeAsync } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
import { unwrapSecureResult } from "./unwrap-secure-result.js";
const removeSecureItem = async (key) => {
  unwrapSecureResult(await callNativeAsync(MODULE, "removeSecureItem", key), `remove "${key}"`);
};
export {
  removeSecureItem
};
