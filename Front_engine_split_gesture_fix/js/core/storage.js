export function readJson(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`AirNote storage: ${key} parse failed.`, error);
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`AirNote storage: ${key} save failed.`, error);
    return false;
  }
}

export function removeKeys(storage, keys) {
  keys.forEach((key) => storage?.removeItem(key));
}
