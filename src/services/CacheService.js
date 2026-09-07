/**
 * CacheService.js
 * A centralized caching utility to reduce Firestore network reads for application state.
 * Supports memory caching (session) and LocalStorage (persistent) with tenant isolation.
 */

const MEMORY_CACHE = new Map();

export const CacheService = {
  /**
   * Generates a tenant-isolated key.
   */
  _getKey(schoolId, key) {
    return `${schoolId}_${key}`;
  },

  /**
   * Set data in persistent cache (LocalStorage).
   * @param {string} schoolId - Tenant ID
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttlMinutes - Time to live in minutes
   */
  setPersistent(schoolId, key, data, ttlMinutes = 60 * 24) {
    if (!schoolId || !key) return;
    const fullKey = this._getKey(schoolId, key);
    const payload = {
      data,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    };
    try {
      localStorage.setItem(fullKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage is full or unavailable.', e);
    }
  },

  /**
   * Get data from persistent cache if it hasn't expired.
   * @param {string} schoolId - Tenant ID
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null
   */
  getPersistent(schoolId, key) {
    if (!schoolId || !key) return null;
    const fullKey = this._getKey(schoolId, key);
    try {
      const item = localStorage.getItem(fullKey);
      if (!item) return null;

      const parsed = JSON.parse(item);
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(fullKey);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Set data in session memory.
   */
  setSession(schoolId, key, data) {
    if (!schoolId || !key) return;
    MEMORY_CACHE.set(this._getKey(schoolId, key), data);
  },

  /**
   * Get data from session memory.
   */
  getSession(schoolId, key) {
    if (!schoolId || !key) return null;
    return MEMORY_CACHE.get(this._getKey(schoolId, key)) || null;
  },

  /**
   * Invalidates a specific key.
   */
  invalidate(schoolId, key) {
    if (!schoolId || !key) return;
    const fullKey = this._getKey(schoolId, key);
    MEMORY_CACHE.delete(fullKey);
    localStorage.removeItem(fullKey);
  },

  /**
   * Clears all cache for a specific tenant (useful on logout).
   */
  clearTenant(schoolId) {
    if (!schoolId) return;
    
    // Clear Memory
    for (const key of MEMORY_CACHE.keys()) {
      if (key.startsWith(`${schoolId}_`)) {
        MEMORY_CACHE.delete(key);
      }
    }

    // Clear LocalStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`${schoolId}_`)) {
        localStorage.removeItem(key);
      }
    });
  }
};
