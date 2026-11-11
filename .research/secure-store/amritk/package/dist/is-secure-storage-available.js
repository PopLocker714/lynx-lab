import { callNativeAsync, isNativeModuleAvailable } from "@amritk/mini-lynx-native";
import { MODULE } from "./native-module.js";
const isSecureStorageAvailable = async () => {
  if (!await isNativeModuleAvailable(MODULE))
    return false;
  try {
    return await callNativeAsync(MODULE, "isSecureStorageAvailable");
  } catch {
    return false;
  }
};
export {
  isSecureStorageAvailable
};
