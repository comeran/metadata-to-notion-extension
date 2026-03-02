import { SOURCE_FIELDS_BY_TYPE } from "./source-fields.js";

const CONTENT_TYPES = ["movie", "book", "tv", "game"];
const CONFIG_KEY = "config";

function buildEmptyMapping(type) {
  return Object.keys(SOURCE_FIELDS_BY_TYPE[type] || {}).reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

function buildDefaultEnabled(type) {
  return Object.keys(SOURCE_FIELDS_BY_TYPE[type] || {}).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

const DEFAULT_CONFIG = {
  notionToken: "",
  targets: {
    movie: { databaseId: "", fieldMapping: buildEmptyMapping("movie"), fieldEnabled: buildDefaultEnabled("movie") },
    book: { databaseId: "", fieldMapping: buildEmptyMapping("book"), fieldEnabled: buildDefaultEnabled("book") },
    tv: { databaseId: "", fieldMapping: buildEmptyMapping("tv"), fieldEnabled: buildDefaultEnabled("tv") },
    game: { databaseId: "", fieldMapping: buildEmptyMapping("game"), fieldEnabled: buildDefaultEnabled("game") }
  },
  options: {
    autoCreateSelectOption: false,
    skipUnknownTypes: true
  }
};

function mergeTargets(incomingTargets = {}) {
  const merged = {};
  for (const type of CONTENT_TYPES) {
    const incoming = incomingTargets[type] || {};
    const defaultMapping = buildEmptyMapping(type);
    const defaultEnabled = buildDefaultEnabled(type);
    merged[type] = {
      databaseId: incoming.databaseId || "",
      fieldMapping: {
        ...defaultMapping,
        ...(incoming.fieldMapping || {})
      },
      fieldEnabled: {
        ...defaultEnabled,
        ...(incoming.fieldEnabled || {})
      }
    };
  }
  return merged;
}

function normalizeConfig(raw = {}) {
  // Backward compatibility with v0.1 config
  const migratedTargets =
    raw.targets ||
    (raw.databaseId || raw.fieldMapping
      ? {
          movie: {
            databaseId: raw.databaseId || "",
            fieldMapping: raw.fieldMapping || {}
          }
        }
      : {});

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    targets: mergeTargets(migratedTargets),
    options: {
      ...DEFAULT_CONFIG.options,
      ...(raw.options || {})
    }
  };
}

export async function getConfig() {
  const localResult = await chrome.storage.local.get([CONFIG_KEY]);
  if (localResult?.[CONFIG_KEY]) {
    return normalizeConfig(localResult[CONFIG_KEY]);
  }

  // One-time migration path: move existing sync config into local storage.
  const syncResult = await chrome.storage.sync.get([CONFIG_KEY]);
  if (syncResult?.[CONFIG_KEY]) {
    const migrated = normalizeConfig(syncResult[CONFIG_KEY]);
    await chrome.storage.local.set({ [CONFIG_KEY]: migrated });
    return migrated;
  }

  return normalizeConfig({});
}

export async function saveConfig(config) {
  await chrome.storage.local.set({
    [CONFIG_KEY]: normalizeConfig(config)
  });
}

export { DEFAULT_CONFIG, SOURCE_FIELDS_BY_TYPE, CONTENT_TYPES };
