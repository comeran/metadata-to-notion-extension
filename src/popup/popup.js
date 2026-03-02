const importBtn = document.getElementById("importBtn");
const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const previewEl = document.getElementById("preview");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");
const configBtn = document.getElementById("configBtn");
const addCustomBtn = document.getElementById("addCustomBtn");
const customListEl = document.getElementById("customList");

const state = {
  metadata: null,
  preview: null,
  supported: false,
  customRows: []
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
  statusEl.style.color = isError ? "#c00" : "#222";
}

function setConfigButton(visible, label = "去配置此类型", disabled = false) {
  configBtn.style.display = visible ? "block" : "none";
  configBtn.textContent = label;
  configBtn.disabled = disabled;
}

function setMeta(metadata, preview) {
  if (!metadata) {
    metaEl.textContent = "";
    return;
  }

  const fieldCount = preview?.fields?.length || 0;
  metaEl.textContent = `${metadata.source || ""} / ${metadata.type || ""}\n${metadata.title || ""}\n可写入字段: ${fieldCount}`;
}

function renderCustomRows() {
  const allFields = state.preview?.availableNotionFields || [];

  customListEl.innerHTML = state.customRows
    .map(
      (row, idx) => {
        const usedByOthers = new Set((state.preview?.fields || []).map((f) => f.notionField));
        state.customRows.forEach((other, j) => {
          if (j !== idx && other.notionField) usedByOthers.add(other.notionField);
        });
        const options = allFields
          .filter((f) => !usedByOthers.has(f.name) || f.name === row.notionField)
          .map(
            (f) =>
              `<option value="${escapeHtml(f.name)}" data-field-type="${escapeHtml(f.type)}">${escapeHtml(f.name)} (${escapeHtml(
                f.type
              )})</option>`
          )
          .join("");
        const rowType = allFields.find((f) => f.name === row.notionField)?.type || "";
        const placeholder =
          rowType === "multi_select"
            ? "例如: PS5, Xbox Series X/S, Switch"
            : rowType === "number"
              ? "例如: 9.0"
              : rowType === "date"
                ? "例如: 2025-09-04"
                : "字段值";
        return `
      <div class="custom-row" data-custom-index="${idx}">
        <div class="custom-grid">
          <select data-custom-notion="${idx}">
            <option value="">选择 Notion 字段（来自数据库）</option>
            ${options}
          </select>
          <button class="small-btn" data-remove-custom="${idx}">删除</button>
        </div>
        <input class="edit" data-custom-value="${idx}" placeholder="${escapeHtml(placeholder)}" />
        <div class="custom-meta">字段类型：${escapeHtml(rowType || "未选择")}</div>
      </div>
    `;
      }
    )
    .join("");

  state.customRows.forEach((row, idx) => {
    const notionEl = customListEl.querySelector(`[data-custom-notion="${idx}"]`);
    const valueEl = customListEl.querySelector(`[data-custom-value="${idx}"]`);
    if (notionEl) notionEl.value = row.notionField || "";
    if (valueEl) valueEl.value = row.value || "";
  });
}

function renderPreview(preview) {
  if (!preview?.fields?.length) {
    previewEl.textContent = "当前配置下没有可写入字段（请检查映射或字段启用开关）。";
    selectAllBtn.disabled = true;
    selectNoneBtn.disabled = true;
    addCustomBtn.disabled = !(preview?.availableNotionFields?.length);
    renderCustomRows();
    return;
  }

  const rows = preview.fields
    .map((field, idx) => {
      const valueRaw = String(field.value || "").slice(0, 240);
      const sourceField = escapeHtml(field.sourceField || "");
      const notionField = escapeHtml(field.notionField || "");
      const notionType = escapeHtml(field.notionType || "");
      return `
        <label class="row">
          <input type="checkbox" data-source-field="${sourceField}" checked />
          <div>
            <div class="name">
              ${sourceField}<span class="to">→</span>${notionField}
              <span class="badge">${notionType}</span>
            </div>
            <input class="edit" data-edit-source="${sourceField}" value="${escapeHtml(valueRaw)}" />
          </div>
        </label>
      `;
    })
    .join("");

  previewEl.innerHTML = rows;
  selectAllBtn.disabled = false;
  selectNoneBtn.disabled = false;
  addCustomBtn.disabled = !(preview?.availableNotionFields?.length);
  renderCustomRows();
}

function selectedSourceFields() {
  return Array.from(previewEl.querySelectorAll("input[data-source-field]:checked")).map((el) => el.dataset.sourceField);
}

function collectOverrides() {
  const overrides = {};
  previewEl.querySelectorAll("input[data-edit-source]").forEach((el) => {
    overrides[el.dataset.editSource] = el.value;
  });
  return overrides;
}

function collectCustomFields() {
  const out = [];
  state.customRows.forEach((_, idx) => {
    const notionEl = customListEl.querySelector(`[data-custom-notion="${idx}"]`);
    const valueEl = customListEl.querySelector(`[data-custom-value="${idx}"]`);
    const notionField = notionEl?.value?.trim() || "";
    const value = valueEl?.value ?? "";
    if (notionField && String(value).trim()) {
      out.push({ notionField, value });
    }
  });
  return out;
}

function syncCustomRowsFromDom() {
  state.customRows.forEach((row, idx) => {
    const notionEl = customListEl.querySelector(`[data-custom-notion="${idx}"]`);
    const valueEl = customListEl.querySelector(`[data-custom-value="${idx}"]`);
    if (notionEl) row.notionField = notionEl.value || "";
    if (valueEl) row.value = valueEl.value || "";
  });
}

function renderMetadataOnly(metadata) {
  const skipped = new Set(["supported", "debug", "id"]);
  const entries = Object.entries(metadata || {}).filter(([k, v]) => !skipped.has(k) && v !== undefined && v !== null && v !== "");
  if (!entries.length) {
    previewEl.textContent = "页面支持，但未提取到可展示字段。";
    return;
  }

  const rows = entries
    .map(([k, v]) => {
      const value = escapeHtml(Array.isArray(v) ? v.join(", ") : String(v));
      const key = escapeHtml(k);
      return `
        <div class="row">
          <div></div>
          <div>
            <div class="name">${key}</div>
            <div class="value">${value || "(空)"}</div>
          </div>
        </div>
      `;
    })
    .join("");
  previewEl.innerHTML = rows;
}

async function loadPreview() {
  const resp = await chrome.runtime.sendMessage({ type: "PREVIEW_ACTIVE_TAB" });
  if (!resp.ok) {
    throw new Error(resp.reason || "预览失败");
  }

  state.metadata = resp.metadata;
  state.preview = resp.preview;

  setMeta(state.metadata, state.preview);
  renderPreview(state.preview);

  if (resp.preview?.warnings?.length) {
    setStatus(`预览警告:\n${resp.preview.warnings.map((w) => `- ${w}`).join("\n")}`);
  } else {
    setStatus("预览完成，可编辑字段后导入。");
  }
}

async function pingSupport() {
  return chrome.runtime.sendMessage({ type: "PING_SUPPORT" });
}

async function doImport() {
  setStatus("正在导入...");
  importBtn.disabled = true;

  const selectedFields = selectedSourceFields();
  if (!selectedFields.length) {
    setStatus("请至少勾选一个字段", true);
    importBtn.disabled = false;
    return;
  }

  const overrides = collectOverrides();
  const customFields = collectCustomFields();

  const resp = await chrome.runtime.sendMessage({
    type: "IMPORT_ACTIVE_TAB",
    selectedFields,
    overrides,
    customFields
  });
  if (!resp.ok) {
    setStatus(`失败: ${resp.reason}`, true);
    importBtn.disabled = false;
    return;
  }

  const lines = [`成功创建: ${resp.result.pageId}`];
  if (resp.result.url) lines.push(resp.result.url);
  if (resp.result.warnings?.length) {
    lines.push("警告:");
    lines.push(...resp.result.warnings.map((w) => `- ${w}`));
  }

  setStatus(lines.join("\n"));
  importBtn.disabled = false;
}

importBtn.addEventListener("click", () => {
  doImport().catch((error) => {
    setStatus(`失败: ${error.message}`, true);
    importBtn.disabled = false;
  });
});

selectAllBtn.addEventListener("click", () => {
  previewEl.querySelectorAll("input[data-source-field]").forEach((el) => {
    el.checked = true;
  });
});

selectNoneBtn.addEventListener("click", () => {
  previewEl.querySelectorAll("input[data-source-field]").forEach((el) => {
    el.checked = false;
  });
});

addCustomBtn.addEventListener("click", () => {
  state.customRows.push({ notionField: "", value: "" });
  renderCustomRows();
});

customListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const idx = target.dataset.removeCustom;
  if (idx === undefined) return;
  const index = Number(idx);
  if (!Number.isInteger(index)) return;
  syncCustomRowsFromDom();
  state.customRows.splice(index, 1);
  renderCustomRows();
});

customListEl.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const idx = target.dataset.customNotion;
  if (idx === undefined) return;
  const index = Number(idx);
  if (!Number.isInteger(index) || !state.customRows[index]) return;
  syncCustomRowsFromDom();
  const select = customListEl.querySelector(`[data-custom-notion="${index}"]`);
  state.customRows[index].notionField = select?.value || "";
  renderCustomRows();
});

configBtn.addEventListener("click", async () => {
  try {
    setConfigButton(true, "正在打开配置页...", true);
    const scanResp = await chrome.runtime.sendMessage({ type: "SCAN_ACTIVE_TAB" });
    if (!scanResp.ok || !scanResp.scan) {
      throw new Error(scanResp.reason || "无法扫描当前页面");
    }
    await chrome.storage.local.set({
      pendingTypeConfigScan: {
        ...scanResp.scan,
        createdAt: Date.now()
      }
    });
    await chrome.runtime.openOptionsPage();
    setConfigButton(true, "已打开配置页", true);
    setStatus("已带入当前页面扫描结果，请在设置页完成 Notion 字段映射。");
  } catch (error) {
    setConfigButton(true, "去配置此类型", false);
    setStatus(`配置跳转失败: ${error.message}`, true);
  }
});

(async () => {
  let supportResp = null;
  try {
    supportResp = await pingSupport();
  } catch (error) {
    importBtn.disabled = true;
    importBtn.textContent = "检测失败";
    previewEl.textContent = "无法预览";
    setStatus(error.message, true);
    return;
  }

  if (!supportResp.ok || !supportResp.supported) {
    importBtn.disabled = true;
    importBtn.textContent = "当前页面不支持导入";
    setConfigButton(false);
    previewEl.textContent = "无法预览";
    setStatus(supportResp.reason || "请打开豆瓣/TMDB/IGN详情页", true);
    return;
  }

  state.supported = true;
  state.metadata = supportResp.metadata;
  setMeta(state.metadata, null);
  renderMetadataOnly(state.metadata);
  selectAllBtn.disabled = true;
  selectNoneBtn.disabled = true;
  addCustomBtn.disabled = true;
  setConfigButton(false);

  try {
    await loadPreview();
    importBtn.disabled = false;
    importBtn.textContent = "导入到 Notion";
  } catch (error) {
    importBtn.disabled = true;
    importBtn.textContent = "配置后可导入";
    setConfigButton(true, `去配置 ${state.metadata?.type || ""}`.trim());
    setStatus(`页面支持，但当前配置不可导入: ${error.message}`, true);
  }
})();
