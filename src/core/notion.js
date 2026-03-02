const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";
const SCHEMA_CACHE_KEY = "notionDatabaseSchemaCache";
const SCHEMA_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const SCHEMA_CACHE_NS = "v2";

function notionHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
    ...extra
  };
}

function normalizeUploadUrl(uploadUrl) {
  if (!uploadUrl) return "";
  if (uploadUrl.startsWith("http://") || uploadUrl.startsWith("https://")) return uploadUrl;
  if (uploadUrl.startsWith("/")) return `https://api.notion.com${uploadUrl}`;
  return uploadUrl;
}

async function notionRequest(token, path, method = "GET", body = null) {
  const response = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: notionHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${method} ${path} failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getDatabaseSchema(token, databaseId) {
  return notionRequest(token, `/databases/${databaseId}`, "GET");
}

async function getSchemaCacheMap() {
  const resp = await chrome.storage.local.get([SCHEMA_CACHE_KEY]);
  return resp?.[SCHEMA_CACHE_KEY] || {};
}

async function tokenFingerprint(token) {
  const input = new TextEncoder().encode(String(token || ""));
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex || "anon";
}

function buildSchemaCacheEntryKey(databaseId, fingerprint) {
  return `${SCHEMA_CACHE_NS}:${fingerprint}:${databaseId}`;
}

async function setSchemaCacheEntry(databaseId, fingerprint, schema) {
  const cacheKey = buildSchemaCacheEntryKey(databaseId, fingerprint);
  const map = await getSchemaCacheMap();
  map[cacheKey] = {
    fetchedAt: Date.now(),
    schema
  };
  await chrome.storage.local.set({
    [SCHEMA_CACHE_KEY]: map
  });
}

function isFreshCache(entry) {
  if (!entry || !entry.fetchedAt) return false;
  return Date.now() - entry.fetchedAt <= SCHEMA_CACHE_TTL_MS;
}

function parseNotionStatusFromError(error) {
  const msg = String(error?.message || error || "");
  const m = msg.match(/failed:\s*(\d{3})/i);
  if (!m) return 0;
  const status = Number(m[1]);
  return Number.isFinite(status) ? status : 0;
}

function shouldFallbackToStaleSchema(error) {
  const status = parseNotionStatusFromError(error);
  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export async function getDatabaseSchemaCached(token, databaseId, opts = {}) {
  const forceRefresh = Boolean(opts.forceRefresh);
  const fingerprint = await tokenFingerprint(token);
  const cacheKey = buildSchemaCacheEntryKey(databaseId, fingerprint);
  const map = await getSchemaCacheMap();
  const entry = map[cacheKey];

  if (!forceRefresh && isFreshCache(entry) && entry.schema) {
    return entry.schema;
  }

  try {
    const live = await getDatabaseSchema(token, databaseId);
    await setSchemaCacheEntry(databaseId, fingerprint, live);
    return live;
  } catch (error) {
    // Fallback to stale cache only for retryable failures.
    if (entry?.schema && shouldFallbackToStaleSchema(error)) return entry.schema;
    throw error;
  }
}

export async function createPage(token, databaseId, properties) {
  return notionRequest(token, "/pages", "POST", {
    parent: { database_id: databaseId },
    properties
  });
}

export async function uploadImageToNotion(token, imageUrl, filename = "cover.jpg", downloadOptions = {}) {
  try {
    if (!imageUrl) {
      throw new Error("empty image source");
    }

    if (String(imageUrl).startsWith("data:")) {
      const dataResp = await fetch(imageUrl);
      if (!dataResp.ok) {
        throw new Error(`data url decode failed: ${dataResp.status}`);
      }
      const blob = await dataResp.blob();
      return uploadBlobToNotion(token, blob, filename);
    }

    const requestInits = [];
    if (downloadOptions.referrer) {
      requestInits.push({
        method: "GET",
        credentials: "omit",
        referrer: downloadOptions.referrer,
        referrerPolicy: "strict-origin-when-cross-origin"
      });
    }
    requestInits.push({
      method: "GET",
      credentials: "omit"
    });

    let imageResp = null;
    let lastStatus = 0;
    for (const init of requestInits) {
      const resp = await fetch(imageUrl, init);
      lastStatus = resp.status;
      if (resp.ok) {
        imageResp = resp;
        break;
      }
    }

    if (!imageResp) {
      throw new Error(`download failed: ${lastStatus}`);
    }

    const blob = await imageResp.blob();
    return uploadBlobToNotion(token, blob, filename);
  } catch (error) {
    return {
      error: `image upload skipped: ${error.message}`
    };
  }
}

async function uploadBlobToNotion(token, blob, filename = "cover.jpg") {
  const contentType = blob.type || "image/jpeg";
  const init = await notionRequest(token, "/file_uploads", "POST", {
    filename,
    content_type: contentType
  });

  const uploadUrlRaw = init.upload_url || (init.file_upload && init.file_upload.upload_url);
  const uploadUrl = normalizeUploadUrl(uploadUrlRaw);
  const fileUploadId = init.id || (init.file_upload && init.file_upload.id);
  if (!uploadUrl || !fileUploadId) {
    throw new Error("missing upload url or file_upload id");
  }

  const isNotionApiUpload = uploadUrl.includes("api.notion.com");
  let uploadResp;
  if (isNotionApiUpload) {
    // Notion API upload URLs expect multipart with a `file` field.
    const formData = new FormData();
    formData.append("file", blob, filename);
    uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION
      },
      body: formData
    });
  } else {
    // Pre-signed object storage URL path.
    uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType
      },
      body: blob
    });
    if (!uploadResp.ok) {
      uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        body: blob
      });
    }
  }

  if (!uploadResp.ok) {
    const errText = await uploadResp.text().catch(() => "");
    throw new Error(`upload failed: ${uploadResp.status}${errText ? ` ${errText.slice(0, 220)}` : ""}`);
  }

  try {
    await notionRequest(token, `/file_uploads/${fileUploadId}/complete`, "POST", {});
  } catch (error) {
    const message = String(error?.message || error);
    // Newer upload flow can already transition to `uploaded` before complete.
    // In that case complete returns 400 and should be treated as success.
    if (!message.includes("status of `uploaded`")) {
      throw error;
    }
  }
  return {
    type: "file_upload",
    file_upload: { id: fileUploadId }
  };
}
