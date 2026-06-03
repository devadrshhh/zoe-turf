const cache = {};

/**
 * 📥 Retrieve a cached value by key if it hasn't expired.
 * @param {String} key - Cache identifier key
 * @returns {any|null} The cached data value or null if expired/missing
 */
const getCache = (key) => {
  const item = cache[key];
  if (item && item.expiry > Date.now()) {
    return item.value;
  }
  // Delete expired key to free memory
  if (item) {
    delete cache[key];
  }
  return null;
};

/**
 * 📤 Store a value inside the in-memory cache with an expiry TTL.
 * @param {String} key - Cache identifier key
 * @param {any} value - The data payload to cache
 * @param {Number} ttlSeconds - Duration in seconds before expiration (default: 5 minutes)
 */
const setCache = (key, value, ttlSeconds = 300) => {
  cache[key] = {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  };
};

/**
 * 🗑️ Invalidate/clear specific cache keys.
 * @param {String} key - Cache identifier key to purge
 */
const clearCache = (key) => {
  delete cache[key];
};

module.exports = {
  getCache,
  setCache,
  clearCache,
};
