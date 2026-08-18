const TEXT_CHUNK_SIZE = 100000;
const CHUNK_MIN_RATIO = 0.55;
const CHUNK_MAX_RATIO = 1.1;

const state = {
  user: null,
  books: [],
  logs: [],
  styleCards: [],
  currentStyleCard: null,
  activeBook: null,
  activeVersion: null,
  selection: null,
  paragraphSelection: {
    enabled: false,
    anchor: null,
    focus: null
  },
  textChunks: [],
  textChunkVersionId: null,
  extractSelectedChunks: new Set(),
  readerWindow: {
    index: 0,
    start: 0,
    end: 0,
    total: 1
  },
  settings: {
    renderMode: "txt",
    fontFamily: "'Noto Serif SC', 'Songti SC', SimSun, serif",
    fontSize: 19,
    lineHeight: 1.9,
    textColor: "#2a2722",
    bgColor: "#fbf7ec",
    toolbarCollapsed: false
  }
};

const els = {
  authView: document.querySelector("#authView"),
  appShell: document.querySelector("#appShell"),
  authForm: document.querySelector("#authForm"),
  authUsername: document.querySelector("#authUsername"),
  authPassword: document.querySelector("#authPassword"),
  loginButton: document.querySelector("#loginButton"),
  registerButton: document.querySelector("#registerButton"),
  authStatus: document.querySelector("#authStatus"),
  currentUser: document.querySelector("#currentUser"),
  logoutButton: document.querySelector("#logoutButton"),
  uploadForm: document.querySelector("#uploadForm"),
  fileInput: document.querySelector("#fileInput"),
  bookTitle: document.querySelector("#bookTitle"),
  encodingSelect: document.querySelector("#encodingSelect"),
  uploadProgress: document.querySelector("#uploadProgress"),
  uploadProgressLabel: document.querySelector("#uploadProgressLabel"),
  uploadProgressPercent: document.querySelector("#uploadProgressPercent"),
  uploadProgressBar: document.querySelector("#uploadProgressBar"),
  bookList: document.querySelector("#bookList"),
  bookCount: document.querySelector("#bookCount"),
  pasteText: document.querySelector("#pasteText"),
  currentTitle: document.querySelector("#currentTitle"),
  currentVersion: document.querySelector("#currentVersion"),
  readerTab: document.querySelector("#readerTab"),
  readerProgress: document.querySelector("#readerProgress"),
  readerProgressLabel: document.querySelector("#readerProgressLabel"),
  readerProgressPercent: document.querySelector("#readerProgressPercent"),
  readerProgressBar: document.querySelector("#readerProgressBar"),
  readerControlStack: document.querySelector(".reader-control-stack"),
  toggleReaderToolbarButton: document.querySelector("#toggleReaderToolbarButton"),
  readerSurface: document.querySelector("#readerSurface"),
  readerPager: document.querySelector("#readerPager"),
  prevChunkButton: document.querySelector("#prevChunkButton"),
  nextChunkButton: document.querySelector("#nextChunkButton"),
  chunkMeta: document.querySelector("#chunkMeta"),
  paragraphSelectBar: document.querySelector("#paragraphSelectBar"),
  toggleParagraphSelectButton: document.querySelector("#toggleParagraphSelectButton"),
  paragraphSelectMeta: document.querySelector("#paragraphSelectMeta"),
  clearParagraphSelectButton: document.querySelector("#clearParagraphSelectButton"),
  rewriteParagraphSelectionButton: document.querySelector("#rewriteParagraphSelectionButton"),
  readerText: document.querySelector("#readerText"),
  emptyReader: document.querySelector("#emptyReader"),
  renderMode: document.querySelector("#renderMode"),
  fontFamily: document.querySelector("#fontFamily"),
  fontSize: document.querySelector("#fontSize"),
  fontSizeOutput: document.querySelector("#fontSizeOutput"),
  lineHeight: document.querySelector("#lineHeight"),
  lineHeightOutput: document.querySelector("#lineHeightOutput"),
  textColor: document.querySelector("#textColor"),
  bgColor: document.querySelector("#bgColor"),
  tabs: document.querySelectorAll(".tab-button"),
  outlineTab: document.querySelector("#outlineTab"),
  rewriteTab: document.querySelector("#rewriteTab"),
  compareTab: document.querySelector("#compareTab"),
  infoTab: document.querySelector("#infoTab"),
  styleTab: document.querySelector("#styleTab"),
  settingsTab: document.querySelector("#settingsTab"),
  shelfTab: document.querySelector("#shelfTab"),
  logsTab: document.querySelector("#logsTab"),
  selectionMeta: document.querySelector("#selectionMeta"),
  selectionPreview: document.querySelector("#selectionPreview"),
  outlineSelectionMeta: document.querySelector("#outlineSelectionMeta"),
  outlineSelectionPreview: document.querySelector("#outlineSelectionPreview"),
  outlineForm: document.querySelector("#outlineForm"),
  outlineInstruction: document.querySelector("#outlineInstruction"),
  outlineUseCurrentChunk: document.querySelector("#outlineUseCurrentChunk"),
  outlineButton: document.querySelector("#outlineButton"),
  useOutlineAsRewriteButton: document.querySelector("#useOutlineAsRewriteButton"),
  outlineOutput: document.querySelector("#outlineOutput"),
  outlineStatus: document.querySelector("#outlineStatus"),
  rewriteForm: document.querySelector("#rewriteForm"),
  rewriteInstruction: document.querySelector("#rewriteInstruction"),
  rewriteUseCurrentChunk: document.querySelector("#rewriteUseCurrentChunk"),
  rewriteButton: document.querySelector("#rewriteButton"),
  rewriteStatus: document.querySelector("#rewriteStatus"),
  styleAnalysisForm: document.querySelector("#styleAnalysisForm"),
  styleCardTitle: document.querySelector("#styleCardTitle"),
  styleSampleText: document.querySelector("#styleSampleText"),
  analyzeStyleButton: document.querySelector("#analyzeStyleButton"),
  styleAnalysisStatus: document.querySelector("#styleAnalysisStatus"),
  styleCardCount: document.querySelector("#styleCardCount"),
  styleCardList: document.querySelector("#styleCardList"),
  compareCount: document.querySelector("#compareCount"),
  compareList: document.querySelector("#compareList"),
  bookInfoForm: document.querySelector("#bookInfoForm"),
  bookInfoMeta: document.querySelector("#bookInfoMeta"),
  storyBackground: document.querySelector("#storyBackground"),
  characterSettings: document.querySelector("#characterSettings"),
  plotDevelopment: document.querySelector("#plotDevelopment"),
  characterCardMeta: document.querySelector("#characterCardMeta"),
  characterCardList: document.querySelector("#characterCardList"),
  extractRangeMeta: document.querySelector("#extractRangeMeta"),
  extractChunkList: document.querySelector("#extractChunkList"),
  selectAllChunksButton: document.querySelector("#selectAllChunksButton"),
  selectCurrentChunkButton: document.querySelector("#selectCurrentChunkButton"),
  clearChunksButton: document.querySelector("#clearChunksButton"),
  saveInfoButton: document.querySelector("#saveInfoButton"),
  extractInfoButton: document.querySelector("#extractInfoButton"),
  bookInfoStatus: document.querySelector("#bookInfoStatus"),
  settingsForm: document.querySelector("#settingsForm"),
  apiKey: document.querySelector("#apiKey"),
  baseUrl: document.querySelector("#baseUrl"),
  modelName: document.querySelector("#modelName"),
  temperature: document.querySelector("#temperature"),
  maxTokens: document.querySelector("#maxTokens"),
  thinking: document.querySelector("#thinking"),
  reasoningEffort: document.querySelector("#reasoningEffort"),
  systemPrompts: document.querySelector("#systemPrompts"),
  addPrompt: document.querySelector("#addPrompt"),
  outlineSystemPrompt: document.querySelector("#outlineSystemPrompt"),
  outlineUserPrompt: document.querySelector("#outlineUserPrompt"),
  extractSystemPrompt: document.querySelector("#extractSystemPrompt"),
  extractBackgroundPrompt: document.querySelector("#extractBackgroundPrompt"),
  extractCharactersPrompt: document.querySelector("#extractCharactersPrompt"),
  extractPlotPrompt: document.querySelector("#extractPlotPrompt"),
  styleAnalysisModel: document.querySelector("#styleAnalysisModel"),
  styleAnalysisTemperature: document.querySelector("#styleAnalysisTemperature"),
  styleAnalysisMaxTokens: document.querySelector("#styleAnalysisMaxTokens"),
  styleAnalysisSystemPrompt: document.querySelector("#styleAnalysisSystemPrompt"),
  styleAnalysisUserPrompt: document.querySelector("#styleAnalysisUserPrompt"),
  settingsStatus: document.querySelector("#settingsStatus"),
  logCount: document.querySelector("#logCount"),
  logList: document.querySelector("#logList"),
  refreshLogsButton: document.querySelector("#refreshLogsButton"),
  clearLogsButton: document.querySelector("#clearLogsButton"),
  versionDialog: document.querySelector("#versionDialog"),
  versionDialogTitle: document.querySelector("#versionDialogTitle"),
  versionChoices: document.querySelector("#versionChoices"),
  characterDialog: document.querySelector("#characterDialog"),
  characterDialogTitle: document.querySelector("#characterDialogTitle"),
  characterDialogSubtitle: document.querySelector("#characterDialogSubtitle"),
  characterDialogBody: document.querySelector("#characterDialogBody"),
  styleCardDialog: document.querySelector("#styleCardDialog"),
  styleCardDialogTitle: document.querySelector("#styleCardDialogTitle"),
  styleCardDialogSubtitle: document.querySelector("#styleCardDialogSubtitle"),
  styleCardDialogBody: document.querySelector("#styleCardDialogBody"),
  copyStylePromptButton: document.querySelector("#copyStylePromptButton"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  bindEvents();
  loadReaderSettings();
  await checkAuth();
}

function bindEvents() {
  els.authForm.addEventListener("submit", (event) => onAuthSubmit(event, "login"));
  els.registerButton.addEventListener("click", (event) => onAuthSubmit(event, "register"));
  els.logoutButton.addEventListener("click", onLogout);
  els.prevChunkButton.addEventListener("click", () => moveTextChunk(-1));
  els.nextChunkButton.addEventListener("click", () => moveTextChunk(1));
  els.toggleParagraphSelectButton.addEventListener("click", toggleParagraphSelectionMode);
  els.clearParagraphSelectButton.addEventListener("click", () => clearParagraphSelection({ clearTextSelection: true }));
  els.rewriteParagraphSelectionButton.addEventListener("click", () => activateTab("rewrite"));
  els.uploadForm.addEventListener("submit", onUpload);
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file && !els.bookTitle.value.trim()) {
      els.bookTitle.value = file.name.replace(/\.txt$/i, "");
    }
  });

  els.renderMode.addEventListener("change", () => updateReaderSetting("renderMode", els.renderMode.value));
  els.fontFamily.addEventListener("change", () => updateReaderSetting("fontFamily", els.fontFamily.value));
  els.fontSize.addEventListener("input", () => updateReaderSetting("fontSize", Number(els.fontSize.value)));
  els.lineHeight.addEventListener("input", () => updateReaderSetting("lineHeight", Number(els.lineHeight.value)));
  els.textColor.addEventListener("input", () => updateReaderSetting("textColor", els.textColor.value));
  els.bgColor.addEventListener("input", () => updateReaderSetting("bgColor", els.bgColor.value));
  els.toggleReaderToolbarButton.addEventListener("click", toggleReaderToolbar);

  els.tabs.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.addEventListener("selectionchange", debounce(updateSelectionFromDom, 80));
  els.readerText.addEventListener("mouseup", updateSelectionFromDom);
  els.readerText.addEventListener("keyup", updateSelectionFromDom);
  els.readerText.addEventListener("click", onReaderParagraphClick);
  els.outlineForm.addEventListener("submit", onGenerateOutline);
  els.useOutlineAsRewriteButton.addEventListener("click", useOutlineAsRewriteInstruction);
  els.rewriteForm.addEventListener("submit", onRewrite);
  els.styleAnalysisForm.addEventListener("submit", onAnalyzeStyle);
  els.bookInfoForm.addEventListener("submit", onSaveBookInfo);
  els.selectAllChunksButton.addEventListener("click", selectAllExtractChunks);
  els.selectCurrentChunkButton.addEventListener("click", selectCurrentExtractChunk);
  els.clearChunksButton.addEventListener("click", clearExtractChunks);
  els.extractInfoButton.addEventListener("click", onExtractBookInfo);
  els.settingsForm.addEventListener("submit", onSaveConfig);
  els.addPrompt.addEventListener("click", () => addPromptInput(""));
  els.refreshLogsButton.addEventListener("click", loadLogs);
  els.clearLogsButton.addEventListener("click", onClearLogs);
  els.copyStylePromptButton.addEventListener("click", copyCurrentStylePrompt);
}

async function checkAuth() {
  try {
    const payload = await api("/api/auth/status", { skipAuthRedirect: true });
    if (payload.authenticated) {
      await startAuthenticatedSession(payload.user);
      return;
    }
  } catch {
    // Fall through to the login page.
  }
  showAuthView();
}

async function onAuthSubmit(event, mode) {
  event.preventDefault();
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  if (!username || !password) {
    setStatus(els.authStatus, "请输入用户名和密码", true);
    return;
  }

  const isRegister = mode === "register";
  setAuthBusy(true);
  setStatus(els.authStatus, isRegister ? "正在创建账号..." : "正在登录...");
  try {
    const payload = await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true
    });
    els.authPassword.value = "";
    setStatus(els.authStatus, "");
    await startAuthenticatedSession(payload.user);
  } catch (error) {
    setStatus(els.authStatus, error.message, true);
  } finally {
    setAuthBusy(false);
  }
}

async function startAuthenticatedSession(user) {
  state.user = user;
  els.currentUser.textContent = user.username;
  els.authView.hidden = true;
  els.appShell.hidden = false;
  resetWorkspaceState();
  await Promise.all([loadBooks(), loadConfig(), loadLogs(), loadStyleCards()]);
}

function showAuthView(message = "") {
  state.user = null;
  resetWorkspaceState();
  els.currentUser.textContent = "未登录";
  els.appShell.hidden = true;
  els.authView.hidden = false;
  if (message) setStatus(els.authStatus, message, true);
  els.authUsername.focus();
}

async function onLogout() {
  try {
    await api("/api/auth/logout", { method: "POST", skipAuthRedirect: true });
  } catch {
    // Local logout should still clear the client state if the server session is already gone.
  }
  showAuthView();
  setStatus(els.authStatus, "已退出登录");
}

function resetWorkspaceState() {
  state.books = [];
  state.logs = [];
  state.styleCards = [];
  state.currentStyleCard = null;
  state.activeBook = null;
  state.activeVersion = null;
  state.selection = null;
  els.outlineInstruction.value = "";
  els.outlineUseCurrentChunk.checked = false;
  clearOutlineResult();
  resetTextChunks();
  resetReaderWindow();
  setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, { visible: false });
  setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, { visible: false });
  window.getSelection()?.removeAllRanges();
  renderBooks();
  renderReader();
  renderSelection();
  renderCompare();
  renderBookInfo();
  renderLogs();
  renderStyleCards();
  activateTab("reader");
}

function setAuthBusy(isBusy) {
  els.loginButton.disabled = isBusy;
  els.registerButton.disabled = isBusy;
}

async function api(path, options = {}) {
  const { skipAuthRedirect, onDownloadProgress, headers, ...fetchOptions } = options;
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(headers || {})
    },
    ...fetchOptions
  });

  const payload = await readResponsePayload(response, onDownloadProgress);
  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      showAuthView(payload?.error || "请先登录");
    }
    throw new Error(payload?.error || payload?.detail || payload || "请求失败");
  }
  return payload;
}

async function readResponsePayload(response, onDownloadProgress) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  if (!onDownloadProgress || !response.body) {
    return isJson ? await response.json() : await response.text();
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onDownloadProgress(received, total);
  }

  const text = await new Blob(chunks).text();
  onDownloadProgress(received, total || received);
  return isJson ? JSON.parse(text) : text;
}

async function loadBooks() {
  const payload = await api("/api/books");
  state.books = payload.books || [];
  renderBooks();
  renderCompare();
}

async function loadConfig() {
  const config = await api("/api/config");
  els.baseUrl.value = config.baseUrl || "";
  els.modelName.value = config.model || "";
  els.temperature.value = config.temperature ?? 0.7;
  els.maxTokens.value = config.maxTokens ?? 4096;
  els.thinking.value = config.thinking || "disabled";
  els.reasoningEffort.value = config.reasoningEffort || "high";
  els.apiKey.placeholder = config.hasApiKey ? "已保存，留空不修改" : "填写 DeepSeek API Key";
  els.systemPrompts.innerHTML = "";
  (config.systemPrompts?.length ? config.systemPrompts : [""]).forEach(addPromptInput);
  els.outlineSystemPrompt.value = config.outlineDesign?.systemPrompt || "";
  els.outlineUserPrompt.value = config.outlineDesign?.userPrompt || "";
  els.extractSystemPrompt.value = config.extractionPrompts?.system || "";
  els.extractBackgroundPrompt.value = config.extractionPrompts?.background || "";
  els.extractCharactersPrompt.value = config.extractionPrompts?.characters || "";
  els.extractPlotPrompt.value = config.extractionPrompts?.plot || "";
  els.styleAnalysisModel.value = config.styleAnalysis?.model || "";
  els.styleAnalysisTemperature.value = config.styleAnalysis?.temperature ?? 0.35;
  els.styleAnalysisMaxTokens.value = config.styleAnalysis?.maxTokens ?? 4096;
  els.styleAnalysisSystemPrompt.value = config.styleAnalysis?.systemPrompt || "";
  els.styleAnalysisUserPrompt.value = config.styleAnalysis?.userPrompt || "";
}

async function loadStyleCards() {
  try {
    const payload = await api("/api/style-cards");
    state.styleCards = payload.cards || [];
    renderStyleCards();
  } catch (error) {
    showToast(error.message);
  }
}

function renderBooks() {
  els.bookCount.textContent = `${state.books.length} 本`;
  els.bookList.innerHTML = "";
  if (!state.books.length) {
    els.bookList.append(emptyState("还没有书籍。上传 TXT 小说后，会自动保存为 v1 初始版本。"));
    return;
  }

  for (const book of state.books) {
    const item = document.createElement("article");
    item.className = "book-item";

    const title = document.createElement("div");
    title.className = "book-title";
    title.textContent = book.title;

    const meta = document.createElement("div");
    meta.className = "book-meta";
    meta.textContent = `${book.versions.length} 个版本 · ${formatDate(book.updatedAt)}`;

    const actions = document.createElement("div");
    actions.className = "book-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "打开";
    openButton.addEventListener("click", () => showVersionDialog(book.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => onDeleteBook(book));

    actions.append(openButton, deleteButton);
    item.append(title, meta, actions);
    els.bookList.append(item);
  }
}

async function onDeleteBook(book) {
  const ok = window.confirm(`确定删除《${book.title}》吗？这会删除该书的所有版本。`);
  if (!ok) return;

  try {
    const payload = await api(`/api/books/${book.id}`, { method: "DELETE" });
    state.books = payload.books || [];
    if (state.activeBook?.id === book.id) {
      state.activeBook = null;
      state.activeVersion = null;
      state.selection = null;
      clearOutlineResult();
      resetParagraphSelection();
      resetTextChunks();
      resetReaderWindow();
      window.getSelection()?.removeAllRanges();
      renderReader();
      renderSelection();
    }
    renderBooks();
    renderCompare();
    showToast("已删除书籍");
  } catch (error) {
    showToast(error.message);
  }
}

function showVersionDialog(bookId) {
  const book = state.books.find((entry) => entry.id === bookId);
  if (!book) return;

  els.versionDialogTitle.textContent = `选择版本：${book.title}`;
  renderVersionChoices(book);
  els.versionDialog.showModal();
}

function renderVersionChoices(book) {
  els.versionChoices.innerHTML = "";

  [...book.versions].reverse().forEach((version) => {
    const row = document.createElement("article");
    row.className = "version-choice";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = version.label;
    const meta = document.createElement("small");
    meta.textContent = [
      formatDate(version.createdAt),
      `${version.contentLength} 字`,
      version.change ? `要求：${version.change.instruction}` : "初始导入"
    ].join(" · ");
    info.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "载入";
    button.addEventListener("click", async () => {
      els.versionDialog.close();
      await loadVersion(book.id, version.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = isCurrentVersion(book, version) ? "当前版本" : "删除";
    deleteButton.disabled = isCurrentVersion(book, version) || book.versions.length <= 1;
    deleteButton.title = isCurrentVersion(book, version)
      ? "当前正在使用的版本不能删除"
      : book.versions.length <= 1
        ? "至少需要保留一个版本"
        : "删除这个版本";
    deleteButton.addEventListener("click", () => onDeleteVersion(book, version));

    const actions = document.createElement("div");
    actions.className = "version-actions";
    actions.append(button, deleteButton);

    row.append(info, actions);
    els.versionChoices.append(row);
  });
}

function isCurrentVersion(book, version) {
  return state.activeBook?.id === book.id && state.activeVersion?.id === version.id;
}

async function onDeleteVersion(book, version) {
  if (isCurrentVersion(book, version)) {
    showToast("当前版本不能删除，请先切换到其他版本");
    return;
  }
  if (book.versions.length <= 1) {
    showToast("至少需要保留一个版本");
    return;
  }

  const ok = window.confirm(`确定删除《${book.title}》的 ${version.label} 吗？`);
  if (!ok) return;

  try {
    const params = new URLSearchParams();
    if (state.activeBook?.id === book.id && state.activeVersion?.id) {
      params.set("currentVersionId", state.activeVersion.id);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const payload = await api(`/api/books/${book.id}/versions/${version.id}${query}`, { method: "DELETE" });
    upsertBook(payload.book);
    if (state.activeBook?.id === payload.book.id) {
      state.activeBook = payload.book;
    }
    renderBooks();
    renderCompare();
    renderBookInfo();
    if (els.versionDialog.open) renderVersionChoices(payload.book);
    showToast("已删除版本");
  } catch (error) {
    showToast(error.message);
  }
}

async function loadVersion(bookId, versionId) {
  setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
    visible: true,
    label: "正在加载版本",
    value: 0,
    max: 100
  });
  try {
    const payload = await api(`/api/books/${bookId}/versions/${versionId}`, {
      onDownloadProgress: (loaded, total) => {
        setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
          visible: true,
          label: "正在加载版本",
          value: total ? loaded : 0,
          max: total || 0
        });
      }
    });
    upsertBook(payload.book);
    state.activeBook = payload.book;
    state.activeVersion = payload.version;
    state.selection = null;
    clearOutlineResult();
    resetParagraphSelection();
    resetReaderWindow();
    resetTextChunks();
    window.getSelection()?.removeAllRanges();
    renderBooks();
    renderCompare();
    await prepareActiveVersionChunks({ selectAll: true });
    renderReader();
    renderSelection();
    renderBookInfo();
    showToast(`已载入 ${payload.book.title} / ${payload.version.label}`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
      visible: false
    });
  }
}

function upsertBook(book) {
  const index = state.books.findIndex((entry) => entry.id === book.id);
  if (index >= 0) {
    state.books[index] = book;
  } else {
    state.books.unshift(book);
  }
}

function renderReader() {
  const hasVersion = Boolean(state.activeBook && state.activeVersion);
  els.emptyReader.hidden = hasVersion;
  els.readerText.hidden = !hasVersion;

  if (!hasVersion) {
    els.currentTitle.textContent = "未选择书籍";
    els.currentVersion.textContent = "请选择书架中的版本";
    els.readerText.textContent = "";
    renderReaderPager(false);
    renderParagraphSelectBar(false);
    return;
  }

  els.currentTitle.textContent = state.activeBook.title;
  els.currentVersion.textContent = `${state.activeVersion.label} · ${state.activeVersion.contentLength} 字`;
  renderReadableContent(state.activeVersion.content, state.activeVersion.marks || []);
}

function renderReadableContent(content, marks) {
  const mode = state.settings.renderMode || "txt";
  els.readerText.classList.remove("mode-txt", "mode-markdown", "mode-html");
  els.readerText.classList.add(`mode-${mode}`);
  renderParagraphSelectBar(true);

  if (mode === "markdown") {
    resetParagraphSelection();
    renderReaderPager(false);
    renderParagraphSelectBar(true);
    renderMarkdownContent(content, marks);
    return;
  }

  if (mode === "html") {
    resetParagraphSelection();
    renderReaderPager(false);
    renderParagraphSelectBar(true);
    renderHtmlContent(content, marks);
    return;
  }

  renderTxtContent(content, marks);
}

function renderTxtContent(content, marks) {
  const textWindow = getReaderWindow(content.length);
  const visibleContent = content.slice(textWindow.start, textWindow.end);
  const cleanMarks = (marks || [])
    .filter((mark) => mark.end > textWindow.start && mark.start < textWindow.end)
    .map((mark) => ({
      ...mark,
      start: Math.max(mark.start, textWindow.start),
      end: Math.min(mark.end, textWindow.end)
    }))
    .filter((mark) => Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.end > mark.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  renderReaderPager(true);

  els.readerText.innerHTML = "";
  const paragraphs = splitParagraphsWithStart(visibleContent, textWindow.start);
  let visibleParagraphIndex = 0;
  paragraphs.forEach((paragraph) => {
    const node = document.createElement("p");
    const visibleText = paragraph.text.replace(/[\r\n]+$/g, "");
    if (!visibleText.trim()) return;

    node.className = "reader-paragraph";
    node.dataset.paragraphIndex = String(visibleParagraphIndex);
    node.dataset.start = String(paragraph.start);
    node.dataset.end = String(paragraph.end);
    node.dataset.chunkIndex = String(textWindow.index || 0);
    node.dataset.selectable = "true";
    appendSourceText(node, visibleText, paragraph.start, cleanMarks);
    els.readerText.append(node);
    visibleParagraphIndex += 1;
  });

  updateParagraphSelectionHighlights();
  renderParagraphSelectBar(true);
}

function splitParagraphsWithStart(content, sourceStart) {
  const text = String(content || "");
  const paragraphs = [];
  let start = 0;

  while (start < text.length) {
    const lineBreak = text.indexOf("\n", start);
    const end = lineBreak === -1 ? text.length : lineBreak + 1;
    paragraphs.push({
      text: text.slice(start, end),
      start: sourceStart + start,
      end: sourceStart + end
    });
    start = end;
  }

  if (!paragraphs.length) {
    paragraphs.push({ text: "", start: sourceStart, end: sourceStart });
  }
  return paragraphs;
}

function resetReaderWindow() {
  state.readerWindow = {
    index: 0,
    start: 0,
    end: 0,
    total: 1
  };
}

function resetTextChunks() {
  state.textChunks = [];
  state.textChunkVersionId = null;
  state.extractSelectedChunks = new Set();
}

function getActiveTextChunks() {
  if (!state.activeVersion || state.textChunkVersionId !== state.activeVersion.id) return [];
  return state.textChunks;
}

async function prepareActiveVersionChunks({ selectAll = false } = {}) {
  if (!state.activeVersion) {
    resetTextChunks();
    return;
  }
  if (state.textChunkVersionId === state.activeVersion.id && state.textChunks.length) return;

  const content = state.activeVersion.content || "";
  setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
    visible: true,
    label: "正在按段落切分",
    value: 0,
    max: content.length || 1
  });

  const chunks = await splitTextIntoParagraphChunksAsync(content, TEXT_CHUNK_SIZE, (processed, total, count) => {
    setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
      visible: true,
      label: `正在按段落切分（${count} 段）`,
      value: processed,
      max: total || 1
    });
  });

  state.textChunks = chunks;
  state.textChunkVersionId = state.activeVersion.id;
  state.readerWindow.index = Math.min(state.readerWindow.index || 0, Math.max(chunks.length - 1, 0));
  if (selectAll || !state.extractSelectedChunks.size) {
    state.extractSelectedChunks = new Set(chunks.map((chunk) => chunk.index));
  }
}

async function splitTextIntoParagraphChunksAsync(text, targetChars, onProgress) {
  const source = String(text || "");
  const chunks = [];
  let start = 0;

  if (!source.length) {
    return [{ index: 0, start: 0, end: 0 }];
  }

  while (start < source.length) {
    const end = findNearestParagraphBoundary(source, start, targetChars);
    chunks.push({ index: chunks.length, start, end });
    start = end;
    if (chunks.length % 4 === 0 || start >= source.length) {
      onProgress?.(start, source.length, chunks.length);
      await nextFrame();
    }
  }

  return chunks;
}

function findNearestParagraphBoundary(source, start, targetChars) {
  const desired = Math.min(source.length, start + targetChars);
  if (desired >= source.length) return source.length;

  const lower = Math.min(source.length, start + Math.floor(targetChars * CHUNK_MIN_RATIO));
  const upper = Math.min(source.length, start + Math.floor(targetChars * CHUNK_MAX_RATIO));
  const before = findPreviousLineBreak(source, desired, lower);
  const after = findNextLineBreak(source, desired, upper);

  if (before !== -1 && after !== -1) {
    return desired - before <= after - desired ? before : after;
  }
  if (before !== -1) return before;
  if (after !== -1) return after;
  return desired;
}

function findPreviousLineBreak(source, from, min) {
  for (let index = from; index > min; index -= 1) {
    if (source.charCodeAt(index - 1) === 10) return index;
  }
  return -1;
}

function findNextLineBreak(source, from, max) {
  for (let index = from + 1; index <= max; index += 1) {
    if (source.charCodeAt(index - 1) === 10) return index;
  }
  return -1;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getReaderWindow(length) {
  if (state.settings.renderMode !== "txt") {
    state.readerWindow = {
      index: 0,
      start: 0,
      end: length,
      total: 1
    };
    return state.readerWindow;
  }

  const chunks = getActiveTextChunks();
  if (!chunks.length) {
    state.readerWindow = {
      index: 0,
      start: 0,
      end: length,
      total: 1
    };
    return state.readerWindow;
  }

  const total = chunks.length;
  const index = Math.min(total - 1, Math.max(0, state.readerWindow.index || 0));
  const { start, end } = chunks[index];
  state.readerWindow = { index, start, end, total };
  return state.readerWindow;
}

function renderReaderPager(show) {
  els.readerPager.hidden = !show;
  if (!show) return;

  const { index, start, end, total } = state.readerWindow;
  els.chunkMeta.textContent = `${index + 1}/${total} · ${formatNumber(start + 1)}-${formatNumber(end)}`;
  els.prevChunkButton.disabled = index <= 0;
  els.nextChunkButton.disabled = index >= total - 1;
}

function renderParagraphSelectBar(show) {
  els.paragraphSelectBar.hidden = !show;
  if (!show) return;

  const hasVersion = Boolean(state.activeBook && state.activeVersion);
  const isTxtMode = state.settings.renderMode === "txt";
  const available = hasVersion && isTxtMode;
  const selection = state.paragraphSelection;
  const hasAnchor = Boolean(selection.anchor);
  const hasFocus = Boolean(selection.focus);
  const hasSelection = Boolean(state.selection);

  els.paragraphSelectBar.classList.toggle("active", available && selection.enabled);
  els.readerText.classList.toggle("paragraph-selecting", available && selection.enabled);
  els.toggleParagraphSelectButton.disabled = !available;
  els.toggleParagraphSelectButton.textContent = selection.enabled ? "退出" : "段选";
  els.toggleParagraphSelectButton.title = selection.enabled ? "退出段落选择" : "段落选择";
  els.clearParagraphSelectButton.disabled = !available || (!hasAnchor && !hasSelection);
  els.rewriteParagraphSelectionButton.disabled = !hasSelection;

  if (!hasVersion) {
    els.paragraphSelectMeta.textContent = "未载入";
    return;
  }

  if (!isTxtMode) {
    els.paragraphSelectMeta.textContent = "仅 TXT";
    return;
  }

  if (!selection.enabled) {
    els.paragraphSelectMeta.textContent = hasSelection ? `${formatNumber(state.selection.end - state.selection.start)} 字` : "点段选";
    return;
  }

  if (!hasAnchor) {
    els.paragraphSelectMeta.textContent = "选起点";
    return;
  }

  if (!hasFocus) {
    const length = state.selection ? state.selection.end - state.selection.start : selection.anchor.end - selection.anchor.start;
    els.paragraphSelectMeta.textContent = `起点 ${formatParagraphPoint(selection.anchor)} · ${formatNumber(length)} 字`;
    return;
  }

  const length = state.selection ? state.selection.end - state.selection.start : 0;
  els.paragraphSelectMeta.textContent = `${formatParagraphPoint(selection.anchor)}-${formatParagraphPoint(selection.focus)} · ${formatNumber(length)} 字`;
}

function moveTextChunk(delta) {
  if (!state.activeVersion) return;
  const total = Math.max(1, getActiveTextChunks().length || 1);
  state.readerWindow.index = Math.min(total - 1, Math.max(0, state.readerWindow.index + delta));
  if (!state.paragraphSelection.enabled) {
    state.selection = null;
    resetParagraphSelection();
  }
  window.getSelection()?.removeAllRanges();
  renderReader();
  renderSelection();
  els.readerSurface.scrollTop = 0;
}

function toggleParagraphSelectionMode() {
  if (!state.activeVersion || state.settings.renderMode !== "txt") return;
  const enabled = !state.paragraphSelection.enabled;
  state.paragraphSelection.enabled = enabled;
  state.paragraphSelection.anchor = null;
  state.paragraphSelection.focus = null;
  if (enabled) {
    state.selection = null;
    window.getSelection()?.removeAllRanges();
    renderSelection();
    showToast("点起点，再点终点");
  }
  updateParagraphSelectionHighlights();
  renderParagraphSelectBar(true);
}

function clearParagraphSelection({ clearTextSelection = false } = {}) {
  state.paragraphSelection.anchor = null;
  state.paragraphSelection.focus = null;
  if (clearTextSelection) {
    state.selection = null;
    window.getSelection()?.removeAllRanges();
    renderSelection();
  }
  updateParagraphSelectionHighlights();
  renderParagraphSelectBar(Boolean(state.activeVersion));
}

function resetParagraphSelection() {
  state.paragraphSelection.enabled = false;
  state.paragraphSelection.anchor = null;
  state.paragraphSelection.focus = null;
}

function onReaderParagraphClick(event) {
  if (!state.paragraphSelection.enabled || state.settings.renderMode !== "txt") return;
  const paragraph = event.target.closest(".reader-paragraph[data-selectable='true']");
  if (!paragraph || !els.readerText.contains(paragraph)) return;

  event.preventDefault();
  const point = getParagraphPoint(paragraph);
  if (!point) return;

  if (!state.paragraphSelection.anchor || state.paragraphSelection.focus) {
    state.paragraphSelection.anchor = point;
    state.paragraphSelection.focus = null;
  } else {
    state.paragraphSelection.focus = point;
  }

  applyParagraphSelectionToState();
}

function getParagraphPoint(paragraph) {
  const start = Number(paragraph.dataset.start);
  const end = Number(paragraph.dataset.end);
  const index = Number(paragraph.dataset.paragraphIndex);
  const chunkIndex = Number(paragraph.dataset.chunkIndex);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    start,
    end,
    index: Number.isFinite(index) ? index : 0,
    chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : state.readerWindow.index || 0
  };
}

function applyParagraphSelectionToState() {
  const anchor = state.paragraphSelection.anchor;
  const focus = state.paragraphSelection.focus || anchor;
  if (!anchor || !focus || !state.activeVersion) return;

  const start = Math.min(anchor.start, focus.start);
  const end = Math.max(anchor.end, focus.end);
  const text = state.activeVersion.content.slice(start, end);
  state.selection = { start, end, text };
  window.getSelection()?.removeAllRanges();
  renderSelection();
  updateParagraphSelectionHighlights();
  renderParagraphSelectBar(true);
}

function updateParagraphSelectionHighlights() {
  const selection = state.selection;
  const anchor = state.paragraphSelection.anchor;
  const focus = state.paragraphSelection.focus;

  els.readerText.querySelectorAll(".reader-paragraph").forEach((paragraph) => {
    const start = Number(paragraph.dataset.start);
    const end = Number(paragraph.dataset.end);
    const isSelected =
      selection &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > selection.start &&
      start < selection.end;
    const isAnchor = isSameParagraphPoint(paragraph, anchor);
    const isFocus = isSameParagraphPoint(paragraph, focus);

    paragraph.classList.toggle("paragraph-selected", Boolean(isSelected));
    paragraph.classList.toggle("paragraph-anchor", Boolean(isAnchor));
    paragraph.classList.toggle("paragraph-focus", Boolean(isFocus));
  });
}

function isSameParagraphPoint(paragraph, point) {
  if (!point) return false;
  return (
    Number(paragraph.dataset.start) === point.start &&
    Number(paragraph.dataset.end) === point.end &&
    Number(paragraph.dataset.chunkIndex) === point.chunkIndex
  );
}

function formatParagraphPoint(point) {
  if (!point) return "";
  return state.readerWindow.total > 1 ? `${point.chunkIndex + 1}.${point.index + 1}` : `段${point.index + 1}`;
}

function renderMarkdownContent(content, marks) {
  els.readerText.innerHTML = "";
  const lines = splitLinesWithStart(content);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.text.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line.text.trim())) {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].text.trim())) {
        appendSourceText(code, lines[index].text, lines[index].start, marks);
        if (index < lines.length - 1) code.append(document.createTextNode("\n"));
        index += 1;
      }
      if (index < lines.length) index += 1;
      pre.append(code);
      els.readerText.append(pre);
      continue;
    }

    const heading = line.text.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      const node = document.createElement(`h${level}`);
      const textStart = line.start + heading[1].length + 1;
      appendMarkdownInline(node, heading[2], textStart, marks);
      els.readerText.append(node);
      index += 1;
      continue;
    }

    const unordered = line.text.match(/^(\s*)[-*+]\s+(.+)$/);
    if (unordered) {
      const list = document.createElement("ul");
      while (index < lines.length) {
        const match = lines[index].text.match(/^(\s*)[-*+]\s+(.+)$/);
        if (!match) break;
        const item = document.createElement("li");
        const textStart = lines[index].start + lines[index].text.length - match[2].length;
        appendMarkdownInline(item, match[2], textStart, marks);
        list.append(item);
        index += 1;
      }
      els.readerText.append(list);
      continue;
    }

    const ordered = line.text.match(/^(\s*)\d+\.\s+(.+)$/);
    if (ordered) {
      const list = document.createElement("ol");
      while (index < lines.length) {
        const match = lines[index].text.match(/^(\s*)\d+\.\s+(.+)$/);
        if (!match) break;
        const item = document.createElement("li");
        const textStart = lines[index].start + lines[index].text.length - match[2].length;
        appendMarkdownInline(item, match[2], textStart, marks);
        list.append(item);
        index += 1;
      }
      els.readerText.append(list);
      continue;
    }

    const quote = line.text.match(/^>\s?(.+)$/);
    if (quote) {
      const blockquote = document.createElement("blockquote");
      while (index < lines.length) {
        const match = lines[index].text.match(/^>\s?(.+)$/);
        if (!match) break;
        const paragraph = document.createElement("p");
        const textStart = lines[index].start + lines[index].text.length - match[1].length;
        appendMarkdownInline(paragraph, match[1], textStart, marks);
        blockquote.append(paragraph);
        index += 1;
      }
      els.readerText.append(blockquote);
      continue;
    }

    const paragraph = document.createElement("p");
    while (index < lines.length && lines[index].text.trim() && !isMarkdownBlockStart(lines[index].text)) {
      if (paragraph.childNodes.length) paragraph.append(document.createElement("br"));
      appendMarkdownInline(paragraph, lines[index].text, lines[index].start, marks);
      index += 1;
    }
    els.readerText.append(paragraph);
  }
}

function renderHtmlContent(content, marks) {
  const template = document.createElement("template");
  template.innerHTML = content;
  sanitizeHtmlFragment(template.content);
  wrapHtmlTextNodes(template.content, content, marks);
  els.readerText.replaceChildren(template.content);
}

function splitLinesWithStart(content) {
  const parts = content.split("\n");
  const lines = [];
  let start = 0;
  for (const text of parts) {
    lines.push({ text, start });
    start += text.length + 1;
  }
  return lines;
}

function isMarkdownBlockStart(text) {
  return (
    /^```/.test(text.trim()) ||
    /^(#{1,6})\s+/.test(text) ||
    /^(\s*)[-*+]\s+/.test(text) ||
    /^(\s*)\d+\.\s+/.test(text) ||
    /^>\s?/.test(text)
  );
}

function appendMarkdownInline(parent, raw, sourceStart, marks) {
  let cursor = 0;
  while (cursor < raw.length) {
    const rest = raw.slice(cursor);

    if (rest.startsWith("**")) {
      const end = raw.indexOf("**", cursor + 2);
      if (end !== -1) {
        const strong = document.createElement("strong");
        appendMarkdownInline(strong, raw.slice(cursor + 2, end), sourceStart + cursor + 2, marks);
        parent.append(strong);
        cursor = end + 2;
        continue;
      }
    }

    if (rest.startsWith("__")) {
      const end = raw.indexOf("__", cursor + 2);
      if (end !== -1) {
        const strong = document.createElement("strong");
        appendMarkdownInline(strong, raw.slice(cursor + 2, end), sourceStart + cursor + 2, marks);
        parent.append(strong);
        cursor = end + 2;
        continue;
      }
    }

    if (rest.startsWith("`")) {
      const end = raw.indexOf("`", cursor + 1);
      if (end !== -1) {
        const code = document.createElement("code");
        appendSourceText(code, raw.slice(cursor + 1, end), sourceStart + cursor + 1, marks);
        parent.append(code);
        cursor = end + 1;
        continue;
      }
    }

    if (rest.startsWith("[") && raw.includes("](", cursor)) {
      const labelEnd = raw.indexOf("](", cursor);
      const urlEnd = raw.indexOf(")", labelEnd + 2);
      if (urlEnd !== -1) {
        const link = document.createElement("a");
        const href = raw.slice(labelEnd + 2, urlEnd).trim();
        if (isSafeUrl(href, "href")) link.href = href;
        appendMarkdownInline(link, raw.slice(cursor + 1, labelEnd), sourceStart + cursor + 1, marks);
        parent.append(link);
        cursor = urlEnd + 1;
        continue;
      }
    }

    if (rest.startsWith("*")) {
      const end = raw.indexOf("*", cursor + 1);
      if (end !== -1) {
        const em = document.createElement("em");
        appendMarkdownInline(em, raw.slice(cursor + 1, end), sourceStart + cursor + 1, marks);
        parent.append(em);
        cursor = end + 1;
        continue;
      }
    }

    if (rest.startsWith("_")) {
      const end = raw.indexOf("_", cursor + 1);
      if (end !== -1) {
        const em = document.createElement("em");
        appendMarkdownInline(em, raw.slice(cursor + 1, end), sourceStart + cursor + 1, marks);
        parent.append(em);
        cursor = end + 1;
        continue;
      }
    }

    const next = nextMarkdownTokenIndex(raw, cursor + 1);
    appendSourceText(parent, raw.slice(cursor, next), sourceStart + cursor, marks);
    cursor = next;
  }
}

function nextMarkdownTokenIndex(raw, from) {
  const indexes = ["**", "__", "`", "[", "*", "_"]
    .map((token) => raw.indexOf(token, from))
    .filter((index) => index !== -1);
  return indexes.length ? Math.min(...indexes) : raw.length;
}

function appendSourceText(parent, text, sourceStart, marks) {
  if (!text) return;
  const sourceEnd = sourceStart + text.length;
  const points = new Set([sourceStart, sourceEnd]);
  for (const mark of marks || []) {
    if (mark.end <= sourceStart || mark.start >= sourceEnd) continue;
    points.add(Math.max(sourceStart, mark.start));
    points.add(Math.min(sourceEnd, mark.end));
  }

  const sorted = [...points].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end <= start) continue;
    const span = document.createElement("span");
    span.className = "source-text";
    if (isMarkedRange(start, end, marks)) span.classList.add("mark-rewrite");
    span.dataset.sourceStart = String(start);
    span.dataset.sourceEnd = String(end);
    span.textContent = text.slice(start - sourceStart, end - sourceStart);
    parent.append(span);
  }
}

function isMarkedRange(start, end, marks) {
  return (marks || []).some((mark) => mark.start < end && mark.end > start);
}

function sanitizeHtmlFragment(root) {
  const blockedTags = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "svg",
    "math"
  ]);

  for (const element of [...root.querySelectorAll("*")]) {
    if (blockedTags.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcset") {
        element.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && !isSafeUrl(attr.value, name)) {
        element.removeAttribute(attr.name);
      }
    }
  }
}

function isSafeUrl(value, attributeName) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }

  try {
    const url = new URL(trimmed, window.location.href);
    if (["http:", "https:", "mailto:"].includes(url.protocol)) return true;
    return attributeName === "src" && url.protocol === "data:" && /^data:image\//i.test(trimmed);
  } catch {
    return false;
  }
}

function wrapHtmlTextNodes(root, source, marks) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  let cursor = 0;
  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    if (!text) continue;
    const start = source.indexOf(text, cursor);
    const sourceStart = start === -1 ? source.indexOf(text) : start;
    if (sourceStart === -1) continue;

    const fragment = document.createDocumentFragment();
    appendSourceText(fragment, text, sourceStart, marks);
    textNode.replaceWith(fragment);
    cursor = sourceStart + text.length;
  }
}

function renderSelection() {
  const selection = state.selection;
  if (!selection) {
    els.selectionMeta.textContent = "未选择";
    els.selectionPreview.textContent = "在正文中拖选一段文字后，可在这里提交改写。";
    els.outlineSelectionMeta.textContent = "未选择";
    els.outlineSelectionPreview.textContent = "在正文中拖选一段文字后，可在这里设计大纲。";
    els.outlineButton.disabled = true;
    els.rewriteButton.disabled = true;
    return;
  }

  const meta = `${selection.end - selection.start} 字`;
  const preview = formatSelectionPreview(selection.text);
  els.selectionMeta.textContent = meta;
  els.selectionPreview.textContent = preview;
  els.outlineSelectionMeta.textContent = meta;
  els.outlineSelectionPreview.textContent = preview;
  els.outlineButton.disabled = !els.outlineInstruction.value.trim();
  els.rewriteButton.disabled = !els.rewriteInstruction.value.trim();
}

function updateSelectionFromDom() {
  if (!state.activeVersion || els.readerText.hidden) return;
  const offsets = getSelectionOffsets(els.readerText);
  if (!offsets) {
    if (state.paragraphSelection.enabled && state.selection) {
      renderSelection();
      renderParagraphSelectBar(true);
      return;
    }
    if (!shouldKeepSelectionOnFocusChange()) {
      state.selection = null;
      clearParagraphSelection();
      renderSelection();
    }
    return;
  }

  const text = offsets.text || state.activeVersion.content.slice(offsets.start, offsets.end);
  state.selection = { ...offsets, text };
  state.paragraphSelection.anchor = null;
  state.paragraphSelection.focus = null;
  updateParagraphSelectionHighlights();
  renderParagraphSelectBar(Boolean(state.activeVersion));
  renderSelection();
}

function getSelectionOffsets(container) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

  if (container.querySelector(".source-text")) {
    return getMappedSelectionOffsets(container, range, selection.toString());
  }

  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const length = range.toString().length;
  if (!length) return null;
  const windowStart = state.settings.renderMode === "txt" ? state.readerWindow.start || 0 : 0;
  return { start: windowStart + start, end: windowStart + start + length };
}

function getMappedSelectionOffsets(container, range, selectedText) {
  const spans = [...container.querySelectorAll(".source-text")].filter((span) => range.intersectsNode(span));
  if (!spans.length) return findSelectionByVisibleText(selectedText);

  let start = Infinity;
  let end = -Infinity;
  for (const span of spans) {
    const sourceStart = Number(span.dataset.sourceStart);
    const sourceEnd = Number(span.dataset.sourceEnd);
    if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) continue;

    const localStart = span.contains(range.startContainer)
      ? getTextOffsetInside(span, range.startContainer, range.startOffset)
      : 0;
    const localEnd = span.contains(range.endContainer)
      ? getTextOffsetInside(span, range.endContainer, range.endOffset)
      : span.textContent.length;

    start = Math.min(start, sourceStart + localStart);
    end = Math.max(end, sourceStart + localEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return findSelectionByVisibleText(selectedText);
  }

  return { start, end, text: selectedText };
}

function formatSelectionPreview(text) {
  const source = String(text || "");
  const limit = 5000;
  if (source.length <= limit) return source;
  return `${source.slice(0, limit)}\n\n……（预览已截断，实际将提交完整选区，共 ${formatNumber(source.length)} 字）`;
}

function clearOutlineResult() {
  els.outlineOutput.textContent = "生成后会显示改写大纲思路。";
  els.outlineOutput.dataset.fullText = "";
  els.useOutlineAsRewriteButton.disabled = true;
  setStatus(els.outlineStatus, "");
}

function setOutlineResult(text) {
  const value = String(text || "").trim();
  els.outlineOutput.textContent = value || "没有生成可用的大纲思路。";
  els.outlineOutput.dataset.fullText = value;
  els.useOutlineAsRewriteButton.disabled = !value;
}

function getTextOffsetInside(container, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function findSelectionByVisibleText(selectedText) {
  const text = String(selectedText || "").trim();
  if (!text) return null;
  const source = state.activeVersion?.content || "";
  const start = source.indexOf(text);
  if (start === -1) return null;
  return { start, end: start + text.length, text };
}

function shouldKeepSelectionOnFocusChange() {
  if (!state.selection) return false;
  const active = document.activeElement;
  return Boolean(active && !els.readerText.contains(active) && active.closest(".workspace-view"));
}

async function onUpload(event) {
  event.preventDefault();
  const file = els.fileInput.files?.[0];
  const pastedText = els.pasteText.value.trim();
  if (!file && !pastedText) {
    showToast("请选择 TXT 文件，或粘贴小说内容");
    return;
  }

  try {
    let text = "";
    if (file) {
      setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, {
        visible: true,
        label: "正在读取文件",
        value: 0,
        max: file.size || 1
      });
      text = await readTextFile(file, els.encodingSelect.value, (loaded, total) => {
        setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, {
          visible: true,
          label: "正在读取文件",
          value: loaded,
          max: total || file.size || 1
        });
      });
    } else {
      text = pastedText.replace(/\r\n?/g, "\n");
    }

    setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, {
      visible: true,
      label: "正在保存到本地",
      value: 100,
      max: 100
    });
    const title = (els.bookTitle.value || file?.name.replace(/\.txt$/i, "") || "未命名小说").trim();
    const payload = await api("/api/books", {
      method: "POST",
      body: JSON.stringify({ title, text })
    });
    upsertBook(payload.book);
    renderBooks();
    els.uploadForm.reset();
    await loadVersion(payload.book.id, payload.book.versions[0].id);
    setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, {
      visible: false
    });
    showToast("已保存为初始版本");
  } catch (error) {
    setProgress(els.uploadProgress, els.uploadProgressLabel, els.uploadProgressPercent, els.uploadProgressBar, {
      visible: false
    });
    showToast(error.message);
  }
}

async function readTextFile(file, encoding, onProgress) {
  const buffer = await readFileAsArrayBuffer(file, onProgress);
  const decoder = new TextDecoder(encoding || "utf-8");
  return decoder.decode(buffer).replace(/\r\n?/g, "\n");
}

function readFileAsArrayBuffer(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    });
    reader.addEventListener("load", () => {
      onProgress?.(file.size || 1, file.size || 1);
      resolve(reader.result);
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("文件读取失败")));
    reader.readAsArrayBuffer(file);
  });
}

async function onGenerateOutline(event) {
  event.preventDefault();
  if (!state.activeBook || !state.activeVersion || !state.selection) return;
  const instruction = els.outlineInstruction.value.trim();
  if (!instruction) {
    showToast("请输入大纲要求");
    return;
  }

  setStatus(els.outlineStatus, "正在设计大纲思路...");
  els.outlineButton.disabled = true;
  els.useOutlineAsRewriteButton.disabled = true;
  try {
    const payload = await api("/api/outline", {
      method: "POST",
      body: JSON.stringify({
        bookId: state.activeBook.id,
        versionId: state.activeVersion.id,
        start: state.selection.start,
        end: state.selection.end,
        instruction,
        referenceText: els.outlineUseCurrentChunk.checked ? getCurrentRewriteReferenceText() : ""
      })
    });

    setOutlineResult(payload.outline || "");
    setStatus(els.outlineStatus, "");
    showToast("已生成大纲思路");
  } catch (error) {
    setStatus(els.outlineStatus, error.message, true);
  } finally {
    renderSelection();
  }
}

function useOutlineAsRewriteInstruction() {
  const outline = els.outlineOutput.dataset.fullText || "";
  if (!outline) return;
  els.rewriteInstruction.value = outline;
  renderSelection();
  activateTab("rewrite");
  els.rewriteInstruction.focus();
  showToast("已填入改写要求");
}

async function onRewrite(event) {
  event.preventDefault();
  if (!state.activeBook || !state.activeVersion || !state.selection) return;
  const instruction = els.rewriteInstruction.value.trim();
  if (!instruction) {
    showToast("请输入改写要求");
    return;
  }

  setStatus(els.rewriteStatus, "正在请求 DeepSeek 并保存新版本...");
  els.rewriteButton.disabled = true;
  try {
    const payload = await api("/api/rewrite", {
      method: "POST",
      body: JSON.stringify({
        bookId: state.activeBook.id,
        versionId: state.activeVersion.id,
        start: state.selection.start,
        end: state.selection.end,
        instruction,
        referenceText: els.rewriteUseCurrentChunk.checked ? getCurrentRewriteReferenceText() : ""
      })
    });

    upsertBook(payload.book);
    state.activeBook = payload.book;
    state.activeVersion = payload.version;
    state.selection = null;
    resetParagraphSelection();
    resetReaderWindow();
    resetTextChunks();
    window.getSelection()?.removeAllRanges();
    els.rewriteInstruction.value = "";
    els.rewriteUseCurrentChunk.checked = false;
    els.outlineInstruction.value = "";
    els.outlineUseCurrentChunk.checked = false;
    clearOutlineResult();
    await prepareActiveVersionChunks({ selectAll: true });
    renderBooks();
    renderReader();
    renderSelection();
    renderCompare();
    activateTab("compare");
    setStatus(els.rewriteStatus, "");
    setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
      visible: false
    });
    showToast("已生成新版本，并标注改写位置");
  } catch (error) {
    setProgress(els.readerProgress, els.readerProgressLabel, els.readerProgressPercent, els.readerProgressBar, {
      visible: false
    });
    setStatus(els.rewriteStatus, error.message, true);
    renderSelection();
  }
}

function getCurrentRewriteReferenceText() {
  if (!state.activeVersion?.content) return "";
  const content = state.activeVersion.content;
  if (state.settings.renderMode !== "txt") return content;

  const start = Number(state.readerWindow.start) || 0;
  const end = Number(state.readerWindow.end) || content.length;
  if (end <= start || start < 0 || start >= content.length) return content;
  return content.slice(start, Math.min(end, content.length));
}

function renderCompare() {
  const book = state.activeBook;
  els.compareList.innerHTML = "";
  if (!book) {
    els.compareCount.textContent = "0 条";
    els.compareList.append(emptyState("选择书籍版本后，这里会显示该书所有改写前后的对比。"));
    return;
  }

  const changes = book.versions.filter((version) => version.change).reverse();
  els.compareCount.textContent = `${changes.length} 条`;
  if (!changes.length) {
    els.compareList.append(emptyState("当前书籍还没有改写版本。"));
    return;
  }

  for (const version of changes) {
    const item = document.createElement("article");
    item.className = "compare-item";

    const header = document.createElement("header");
    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "compare-title";
    title.textContent = `${version.change.sourceVersionLabel} → ${version.label}`;
    const meta = document.createElement("div");
    meta.className = "compare-meta";
    meta.textContent = `${formatDate(version.createdAt)} · ${version.change.beforeLength} 字 → ${version.change.afterLength} 字`;
    info.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "载入";
    button.addEventListener("click", () => loadVersion(book.id, version.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = isCurrentVersion(book, version) ? "当前版本" : "删除";
    deleteButton.disabled = isCurrentVersion(book, version) || book.versions.length <= 1;
    deleteButton.title = isCurrentVersion(book, version) ? "当前正在使用的版本不能删除" : "删除这个版本";
    deleteButton.addEventListener("click", () => onDeleteVersion(book, version));

    const actions = document.createElement("div");
    actions.className = "compare-actions";
    actions.append(button, deleteButton);
    header.append(info, actions);

    const instruction = document.createElement("div");
    instruction.className = "compare-meta";
    instruction.textContent = `要求：${version.change.instruction}`;

    const diff = document.createElement("div");
    diff.className = "compare-diff";
    diff.append(
      snippet("改写前", version.change.beforeText, "before"),
      snippet("改写后", version.change.afterText, "after")
    );

    item.append(header, instruction, diff);
    els.compareList.append(item);
  }
}

function snippet(titleText, bodyText, tone) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "snippet-title";
  title.textContent = titleText;
  const body = document.createElement("div");
  body.className = `snippet-box ${tone}`;
  body.textContent = bodyText;
  wrap.append(title, body);
  return wrap;
}

function renderBookInfo() {
  const info = state.activeBook?.info || {};
  const hasBook = Boolean(state.activeBook);
  els.bookInfoMeta.textContent = hasBook ? bookInfoMetaText(info) : "未选择";
  els.storyBackground.value = hasBook ? info.background || "" : "";
  els.characterSettings.value = hasBook ? info.characters || "" : "";
  els.plotDevelopment.value = hasBook ? info.plot || "" : "";
  els.saveInfoButton.disabled = !hasBook;
  renderCharacterCards(info.characterProfiles || []);
  renderExtractRanges();
  if (!hasBook) setStatus(els.bookInfoStatus, "");
}

function bookInfoMetaText(info) {
  if (info?.extractedAt) return `已提取 · ${formatDate(info.extractedAt)}`;
  if (info?.updatedAt) return `已保存 · ${formatDate(info.updatedAt)}`;
  return "未保存";
}

async function onSaveBookInfo(event) {
  event.preventDefault();
  if (!state.activeBook) return;

  setStatus(els.bookInfoStatus, "正在保存...");
  try {
    const payload = await api(`/api/books/${state.activeBook.id}/info`, {
      method: "PUT",
      body: JSON.stringify(readBookInfoForm())
    });
    upsertBook(payload.book);
    state.activeBook = payload.book;
    renderBooks();
    renderBookInfo();
    setStatus(els.bookInfoStatus, "已保存附属信息");
    showToast("附属信息已保存");
  } catch (error) {
    setStatus(els.bookInfoStatus, error.message, true);
  }
}

async function onExtractBookInfo() {
  if (!state.activeBook || !state.activeVersion) {
    showToast("请先载入一个版本");
    return;
  }

  await prepareActiveVersionChunks({ selectAll: true });
  const ranges = getSelectedExtractRanges();
  if (!ranges.length) {
    showToast("请至少选择一个分析段");
    return;
  }

  setStatus(els.bookInfoStatus, `正在调用 DeepSeek 分析 ${ranges.length} 个段落...`);
  els.extractInfoButton.disabled = true;
  els.saveInfoButton.disabled = true;
  try {
    const payload = await api(`/api/books/${state.activeBook.id}/extract-info`, {
      method: "POST",
      body: JSON.stringify({ versionId: state.activeVersion.id, ranges })
    });
    upsertBook(payload.book);
    state.activeBook = payload.book;
    renderBooks();
    renderBookInfo();
    setStatus(els.bookInfoStatus, "已提取并保存附属信息");
    showToast("附属信息已更新");
  } catch (error) {
    setStatus(els.bookInfoStatus, error.message, true);
    renderBookInfo();
  }
}

function renderExtractRanges() {
  const chunks = getActiveTextChunks();
  const hasVersion = Boolean(state.activeBook && state.activeVersion);
  els.extractChunkList.innerHTML = "";

  if (!hasVersion) {
    els.extractRangeMeta.textContent = "未选择";
    els.extractChunkList.append(emptyState("载入版本后显示可分析段落。"));
    setExtractRangeActionsDisabled(true);
    els.extractInfoButton.disabled = true;
    return;
  }

  if (!chunks.length) {
    els.extractRangeMeta.textContent = "正在切分";
    els.extractChunkList.append(emptyState("正在按段落切分文本。"));
    setExtractRangeActionsDisabled(true);
    els.extractInfoButton.disabled = true;
    return;
  }

  setExtractRangeActionsDisabled(false);
  for (const chunk of chunks) {
    const label = document.createElement("label");
    label.className = "chunk-check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.extractSelectedChunks.has(chunk.index);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.extractSelectedChunks.add(chunk.index);
      } else {
        state.extractSelectedChunks.delete(chunk.index);
      }
      updateExtractRangeMeta();
    });

    const body = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = `第 ${chunk.index + 1} 段`;
    const meta = document.createElement("small");
    meta.textContent = `${formatNumber(chunk.start + 1)}-${formatNumber(chunk.end)} 字 · ${formatNumber(chunk.end - chunk.start)} 字`;
    body.append(title, meta);
    label.append(checkbox, body);
    els.extractChunkList.append(label);
  }

  updateExtractRangeMeta();
}

function setExtractRangeActionsDisabled(disabled) {
  els.selectAllChunksButton.disabled = disabled;
  els.selectCurrentChunkButton.disabled = disabled;
  els.clearChunksButton.disabled = disabled;
}

function updateExtractRangeMeta() {
  const chunks = getActiveTextChunks();
  const selected = getSelectedExtractRanges();
  const selectedChars = selected.reduce((sum, range) => sum + (range.end - range.start), 0);
  els.extractRangeMeta.textContent = chunks.length
    ? `已选 ${selected.length}/${chunks.length} 段 · ${formatNumber(selectedChars)} 字`
    : "未切分";
  els.extractInfoButton.disabled = !state.activeBook || !state.activeVersion || !selected.length;
}

function getSelectedExtractRanges() {
  return getActiveTextChunks()
    .filter((chunk) => state.extractSelectedChunks.has(chunk.index))
    .map((chunk) => ({
      index: chunk.index,
      start: chunk.start,
      end: chunk.end
    }));
}

function selectAllExtractChunks() {
  state.extractSelectedChunks = new Set(getActiveTextChunks().map((chunk) => chunk.index));
  renderExtractRanges();
}

function selectCurrentExtractChunk() {
  const chunks = getActiveTextChunks();
  if (!chunks.length) return;
  const index = Math.min(chunks.length - 1, Math.max(0, state.readerWindow.index || 0));
  state.extractSelectedChunks = new Set([index]);
  renderExtractRanges();
}

function clearExtractChunks() {
  state.extractSelectedChunks = new Set();
  renderExtractRanges();
}

function renderCharacterCards(profiles) {
  const items = Array.isArray(profiles) ? profiles.filter((profile) => profile?.name) : [];
  els.characterCardMeta.textContent = `${items.length} 个`;
  els.characterCardList.innerHTML = "";

  if (!items.length) {
    els.characterCardList.append(emptyState("提取角色后，这里会以卡片形式展示概要。"));
    return;
  }

  for (const profile of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-card";

    const title = document.createElement("strong");
    title.textContent = profile.name;
    const meta = document.createElement("small");
    meta.textContent = profile.aliases?.length ? `又名：${profile.aliases.join("、")}` : "角色档案";
    const summary = document.createElement("p");
    summary.textContent = characterSummary(profile);

    button.append(title, meta, summary);
    button.addEventListener("click", () => showCharacterDetail(profile));
    els.characterCardList.append(button);
  }
}

function characterSummary(profile) {
  return [profile.background, profile.personality, profile.style, profile.relationships, profile.abilities, profile.notes]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("；")
    .slice(0, 120) || "暂无概要";
}

function showCharacterDetail(profile) {
  els.characterDialogTitle.textContent = profile.name || "角色详情";
  els.characterDialogSubtitle.textContent = profile.aliases?.length ? `又名：${profile.aliases.join("、")}` : "";
  els.characterDialogBody.innerHTML = "";

  const dl = document.createElement("dl");
  for (const [label, value] of [
    ["背景描述", profile.background],
    ["性格特点", profile.personality],
    ["人设风格", profile.style],
    ["人物关系", profile.relationships],
    ["能力/限制", profile.abilities],
    ["其他信息", profile.notes]
  ]) {
    if (!String(value || "").trim()) continue;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }

  if (!dl.children.length) {
    els.characterDialogBody.append(emptyState("这个角色暂无更多详情。"));
  } else {
    els.characterDialogBody.append(dl);
  }
  els.characterDialog.showModal();
}

async function onAnalyzeStyle(event) {
  event.preventDefault();
  const sampleText = els.styleSampleText.value.trim();
  if (!sampleText) {
    showToast("请先粘贴一段样本文字");
    return;
  }

  els.analyzeStyleButton.disabled = true;
  setStatus(els.styleAnalysisStatus, "正在请求 DeepSeek 分析写法...");
  try {
    const payload = await api("/api/style-cards/analyze", {
      method: "POST",
      body: JSON.stringify({
        title: els.styleCardTitle.value.trim(),
        sampleText
      })
    });
    state.styleCards = payload.cards || [];
    els.styleCardTitle.value = "";
    els.styleSampleText.value = "";
    renderStyleCards();
    setStatus(els.styleAnalysisStatus, "");
    showToast("已保存写法卡片");
  } catch (error) {
    setStatus(els.styleAnalysisStatus, error.message, true);
  } finally {
    els.analyzeStyleButton.disabled = false;
  }
}

function renderStyleCards() {
  const cards = Array.isArray(state.styleCards) ? state.styleCards : [];
  els.styleCardCount.textContent = `${cards.length} 张`;
  els.styleCardList.innerHTML = "";

  if (!cards.length) {
    els.styleCardList.append(emptyState("粘贴样本文字并分析后，这里会保存常见写法卡片。"));
    return;
  }

  for (const card of cards) {
    const item = document.createElement("article");
    item.className = "style-card";

    const content = document.createElement("button");
    content.type = "button";
    content.className = "style-card-content";
    content.addEventListener("click", () => showStyleCardDetail(card));

    const title = document.createElement("strong");
    title.textContent = card.title || "常见写法";
    const meta = document.createElement("small");
    meta.textContent = formatDate(card.createdAt);
    const summary = document.createElement("p");
    summary.textContent = card.summary || "暂无概要";
    content.append(title, meta, summary);

    const actions = document.createElement("div");
    actions.className = "style-card-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button";
    copyButton.textContent = "复制";
    copyButton.addEventListener("click", () => copyText(card.prompt || card.detail || ""));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => onDeleteStyleCard(card));
    actions.append(copyButton, deleteButton);

    item.append(content, actions);
    els.styleCardList.append(item);
  }
}

function showStyleCardDetail(card) {
  state.currentStyleCard = card;
  els.styleCardDialogTitle.textContent = card.title || "写法详情";
  els.styleCardDialogSubtitle.textContent = card.createdAt ? `创建于 ${formatDate(card.createdAt)}` : "";
  els.styleCardDialogBody.innerHTML = "";

  const detail = document.createElement("pre");
  detail.textContent = card.detail || card.prompt || "暂无详情";
  els.styleCardDialogBody.append(detail);

  if (card.sampleText) {
    const sampleTitle = document.createElement("strong");
    sampleTitle.textContent = "样本文字";
    const sample = document.createElement("pre");
    sample.className = "style-card-sample";
    sample.textContent = card.sampleText;
    els.styleCardDialogBody.append(sampleTitle, sample);
  }

  els.styleCardDialog.showModal();
}

async function copyCurrentStylePrompt() {
  const card = state.currentStyleCard;
  if (!card) return;
  await copyText(card.prompt || card.detail || "");
}

async function copyText(text) {
  const content = String(text || "").trim();
  if (!content) {
    showToast("没有可复制的内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast("已复制提示词");
}

async function onDeleteStyleCard(card) {
  const ok = window.confirm(`确定删除写法卡片「${card.title || "常见写法"}」吗？`);
  if (!ok) return;

  try {
    const payload = await api(`/api/style-cards/${card.id}`, { method: "DELETE" });
    state.styleCards = payload.cards || [];
    if (state.currentStyleCard?.id === card.id) {
      state.currentStyleCard = null;
      if (els.styleCardDialog.open) els.styleCardDialog.close();
    }
    renderStyleCards();
    showToast("已删除写法卡片");
  } catch (error) {
    showToast(error.message);
  }
}

function readBookInfoForm() {
  return {
    background: els.storyBackground.value.trim(),
    characters: els.characterSettings.value.trim(),
    plot: els.plotDevelopment.value.trim()
  };
}

async function onSaveConfig(event) {
  event.preventDefault();
  const systemPrompts = [...els.systemPrompts.querySelectorAll("textarea")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  setStatus(els.settingsStatus, "正在保存...");
  try {
    const config = await api("/api/config", {
      method: "PUT",
      body: JSON.stringify({
        apiKey: els.apiKey.value.trim(),
        baseUrl: els.baseUrl.value.trim(),
        model: els.modelName.value.trim(),
        temperature: Number(els.temperature.value),
        maxTokens: Number(els.maxTokens.value),
        thinking: els.thinking.value,
        reasoningEffort: els.reasoningEffort.value,
        systemPrompts,
        outlineDesign: {
          systemPrompt: els.outlineSystemPrompt.value.trim(),
          userPrompt: els.outlineUserPrompt.value.trim()
        },
        extractionPrompts: {
          system: els.extractSystemPrompt.value.trim(),
          background: els.extractBackgroundPrompt.value.trim(),
          characters: els.extractCharactersPrompt.value.trim(),
          plot: els.extractPlotPrompt.value.trim()
        },
        styleAnalysis: {
          model: els.styleAnalysisModel.value.trim(),
          temperature: Number(els.styleAnalysisTemperature.value),
          maxTokens: Number(els.styleAnalysisMaxTokens.value),
          systemPrompt: els.styleAnalysisSystemPrompt.value.trim(),
          userPrompt: els.styleAnalysisUserPrompt.value.trim()
        }
      })
    });
    els.apiKey.value = "";
    els.apiKey.placeholder = config.hasApiKey ? "已保存，留空不修改" : "填写 DeepSeek API Key";
    setStatus(els.settingsStatus, "已保存接口设置");
    showToast("接口设置已保存");
  } catch (error) {
    setStatus(els.settingsStatus, error.message, true);
  }
}

async function loadLogs() {
  try {
    const payload = await api("/api/logs");
    state.logs = payload.logs || [];
    renderLogs();
  } catch (error) {
    showToast(error.message);
  }
}

async function onClearLogs() {
  const ok = window.confirm("确定清空当前用户的调用日志吗？");
  if (!ok) return;

  try {
    const payload = await api("/api/logs", { method: "DELETE" });
    state.logs = payload.logs || [];
    renderLogs();
    showToast("日志已清空");
  } catch (error) {
    showToast(error.message);
  }
}

function renderLogs() {
  const logs = Array.isArray(state.logs) ? state.logs : [];
  els.logCount.textContent = `${logs.length} 条`;
  els.logList.innerHTML = "";

  if (!logs.length) {
    els.logList.append(emptyState("还没有提取或改写日志。"));
    return;
  }

  for (const log of logs) {
    const item = document.createElement("article");
    item.className = "log-item";

    const header = document.createElement("header");
    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "log-title";
    title.textContent = `${logTypeText(log.type)} · ${log.status === "error" ? "失败" : "成功"}`;
    const meta = document.createElement("div");
    meta.className = "log-meta";
    meta.textContent = [formatDate(log.createdAt), log.bookTitle, log.versionLabel].filter(Boolean).join(" · ");
    titleWrap.append(title, meta);

    const badge = document.createElement("small");
    badge.className = "log-meta";
    badge.textContent = log.summary || "";
    header.append(titleWrap, badge);

    item.append(
      header,
      logSection("请求参数", log.request),
      logSection("返回结果", log.response)
    );

    if (Array.isArray(log.calls) && log.calls.length) {
      item.append(logSection(`接口调用明细（${log.calls.length} 次）`, log.calls));
    }

    els.logList.append(item);
  }
}

function logTypeText(type) {
  if (type === "extract") return "附属信息提取";
  if (type === "rewrite") return "AI 改写";
  if (type === "outline") return "剧情大纲";
  if (type === "style-analysis") return "写法分析";
  return "调用";
}

function logSection(title, value) {
  const section = document.createElement("section");
  section.className = "log-section";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const body = document.createElement("pre");
  body.className = "log-pre";
  body.textContent = formatLogValue(value);
  section.append(heading, body);
  return section;
}

function formatLogValue(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function addPromptInput(value) {
  const item = document.createElement("div");
  item.className = "prompt-item";

  const textarea = document.createElement("textarea");
  textarea.rows = 4;
  textarea.placeholder = "系统级提示词";
  textarea.value = value;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.ariaLabel = "删除提示词";
  remove.addEventListener("click", () => {
    item.remove();
    if (!els.systemPrompts.children.length) addPromptInput("");
  });

  item.append(textarea, remove);
  els.systemPrompts.append(item);
}

function activateTab(name) {
  els.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  els.readerTab.classList.toggle("active", name === "reader");
  els.shelfTab.classList.toggle("active", name === "shelf");
  els.outlineTab.classList.toggle("active", name === "outline");
  els.rewriteTab.classList.toggle("active", name === "rewrite");
  els.styleTab.classList.toggle("active", name === "style");
  els.compareTab.classList.toggle("active", name === "compare");
  els.infoTab.classList.toggle("active", name === "info");
  els.settingsTab.classList.toggle("active", name === "settings");
  els.logsTab.classList.toggle("active", name === "logs");
  if (name === "logs") loadLogs();
  if (name === "style") loadStyleCards();
}

function loadReaderSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem("readerSettings") || "{}");
    state.settings = { ...state.settings, ...stored };
  } catch {
    localStorage.removeItem("readerSettings");
  }

  if (!["txt", "markdown", "html"].includes(state.settings.renderMode)) {
    state.settings.renderMode = "txt";
  }
  if (!Number.isFinite(Number(state.settings.lineHeight))) {
    state.settings.lineHeight = 1.9;
  }
  state.settings.lineHeight = Math.min(2.4, Math.max(1.4, Number(state.settings.lineHeight)));
  state.settings.toolbarCollapsed = Boolean(state.settings.toolbarCollapsed);

  els.renderMode.value = state.settings.renderMode;
  els.fontFamily.value = state.settings.fontFamily;
  els.fontSize.value = state.settings.fontSize;
  els.fontSizeOutput.textContent = `${state.settings.fontSize}px`;
  els.lineHeight.value = state.settings.lineHeight;
  els.lineHeightOutput.textContent = state.settings.lineHeight.toFixed(1);
  els.textColor.value = state.settings.textColor;
  els.bgColor.value = state.settings.bgColor;
  applyReaderSettings();
}

function toggleReaderToolbar() {
  updateReaderSetting("toolbarCollapsed", !state.settings.toolbarCollapsed);
}

function updateReaderSetting(key, value) {
  state.settings[key] = value;
  if (key === "fontSize") els.fontSizeOutput.textContent = `${value}px`;
  if (key === "lineHeight") {
    state.settings.lineHeight = Math.min(2.4, Math.max(1.4, Number(value) || 1.9));
    els.lineHeightOutput.textContent = state.settings.lineHeight.toFixed(1);
  }
  if (key === "toolbarCollapsed") {
    state.settings.toolbarCollapsed = Boolean(value);
  }
  localStorage.setItem("readerSettings", JSON.stringify(state.settings));
  applyReaderSettings();
  if (key === "renderMode") {
    state.selection = null;
    resetParagraphSelection();
    resetReaderWindow();
    window.getSelection()?.removeAllRanges();
    renderReader();
    renderSelection();
  }
}

function applyReaderSettings() {
  document.documentElement.style.setProperty("--reader-font", state.settings.fontFamily);
  document.documentElement.style.setProperty("--reader-size", `${state.settings.fontSize}px`);
  document.documentElement.style.setProperty("--reader-line-height", String(state.settings.lineHeight || 1.9));
  document.documentElement.style.setProperty("--reader-color", state.settings.textColor);
  document.documentElement.style.setProperty("--reader-bg", state.settings.bgColor);
  applyReaderToolbarState();
}

function applyReaderToolbarState() {
  const collapsed = Boolean(state.settings.toolbarCollapsed);
  els.readerControlStack.classList.toggle("collapsed", collapsed);
  els.toggleReaderToolbarButton.textContent = collapsed ? "展开" : "收起";
  els.toggleReaderToolbarButton.setAttribute("aria-expanded", String(!collapsed));
  els.toggleReaderToolbarButton.title = collapsed ? "展开阅读工具栏" : "收起阅读工具栏";
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setProgress(wrap, labelElement, percentElement, barElement, options = {}) {
  if (!wrap) return;
  const visible = Boolean(options.visible);
  wrap.hidden = !visible;
  if (!visible) return;

  const label = options.label || "";
  const value = Number(options.value) || 0;
  const max = Number(options.max) || 0;
  labelElement.textContent = label;
  if (max > 0) {
    const safeValue = Math.min(max, Math.max(0, value));
    barElement.max = max;
    barElement.value = safeValue;
    percentElement.textContent = `${Math.round((safeValue / max) * 100)}%`;
  } else {
    barElement.removeAttribute("value");
    percentElement.textContent = "";
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function emptyState(message) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = message;
  return node;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value) || 0);
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

els.rewriteInstruction.addEventListener("input", renderSelection);
els.outlineInstruction.addEventListener("input", renderSelection);
