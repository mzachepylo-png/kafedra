/* BioBib — фронтенд Етапу 1 (MVP), чистий JS без сторонніх збірок */

const state = {
  i18n: {},
  sources: [],
  selectedId: null,
  selectedSource: null,
  activeTab: "overview",
  settings: {},
  deleteTargetId: null,
  searchTimer: null,
  sections: [],
};

/* ---------- Розділи «Посилання»: папки → підпапки ---------- */

async function loadSections() {
  state.sections = await api("/api/sections");
  for (const id of ["sectionFilter", "fSection"]) {
    const sel = document.getElementById(id);
    const keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    state.sections.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = (s.parent_id ? "    " : "") + s.path + (s.count ? ` (${s.count})` : "");
      sel.appendChild(opt);
    });
    sel.value = keep;
  }
}

function t(key, fallback = "") {
  const parts = key.split(".");
  let cur = state.i18n;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = cur[p];
    } else {
      return fallback || key;
    }
  }
  return typeof cur === "string" ? cur : fallback || key;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeSnippet(html) {
  // Дозволяємо лише <mark> та </mark> з FTS5 snippet()
  return escapeHtml(html)
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>");
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2500);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(t("toast_copied"));
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast(t("toast_copied"));
  }
}

async function api(url, options = {}) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    let detail = t("toast_error");
    try {
      const err = await resp.json();
      if (err.detail) detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch {}
    showToast(detail);
    throw new Error(detail);
  }
  return resp.json();
}

/* Відкрити прикріплений файл у програмі за замовчуванням (PDF-переглядач) або показати його в Провіднику.
   Заголовок X-BioBib не дає стороннім сайтам викликати це через браузер (запит без нього відхиляється). */
async function openOnDisk(fileId, reveal) {
  await api(`/api/files/${fileId}/open?reveal=${reveal ? 1 : 0}`, { method: "POST", headers: { "X-BioBib": "1" } });
  showToast(t(reveal ? "toast_revealed" : "toast_opened"));
}

function formatAuthorsShort(authors) {
  if (!authors || !authors.length) return "—";
  const list = authors.map((a) => `${a.family} ${a.given_initials || ""}`.trim());
  if (list.length <= 3) return list.join(", ");
  return `${list.slice(0, 3).join(", ")} та ін.`;
}

function formatStars(rating) {
  const n = Number(rating) || 0;
  if (!n) return "";
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatBytes(bytes) {
  if (!bytes) return "0 Б";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key, el.textContent);
  });
  document.getElementById("searchInput").placeholder = t("search_placeholder");

  populateSelect("fType", state.i18n.source_types || {});
  populateSelect("fLanguage", state.i18n.languages || {});
  populateSelect("fStatus", state.i18n.statuses || {});
  populateSelect("sFourPlus", state.i18n.setting_dstu_4plus_options || {});
}

function populateSelect(id, mapObj) {
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  Object.entries(mapObj).forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

async function loadSources() {
  const q = document.getElementById("searchInput").value.trim();
  const sort = document.getElementById("sortSelect").value;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  const section = document.getElementById("sectionFilter").value;
  if (section) params.set("section", section);

  state.sources = await api(`/api/sources?${params.toString()}`);
  renderSourceList();

  if (state.selectedId) {
    const stillExists = state.sources.some((s) => s.id === state.selectedId);
    if (stillExists) {
      await selectSource(state.selectedId, false);
    } else if (state.sources.length) {
      await selectSource(state.sources[0].id, false);
    } else {
      state.selectedId = null;
      state.selectedSource = null;
      renderDetailPane();
    }
  }
}

function renderSourceList() {
  const container = document.getElementById("sourceList");
  const countEl = document.getElementById("sourceCount");
  countEl.textContent = `${t("count_sources")} ${state.sources.length}`;

  if (!state.sources.length) {
    const hasQuery = document.getElementById("searchInput").value.trim().length > 0;
    const secSel = document.getElementById("sectionFilter");
    const sec = secSel.value ? state.sections.find((x) => String(x.id) === secSel.value) : null;
    if (sec && !hasQuery) {
      // вибрано розділ без джерел — показуємо, де вони є, і кнопку «Усі джерела»
      const withSources = state.sections.filter((x) => x.count > 0);
      container.innerHTML = `
        <div class="empty-state">
          <h3>${escapeHtml(t("empty_section_title").replace("{name}", sec.path))}</h3>
          <p>${escapeHtml(t("empty_section_hint"))}</p>
          <p><button type="button" class="btn btn-primary btn-sm js-all-sources">${escapeHtml(t("btn_all_sources"))}</button></p>
          ${withSources.length ? `<p>${withSources.map((x) => `<button type="button" class="btn btn-secondary btn-sm js-goto-sec" data-id="${x.id}">${escapeHtml(x.path)} (${x.count})</button>`).join(" ")}</p>` : ""}
        </div>
      `;
      container.querySelector(".js-all-sources").addEventListener("click", () => { secSel.value = ""; loadSources(); });
      container.querySelectorAll(".js-goto-sec").forEach((b) => b.addEventListener("click", () => { secSel.value = b.dataset.id; loadSources(); }));
      return;
    }
    container.innerHTML = `
      <div class="empty-state">
        <h3>${escapeHtml(hasQuery ? t("empty_search_title") : t("empty_list_title"))}</h3>
        <p>${escapeHtml(hasQuery ? t("empty_search_hint") : t("empty_list_hint"))}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.sources
    .map((s) => {
      const activeClass = s.id === state.selectedId ? "active" : "";
      const typeLabel = t(`source_types.${s.type}`, s.type);
      const statusLabel = t(`statuses.${s.status}`, s.status);
      const tagsHtml = (s.tags || [])
        .map((tg) => `<span class="tag">${escapeHtml(tg)}</span>`)
        .join("");

      const snippetHtml = s.match_snippet
        ? `<div class="card-snippet">
             <strong>${escapeHtml(t(`match_fields.${s.match_field}`, ""))}:</strong>
             ${sanitizeSnippet(s.match_snippet)}
           </div>`
        : "";

      return `
        <article class="source-card ${activeClass}" data-id="${s.id}">
          <div class="card-top">
            <span class="card-meta-line">${escapeHtml(typeLabel)}${s.year ? " · " + s.year : ""}</span>
            <span class="badge badge-${escapeHtml(s.status)}">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="card-title">${escapeHtml(s.title)}</div>
          <div class="card-authors">${escapeHtml(formatAuthorsShort(s.authors))}${
        s.container_title ? " — <em>" + escapeHtml(s.container_title) + "</em>" : ""
      }</div>
          ${snippetHtml}
          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
          <div class="card-footer">
            <div class="card-meta-line">
              <span class="stars">${formatStars(s.rating)}</span>
              📎 ${s.file_count} · 📝 ${s.note_count}
            </div>
            <div>
              ${s.file_count ? `<a class="btn btn-sm btn-secondary" href="/reader/${s.id}" target="_blank" rel="noopener">${escapeHtml(t("btn_read"))}</a>` : ""}
              <button class="btn btn-sm btn-secondary js-copy-dstu" data-id="${s.id}" type="button">${escapeHtml(t("btn_copy_dstu"))}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll(".source-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".js-copy-dstu") || e.target.closest("a")) return;
      selectSource(Number(card.dataset.id));
    });
  });

  container.querySelectorAll(".js-copy-dstu").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const src = state.sources.find((x) => x.id === id);
      if (src) copyText(src.citation_dstu);
    });
  });
}

async function selectSource(id, rerenderList = true) {
  state.selectedId = id;
  state.selectedSource = await api(`/api/sources/${id}`);
  if (rerenderList) renderSourceList();
  renderDetailPane();
}

function renderDetailPane() {
  const pane = document.getElementById("detailPane");
  const s = state.selectedSource;
  if (!s) {
    pane.innerHTML = `<div class="empty-detail">${escapeHtml(t("select_source_hint"))}</div>`;
    return;
  }

  const descNote = (s.notes || []).find((n) => n.kind === "description");
  const regularNotes = (s.notes || []).filter((n) => n.kind !== "description");

  const metaItems = [
    [t("field_type"), t(`source_types.${s.type}`, s.type)],
    [t("field_language"), t(`languages.${s.language}`, s.language)],
    [t("field_status"), t(`statuses.${s.status}`, s.status)],
    [t("field_year"), s.year || "—"],
    [t("field_doi"), s.doi || "—"],
    [t("field_pmid"), s.pmid || "—"],
    [t("field_isbn"), s.isbn || "—"],
    [t("field_url"), s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a>` : "—"],
  ];

  pane.innerHTML = `
    <div class="detail-header">
      <div>
        <h1 class="detail-title">${escapeHtml(s.title)}${s.subtitle ? " : " + escapeHtml(s.subtitle) : ""}</h1>
        <div class="card-authors">${escapeHtml(formatAuthorsShort(s.authors))}</div>
        <div class="card-tags">${(s.tags || []).map((tg) => `<span class="tag">${escapeHtml(tg)}</span>`).join("")}</div>
      </div>
      <div class="detail-actions">
        <button id="btnEditSource" class="btn btn-secondary" type="button">${escapeHtml(t("btn_edit"))}</button>
        <button id="btnDeleteSource" class="btn btn-danger" type="button">${escapeHtml(t("btn_delete"))}</button>
      </div>
    </div>

    <div class="citation-box">
      <div class="citation-label">${escapeHtml(t("section_citation"))}</div>
      <div class="citation-text">${escapeHtml(s.citation_dstu)}</div>
      <div class="citation-actions">
        <button id="btnDetailCopyDstu" class="btn btn-sm btn-primary" type="button">${escapeHtml(t("btn_copy_dstu"))}</button>
        <button id="btnDetailCopyInText" class="btn btn-sm btn-secondary" type="button">${escapeHtml(t("btn_copy_intext"))} (${escapeHtml(s.in_text_citation)})</button>
      </div>
    </div>

    <div class="meta-grid">
      ${metaItems
        .map(
          ([k, v]) => `<div class="meta-item"><strong>${escapeHtml(k)}</strong><span>${k === t("field_url") ? v : escapeHtml(v)}</span></div>`
        )
        .join("")}
    </div>

    <div class="tabs">
      <button class="tab-btn ${state.activeTab === "overview" ? "active" : ""}" data-tab="overview">${escapeHtml(t("tab_overview"))}</button>
      <button class="tab-btn ${state.activeTab === "notes" ? "active" : ""}" data-tab="notes">${escapeHtml(t("tab_notes"))} (${regularNotes.length})</button>
      <button class="tab-btn ${state.activeTab === "files" ? "active" : ""}" data-tab="files">${escapeHtml(t("tab_files"))} (${(s.files || []).length})</button>
    </div>

    <div id="tabContent"></div>
  `;

  document.getElementById("btnEditSource").addEventListener("click", () => openSourceModal(s));
  document.getElementById("btnDeleteSource").addEventListener("click", () => openDeleteModal(s.id));
  document.getElementById("btnDetailCopyDstu").addEventListener("click", () => copyText(s.citation_dstu));
  document.getElementById("btnDetailCopyInText").addEventListener("click", () => copyText(s.in_text_citation));

  pane.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      renderDetailPane();
    });
  });

  const tabContent = document.getElementById("tabContent");
  if (state.activeTab === "overview") {
    tabContent.innerHTML = `
      <div class="info-block">
        <h4>${escapeHtml(t("section_my_description"))}</h4>
        <p>${escapeHtml(descNote && descNote.text ? descNote.text : t("no_description"))}</p>
      </div>
      <div class="structured-grid">
        <div class="info-block">
          <h4>${escapeHtml(t("field_study_object"))}</h4>
          <p>${escapeHtml(s.study_object || "—")}</p>
        </div>
        <div class="info-block">
          <h4>${escapeHtml(t("field_methods"))}</h4>
          <p>${escapeHtml(s.methods || "—")}</p>
        </div>
        <div class="info-block">
          <h4>${escapeHtml(t("field_main_results"))}</h4>
          <p>${escapeHtml(s.main_results || "—")}</p>
        </div>
        <div class="info-block">
          <h4>${escapeHtml(t("field_for_dissertation"))}</h4>
          <p>${escapeHtml(s.for_dissertation || "—")}</p>
        </div>
      </div>
    `;
  } else if (state.activeTab === "notes") {
    tabContent.innerHTML = `
      <form id="noteForm" class="note-form">
        <div class="form-grid-2">
          <div class="field">
            <label for="nKind">${escapeHtml(t("field_note_kind"))}</label>
            <select id="nKind">
              <option value="quote">${escapeHtml(t("note_kind_quote"))}</option>
              <option value="note">${escapeHtml(t("note_kind_note"))}</option>
            </select>
          </div>
          <div class="field">
            <label for="nPage">${escapeHtml(t("field_note_page"))}</label>
            <input id="nPage" type="text" placeholder="напр. 18" />
          </div>
        </div>
        <div class="field">
          <label for="nText">${escapeHtml(t("field_note_text"))}</label>
          <textarea id="nText" rows="3" required></textarea>
        </div>
        <div class="field">
          <label for="nComment">${escapeHtml(t("field_note_comment"))}</label>
          <input id="nComment" type="text" />
        </div>
        <button type="submit" class="btn btn-primary btn-sm">${escapeHtml(t("btn_add_note"))}</button>
      </form>
      <div id="notesList">
        ${
          regularNotes.length
            ? regularNotes
                .map(
                  (n) => `
                <div class="note-item">
                  <div class="note-header">
                    <strong>${escapeHtml(n.kind === "quote" ? t("note_kind_quote") : t("note_kind_note"))}${
                    n.page ? " · с. " + escapeHtml(n.page) : ""
                  }</strong>
                    <div>
                      <button type="button" class="btn btn-sm btn-secondary js-copy-quote" data-note-id="${n.id}">${escapeHtml(t("btn_copy_quote"))}</button>
                      <button type="button" class="btn btn-sm btn-danger js-del-note" data-note-id="${n.id}">✕</button>
                    </div>
                  </div>
                  <div class="${n.kind === "quote" ? "note-quote" : ""}">${escapeHtml(n.text)}</div>
                  ${n.comment ? `<div class="note-comment">${escapeHtml(n.comment)}</div>` : ""}
                </div>
              `
                )
                .join("")
            : `<p class="card-meta-line">${escapeHtml(t("no_notes"))}</p>`
        }
      </div>
    `;

    document.getElementById("noteForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        kind: document.getElementById("nKind").value,
        page: document.getElementById("nPage").value,
        text: document.getElementById("nText").value,
        comment: document.getElementById("nComment").value,
      };
      await api(`/api/sources/${s.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast(t("toast_saved"));
      await selectSource(s.id);
    });

    tabContent.querySelectorAll(".js-copy-quote").forEach((btn) => {
      btn.addEventListener("click", () => {
        const note = regularNotes.find((x) => x.id === Number(btn.dataset.noteId));
        if (!note) return;
        const pagePart = note.page ? `, с. ${note.page}` : "";
        const ref = `[${s.id}${pagePart}]`;
        copyText(`«${note.text}» ${ref}\n${s.citation_dstu}`);
      });
    });

    tabContent.querySelectorAll(".js-del-note").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/notes/${btn.dataset.noteId}`, { method: "DELETE" });
        showToast(t("toast_deleted"));
        await selectSource(s.id);
      });
    });
  } else if (state.activeTab === "files") {
    tabContent.innerHTML = `
      <form id="uploadForm" class="upload-form">
        <div class="form-grid-2">
          <div class="field">
            <label for="uFile">Файл (PDF, DOCX, XLSX, зображення…)</label>
            <input id="uFile" type="file" required />
          </div>
          <div class="field">
            <label for="uLabel">${escapeHtml(t("field_file_label"))}</label>
            <input id="uLabel" type="text" placeholder="основний текст" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">${escapeHtml(t("btn_upload_file"))}</button>
      </form>
      <div id="filesList">
        ${
          (s.files || []).length
            ? s.files
                .map((f) => {
                  const canPreview = f.mime === "application/pdf" || (f.mime || "").startsWith("image/");
                  return `
                    <div class="file-item">
                      <div class="file-header">
                        <div>
                          <strong>${escapeHtml(f.label || f.original_name)}</strong>
                          <div class="card-meta-line">${escapeHtml(f.original_name)} · ${formatBytes(f.size)} ${
                    f.has_text ? `· <span class="tag">${escapeHtml(t("file_indexed_badge"))}</span>` : ""
                  }</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                          ${
                            canPreview
                              ? `<button type="button" class="btn btn-sm btn-secondary js-preview-file" data-file-id="${f.id}" data-mime="${escapeHtml(f.mime)}" data-name="${escapeHtml(f.original_name)}">${escapeHtml(t("btn_open_preview"))}</button>`
                              : ""
                          }
                          ${
                            f.mime === "application/pdf"
                              ? `<a class="btn btn-sm btn-primary" href="/reader/${s.id}?file=${f.id}" target="_blank" rel="noopener">${escapeHtml(t("btn_read"))}</a>`
                              : ""
                          }
                          <button type="button" class="btn btn-sm btn-secondary js-open-disk" data-file-id="${f.id}" title="${escapeHtml(t("btn_open_disk_hint"))}">${escapeHtml(t("btn_open_disk"))}</button>
                          <button type="button" class="btn btn-sm btn-secondary js-reveal-disk" data-file-id="${f.id}" title="${escapeHtml(t("btn_reveal_disk"))}">📁</button>
                          <a class="btn btn-sm btn-secondary" href="/api/files/${f.id}?download=1">${escapeHtml(t("btn_download"))}</a>
                          <button type="button" class="btn btn-sm btn-danger js-del-file" data-file-id="${f.id}">✕</button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `<p class="card-meta-line">${escapeHtml(t("no_files"))}</p>`
        }
      </div>
    `;

    document.getElementById("uploadForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("uFile");
      if (!fileInput.files.length) return;
      const fd = new FormData();
      fd.append("file", fileInput.files[0]);
      fd.append("label", document.getElementById("uLabel").value);
      await api(`/api/sources/${s.id}/files`, { method: "POST", body: fd });
      showToast(t("toast_file_uploaded"));
      await selectSource(s.id);
    });

    tabContent.querySelectorAll(".js-preview-file").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPreviewModal(btn.dataset.fileId, btn.dataset.mime, btn.dataset.name);
      });
    });

    tabContent.querySelectorAll(".js-open-disk, .js-reveal-disk").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const reveal = btn.classList.contains("js-reveal-disk") ? 1 : 0;
        await openOnDisk(btn.dataset.fileId, reveal);
      });
    });

    tabContent.querySelectorAll(".js-del-file").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/files/${btn.dataset.fileId}`, { method: "DELETE" });
        showToast(t("toast_deleted"));
        await selectSource(s.id);
      });
    });
  }
}

/* ---------- Source Add/Edit Modal ---------- */

function updateFormFieldsByType() {
  const srcType = document.getElementById("fType").value;
  document.querySelectorAll("#sourceForm .field[data-types]").forEach((el) => {
    const allowed = el.getAttribute("data-types").split(",");
    el.classList.toggle("hidden-field", !allowed.includes(srcType));
  });

  const containerLabels = {
    article: t("field_container_article"),
    book_chapter: t("field_container_book_chapter"),
    conference: t("field_container_conference"),
    web: t("field_container_web"),
    database: t("field_container_database"),
  };
  document.getElementById("lblContainer").textContent =
    containerLabels[srcType] || t("field_container_default");
}

function addAuthorRow(author = {}) {
  const container = document.getElementById("authorsContainer");
  const row = document.createElement("div");
  row.className = "author-row";
  row.innerHTML = `
    <select class="a-role">
      <option value="author" ${author.role === "editor" ? "" : "selected"}>${escapeHtml(t("role_author"))}</option>
      <option value="editor" ${author.role === "editor" ? "selected" : ""}>${escapeHtml(t("role_editor"))}</option>
    </select>
    <input type="text" class="a-family" placeholder="${escapeHtml(t("field_author_family"))}" value="${escapeHtml(author.family || "")}" />
    <input type="text" class="a-initials" placeholder="${escapeHtml(t("field_author_initials"))}" value="${escapeHtml(author.given_initials || "")}" />
    <input type="text" class="a-orcid" placeholder="${escapeHtml(t("field_author_orcid"))}" value="${escapeHtml(author.orcid || "")}" />
    <button type="button" class="icon-btn js-remove-author" title="Видалити">✕</button>
  `;
  row.querySelector(".js-remove-author").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function openSourceModal(source = null) {
  document.getElementById("sourceModalTitle").textContent = source
    ? t("modal_edit_source")
    : t("modal_new_source");

  document.getElementById("fId").value = source ? source.id : "";
  document.getElementById("fType").value = source ? source.type : "article";
  document.getElementById("fLanguage").value = source ? source.language : "uk";
  document.getElementById("fTitle").value = source ? source.title : "";
  document.getElementById("fSubtitle").value = source ? source.subtitle : "";
  document.getElementById("fContainer").value = source ? source.container_title : "";
  document.getElementById("fYear").value = source && source.year ? source.year : "";
  document.getElementById("fVolume").value = source ? source.volume : "";
  document.getElementById("fIssue").value = source ? source.issue : "";
  document.getElementById("fPlace").value = source ? source.place : "";
  document.getElementById("fPublisher").value = source ? source.publisher : "";
  document.getElementById("fPages").value = source ? source.pages : "";
  document.getElementById("fPageCount").value = source && source.page_count ? source.page_count : "";
  document.getElementById("fDoi").value = source ? source.doi : "";
  document.getElementById("fPmid").value = source ? source.pmid : "";
  document.getElementById("fIsbn").value = source ? source.isbn : "";
  document.getElementById("fIssn").value = source ? source.issn : "";
  document.getElementById("fUrl").value = source ? source.url : "";
  document.getElementById("fAccessedDate").value = source ? source.accessed_date : "";
  document.getElementById("fStatus").value = source ? source.status : "unread";
  document.getElementById("fRating").value = source ? String(source.rating || 0) : "0";
  document.getElementById("fTags").value = source ? (source.tags || []).join(", ") : "";
  document.getElementById("fKeywords").value = source ? source.keywords : "";
  document.getElementById("fStudyObject").value = source ? source.study_object : "";
  document.getElementById("fMethods").value = source ? source.methods : "";
  document.getElementById("fMainResults").value = source ? source.main_results : "";
  document.getElementById("fForDissertation").value = source ? source.for_dissertation : "";

  const secIds = source ? source.section_ids || [] : [];
  const filterSec = document.getElementById("sectionFilter").value;
  document.getElementById("fSection").value = secIds.length ? String(secIds[0]) : (source ? "" : filterSec);

  const descNote = source ? (source.notes || []).find((n) => n.kind === "description") : null;
  document.getElementById("fDescription").value = descNote ? descNote.text : "";

  const authorsBox = document.getElementById("authorsContainer");
  authorsBox.innerHTML = "";
  if (source && source.authors && source.authors.length) {
    source.authors.forEach((a) => addAuthorRow(a));
  } else {
    addAuthorRow();
  }

  updateFormFieldsByType();
  openModal("sourceModal");
  document.getElementById("fTitle").focus();
}

async function handleSourceSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("fTitle").value.trim();
  if (!title) {
    showToast(t("validation_title_required"));
    return;
  }

  const authors = [];
  document.querySelectorAll("#authorsContainer .author-row").forEach((row, idx) => {
    const family = row.querySelector(".a-family").value.trim();
    if (!family) return;
    authors.push({
      role: row.querySelector(".a-role").value,
      family,
      given_initials: row.querySelector(".a-initials").value.trim(),
      orcid: row.querySelector(".a-orcid").value.trim(),
      position: idx,
    });
  });

  const tags = document
    .getElementById("fTags")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const yearVal = document.getElementById("fYear").value.trim();
  const pageCountVal = document.getElementById("fPageCount").value.trim();

  const payload = {
    type: document.getElementById("fType").value,
    language: document.getElementById("fLanguage").value,
    title,
    subtitle: document.getElementById("fSubtitle").value.trim(),
    container_title: document.getElementById("fContainer").value.trim(),
    year: yearVal ? Number(yearVal) : null,
    volume: document.getElementById("fVolume").value.trim(),
    issue: document.getElementById("fIssue").value.trim(),
    place: document.getElementById("fPlace").value.trim(),
    publisher: document.getElementById("fPublisher").value.trim(),
    pages: document.getElementById("fPages").value.trim(),
    page_count: pageCountVal ? Number(pageCountVal) : null,
    doi: document.getElementById("fDoi").value.trim(),
    pmid: document.getElementById("fPmid").value.trim(),
    isbn: document.getElementById("fIsbn").value.trim(),
    issn: document.getElementById("fIssn").value.trim(),
    url: document.getElementById("fUrl").value.trim(),
    accessed_date: document.getElementById("fAccessedDate").value.trim(),
    status: document.getElementById("fStatus").value,
    rating: Number(document.getElementById("fRating").value) || 0,
    tags,
    keywords: document.getElementById("fKeywords").value.trim(),
    description: document.getElementById("fDescription").value,
    study_object: document.getElementById("fStudyObject").value.trim(),
    methods: document.getElementById("fMethods").value.trim(),
    main_results: document.getElementById("fMainResults").value.trim(),
    for_dissertation: document.getElementById("fForDissertation").value.trim(),
    authors,
  };
  const secVal = document.getElementById("fSection").value;
  const editing = document.getElementById("fId").value;
  const prevSecs = editing && state.selectedSource ? state.selectedSource.section_ids || [] : [];
  // розділ у формі — один (перший); інші розділи джерела, якщо були, зберігаються
  payload.section_ids = secVal ? [Number(secVal), ...prevSecs.slice(1).filter((x) => x !== Number(secVal))]
                               : prevSecs.slice(1);

  const id = document.getElementById("fId").value;
  let saved;
  if (id) {
    saved = await api(`/api/sources/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    saved = await api("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  closeModal("sourceModal");
  showToast(t("toast_saved"));
  state.selectedId = saved.id;
  await loadSections();
  await loadSources();
}

/* ---------- Other Modals ---------- */

function openDeleteModal(id) {
  state.deleteTargetId = id;
  document.getElementById("chkDeleteFiles").checked = false;
  openModal("deleteModal");
}

function openPreviewModal(fileId, mime, name) {
  document.getElementById("previewTitle").textContent = name;
  const body = document.getElementById("previewBody");
  const url = `/api/files/${fileId}`;
  if (mime === "application/pdf") {
    body.innerHTML = `<iframe src="${url}"></iframe>`;
  } else {
    body.innerHTML = `<img src="${url}" alt="${escapeHtml(name)}" />`;
  }
  openModal("previewModal");
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  if (id === "previewModal") {
    document.getElementById("previewBody").innerHTML = "";
  }
}

/* ---------- Init ---------- */

async function init() {
  state.i18n = await api("/static/uk.json");
  applyStaticI18n();
  state.settings = await api("/api/settings");

  document.getElementById("btnAddSource").addEventListener("click", () => openSourceModal());
  document.getElementById("btnAddAuthorRow").addEventListener("click", () => addAuthorRow());
  document.getElementById("fType").addEventListener("change", updateFormFieldsByType);
  document.getElementById("sourceForm").addEventListener("submit", handleSourceSubmit);

  document.getElementById("btnSettings").addEventListener("click", () => {
    document.getElementById("sFourPlus").value = state.settings.dstu_four_plus_authors || "first_3_et_al";
    openModal("settingsModal");
  });

  document.getElementById("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    state.settings = await api("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dstu_four_plus_authors: document.getElementById("sFourPlus").value,
      }),
    });
    closeModal("settingsModal");
    showToast(t("toast_saved"));
    await loadSources();
  });

  document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
    if (!state.deleteTargetId) return;
    const delFiles = document.getElementById("chkDeleteFiles").checked;
    await api(`/api/sources/${state.deleteTargetId}?delete_files=${delFiles}`, {
      method: "DELETE",
    });
    closeModal("deleteModal");
    showToast(t("toast_deleted"));
    if (state.selectedId === state.deleteTargetId) {
      state.selectedId = null;
      state.selectedSource = null;
    }
    await loadSources();
    renderDetailPane();
  });

  document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => loadSources(), 180);
  });

  document.getElementById("sortSelect").addEventListener("change", () => loadSources());
  document.getElementById("sectionFilter").addEventListener("change", () => loadSources());

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => closeModal(el.getAttribute("data-close-modal")));
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("searchInput").focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openSourceModal();
    } else if (e.key === "Escape") {
      ["sourceModal", "settingsModal", "deleteModal", "previewModal"].forEach(closeModal);
    }
  });

  await loadSections();
  // з програми: /?section=ID — показати розділ; &new=1 — одразу форма нового джерела в цьому розділі
  const qs = new URLSearchParams(location.search);
  if (qs.get("section")) document.getElementById("sectionFilter").value = qs.get("section");
  await loadSources();
  if (qs.get("new")) openSourceModal();
}

init();
