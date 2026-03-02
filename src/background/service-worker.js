import { getConfig } from "../core/storage.js";
import { buildImportPreview, importMetadataToNotion } from "../core/importer.js";
import { getDatabaseSchemaCached } from "../core/notion.js";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function collectMetadataFromTab(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_METADATA" });
}

async function downloadImageDataUrlFromTab(tabId, url) {
  const resp = await chrome.tabs.sendMessage(tabId, { type: "DOWNLOAD_IMAGE_AS_DATA_URL", url });
  if (!resp || !resp.ok || !resp.dataUrl) {
    throw new Error(resp?.reason || "download failed in content script");
  }
  return resp.dataUrl;
}

async function getCoverImageRectFromTab(tabId) {
  const resp = await chrome.tabs.sendMessage(tabId, { type: "GET_COVER_IMAGE_RECT" });
  if (!resp || !resp.ok || !resp.rect) {
    throw new Error(resp?.reason || "cover rect unavailable");
  }
  return resp;
}

async function captureVisibleTabDataUrl(windowId) {
  return chrome.tabs.captureVisibleTab(windowId, { format: "png" });
}

async function cropDataUrl(dataUrl, rect, devicePixelRatio) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = devicePixelRatio || 1;
  const sx = Math.max(0, Math.floor(rect.x * scale));
  const sy = Math.max(0, Math.floor(rect.y * scale));
  const sw = Math.max(1, Math.floor(rect.width * scale));
  const sh = Math.max(1, Math.floor(rect.height * scale));

  const cw = Math.min(sw, Math.max(1, bitmap.width - sx));
  const ch = Math.min(sh, Math.max(1, bitmap.height - sy));

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, cw, ch);
  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  const buffer = await outBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/png;base64,${base64}`;
}

async function getDoubanCoverDataUrl(tab) {
  if (!tab?.id) throw new Error("missing tab");
  const metadata = await collectMetadataFromTab(tab.id);
  if (!metadata?.coverUrl) throw new Error("missing cover url");

  // First try direct fetch in page context.
  try {
    const direct = await downloadImageDataUrlFromTab(tab.id, metadata.coverUrl);
    if (direct) return direct;
  } catch {
    // continue to screenshot fallback
  }

  // Fallback: screenshot the visible tab and crop the cover image area.
  const rectInfo = await getCoverImageRectFromTab(tab.id);
  const fullShot = await captureVisibleTabDataUrl(tab.windowId);
  return cropDataUrl(fullShot, rectInfo.rect, rectInfo.devicePixelRatio || 1);
}

async function buildScanResultFromTab(tabId) {
  let metadata;
  try {
    metadata = await collectMetadataFromTab(tabId);
  } catch (error) {
    throw new Error(`Cannot scan this page. Please refresh target page and retry. (${error.message})`);
  }
  if (!metadata || !metadata.supported) {
    throw new Error("Current page is not a supported detail page.");
  }

  return {
    type: metadata.type,
    source: metadata.source,
    sourceUrl: metadata.sourceUrl,
    normalized: metadata,
    rawSignals: metadata.debug?.rawSignals || {}
  };
}

async function preloadConfiguredSchemas() {
  try {
    const config = await getConfig();
    const token = config?.notionToken || "";
    if (!token) return;

    const targets = config?.targets || {};
    const dbIds = Array.from(
      new Set(
        Object.values(targets)
          .map((t) => (t?.databaseId || "").trim())
          .filter(Boolean)
      )
    );
    if (!dbIds.length) return;

    await Promise.all(
      dbIds.map((databaseId) =>
        getDatabaseSchemaCached(token, databaseId, { forceRefresh: true }).catch(() => null)
      )
    );
  } catch {
    // Ignore preload failures; normal requests still work.
  }
}

chrome.runtime.onStartup.addListener(() => {
  preloadConfiguredSchemas();
});

chrome.runtime.onInstalled.addListener(() => {
  preloadConfiguredSchemas();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "PING_SUPPORT") {
      const tab = await getActiveTab();
      if (!tab || !tab.id) {
        sendResponse({ ok: false, supported: false, reason: "No active tab" });
        return;
      }

      try {
        const metadata = await collectMetadataFromTab(tab.id);
        sendResponse({ ok: true, supported: Boolean(metadata && metadata.supported), metadata });
      } catch (error) {
        sendResponse({ ok: false, supported: false, reason: error.message });
      }
      return;
    }

    if (message.type === "IMPORT_ACTIVE_TAB") {
      const tab = await getActiveTab();
      if (!tab || !tab.id) throw new Error("No active tab");

      const metadata = await collectMetadataFromTab(tab.id);
      if (!metadata || !metadata.supported) {
        throw new Error("Current page is not supported for import.");
      }

      if (metadata.source === "douban" && metadata.coverUrl) {
        try {
          const dataUrl = await getDoubanCoverDataUrl(tab);
          metadata.coverDataUrl = dataUrl;
        } catch {
          // Fallback to background fetch path in importer.
        }
      }

      const config = await getConfig();
      const result = await importMetadataToNotion(
        config,
        metadata,
        message.selectedFields || null,
        message.overrides || {},
        message.customFields || []
      );

      sendResponse({ ok: true, result });
      return;
    }

    if (message.type === "SCAN_ACTIVE_TAB") {
      const tab = await getActiveTab();
      if (!tab || !tab.id) throw new Error("No active tab");
      const scan = await buildScanResultFromTab(tab.id);

      sendResponse({
        ok: true,
        scan
      });
      return;
    }

    if (message.type === "PREVIEW_ACTIVE_TAB") {
      const tab = await getActiveTab();
      if (!tab || !tab.id) throw new Error("No active tab");

      const metadata = await collectMetadataFromTab(tab.id);
      if (!metadata || !metadata.supported) {
        throw new Error("Current page is not supported for import.");
      }

      const config = await getConfig();
      const preview = await buildImportPreview(config, metadata);

      sendResponse({ ok: true, metadata, preview });
      return;
    }

    if (message.type === "PREPARE_TYPE_CONFIG_FROM_ACTIVE_TAB") {
      const tab = await getActiveTab();
      if (!tab || !tab.id) throw new Error("No active tab");
      const scan = await buildScanResultFromTab(tab.id);

      await chrome.storage.local.set({
        pendingTypeConfigScan: {
          ...scan,
          createdAt: Date.now()
        }
      });
      await chrome.runtime.openOptionsPage();
      sendResponse({ ok: true, scan });
      return;
    }

    if (message.type === "GET_PENDING_TYPE_CONFIG_SCAN") {
      const result = await chrome.storage.local.get(["pendingTypeConfigScan"]);
      sendResponse({ ok: true, pending: result.pendingTypeConfigScan || null });
      return;
    }

    if (message.type === "CLEAR_PENDING_TYPE_CONFIG_SCAN") {
      await chrome.storage.local.remove(["pendingTypeConfigScan"]);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, reason: "Unknown message type" });
  })().catch((error) => {
    sendResponse({ ok: false, reason: error.message || String(error) });
  });

  return true;
});
