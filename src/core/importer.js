import { createPage, getDatabaseSchemaCached, uploadImageToNotion } from "./notion.js";
import { getSourceFieldValue, hasMeaningfulValue } from "./source-fields.js";

function normalizeArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  return String(input)
    // Do not split by "/" to avoid breaking values like "Xbox Series X/S".
    .split(/[,，、|;\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getFirstMeaningfulItem(values) {
  if (!Array.isArray(values)) return values;
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function buildTitleProperty(value) {
  const text = asText(value);
  if (!text) return null;
  return {
    title: [{ text: { content: text.slice(0, 2000) } }]
  };
}

function buildRichTextProperty(value) {
  const text = asText(value);
  if (!text) return null;
  return {
    rich_text: [{ text: { content: text.slice(0, 2000) } }]
  };
}

function buildNumberProperty(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return { number: num };
}

function buildUrlProperty(value) {
  const text = asText(value);
  if (!text) return null;
  return { url: text };
}

function buildSelectProperty(value) {
  const text = asText(Array.isArray(value) ? getFirstMeaningfulItem(value) : value);
  if (!text) return null;
  return { select: { name: text.slice(0, 100) } };
}

function buildDateProperty(value) {
  const text = asText(value);
  if (!text) return null;

  // Prefer direct ISO date extraction to avoid timezone shift (e.g. 2023-05-04T00:00:00Z).
  const isoDay = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDay) {
    return { date: { start: `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}` } };
  }

  // English natural date, e.g. "Sep 4, 2025"
  const naturalDate = new Date(text);
  if (!Number.isNaN(naturalDate.getTime())) {
    const y = naturalDate.getFullYear();
    const m = String(naturalDate.getMonth() + 1).padStart(2, "0");
    const d = String(naturalDate.getDate()).padStart(2, "0");
    return { date: { start: `${y}-${m}-${d}` } };
  }

  const match = text.match(/\d{4}([-/]\d{1,2})?([-/]\d{1,2})?/);
  if (!match) return null;
  const raw = match[0].replace(/\//g, "-");
  const parts = raw.split("-");
  if (parts.length === 1) {
    return { date: { start: `${parts[0]}-01-01` } };
  }
  if (parts.length === 2) {
    const [y, m] = parts;
    return { date: { start: `${y}-${m.padStart(2, "0")}-01` } };
  }
  const [y, m, d] = parts;
  return { date: { start: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` } };
}

function buildMultiSelectProperty(values) {
  const items = normalizeArray(values).map((name) => ({ name: name.slice(0, 100) }));
  if (!items.length) return null;
  return { multi_select: items };
}

function buildFilesProperty(fileObject) {
  if (!fileObject) return null;

  if (fileObject.type === "file_upload") {
    return {
      files: [
        {
          type: "file_upload",
          name: "Cover",
          file_upload: { id: fileObject.file_upload.id }
        }
      ]
    };
  }

  if (fileObject.type === "external") {
    return {
      files: [
        {
          type: "external",
          name: "Cover",
          external: { url: fileObject.external.url }
        }
      ]
    };
  }

  return null;
}

function buildPropertyValue(type, value, extra = {}) {
  switch (type) {
    case "title":
      return buildTitleProperty(value);
    case "rich_text":
      return buildRichTextProperty(value);
    case "number":
      return buildNumberProperty(value);
    case "date":
      return buildDateProperty(value);
    case "url":
      return buildUrlProperty(value);
    case "select":
      return buildSelectProperty(value);
    case "multi_select":
      return buildMultiSelectProperty(value);
    case "files":
      return buildFilesProperty(extra.fileObject || null);
    default:
      return null;
  }
}

function getCoverFilename(metadata) {
  const base = `${metadata.source || "source"}-${metadata.type || "item"}-${metadata.id || Date.now()}`;
  return `${base.replace(/[^a-zA-Z0-9-_]/g, "_")}.jpg`;
}

function getDoubanCoverCandidates(url) {
  if (!url) return [];
  const urls = new Set([url]);
  const hosts = ["img1.doubanio.com", "img2.doubanio.com", "img3.doubanio.com", "img9.doubanio.com"];

  try {
    const u = new URL(url);
    const variants = [u.pathname];
    variants.push(u.pathname.replace("/s/public/", "/m/public/"));
    variants.push(u.pathname.replace("/s/public/", "/l/public/"));
    variants.push(u.pathname.replace("/m/public/", "/l/public/"));
    variants.push(u.pathname.replace("/s_ratio_poster/public/", "/m_ratio_poster/public/"));
    variants.push(u.pathname.replace("/s_ratio_poster/public/", "/l_ratio_poster/public/"));
    variants.push(u.pathname.replace("/m_ratio_poster/public/", "/l_ratio_poster/public/"));
    variants.push(u.pathname.replace("/view/photo/", "/view/subject/"));
    variants.push(u.pathname.replace("/view/photo/s_ratio_poster/public/", "/view/subject/s/public/"));
    variants.push(u.pathname.replace("/view/photo/m_ratio_poster/public/", "/view/subject/m/public/"));
    variants.push(u.pathname.replace("/view/photo/l_ratio_poster/public/", "/view/subject/l/public/"));

    const moreVariants = [];
    for (const p of variants) {
      moreVariants.push(p);
      if (p.endsWith(".webp")) moreVariants.push(p.replace(/\.webp$/i, ".jpg"));
      if (p.endsWith(".jpg")) moreVariants.push(p.replace(/\.jpg$/i, ".webp"));
    }

    for (const host of hosts) {
      for (const pathname of moreVariants) {
        const candidate = new URL(url);
        candidate.hostname = host;
        candidate.pathname = pathname;
        urls.add(candidate.toString());
      }
    }
  } catch {
    // ignore invalid url
  }

  return Array.from(urls);
}

function resolveTarget(config, metadata) {
  if (!config.notionToken) throw new Error("Missing Notion token.");
  const target = config.targets?.[metadata.type];
  if (!target) throw new Error(`Unsupported content type: ${metadata.type}`);
  if (!target.databaseId) throw new Error(`Missing Notion database ID for type: ${metadata.type}`);
  return target;
}

function shouldIncludeSourceField(target, sourceField, selectedFieldsSet = null) {
  if (target.fieldEnabled && target.fieldEnabled[sourceField] === false) return false;
  if (selectedFieldsSet && !selectedFieldsSet.has(sourceField)) return false;
  return true;
}

function summarizeValue(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function buildMappedProperties(config, metadata, target, selectedFields = null, opts = {}) {
  const performUpload = Boolean(opts.performUpload);
  const selectedFieldsSet = selectedFields ? new Set(selectedFields) : null;
  const overrides = opts.overrides || {};
  const customFields = Array.isArray(opts.customFields) ? opts.customFields : [];

  const schema = await getDatabaseSchemaCached(config.notionToken, target.databaseId);
  const propertiesSchema = schema.properties || {};
  const mapped = {};
  const warnings = [];
  const previewFields = [];

  let coverFileObject = null;
  const coverEnabled = shouldIncludeSourceField(target, "cover", selectedFieldsSet);
  if (metadata.coverUrl && coverEnabled) {
    if (metadata.source === "douban" && performUpload) {
      if (metadata.coverDataUrl) {
        const uploaded = await uploadImageToNotion(config.notionToken, metadata.coverDataUrl, getCoverFilename(metadata), {
          referrer: metadata.sourceUrl || ""
        });
        if (uploaded && uploaded.type === "file_upload") {
          coverFileObject = uploaded;
        }
      }

      if (!coverFileObject) {
        const candidates = getDoubanCoverCandidates(metadata.coverUrl);
        let lastError = "";
        let fallbackUrl = metadata.coverUrl;
        for (const candidate of candidates) {
          fallbackUrl = candidate;
          const uploaded = await uploadImageToNotion(config.notionToken, candidate, getCoverFilename(metadata), {
            referrer: metadata.sourceUrl || ""
          });
          if (uploaded && uploaded.type === "file_upload") {
            coverFileObject = uploaded;
            break;
          }
          if (uploaded?.error) lastError = uploaded.error;
        }
        if (!coverFileObject) {
          coverFileObject = {
            type: "external",
            external: { url: fallbackUrl || metadata.coverUrl }
          };
          warnings.push(`${lastError || "douban image upload failed"}; fallback to external cover url`);
        }
      }
    } else if (metadata.source === "douban" && !performUpload) {
      coverFileObject = { type: "external", external: { url: metadata.coverUrl } };
    } else {
      coverFileObject = { type: "external", external: { url: metadata.coverUrl } };
    }
  }

  for (const [sourceField, notionFieldName] of Object.entries(target.fieldMapping || {})) {
    if (!shouldIncludeSourceField(target, sourceField, selectedFieldsSet)) continue;
    if (!notionFieldName) continue;
    const propertyDef = propertiesSchema[notionFieldName];
    if (!propertyDef) {
      warnings.push(`Notion field not found: ${notionFieldName}`);
      continue;
    }

    const type = propertyDef.type;
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, sourceField);
    const value = hasOverride ? overrides[sourceField] : getSourceFieldValue(metadata, sourceField);
    let propertyValue = value;
    if (type === "select" && Array.isArray(value)) {
      const items = normalizeArray(value);
      propertyValue = getFirstMeaningfulItem(items);
      if (items.length > 1) {
        warnings.push(`Field ${notionFieldName} is select; used first value only: ${propertyValue}`);
      }
    }

    if (!hasMeaningfulValue(propertyValue) && sourceField !== "cover") {
      continue;
    }

    const built = buildPropertyValue(type, propertyValue, {
      fileObject: sourceField === "cover" ? coverFileObject : null
    });
    if (!built) {
      if (sourceField === "cover" || hasMeaningfulValue(propertyValue)) {
        warnings.push(`Skipped field ${notionFieldName} (${type})`);
      }
      continue;
    }

    mapped[notionFieldName] = built;
    previewFields.push({
      sourceField,
      notionField: notionFieldName,
      notionType: type,
      value: summarizeValue(propertyValue)
    });
  }

  for (const custom of customFields) {
    const notionFieldName = String(custom?.notionField || "").trim();
    if (!notionFieldName) continue;
    const propertyDef = propertiesSchema[notionFieldName];
    if (!propertyDef) {
      warnings.push(`Custom Notion field not found: ${notionFieldName}`);
      continue;
    }
    const value = custom?.value;
    if (!hasMeaningfulValue(value)) continue;

    const built = buildPropertyValue(propertyDef.type, value, {});
    if (!built) {
      warnings.push(`Skipped custom field ${notionFieldName} (${propertyDef.type})`);
      continue;
    }
    mapped[notionFieldName] = built;
    previewFields.push({
      sourceField: "__custom__",
      notionField: notionFieldName,
      notionType: propertyDef.type,
      value: summarizeValue(value)
    });
  }

  return {
    mapped,
    warnings,
    previewFields,
    databaseId: target.databaseId,
    availableNotionFields: Object.entries(propertiesSchema).map(([name, def]) => ({
      name,
      type: def.type || "unknown"
    }))
  };
}

export async function buildImportPreview(config, metadata) {
  const target = resolveTarget(config, metadata);
  const built = await buildMappedProperties(config, metadata, target, null, { performUpload: false });
  return {
    type: metadata.type,
    source: metadata.source,
    databaseId: built.databaseId,
    fields: built.previewFields,
    warnings: built.warnings,
    availableNotionFields: built.availableNotionFields
  };
}

export async function importMetadataToNotion(config, metadata, selectedFields = null, overrides = {}, customFields = []) {
  const target = resolveTarget(config, metadata);
  const built = await buildMappedProperties(config, metadata, target, selectedFields, {
    performUpload: true,
    overrides,
    customFields
  });
  const created = await createPage(config.notionToken, target.databaseId, built.mapped);

  return {
    pageId: created.id,
    url: created.url,
    warnings: built.warnings
  };
}
