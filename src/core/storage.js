import { SOURCE_FIELDS_BY_TYPE } from "./source-fields.js";

const CONTENT_TYPES = ["movie", "book", "tv", "game"];
const LEGACY_CONFIG_KEY = "config";
const SYNC_CONFIG_KEY = "configSync";
const LOCAL_CONFIG_KEY = "configLocal";

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

function extractSyncConfig(raw = {}) {
  const normalized = normalizeConfig(raw);
  return {
    targets: normalized.targets,
    options: normalized.options
  };
}

function extractLocalConfig(raw = {}) {
  const normalized = normalizeConfig(raw);
  return {
    notionToken: normalized.notionToken || ""
  };
}

function mergeConfigParts(syncConfig = {}, localConfig = {}) {
  return normalizeConfig({
    ...extractSyncConfig(syncConfig),
    ...extractLocalConfig(localConfig)
  });
}

async function persistSplitConfig(config) {
  const normalized = normalizeConfig(config);
  await Promise.all([
    chrome.storage.sync.set({
      [SYNC_CONFIG_KEY]: extractSyncConfig(normalized)
    }),
    chrome.storage.local.set({
      [LOCAL_CONFIG_KEY]: extractLocalConfig(normalized)
    }),
    chrome.storage.sync.remove([LEGACY_CONFIG_KEY]),
    chrome.storage.local.remove([LEGACY_CONFIG_KEY])
  ]);
  return normalized;
}

export async function getConfig() {
  const [localResult, syncResult] = await Promise.all([
    chrome.storage.local.get([LOCAL_CONFIG_KEY, LEGACY_CONFIG_KEY]),
    chrome.storage.sync.get([SYNC_CONFIG_KEY, LEGACY_CONFIG_KEY])
  ]);

  let localConfig = localResult?.[LOCAL_CONFIG_KEY] || null;
  let syncConfig = syncResult?.[SYNC_CONFIG_KEY] || null;

  const legacyLocal = localResult?.[LEGACY_CONFIG_KEY];
  if (legacyLocal) {
    const migrated = normalizeConfig(legacyLocal);
    if (!localConfig) {
      localConfig = extractLocalConfig(migrated);
      await chrome.storage.local.set({ [LOCAL_CONFIG_KEY]: localConfig });
    }
    if (!syncConfig) {
      syncConfig = extractSyncConfig(migrated);
      await chrome.storage.sync.set({ [SYNC_CONFIG_KEY]: syncConfig });
    }
    await chrome.storage.local.remove([LEGACY_CONFIG_KEY]);
  }

  const legacySync = syncResult?.[LEGACY_CONFIG_KEY];
  if (legacySync) {
    const migrated = normalizeConfig(legacySync);
    if (!syncConfig) {
      syncConfig = extractSyncConfig(migrated);
      await chrome.storage.sync.set({ [SYNC_CONFIG_KEY]: syncConfig });
    }
    if (!localConfig) {
      localConfig = extractLocalConfig(migrated);
      await chrome.storage.local.set({ [LOCAL_CONFIG_KEY]: localConfig });
    }
    await chrome.storage.sync.remove([LEGACY_CONFIG_KEY]);
  }

  return mergeConfigParts(syncConfig || {}, localConfig || {});
}

export async function saveConfig(config) {
  await persistSplitConfig(config);
}

export { DEFAULT_CONFIG, SOURCE_FIELDS_BY_TYPE, CONTENT_TYPES };
