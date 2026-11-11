import { callNativeAsync } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
import { unwrapSecureResult } from "./unwrap-secure-result.js";
const getSecureItem = async (key) => unwrapSecureResult(await callNativeAsync(MODULE, "getSecureItem", key), `read "${key}"`);
export {
  getSecureItem
};
