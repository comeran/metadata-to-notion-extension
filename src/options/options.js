import { CONTENT_TYPES, SOURCE_FIELDS_BY_TYPE, getConfig, saveConfig } from "../core/storage.js";
import { getDatabaseSchemaCached } from "../core/notion.js";
import {
  SOURCE_FIELD_NAME_HINTS,
  SOURCE_FIELD_TYPE_COMPAT,
  SOURCE_TYPE_HINTS,
  getOrderedSourceFields,
  getSourceFieldValue,
  hasMeaningfulValue
} from "../core/source-fields.js";

const notionTokenEl = document.getElementById("notionToken");
const autoCreateSelectOptionEl = document.getElementById("autoCreateSelectOption");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const typeTabsEl = document.getElementById("typeTabs");
const activeTypeChipEl = document.getElementById("activeTypeChip");
const activeDatabaseIdEl = document.getElementById("activeDatabaseId");
const fetchSchemaBtn = document.getElementById("fetchSchemaBtn");
const typeStatusEl = document.getElementById("typeStatus");
const mappingBodyEl = document.getElementById("mappingBody");
const focusHintEl = document.getElementById("focusHint");

const TYPE_LABELS = {
  movie: "电影",
  book: "书籍",
  tv: "电视剧",
  game: "游戏"
};

const state = {
  config: null,
  schemasByType: {},
  scannedMetadataByType: {},
  focusType: null,
  pendingContext: null,
  activeType: "movie"
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = `page-status ${text ? (isError ? "error" : "success") : ""}`;
}

function setTypeStatus(text, isError = false) {
  typeStatusEl.textContent = text;
  typeStatusEl.className = `type-status ${text ? (isError ? "error" : "success") : ""}`;
}

function currentType() {
  return state.focusType || state.activeType;
}

function getSavedMappedFields(type) {
  const map = state.config?.targets?.[type]?.fieldMapping || {};
  return Array.from(
    new Set(
      Object.values(map)
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
}

function fieldOptionsHtml(type) {
  const schema = state.schemasByType[type];
  const options = Object.entries(schema?.properties || {}).map(([name, def]) => {
    const fieldType = def.type || "unknown";
    return `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${escapeHtml(fieldType)})</option>`;
  });
  const existingNames = new Set(Object.keys(schema?.properties || {}));
  const savedOnlyOptions = getSavedMappedFields(type)
    .filter((name) => !existingNames.has(name))
    .map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)} (saved)</option>`
    );

  return [`<option value="">-- 不映射 --</option>`, ...savedOnlyOptions, ...options].join("");
}

function formatPreview(value) {
  if (!hasMeaningfulValue(value)) return '<div class="preview-text">未扫描到</div>';
  if (Array.isArray(value)) {
    const chips = value
      .filter(Boolean)
      .slice(0, 8)
      .map((item) => `<span class="preview-chip">${escapeHtml(item)}</span>`)
      .join("");
    return `<div class="preview-chips">${chips || `<span class="preview-chip">(空)</span>`}</div>`;
  }
  const text = String(value);
  return `<div class="preview-text">${escapeHtml(text)}</div>`;
}

function renderMappingRows(type) {
  const optionsHtml = fieldOptionsHtml(type);
  const target = state.config.targets[type];
  const mapping = target.fieldMapping;
  const enabledMap = target.fieldEnabled || {};
  const sourceFields = SOURCE_FIELDS_BY_TYPE[type] || {};
  const orderedFields = getOrderedSourceFields(type, state.scannedMetadataByType[type]);

  return orderedFields
    .map((sourceField) => {
      const enabled = enabledMap[sourceField] !== false;
      const scannedValue = getSourceFieldValue(state.scannedMetadataByType[type], sourceField);
      const scanned = hasMeaningfulValue(scannedValue);
      return `
        <tr class="mapping-row ${enabled ? "" : "disabled"}">
          <td>
            <label class="switch">
              <input type="checkbox" data-field-enable="${type}:${sourceField}" ${enabled ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </td>
          <td>
            <div class="field-main">${escapeHtml(sourceField)}</div>
            <div class="field-sub">${escapeHtml(sourceFields[sourceField] || "")}</div>
            ${scanned ? '<span class="field-tag">已扫描</span>' : ""}
          </td>
          <td>
            ${formatPreview(scannedValue)}
          </td>
          <td>
            <span class="field-tag">${escapeHtml(SOURCE_TYPE_HINTS[sourceField] || "-")}</span>
          </td>
          <td>
            <select class="select" data-field-select="${type}:${sourceField}" ${enabled ? "" : "disabled"}>
              ${optionsHtml}
            </select>
            <div class="hint-mini" data-suggest-label="${type}:${sourceField}"></div>
          </td>
          <td>
            <button class="btn ghost-danger" type="button" data-delete-field="${type}:${sourceField}">删除</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setSelectionsFromState(type) {
  const target = state.config.targets[type];
  const mapping = target.fieldMapping;
  const enabledMap = target.fieldEnabled || {};
  const sourceFields = SOURCE_FIELDS_BY_TYPE[type] || {};

  for (const sourceField of Object.keys(sourceFields)) {
    const enableBox = document.querySelector(`[data-field-enable="${type}:${sourceField}"]`);
    const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
    const enabled = enabledMap[sourceField] !== false;
    if (enableBox) enableBox.checked = enabled;
    if (!select) continue;
    select.disabled = !enabled;
    select.value = mapping[sourceField] || "";
  }
}

function renderTabs() {
  if (state.focusType) {
    typeTabsEl.innerHTML = "";
    typeTabsEl.style.display = "none";
    return;
  }

  typeTabsEl.style.display = "flex";
  typeTabsEl.innerHTML = CONTENT_TYPES.map((type) => {
    const active = state.activeType === type;
    return `<button class="tab-btn ${active ? "active" : ""}" data-tab-type="${type}">${TYPE_LABELS[type]} (${type})</button>`;
  }).join("");
}

function renderFocusHint() {
  if (!state.focusType) {
    focusHintEl.style.display = "none";
    focusHintEl.innerHTML = "";
    return;
  }

  focusHintEl.style.display = "block";
  focusHintEl.className = "focus-hint";
  focusHintEl.innerHTML = `
    当前优先配置：${TYPE_LABELS[state.focusType]}（${state.focusType}）
    ${state.pendingContext?.source ? `<br/>来源站点：${escapeHtml(state.pendingContext.source)}` : ""}
    ${state.pendingContext?.sourceUrl ? `<div class="focus-url">来源页面：${escapeHtml(state.pendingContext.sourceUrl)}</div>` : ""}
  `;
}

function renderTypePanel() {
  const type = currentType();
  const dbId = state.config.targets[type]?.databaseId || "";
  activeTypeChipEl.textContent = `${TYPE_LABELS[type]} (${type})`;
  activeDatabaseIdEl.value = dbId;
}

function renderMappingPanel() {
  const type = currentType();
  mappingBodyEl.innerHTML = renderMappingRows(type);
  setSelectionsFromState(type);
}

function renderAll() {
  renderFocusHint();
  renderTabs();
  renderTypePanel();
  renderMappingPanel();
}

function syncStateFromForm() {
  const type = currentType();
  state.config.targets[type].databaseId = activeDatabaseIdEl.value.trim();
  const sourceFields = SOURCE_FIELDS_BY_TYPE[type] || {};
  for (const sourceField of Object.keys(sourceFields)) {
    const enableBox = document.querySelector(`[data-field-enable="${type}:${sourceField}"]`);
    const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
    if (enableBox) {
      state.config.targets[type].fieldEnabled[sourceField] = enableBox.checked;
    }
    if (select) {
      state.config.targets[type].fieldMapping[sourceField] = select.value || "";
    }
  }
}

function scoreCandidate(sourceField, notionName, notionType) {
  let score = 0;
  const lowerName = notionName.toLowerCase();
  const compatTypes = SOURCE_FIELD_TYPE_COMPAT[sourceField] || [];
  if (compatTypes.includes(notionType)) score += 4;

  const hints = SOURCE_FIELD_NAME_HINTS[sourceField] || [];
  for (const hint of hints) {
    if (lowerName.includes(hint.toLowerCase())) {
      score += 3;
      break;
    }
  }

  if (sourceField === "title" && notionType === "title") score += 3;
  if (sourceField === "sourceUrl" && notionType === "url") score += 3;
  if (sourceField === "cover" && notionType === "files") score += 3;
  if ((sourceField === "genres" || sourceField === "tags") && notionType === "multi_select") score += 2;
  if (sourceField === "summary" && notionType === "rich_text") score += 2;

  return score;
}

function suggestMappingForType(type) {
  const schema = state.schemasByType[type];
  if (!schema?.properties) return;

  const candidates = Object.entries(schema.properties).map(([name, def]) => ({
    name,
    type: def.type || "unknown"
  }));
  const used = new Set();
  const sourceFields = SOURCE_FIELDS_BY_TYPE[type] || {};

  for (const sourceField of Object.keys(sourceFields)) {
    if (state.config.targets[type].fieldEnabled[sourceField] === false) {
      const hintEl = document.querySelector(`[data-suggest-label="${type}:${sourceField}"]`);
      const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
      if (select) select.value = "";
      state.config.targets[type].fieldMapping[sourceField] = "";
      if (hintEl) hintEl.textContent = "已禁用";
      continue;
    }

    const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
    const hintEl = document.querySelector(`[data-suggest-label="${type}:${sourceField}"]`);
    if (!select) continue;

    if (select.value && candidates.find((c) => c.name === select.value)) {
      used.add(select.value);
      if (hintEl) hintEl.textContent = "已保留手动映射";
      continue;
    }

    const scored = candidates
      .filter((c) => !used.has(c.name))
      .map((c) => ({ ...c, score: scoreCandidate(sourceField, c.name, c.type) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= 5) {
      select.value = best.name;
      state.config.targets[type].fieldMapping[sourceField] = best.name;
      used.add(best.name);
      if (hintEl) hintEl.textContent = `自动建议: ${best.name} (${best.type})`;
    } else {
      select.value = "";
      state.config.targets[type].fieldMapping[sourceField] = "";
      if (hintEl) hintEl.textContent = "未找到高置信匹配";
    }
  }
}

async function fetchSchemaForType(type) {
  syncStateFromForm();

  const token = notionTokenEl.value.trim();
  const databaseId = state.config.targets[type].databaseId;
  if (!token) {
    setTypeStatus("请先填写 Notion Token", true);
    return;
  }
  if (!databaseId) {
    setTypeStatus("请先填写该类型的 Database ID", true);
    return;
  }

  setTypeStatus("读取中...");
  const schema = await getDatabaseSchemaCached(token, databaseId);
  state.schemasByType[type] = schema;

  renderMappingPanel();
  suggestMappingForType(type);
  const total = Object.keys(schema.properties || {}).length;
  setTypeStatus(`已读取 ${total} 个字段，并应用自动建议`);
}

async function preloadSchemasForConfiguredTypes() {
  const token = notionTokenEl.value.trim();
  if (!token) return;

  const dbIds = Array.from(
    new Set(
      CONTENT_TYPES.map((type) => (state.config.targets[type]?.databaseId || "").trim()).filter(Boolean)
    )
  );

  const jobs = dbIds.map(async (databaseId) => {
    try {
      const schema = await getDatabaseSchemaCached(token, databaseId);
      for (const type of CONTENT_TYPES) {
        if ((state.config.targets[type]?.databaseId || "").trim() === databaseId) {
          state.schemasByType[type] = schema;
        }
      }
    } catch {
      // ignore preload failures; saved mapping options still render
    }
  });

  await Promise.all(jobs);
}

function setScannedMetadata(type, normalized) {
  state.scannedMetadataByType[type] = normalized || null;
  if (type === currentType()) {
    renderMappingPanel();
    suggestMappingForType(type);
  }
}

function applyPendingScan(pending) {
  if (!pending || !pending.type || !state.config.targets[pending.type]) return false;
  state.focusType = pending.type;
  state.activeType = pending.type;
  state.pendingContext = {
    source: pending.source || "",
    sourceUrl: pending.sourceUrl || ""
  };
  renderAll();
  setScannedMetadata(pending.type, pending.normalized || {});
  setTypeStatus("已从目标页面带入扫描结果，请继续读取 Notion 字段并映射");
  return true;
}

async function consumePendingScan() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_PENDING_TYPE_CONFIG_SCAN" });
    const pending = resp?.ok ? resp.pending : null;
    const applied = applyPendingScan(pending);
    if (applied) {
      await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_TYPE_CONFIG_SCAN" });
    }
  } catch {
    // ignore
  }
}

typeTabsEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const tabType = target.dataset.tabType;
  if (!tabType || !CONTENT_TYPES.includes(tabType)) return;
  syncStateFromForm();
  state.activeType = tabType;
  setTypeStatus("");
  renderAll();
});

fetchSchemaBtn.addEventListener("click", () => {
  const type = currentType();
  fetchSchemaForType(type).catch((error) => {
    setTypeStatus(`读取失败: ${error.message}`, true);
  });
});

mappingBodyEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const deleteKey = target.dataset.deleteField;
  if (!deleteKey) return;

  const [type, sourceField] = deleteKey.split(":");
  if (!type || !sourceField) return;

  state.config.targets[type].fieldEnabled[sourceField] = false;
  state.config.targets[type].fieldMapping[sourceField] = "";

  const enableBox = document.querySelector(`[data-field-enable="${type}:${sourceField}"]`);
  const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
  const hintEl = document.querySelector(`[data-suggest-label="${type}:${sourceField}"]`);

  if (enableBox) enableBox.checked = false;
  if (select) {
    select.value = "";
    select.disabled = true;
  }
  if (hintEl) hintEl.textContent = "已删除";

  const row = target.closest("tr");
  if (row) row.classList.add("disabled");
});

mappingBodyEl.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const key = target.dataset.fieldEnable;
  if (!key) return;

  const [type, sourceField] = key.split(":");
  if (!type || !sourceField || !(target instanceof HTMLInputElement)) return;

  const enabled = target.checked;
  state.config.targets[type].fieldEnabled[sourceField] = enabled;
  if (!enabled) {
    state.config.targets[type].fieldMapping[sourceField] = "";
  }

  const select = document.querySelector(`[data-field-select="${type}:${sourceField}"]`);
  if (select) {
    select.disabled = !enabled;
    if (!enabled) select.value = "";
  }

  const row = target.closest("tr");
  if (row) row.classList.toggle("disabled", !enabled);

  const hintEl = document.querySelector(`[data-suggest-label="${type}:${sourceField}"]`);
  if (hintEl) hintEl.textContent = enabled ? "" : "已禁用";
});

saveBtn.addEventListener("click", async () => {
  try {
    syncStateFromForm();
    await saveConfig({
      notionToken: notionTokenEl.value.trim(),
      targets: state.config.targets,
      options: {
        autoCreateSelectOption: autoCreateSelectOptionEl.checked
      }
    });
    setStatus("配置已保存");
  } catch (error) {
    setStatus(`保存失败: ${error.message}`, true);
  }
});

async function load() {
  state.config = await getConfig();
  notionTokenEl.value = state.config.notionToken || "";
  autoCreateSelectOptionEl.checked = Boolean(state.config.options?.autoCreateSelectOption);
  state.activeType = CONTENT_TYPES[0];
  await preloadSchemasForConfiguredTypes();
  renderAll();
  await consumePendingScan();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes.pendingTypeConfigScan || !changes.pendingTypeConfigScan.newValue) return;
  applyPendingScan(changes.pendingTypeConfigScan.newValue);
});

window.addEventListener("focus", () => {
  consumePendingScan();
});

load().catch((error) => setStatus(error.message, true));
