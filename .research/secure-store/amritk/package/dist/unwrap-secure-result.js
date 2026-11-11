const unwrapSecureResult = (result, action) => {
  if (result.ok)
    return result.value;
  throw new Error(`secure storage could not ${action}: ${result.message} [${result.error}]`);
};
export {
  unwrapSecureResult
};
