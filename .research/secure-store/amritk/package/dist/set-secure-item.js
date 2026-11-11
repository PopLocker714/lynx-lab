import { callNativeAsync } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
const setSecureItem = (key, value, options = {}) => callNativeAsync(MODULE, "setSecureItem", key, value, options);
export {
  setSecureItem
};
