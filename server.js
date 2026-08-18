import express from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const USER_DATA_DIR = path.join(DATA_DIR, "users");
const LIBRARY_FILE = path.join(DATA_DIR, "library.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSION_COOKIE = "reader_session";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const EXTRACT_CHUNK_SIZE = 100000;
const EXTRACT_CONCURRENCY = Math.max(1, Math.min(12, Number.parseInt(process.env.EXTRACT_CONCURRENCY || "4", 10) || 4));
const CHUNK_MIN_RATIO = 0.55;
const CHUNK_MAX_RATIO = 1.1;
const INFO_FIELD_LIMIT = 6000;
const LOG_LIMIT = 100;
const LOG_TEXT_LIMIT = 4000;
const STYLE_SAMPLE_LIMIT = 50000;
const STYLE_CARD_LIMIT = 300;
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "120mb";

const DEFAULT_CONFIG = {
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-v4-flash",
  temperature: 0.7,
  maxTokens: 4096,
  thinking: "disabled",
  reasoningEffort: "high",
  systemPrompts: [
    "你是一名中文小说改写助手。遵循用户的改写要求，只返回可直接替换原文的改写结果，不解释、不加标题、不使用 Markdown。"
  ],
  outlineDesign: {
    systemPrompt:
      "你是中文小说剧情大纲与改写方案设计助手。请基于用户选中的段落、写作要求和已知附属信息，设计可执行的改写大纲思路。可以使用清晰分点，但不要直接改写正文。",
    userPrompt:
      "请针对选中段落设计改写大纲思路，重点说明情节目标、冲突递进、人物动机、信息揭示、伏笔回收或埋设、情绪节奏、场景调度，以及改写时应保留和强化的关键点。"
  },
  extractionPrompts: {
    system:
      "你是中文长篇小说资料整理助手。请从给定片段中提取故事背景、角色设定、情节发展。必须只返回 JSON，不要 Markdown，不要解释。",
    background: "提取故事发生的时代地域、世界观规则、势力格局、重要地点、修炼体系或社会环境。",
    characters:
      "提取出现或被明确提及的角色。每个角色必须包含 name，并尽量整理背景描述、性格特点、人设风格、人物关系、能力限制和备注；同名角色不要拆成多条。",
    plot: "提取已经发生的关键事件、冲突、线索、阶段性发展、伏笔和未解决悬念。"
  },
  styleAnalysis: {
    model: "",
    temperature: 0.35,
    maxTokens: 4096,
    systemPrompt:
      "你是中文小说写法分析与改写提示词设计助手。请从样本文字中提炼可复用的描写方法，并只返回合法 JSON，不要 Markdown，不要解释。",
    userPrompt:
      "请分析样本文字的描写方法，重点覆盖语气、用词、句式节奏、意象感官、视角、铺陈节奏、情节设计、冲突张力、角色塑造、情绪控制、场景构建、对白叙述、转场技巧，并生成可直接用于指导改写的提示词。"
  }
};

const DEFAULT_BOOK_INFO = {
  background: "",
  characters: "",
  plot: "",
  characterProfiles: [],
  updatedAt: null,
  extractedAt: null,
  extractedFromVersionId: null
};

const app = express();
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.static(path.join(__dirname, "public")));

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(USER_DATA_DIR, { recursive: true });
  await ensureJsonFile(LIBRARY_FILE, { books: [] });
  await ensureJsonFile(CONFIG_FILE, DEFAULT_CONFIG);
  await ensureJsonFile(USERS_FILE, { users: [], sessions: {} });
  await migrateInlineUserData();
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  }
}

async function readJson(filePath, fallback) {
  await ensureJsonFile(filePath, fallback);
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readUsersData() {
  const usersData = await readJson(USERS_FILE, { users: [], sessions: {} });
  return normalizeUsersData(usersData);
}

async function writeUsersData(usersData) {
  await writeJson(USERS_FILE, normalizeUsersData(usersData));
}

function normalizeUsersData(usersData) {
  const normalized = {
    users: Array.isArray(usersData.users) ? usersData.users : [],
    sessions:
      usersData.sessions && typeof usersData.sessions === "object" && !Array.isArray(usersData.sessions)
        ? usersData.sessions
        : {}
  };

  normalized.users = normalized.users.map(normalizeUserAccount).filter((user) => user.username);

  return normalized;
}

function normalizeUserAccount(user = {}) {
  return {
    id: user.id || id("user"),
    username: sanitizeText(user.username),
    passwordHash: typeof user.passwordHash === "string" ? user.passwordHash : "",
    salt: typeof user.salt === "string" ? user.salt : "",
    createdAt: user.createdAt || nowIso()
  };
}

async function migrateInlineUserData() {
  const raw = await readJson(USERS_FILE, { users: [], sessions: {} });
  const rawUsers = Array.isArray(raw.users) ? raw.users : [];
  let shouldRewriteUsersFile = false;

  for (const rawUser of rawUsers) {
    const user = normalizeUserAccount(rawUser);
    await ensureUserStorage(user, rawUser);
    if (rawUser.config || rawUser.library || rawUser.logs) {
      shouldRewriteUsersFile = true;
    }
  }

  const normalized = normalizeUsersData(raw);
  shouldRewriteUsersFile =
    shouldRewriteUsersFile ||
    JSON.stringify(rawUsers.map(normalizeUserAccount)) !== JSON.stringify(normalized.users);

  if (shouldRewriteUsersFile) {
    await writeJson(USERS_FILE, normalized);
  }
}

function userBaseDir(userId) {
  return path.join(USER_DATA_DIR, safeFileSegment(userId));
}

function userBooksDir(userId) {
  return path.join(userBaseDir(userId), "books");
}

function userConfigFile(userId) {
  return path.join(userBaseDir(userId), "config.json");
}

function userLogsFile(userId) {
  return path.join(userBaseDir(userId), "logs.json");
}

function userStyleCardsFile(userId) {
  return path.join(userBaseDir(userId), "style-cards.json");
}

function userLibraryFile(userId) {
  return path.join(userBaseDir(userId), "library.json");
}

function userBookFile(userId, bookId) {
  return path.join(userBooksDir(userId), `${safeFileSegment(bookId)}.json`);
}

function safeFileSegment(value) {
  const segment = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return segment || "unknown";
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readExistingJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function ensureUserStorage(user, seed = {}) {
  if (!user?.id) return;
  await fs.mkdir(userBaseDir(user.id), { recursive: true });
  await fs.mkdir(userBooksDir(user.id), { recursive: true });

  if (!(await fileExists(userConfigFile(user.id)))) {
    await writeJson(userConfigFile(user.id), normalizeConfig(seed.config || DEFAULT_CONFIG));
  }

  if (!(await fileExists(userLogsFile(user.id)))) {
    const logs = Array.isArray(seed.logs) ? seed.logs.slice(0, LOG_LIMIT).map(normalizeLogEntry) : [];
    await writeJson(userLogsFile(user.id), { logs });
  }

  if (!(await fileExists(userStyleCardsFile(user.id)))) {
    const cards = Array.isArray(seed.styleCards)
      ? seed.styleCards.slice(0, STYLE_CARD_LIMIT).map(normalizeStyleCard)
      : [];
    await writeJson(userStyleCardsFile(user.id), { cards });
  }

  if (!(await fileExists(userLibraryFile(user.id)))) {
    const seedLibrary = normalizeLibrary(seed.library || { books: [] });
    for (const book of seedLibrary.books) {
      const bookPath = userBookFile(user.id, book.id);
      if (!(await fileExists(bookPath))) {
        await writeJson(bookPath, normalizeBook(book));
      }
    }
    await writeJson(userLibraryFile(user.id), normalizeLibraryIndex(seedLibrary));
  }
}

async function readUserConfig(user) {
  await ensureUserStorage(user);
  return normalizeConfig(await readJson(userConfigFile(user.id), DEFAULT_CONFIG));
}

async function writeUserConfig(user, config) {
  await ensureUserStorage(user);
  const normalized = normalizeConfig(config);
  await writeJson(userConfigFile(user.id), normalized);
  return normalized;
}

async function readUserLogs(user) {
  await ensureUserStorage(user);
  const data = await readJson(userLogsFile(user.id), { logs: [] });
  return Array.isArray(data.logs) ? data.logs.slice(0, LOG_LIMIT).map(normalizeLogEntry) : [];
}

async function writeUserLogs(user, logs) {
  await ensureUserStorage(user);
  const normalized = Array.isArray(logs) ? logs.slice(0, LOG_LIMIT).map(normalizeLogEntry) : [];
  await writeJson(userLogsFile(user.id), { logs: normalized });
  return normalized;
}

async function addUserLog(user, log) {
  const logs = await readUserLogs(user);
  logs.unshift(normalizeLogEntry({ id: id("log"), createdAt: nowIso(), ...log }));
  return writeUserLogs(user, logs);
}

async function readUserStyleCards(user) {
  await ensureUserStorage(user);
  const data = await readJson(userStyleCardsFile(user.id), { cards: [] });
  return Array.isArray(data.cards) ? data.cards.slice(0, STYLE_CARD_LIMIT).map(normalizeStyleCard) : [];
}

async function writeUserStyleCards(user, cards) {
  await ensureUserStorage(user);
  const normalized = Array.isArray(cards) ? cards.slice(0, STYLE_CARD_LIMIT).map(normalizeStyleCard) : [];
  await writeJson(userStyleCardsFile(user.id), { cards: normalized });
  return normalized;
}

async function addUserStyleCard(user, card) {
  const cards = await readUserStyleCards(user);
  cards.unshift(normalizeStyleCard(card));
  return writeUserStyleCards(user, cards);
}

async function deleteUserStyleCard(user, cardId) {
  const cards = await readUserStyleCards(user);
  const beforeCount = cards.length;
  const nextCards = cards.filter((card) => card.id !== cardId);
  if (nextCards.length === beforeCount) {
    return { deleted: false, cards };
  }
  return { deleted: true, cards: await writeUserStyleCards(user, nextCards) };
}

async function readUserLibrary(user) {
  await ensureUserStorage(user);
  return normalizeLibraryIndex(await readJson(userLibraryFile(user.id), { books: [] }));
}

async function writeUserLibrary(user, library) {
  await ensureUserStorage(user);
  const normalized = normalizeLibraryIndex(library);
  await writeJson(userLibraryFile(user.id), normalized);
  return normalized;
}

async function readUserBook(user, bookId) {
  await ensureUserStorage(user);
  const data = await readExistingJson(userBookFile(user.id, bookId));
  return data ? normalizeBook(data) : null;
}

async function writeUserBook(user, book, { prepend = false } = {}) {
  await ensureUserStorage(user);
  const normalized = normalizeBook(book);
  await writeJson(userBookFile(user.id, normalized.id), normalized);

  const library = await readUserLibrary(user);
  upsertBookSummary(library, normalized, { prepend });
  await writeUserLibrary(user, library);
  return normalized;
}

async function deleteUserBook(user, bookId) {
  await ensureUserStorage(user);
  const library = await readUserLibrary(user);
  const beforeCount = library.books.length;
  library.books = library.books.filter((book) => book.id !== bookId);
  if (library.books.length === beforeCount) {
    return { deleted: false, library };
  }

  await writeUserLibrary(user, library);
  await fs.rm(userBookFile(user.id, bookId), { force: true });
  return { deleted: true, library };
}

function upsertBookSummary(library, book, { prepend = false } = {}) {
  const summary = serializeBookSummary(book);
  const index = library.books.findIndex((entry) => entry.id === summary.id);
  if (index >= 0) {
    library.books[index] = summary;
  } else if (prepend) {
    library.books.unshift(summary);
  } else {
    library.books.push(summary);
  }
}

function normalizeLibrary(library) {
  return {
    books: Array.isArray(library.books) ? library.books.map(normalizeBook) : []
  };
}

function normalizeLibraryIndex(library) {
  return {
    books: Array.isArray(library.books) ? library.books.map(serializeBookSummary).filter((book) => book.id) : []
  };
}

function normalizeBook(book) {
  return {
    ...book,
    info: normalizeBookInfo(book.info),
    versions: Array.isArray(book.versions) ? book.versions : []
  };
}

function normalizeBookInfo(info = {}) {
  return {
    ...DEFAULT_BOOK_INFO,
    background: typeof info.background === "string" ? info.background : "",
    characters: typeof info.characters === "string" ? info.characters : "",
    plot: typeof info.plot === "string" ? info.plot : "",
    characterProfiles: normalizeCharacterProfiles(info.characterProfiles),
    updatedAt: info.updatedAt || null,
    extractedAt: info.extractedAt || null,
    extractedFromVersionId: info.extractedFromVersionId || null
  };
}

function normalizeLogEntry(log = {}) {
  return {
    id: log.id || id("log"),
    type: sanitizeText(log.type || "unknown"),
    status: sanitizeText(log.status || "success"),
    createdAt: log.createdAt || nowIso(),
    title: sanitizeText(log.title || ""),
    bookId: sanitizeText(log.bookId || ""),
    bookTitle: sanitizeText(log.bookTitle || ""),
    versionId: sanitizeText(log.versionId || ""),
    versionLabel: sanitizeText(log.versionLabel || ""),
    summary: sanitizeText(log.summary || ""),
    request: cloneJson(log.request || {}),
    response: cloneJson(log.response || {}),
    calls: Array.isArray(log.calls) ? log.calls.map((call) => cloneJson(call)) : []
  };
}

function normalizeStyleCard(card = {}) {
  const analysis = normalizeStyleAnalysis(card.analysis);
  const detail = sanitizeText(card.detail) || formatStyleAnalysisDetail(analysis);
  const prompt = sanitizeText(card.prompt) || analysis.rewritePrompt || detail;
  const summary = sanitizeText(card.summary) || analysis.summary || truncateText(detail, 240);
  return {
    id: sanitizeText(card.id) || id("style"),
    title: sanitizeText(card.title || analysis.title || "常见写法"),
    summary,
    detail,
    prompt,
    sampleText: truncateText(card.sampleText || "", STYLE_SAMPLE_LIMIT),
    analysis,
    rawOutput: sanitizeText(card.rawOutput || ""),
    createdAt: card.createdAt || nowIso(),
    updatedAt: card.updatedAt || card.createdAt || nowIso()
  };
}

function normalizeStyleAnalysis(analysis = {}) {
  const source = analysis && typeof analysis === "object" && !Array.isArray(analysis) ? analysis : {};
  return {
    title: analysisText(source.title),
    summary: analysisText(source.summary),
    tone: analysisText(source.tone),
    diction: analysisText(source.diction),
    syntaxRhythm: analysisText(source.syntaxRhythm),
    imagery: analysisText(source.imagery),
    sensoryDetails: analysisText(source.sensoryDetails),
    perspective: analysisText(source.perspective),
    pacing: analysisText(source.pacing),
    plotDesign: analysisText(source.plotDesign),
    conflictTension: analysisText(source.conflictTension),
    characterPortrayal: analysisText(source.characterPortrayal),
    emotionControl: analysisText(source.emotionControl),
    sceneConstruction: analysisText(source.sceneConstruction),
    dialogueNarration: analysisText(source.dialogueNarration),
    transitionTechnique: analysisText(source.transitionTechnique),
    reusablePatterns: analysisText(source.reusablePatterns),
    rewritePrompt: analysisText(source.rewritePrompt),
    cautions: analysisText(source.cautions)
  };
}

function analysisText(value) {
  if (Array.isArray(value)) {
    return value.map(analysisText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = analysisText(item);
        return text ? `${key}：${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return sanitizeText(value);
}

function formatStyleAnalysisDetail(analysis) {
  const normalized = normalizeStyleAnalysis(analysis);
  const rows = [
    ["概述", normalized.summary],
    ["语气", normalized.tone],
    ["用词", normalized.diction],
    ["句式节奏", normalized.syntaxRhythm],
    ["意象与修辞", normalized.imagery],
    ["感官细节", normalized.sensoryDetails],
    ["叙事视角", normalized.perspective],
    ["铺陈节奏", normalized.pacing],
    ["情节设计", normalized.plotDesign],
    ["冲突张力", normalized.conflictTension],
    ["角色塑造", normalized.characterPortrayal],
    ["情绪控制", normalized.emotionControl],
    ["场景构建", normalized.sceneConstruction],
    ["对白/叙述", normalized.dialogueNarration],
    ["转场技巧", normalized.transitionTechnique],
    ["可复用写法", normalized.reusablePatterns],
    ["改写提示词", normalized.rewritePrompt],
    ["注意事项", normalized.cautions]
  ];

  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => `【${label}】\n${value}`)
    .join("\n\n");
}

function truncateText(value, limit = LOG_TEXT_LIMIT) {
  const text = String(value || "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n...（已截断，原始长度 ${text.length} 字）`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt
  };
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("base64");
  return { salt, passwordHash: hash };
}

function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const { passwordHash } = hashPassword(password, user.salt);
  const actual = Buffer.from(user.passwordHash, "base64");
  const expected = Buffer.from(passwordHash, "base64");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function validateCredentials(username, password) {
  const cleanUsername = sanitizeText(username);
  if (cleanUsername.length < 2 || cleanUsername.length > 40) {
    const error = new Error("用户名长度需为 2-40 个字符");
    error.status = 400;
    throw error;
  }
  if (typeof password !== "string" || password.length < 4 || password.length > 128) {
    const error = new Error("密码长度需为 4-128 个字符");
    error.status = 400;
    throw error;
  }
  return cleanUsername;
}

async function readLegacySeedData() {
  const usersData = await readUsersData();
  if (usersData.users.length) {
    return {
      library: { books: [] },
      config: DEFAULT_CONFIG
    };
  }

  return {
    library: normalizeLibrary(await readJson(LIBRARY_FILE, { books: [] })),
    config: normalizeConfig(await readJson(CONFIG_FILE, DEFAULT_CONFIG))
  };
}

function findUserByUsername(usersData, username) {
  const lower = username.toLowerCase();
  return usersData.users.find((user) => user.username.toLowerCase() === lower);
}

function createSession(usersData, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  usersData.sessions[token] = {
    userId,
    createdAt: nowIso()
  };
  return token;
}

async function getAuthContext(req) {
  const usersData = await readUsersData();
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? usersData.sessions[token] : null;
  const user = session ? usersData.users.find((entry) => entry.id === session.userId) : null;
  if (user) await ensureUserStorage(user);
  return { usersData, token, session, user };
}

async function requireAuth(req, res, next) {
  try {
    const auth = await getAuthContext(req);
    if (!auth.user) {
      const error = new Error("请先登录");
      error.status = 401;
      throw error;
    }
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

function normalizeConfig(config) {
  const systemPrompts = Array.isArray(config.systemPrompts)
    ? config.systemPrompts.map(sanitizeText).filter(Boolean)
    : DEFAULT_CONFIG.systemPrompts;

  return {
    ...DEFAULT_CONFIG,
    ...config,
    baseUrl: sanitizeText(config.baseUrl || DEFAULT_CONFIG.baseUrl),
    apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
    model: sanitizeText(config.model || DEFAULT_CONFIG.model),
    temperature: clampNumber(config.temperature, 0, 2, DEFAULT_CONFIG.temperature),
    maxTokens: clampInteger(config.maxTokens, 256, 65536, DEFAULT_CONFIG.maxTokens),
    thinking: ["disabled", "enabled", "auto"].includes(config.thinking)
      ? config.thinking
      : DEFAULT_CONFIG.thinking,
    reasoningEffort: ["low", "high", "max"].includes(config.reasoningEffort)
      ? config.reasoningEffort
      : DEFAULT_CONFIG.reasoningEffort,
    systemPrompts: systemPrompts.length ? systemPrompts : DEFAULT_CONFIG.systemPrompts,
    outlineDesign: normalizeOutlineDesignConfig(config.outlineDesign),
    extractionPrompts: normalizeExtractionPrompts(config.extractionPrompts),
    styleAnalysis: normalizeStyleAnalysisConfig(config.styleAnalysis)
  };
}

function normalizeOutlineDesignConfig(config = {}) {
  const source = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  return {
    systemPrompt: sanitizeText(source.systemPrompt || DEFAULT_CONFIG.outlineDesign.systemPrompt),
    userPrompt: sanitizeText(source.userPrompt || DEFAULT_CONFIG.outlineDesign.userPrompt)
  };
}

function normalizeExtractionPrompts(prompts = {}) {
  const source = prompts && typeof prompts === "object" && !Array.isArray(prompts) ? prompts : {};
  return {
    system: sanitizeText(source.system || DEFAULT_CONFIG.extractionPrompts.system),
    background: sanitizeText(source.background || DEFAULT_CONFIG.extractionPrompts.background),
    characters: sanitizeText(source.characters || DEFAULT_CONFIG.extractionPrompts.characters),
    plot: sanitizeText(source.plot || DEFAULT_CONFIG.extractionPrompts.plot)
  };
}

function normalizeStyleAnalysisConfig(config = {}) {
  const source = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  return {
    model: sanitizeText(source.model || ""),
    temperature: clampNumber(source.temperature, 0, 2, DEFAULT_CONFIG.styleAnalysis.temperature),
    maxTokens: clampInteger(source.maxTokens, 256, 65536, DEFAULT_CONFIG.styleAnalysis.maxTokens),
    systemPrompt: sanitizeText(source.systemPrompt || DEFAULT_CONFIG.styleAnalysis.systemPrompt),
    userPrompt: sanitizeText(source.userPrompt || DEFAULT_CONFIG.styleAnalysis.userPrompt)
  };
}

function publicConfig(config) {
  const { apiKey, ...rest } = config;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey)
  };
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function clampInteger(value, min, max, fallback) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function normalizeNovelText(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function serializeBook(book) {
  return {
    id: book.id,
    title: book.title,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    info: normalizeBookInfo(book.info),
    versions: book.versions.map(serializeVersion)
  };
}

function serializeBookSummary(book) {
  const versions = Array.isArray(book.versions) ? book.versions : [];
  return {
    id: sanitizeText(book.id),
    title: sanitizeText(book.title),
    createdAt: book.createdAt || nowIso(),
    updatedAt: book.updatedAt || book.createdAt || nowIso(),
    info: normalizeBookInfo(book.info),
    versions: versions.map(serializeVersionSummary)
  };
}

function serializeVersion(version) {
  return {
    id: version.id,
    number: version.number,
    label: version.label,
    createdAt: version.createdAt,
    parentVersionId: version.parentVersionId,
    contentLength: version.content.length,
    change: version.change || null,
    markCount: Array.isArray(version.marks) ? version.marks.length : 0
  };
}

function serializeVersionSummary(version) {
  const content = typeof version.content === "string" ? version.content : "";
  return {
    id: sanitizeText(version.id),
    number: Number.isInteger(version.number) ? version.number : 1,
    label: sanitizeText(version.label || "未命名版本"),
    createdAt: version.createdAt || nowIso(),
    parentVersionId: version.parentVersionId || null,
    contentLength: Number.isFinite(Number(version.contentLength)) ? Number(version.contentLength) : content.length,
    change: version.change || null,
    markCount: Number.isFinite(Number(version.markCount))
      ? Number(version.markCount)
      : Array.isArray(version.marks)
        ? version.marks.length
        : 0
  };
}

function findBook(library, bookId) {
  return library.books.find((book) => book.id === bookId);
}

function findVersion(book, versionId) {
  return book?.versions.find((version) => version.id === versionId);
}

function nextVersionNumber(book) {
  const numbers = (book?.versions || [])
    .map((version) => Number(version.number))
    .filter((number) => Number.isInteger(number) && number > 0);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

function createInitialVersion(text) {
  return {
    id: id("ver"),
    number: 1,
    label: "v1 初始版本",
    createdAt: nowIso(),
    parentVersionId: null,
    content: text,
    marks: [],
    change: null
  };
}

function shiftMarks(marks, start, end, diff, replacementLength, changeId) {
  const nextMarks = [];
  for (const mark of marks || []) {
    if (mark.end <= start) {
      nextMarks.push(mark);
      continue;
    }
    if (mark.start >= end) {
      nextMarks.push({
        ...mark,
        start: mark.start + diff,
        end: mark.end + diff
      });
      continue;
    }
  }

  nextMarks.push({
    id: changeId,
    type: "rewrite",
    start,
    end: start + replacementLength
  });

  return nextMarks.sort((a, b) => a.start - b.start || a.end - b.end);
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    const error = new Error(`${fieldName} 不能为空`);
    error.status = 400;
    throw error;
  }
  return value;
}

function assertRange(start, end, length) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > length) {
    const error = new Error("选择范围无效，请重新选择文本");
    error.status = 400;
    throw error;
  }
}

function cleanModelOutput(value) {
  let text = String(value || "");
  text = text.replace(/^\s*```(?:text|txt|markdown)?\s*/i, "");
  text = text.replace(/\s*```\s*$/i, "");
  return text.trim();
}

function cleanRewriteOutput(value) {
  return cleanModelOutput(value);
}

function cleanJsonOutput(value) {
  let text = cleanModelOutput(value).replace(/^\s*```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return text;
}

function formatBookInfoForPrompt(info) {
  const normalized = normalizeBookInfo(info);
  const parts = [
    ["故事背景", normalized.background],
    ["角色设定", normalized.characters],
    ["情节发展", normalized.plot]
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `【${label}】\n${value.trim()}`);

  return parts.length ? parts.join("\n\n") : "";
}

async function callDeepSeekChat({ config, messages, temperature = config.temperature, maxTokens = config.maxTokens }) {
  return (await callDeepSeekChatDetailed({ config, messages, temperature, maxTokens })).cleaned;
}

async function callDeepSeekChatDetailed({ config, messages, temperature = config.temperature, maxTokens = config.maxTokens }) {
  if (!config.apiKey) {
    const error = new Error("请先在接口设置中保存 DeepSeek API Key");
    error.status = 400;
    throw error;
  }

  const endpoint = new URL("chat/completions", ensureTrailingSlash(config.baseUrl)).toString();
  const body = {
    model: config.model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens
  };

  body.reasoning_effort = config.reasoningEffort;

  if (config.thinking !== "auto") {
    body.thinking = { type: config.thinking };
  }

  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });
  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`DeepSeek 请求失败（${response.status}）：${detail.slice(0, 500)}`);
    error.status = response.status;
    error.deepSeekCall = summarizeDeepSeekCall({
      endpoint,
      body,
      status: response.status,
      content: detail,
      durationMs
    });
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const cleaned = cleanModelOutput(content);
  if (!cleaned) {
    const error = new Error("DeepSeek 没有返回可用内容");
    error.status = 502;
    error.deepSeekCall = summarizeDeepSeekCall({
      endpoint,
      body,
      status: response.status,
      content: JSON.stringify(payload),
      durationMs
    });
    throw error;
  }
  return {
    cleaned,
    call: summarizeDeepSeekCall({
      endpoint,
      body,
      status: response.status,
      content,
      durationMs
    })
  };
}

function summarizeDeepSeekCall({ endpoint, body, status, content, durationMs, extra = {} }) {
  return {
    ...extra,
    request: {
      endpoint,
      model: body.model,
      stream: body.stream,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      thinking: body.thinking || "auto",
      messages: (body.messages || []).map((message) => ({
        role: message.role,
        contentLength: String(message.content || "").length,
        contentPreview: truncateText(message.content)
      }))
    },
    response: {
      status,
      durationMs,
      contentLength: String(content || "").length,
      contentPreview: truncateText(content)
    }
  };
}

async function callDeepSeek({ config, selectedText, instruction, bookInfo, referenceText = "" }) {
  const infoPrompt = formatBookInfoForPrompt(bookInfo);
  const cleanReferenceText = normalizeNovelText(referenceText).trim();
  const messages = [
    ...config.systemPrompts.map((content) => ({ role: "system", content })),
    ...(cleanReferenceText
      ? [
          {
            role: "user",
            content: [
              "以下是小说当前整体内容，请作为本次改写的上下文参考。",
              "参考它的人物关系、叙事语气、情节位置和上下文连贯性，但不要复述这段参考内容。",
              "",
              "小说当前整体内容：",
              cleanReferenceText
            ].join("\n")
          }
        ]
      : []),
    {
      role: "user",
      content: [
        "请按以下要求改写选中的小说文本。",
        "",
        `改写要求：${instruction}`,
        "",
        infoPrompt ? "文档附属信息（用于保持世界观、人物和情节一致）：\n" + infoPrompt : "",
        infoPrompt ? "" : "",
        "约束：",
        "1. 只返回改写后的正文。",
        "2. 保持人物、情节和上下文关系连贯。",
        "3. 不添加解释、标题、代码块或额外说明。",
        "",
        "原文：",
        selectedText
      ].join("\n")
    }
  ];

  const chat = await callDeepSeekChatDetailed({ config, messages });
  const cleaned = cleanRewriteOutput(chat.cleaned);
  if (!cleaned) {
    const error = new Error("DeepSeek 没有返回可替换的文本");
    error.status = 502;
    error.deepSeekCall = chat.call;
    throw error;
  }
  return { text: cleaned, call: chat.call };
}

async function callDeepSeekOutline({ config, selectedText, instruction, bookInfo, referenceText = "" }) {
  const outlineConfig = normalizeOutlineDesignConfig(config.outlineDesign);
  const infoPrompt = formatBookInfoForPrompt(bookInfo);
  const cleanReferenceText = normalizeNovelText(referenceText).trim();
  const messages = [
    {
      role: "system",
      content: outlineConfig.systemPrompt
    },
    ...(cleanReferenceText
      ? [
          {
            role: "user",
            content: [
              "以下是小说当前整体内容，请作为本次大纲设计的上下文参考。",
              "参考它的人物关系、叙事语气、情节位置和上下文连贯性，但不要复述这段参考内容。",
              "",
              "小说当前整体内容：",
              cleanReferenceText
            ].join("\n")
          }
        ]
      : []),
    {
      role: "user",
      content: [
        outlineConfig.userPrompt,
        "",
        `用户要求：${instruction}`,
        "",
        infoPrompt ? "文档附属信息（用于保持世界观、人物和情节一致）：\n" + infoPrompt : "",
        infoPrompt ? "" : "",
        "输出要求：",
        "1. 只返回改写大纲思路，不要直接改写正文。",
        "2. 结构清晰，便于复制到改写要求中继续使用。",
        "3. 不要添加和任务无关的寒暄、免责声明或代码块。",
        "",
        "选中原文：",
        selectedText
      ].join("\n")
    }
  ];

  const chat = await callDeepSeekChatDetailed({ config, messages });
  const outline = cleanModelOutput(chat.cleaned);
  if (!outline) {
    const error = new Error("DeepSeek 没有返回可用的大纲思路");
    error.status = 502;
    error.deepSeekCall = chat.call;
    throw error;
  }
  return { outline, call: chat.call };
}

async function callDeepSeekAnalyzeStyle({ config, title, sampleText }) {
  const styleConfig = normalizeStyleAnalysisConfig(config.styleAnalysis);
  const analysisModel = styleConfig.model || config.model;
  const messages = [
    {
      role: "system",
      content: styleConfig.systemPrompt
    },
    {
      role: "user",
      content: [
        styleConfig.userPrompt,
        "",
        title ? `卡片标题参考：${title}` : "",
        title ? "" : "",
        "请只返回合法 JSON 对象，字段结构如下：",
        "{",
        '  "title": "适合保存为卡片的短标题",',
        '  "summary": "80-160 字概要，概括这段文字最值得复用的写法",',
        '  "tone": "语气与叙事姿态",',
        '  "diction": "用词、词性偏好、关键词密度、雅俗程度",',
        '  "syntaxRhythm": "句式长短、停顿、排比、转折、节奏推进方式",',
        '  "imagery": "意象、比喻、象征、画面组织方式",',
        '  "sensoryDetails": "视觉、听觉、触觉、嗅觉、身体感等细节策略",',
        '  "perspective": "视角距离、信息遮蔽、主观/客观比例",',
        '  "pacing": "铺陈速度、留白、慢镜头/快切、段落推进",',
        '  "plotDesign": "情节设计、钩子、反转、伏笔、因果链",',
        '  "conflictTension": "冲突来源、紧张感制造、悬念保持方式",',
        '  "characterPortrayal": "人物动作、对白、心理、身份感塑造",',
        '  "emotionControl": "情绪递进、压抑/释放、读者期待管理",',
        '  "sceneConstruction": "场景空间、物件调度、环境与人物互动",',
        '  "dialogueNarration": "对白与叙述的比例、潜台词、叙述插入方式",',
        '  "transitionTechnique": "转场、承接、视角切换、时间跳跃技巧",',
        '  "reusablePatterns": "可复用的写法步骤或模板",',
        '  "rewritePrompt": "可直接复制给改写模型使用的提示词，要求具体、可执行",',
        '  "cautions": "使用这种写法时要避免的问题"',
        "}",
        "",
        "样本文字：",
        sampleText
      ]
        .filter((line) => line !== "")
        .join("\n")
    }
  ];

  const chat = await callDeepSeekChatDetailed({
    config: {
      ...config,
      model: analysisModel
    },
    messages,
    temperature: styleConfig.temperature,
    maxTokens: styleConfig.maxTokens
  });

  let parsed = null;
  try {
    parsed = JSON.parse(cleanJsonOutput(chat.cleaned));
  } catch {
    parsed = {
      title,
      summary: truncateText(chat.cleaned, 240),
      rewritePrompt: chat.cleaned
    };
  }

  const analysis = normalizeStyleAnalysis(parsed);
  const card = normalizeStyleCard({
    title: title || analysis.title || "常见写法",
    summary: analysis.summary,
    detail: formatStyleAnalysisDetail(analysis) || chat.cleaned,
    prompt: analysis.rewritePrompt || chat.cleaned,
    sampleText,
    analysis,
    rawOutput: chat.cleaned,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  return { card, call: chat.call };
}

async function callDeepSeekExtractBookInfo({ config, title, content, ranges }) {
  const chunks = buildExtractionChunks(content, ranges);
  if (!chunks.length) {
    return normalizeBookInfo();
  }

  const chunkResults = await mapWithConcurrency(chunks, EXTRACT_CONCURRENCY, (chunk) =>
    callDeepSeekExtractChunkInfo({
      config,
      title,
      chunk,
      totalChunks: chunks.length,
      currentInfo: normalizeBookInfo()
    })
  );
  const partialInfos = chunkResults.map((result) => result.info);

  return {
    info: partialInfos.reduce((accumulated, partial) => mergeBookInfo(accumulated, partial), normalizeBookInfo()),
    chunks,
    calls: chunkResults.map((result) => result.call)
  };
}

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

async function callDeepSeekExtractChunkInfo({ config, title, chunk, totalChunks, currentInfo }) {
  const extractionPrompts = normalizeExtractionPrompts(config.extractionPrompts);
  const currentPrompt = formatBookInfoForPrompt(currentInfo);
  const messages = [
    {
      role: "system",
      content: extractionPrompts.system
    },
    {
      role: "user",
      content: [
        `文档标题：${title}`,
        `片段：${chunk.index + 1}/${totalChunks}`,
        "",
        currentPrompt ? "已知附属信息（用于避免重复，可补充修正）：\n" + currentPrompt : "",
        currentPrompt ? "" : "",
        "请阅读以下片段，提取新增或更准确的信息。",
        "",
        `故事背景提取要求：${extractionPrompts.background}`,
        `角色设定提取要求：${extractionPrompts.characters}`,
        `情节发展提取要求：${extractionPrompts.plot}`,
        "",
        "必须只返回合法 JSON 对象，字段结构如下：",
        "{",
        '  "background": ["故事背景条目"],',
        '  "characters": [',
        "    {",
        '      "name": "角色名称",',
        '      "aliases": ["别名或称呼"],',
        '      "background": "背景描述、身份、身世、经历",',
        '      "personality": "性格特点、行为模式、价值观",',
        '      "style": "人设风格、气质、叙事定位",',
        '      "relationships": "人物关系、阵营、恩怨",',
        '      "abilities": "能力、资源、限制",',
        '      "notes": "其他重要信息"',
        "    }",
        "  ],",
        '  "plot": ["情节发展条目"]',
        "}",
        "",
        "要求：同名角色在本片段内合并为同一对象；不要虚构片段中没有依据的信息；没有内容的字段返回空字符串或空数组。",
        "",
        "片段正文：",
        chunk.text
      ].join("\n")
    }
  ];

  const chat = await callDeepSeekChatDetailed({
    config,
    messages,
    temperature: Math.min(config.temperature, 0.3),
    maxTokens: Math.max(config.maxTokens, 4096)
  });

  try {
    const parsed = JSON.parse(cleanJsonOutput(chat.cleaned));
    return {
      info: normalizeExtractedBookInfo(parsed),
      call: {
        ...chat.call,
        chunk: {
          index: chunk.index,
          total: totalChunks,
          start: chunk.start,
          end: chunk.end,
          length: chunk.text.length
        }
      }
    };
  } catch {
    const error = new Error("无法解析 DeepSeek 返回的附属信息 JSON");
    error.status = 502;
    error.deepSeekCall = {
      ...chat.call,
      chunk: {
        index: chunk.index,
        total: totalChunks,
        start: chunk.start,
        end: chunk.end,
        length: chunk.text.length
      }
    };
    throw error;
  }
}

function buildExtractionChunks(text, ranges) {
  const source = String(text || "");
  const normalizedRanges = normalizeExtractionRanges(ranges, source.length);
  const sourceRanges = normalizedRanges.length ? normalizedRanges : [{ start: 0, end: source.length }];
  const chunks = [];

  for (const range of sourceRanges) {
    const rangeChunks = splitTextIntoChunks(source.slice(range.start, range.end), EXTRACT_CHUNK_SIZE);
    for (const chunk of rangeChunks) {
      chunks.push({
        ...chunk,
        index: chunks.length,
        start: range.start + chunk.start,
        end: range.start + chunk.end
      });
    }
  }

  return chunks;
}

function normalizeExtractedBookInfo(parsed) {
  const characterProfiles = normalizeCharacterProfiles(parsed?.characters);
  return normalizeBookInfo({
    background: collectTextItems(parsed?.background).join("\n"),
    characters: formatCharacterProfiles(characterProfiles) || collectTextItems(parsed?.characters).join("\n"),
    plot: collectTextItems(parsed?.plot).join("\n"),
    characterProfiles
  });
}

function collectTextItems(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => collectTextItems(item))
      .map(sanitizeText)
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const name = sanitizeText(value.name);
    const text = ["background", "personality", "style", "relationships", "abilities", "notes"]
      .map((key) => sanitizeText(value[key]))
      .filter(Boolean)
      .join("；");
    return [name && text ? `${name}：${text}` : name || text].filter(Boolean);
  }
  return sanitizeText(value) ? [sanitizeText(value)] : [];
}

function normalizeExtractionRanges(ranges, length) {
  if (!Array.isArray(ranges)) return [];

  return ranges
    .map((range) => ({
      start: Math.max(0, Math.floor(Number(range?.start))),
      end: Math.min(length, Math.ceil(Number(range?.end)))
    }))
    .filter((range) => Number.isInteger(range.start) && Number.isInteger(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function splitTextIntoChunks(text, maxChars) {
  const source = String(text || "");
  const chunks = [];
  let start = 0;

  while (start < source.length) {
    const end = findNearestParagraphBoundary(source, start, maxChars);

    chunks.push({
      index: chunks.length,
      start,
      end,
      text: source.slice(start, end)
    });
    start = end;
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

function mergeBookInfo(currentInfo, nextInfo) {
  const characterProfiles = mergeCharacterProfiles([
    ...normalizeCharacterProfiles(currentInfo.characterProfiles),
    ...normalizeCharacterProfiles(nextInfo.characterProfiles)
  ]);
  const formattedCharacters = formatCharacterProfiles(characterProfiles);

  return normalizeBookInfo({
    background: mergeInfoField(currentInfo.background, nextInfo.background),
    characters: formattedCharacters || mergeInfoField(currentInfo.characters, nextInfo.characters),
    plot: mergeInfoField(currentInfo.plot, nextInfo.plot),
    characterProfiles
  });
}

function normalizeCharacterProfiles(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeCharacterProfile).filter((profile) => profile.name);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([name, profile]) => normalizeCharacterProfile({ name, ...(profile || {}) }))
      .filter((profile) => profile.name);
  }

  return [];
}

function normalizeCharacterProfile(profile) {
  if (typeof profile === "string") {
    return {
      name: sanitizeText(profile),
      aliases: [],
      background: "",
      personality: "",
      style: "",
      relationships: "",
      abilities: "",
      notes: ""
    };
  }

  const aliases = Array.isArray(profile?.aliases)
    ? profile.aliases.map(sanitizeText).filter(Boolean)
    : sanitizeText(profile?.aliases)
      ? sanitizeText(profile.aliases)
          .split(/[,，、/]/)
          .map(sanitizeText)
          .filter(Boolean)
      : [];

  return {
    name: sanitizeText(profile?.name),
    aliases,
    background: sanitizeText(profile?.background),
    personality: sanitizeText(profile?.personality),
    style: sanitizeText(profile?.style),
    relationships: sanitizeText(profile?.relationships),
    abilities: sanitizeText(profile?.abilities),
    notes: sanitizeText(profile?.notes)
  };
}

function mergeCharacterProfiles(profiles) {
  const byName = new Map();

  for (const profile of profiles.map(normalizeCharacterProfile).filter((entry) => entry.name)) {
    const key = normalizeCharacterName(profile.name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current) {
      byName.set(key, {
        ...profile,
        aliases: [...new Set(profile.aliases)]
      });
      continue;
    }

    current.name = current.name || profile.name;
    current.aliases = [...new Set([...current.aliases, ...profile.aliases])];
    current.background = mergeInfoField(current.background, profile.background);
    current.personality = mergeInfoField(current.personality, profile.personality);
    current.style = mergeInfoField(current.style, profile.style);
    current.relationships = mergeInfoField(current.relationships, profile.relationships);
    current.abilities = mergeInfoField(current.abilities, profile.abilities);
    current.notes = mergeInfoField(current.notes, profile.notes);
  }

  return [...byName.values()];
}

function normalizeCharacterName(name) {
  return sanitizeText(name)
    .replace(/[《》「」『』“”"'\s]/g, "")
    .toLowerCase();
}

function formatCharacterProfiles(profiles) {
  const text = normalizeCharacterProfiles(profiles)
    .map((profile) => {
      const title = profile.aliases.length ? `【${profile.name}】（又名：${profile.aliases.join("、")}）` : `【${profile.name}】`;
      return [
        title,
        profile.background ? `背景描述：${profile.background}` : "",
        profile.personality ? `性格特点：${profile.personality}` : "",
        profile.style ? `人设风格：${profile.style}` : "",
        profile.relationships ? `人物关系：${profile.relationships}` : "",
        profile.abilities ? `能力/限制：${profile.abilities}` : "",
        profile.notes ? `其他信息：${profile.notes}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  return text.slice(0, INFO_FIELD_LIMIT).trim();
}

function mergeInfoField(current, next) {
  const sections = [];
  for (const value of [current, next]) {
    for (const part of splitInfoSections(value)) {
      const normalized = part.replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      const exists = sections.some((section) => {
        const compactA = section.replace(/\s+/g, "");
        const compactB = normalized.replace(/\s+/g, "");
        return compactA.includes(compactB) || compactB.includes(compactA);
      });
      if (!exists) sections.push(part.trim());
    }
  }

  return sections.join("\n").slice(0, INFO_FIELD_LIMIT).trim();
}

function splitInfoSections(value) {
  return String(value || "")
    .split(/\n+|(?<=[。！？；;])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

app.get("/api/auth/status", async (req, res, next) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth.user) {
      if (auth.token && auth.usersData.sessions[auth.token]) {
        delete auth.usersData.sessions[auth.token];
        await writeUsersData(auth.usersData);
      }
      clearSessionCookie(res);
      res.json({ authenticated: false });
      return;
    }

    res.json({ authenticated: true, user: publicUser(auth.user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = validateCredentials(req.body?.username, req.body?.password);
    const usersData = await readUsersData();
    if (findUserByUsername(usersData, username)) {
      const error = new Error("用户名已存在");
      error.status = 409;
      throw error;
    }

    const seed = await readLegacySeedData();
    const { salt, passwordHash } = hashPassword(req.body.password);
    const user = {
      id: id("user"),
      username,
      passwordHash,
      salt,
      createdAt: nowIso()
    };

    usersData.users.push(user);
    const token = createSession(usersData, user.id);
    await ensureUserStorage(user, { config: seed.config, library: seed.library, logs: [] });
    await writeUsersData(usersData);
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = validateCredentials(req.body?.username, req.body?.password);
    const usersData = await readUsersData();
    const user = findUserByUsername(usersData, username);
    if (!user || !verifyPassword(req.body.password, user)) {
      const error = new Error("用户名或密码错误");
      error.status = 401;
      throw error;
    }

    const token = createSession(usersData, user.id);
    await writeUsersData(usersData);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const usersData = await readUsersData();
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) delete usersData.sessions[token];
    await writeUsersData(usersData);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAuth);

app.get("/api/config", async (req, res, next) => {
  try {
    res.json(publicConfig(await readUserConfig(req.auth.user)));
  } catch (error) {
    next(error);
  }
});

app.put("/api/config", async (req, res, next) => {
  try {
    const current = await readUserConfig(req.auth.user);
    const body = req.body || {};
    const nextConfig = normalizeConfig({
      ...current,
      baseUrl: body.baseUrl ?? current.baseUrl,
      model: body.model ?? current.model,
      temperature: body.temperature ?? current.temperature,
      maxTokens: body.maxTokens ?? current.maxTokens,
      thinking: body.thinking ?? current.thinking,
      reasoningEffort: body.reasoningEffort ?? current.reasoningEffort,
      systemPrompts: body.systemPrompts ?? current.systemPrompts,
      outlineDesign: body.outlineDesign ?? current.outlineDesign,
      extractionPrompts: body.extractionPrompts ?? current.extractionPrompts,
      styleAnalysis: body.styleAnalysis ?? current.styleAnalysis,
      apiKey: body.clearApiKey ? "" : sanitizeText(body.apiKey || "") || current.apiKey
    });

    if (!nextConfig.baseUrl) {
      const error = new Error("Base URL 不能为空");
      error.status = 400;
      throw error;
    }
    try {
      new URL(nextConfig.baseUrl);
    } catch {
      const error = new Error("Base URL 格式无效");
      error.status = 400;
      throw error;
    }

    res.json(publicConfig(await writeUserConfig(req.auth.user, nextConfig)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/logs", async (req, res, next) => {
  try {
    res.json({ logs: await readUserLogs(req.auth.user) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/logs", async (req, res, next) => {
  try {
    res.json({ logs: await writeUserLogs(req.auth.user, []) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/style-cards", async (req, res, next) => {
  try {
    res.json({ cards: await readUserStyleCards(req.auth.user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/style-cards/analyze", async (req, res, next) => {
  try {
    const title = sanitizeText(req.body?.title || "").slice(0, 80);
    const sampleText = normalizeNovelText(requireString(req.body?.sampleText, "样本文字")).slice(0, STYLE_SAMPLE_LIMIT);

    let analysisResult;
    try {
      analysisResult = await callDeepSeekAnalyzeStyle({
        config: await readUserConfig(req.auth.user),
        title,
        sampleText
      });
    } catch (error) {
      await addUserLog(req.auth.user, {
        type: "style-analysis",
        status: "error",
        title: "写法分析失败",
        summary: error.message,
        request: {
          title,
          sampleLength: sampleText.length,
          sampleText: truncateText(sampleText)
        },
        response: { error: error.message },
        calls: error.deepSeekCall ? [error.deepSeekCall] : []
      });
      throw error;
    }

    const cards = await addUserStyleCard(req.auth.user, analysisResult.card);
    await addUserLog(req.auth.user, {
      type: "style-analysis",
      status: "success",
      title: "写法分析",
      summary: analysisResult.card.title,
      request: {
        title,
        sampleLength: sampleText.length,
        sampleText: truncateText(sampleText)
      },
      response: {
        cardId: analysisResult.card.id,
        title: analysisResult.card.title,
        summary: analysisResult.card.summary,
        prompt: truncateText(analysisResult.card.prompt)
      },
      calls: [analysisResult.call]
    });

    res.status(201).json({ card: analysisResult.card, cards });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/style-cards/:cardId", async (req, res, next) => {
  try {
    const { deleted, cards } = await deleteUserStyleCard(req.auth.user, req.params.cardId);
    if (!deleted) {
      const error = new Error("没有找到要删除的写法卡片");
      error.status = 404;
      throw error;
    }

    res.json({ cards });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books", async (req, res, next) => {
  try {
    const library = await readUserLibrary(req.auth.user);
    res.json({ books: library.books });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books", async (req, res, next) => {
  try {
    const title = requireString(req.body?.title, "书名").slice(0, 120);
    const text = normalizeNovelText(requireString(req.body?.text, "小说文本"));
    const createdAt = nowIso();
    const book = {
      id: id("book"),
      title,
      createdAt,
      updatedAt: createdAt,
      info: normalizeBookInfo(),
      versions: [createInitialVersion(text)]
    };

    await writeUserBook(req.auth.user, book, { prepend: true });
    res.status(201).json({ book: serializeBook(book) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/books/:bookId", async (req, res, next) => {
  try {
    const { deleted, library } = await deleteUserBook(req.auth.user, req.params.bookId);
    if (!deleted) {
      const error = new Error("没有找到要删除的书籍");
      error.status = 404;
      throw error;
    }

    res.json({ books: library.books });
  } catch (error) {
    next(error);
  }
});

app.put("/api/books/:bookId/info", async (req, res, next) => {
  try {
    const book = await readUserBook(req.auth.user, req.params.bookId);
    if (!book) {
      const error = new Error("没有找到要保存附属信息的书籍");
      error.status = 404;
      throw error;
    }

    book.info = normalizeBookInfo({
      ...book.info,
      background: sanitizeText(req.body?.background || ""),
      characters: sanitizeText(req.body?.characters || ""),
      plot: sanitizeText(req.body?.plot || ""),
      updatedAt: nowIso()
    });

    await writeUserBook(req.auth.user, book);
    res.json({ book: serializeBook(book), info: book.info });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:bookId/extract-info", async (req, res, next) => {
  try {
    const book = await readUserBook(req.auth.user, req.params.bookId);
    const versionId = req.body?.versionId || book?.versions?.at(-1)?.id;
    const version = findVersion(book, versionId);
    if (!book || !version) {
      const error = new Error("没有找到用于提取附属信息的书籍版本");
      error.status = 404;
      throw error;
    }

    let extraction;
    try {
      extraction = await callDeepSeekExtractBookInfo({
        config: await readUserConfig(req.auth.user),
        title: book.title,
        content: version.content,
        ranges: req.body?.ranges
      });
    } catch (error) {
      await addUserLog(req.auth.user, {
        type: "extract",
        status: "error",
        title: "附属信息提取失败",
        bookId: book.id,
        bookTitle: book.title,
        versionId: version.id,
        versionLabel: version.label,
        summary: error.message,
        request: {
          ranges: Array.isArray(req.body?.ranges) ? req.body.ranges : "全文",
          contentLength: version.content.length
        },
        response: { error: error.message },
        calls: error.deepSeekCall ? [error.deepSeekCall] : []
      });
      throw error;
    }

    const extractedAt = nowIso();
    book.info = normalizeBookInfo({
      ...extraction.info,
      updatedAt: extractedAt,
      extractedAt,
      extractedFromVersionId: version.id
    });

    await writeUserBook(req.auth.user, book);
    await addUserLog(req.auth.user, {
      type: "extract",
      status: "success",
      title: "附属信息提取",
      bookId: book.id,
      bookTitle: book.title,
      versionId: version.id,
      versionLabel: version.label,
      summary: `提取 ${extraction.chunks.length} 个分段，角色 ${book.info.characterProfiles.length} 个`,
      request: {
        ranges: Array.isArray(req.body?.ranges) ? req.body.ranges : "全文",
        contentLength: version.content.length,
        chunkCount: extraction.chunks.length,
        concurrency: EXTRACT_CONCURRENCY
      },
      response: {
        background: truncateText(book.info.background),
        characters: truncateText(book.info.characters),
        plot: truncateText(book.info.plot),
        characterProfiles: book.info.characterProfiles
      },
      calls: extraction.calls
    });
    res.json({ book: serializeBook(book), info: book.info });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books/:bookId/versions/:versionId", async (req, res, next) => {
  try {
    const book = await readUserBook(req.auth.user, req.params.bookId);
    const version = findVersion(book, req.params.versionId);
    if (!book || !version) {
      const error = new Error("没有找到对应的书籍版本");
      error.status = 404;
      throw error;
    }

    res.json({
      book: serializeBook(book),
      version: {
        ...serializeVersion(version),
        content: version.content,
        marks: version.marks || []
      }
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/books/:bookId/versions/:versionId", async (req, res, next) => {
  try {
    const book = await readUserBook(req.auth.user, req.params.bookId);
    if (!book) {
      const error = new Error("没有找到对应的书籍");
      error.status = 404;
      throw error;
    }

    const versionId = req.params.versionId;
    const currentVersionId = sanitizeText(req.query?.currentVersionId || req.body?.currentVersionId || "");
    if (currentVersionId && versionId === currentVersionId) {
      const error = new Error("当前正在使用的版本不能删除，请先切换到其他版本");
      error.status = 400;
      throw error;
    }

    if (book.versions.length <= 1) {
      const error = new Error("至少需要保留一个版本");
      error.status = 400;
      throw error;
    }

    const beforeCount = book.versions.length;
    book.versions = book.versions.filter((version) => version.id !== versionId);
    if (book.versions.length === beforeCount) {
      const error = new Error("没有找到要删除的版本");
      error.status = 404;
      throw error;
    }

    if (book.info?.extractedFromVersionId === versionId) {
      book.info = normalizeBookInfo({
        ...book.info,
        extractedFromVersionId: null,
        updatedAt: nowIso()
      });
    }
    book.updatedAt = nowIso();
    await writeUserBook(req.auth.user, book);
    res.json({ book: serializeBook(book) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/outline", async (req, res, next) => {
  try {
    const { bookId, versionId } = req.body || {};
    const start = Number(req.body?.start);
    const end = Number(req.body?.end);
    const instruction = requireString(req.body?.instruction, "大纲要求").slice(0, 2000);
    const referenceText =
      typeof req.body?.referenceText === "string" ? normalizeNovelText(req.body.referenceText).trim() : "";

    const book = await readUserBook(req.auth.user, bookId);
    const sourceVersion = findVersion(book, versionId);
    if (!book || !sourceVersion) {
      const error = new Error("没有找到用于设计大纲的书籍版本");
      error.status = 404;
      throw error;
    }

    assertRange(start, end, sourceVersion.content.length);
    const selectedText = sourceVersion.content.slice(start, end);
    let outlineResult;
    try {
      outlineResult = await callDeepSeekOutline({
        config: await readUserConfig(req.auth.user),
        selectedText,
        instruction,
        bookInfo: book.info,
        referenceText
      });
    } catch (error) {
      await addUserLog(req.auth.user, {
        type: "outline",
        status: "error",
        title: "剧情大纲设计失败",
        bookId: book.id,
        bookTitle: book.title,
        versionId: sourceVersion.id,
        versionLabel: sourceVersion.label,
        summary: error.message,
        request: {
          start,
          end,
          selectedLength: selectedText.length,
          selectedText: truncateText(selectedText),
          referenceLength: referenceText.length,
          referenceText: truncateText(referenceText),
          instruction
        },
        response: { error: error.message },
        calls: error.deepSeekCall ? [error.deepSeekCall] : []
      });
      throw error;
    }

    await addUserLog(req.auth.user, {
      type: "outline",
      status: "success",
      title: "剧情大纲设计",
      bookId: book.id,
      bookTitle: book.title,
      versionId: sourceVersion.id,
      versionLabel: sourceVersion.label,
      summary: `为 ${selectedText.length} 字选区生成大纲思路`,
      request: {
        start,
        end,
        selectedLength: selectedText.length,
        selectedText: truncateText(selectedText),
        referenceLength: referenceText.length,
        referenceText: truncateText(referenceText),
        instruction
      },
      response: {
        outline: truncateText(outlineResult.outline)
      },
      calls: [outlineResult.call]
    });

    res.json({ outline: outlineResult.outline });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rewrite", async (req, res, next) => {
  try {
    const { bookId, versionId } = req.body || {};
    const start = Number(req.body?.start);
    const end = Number(req.body?.end);
    const instruction = requireString(req.body?.instruction, "改写要求").slice(0, 2000);
    const referenceText =
      typeof req.body?.referenceText === "string" ? normalizeNovelText(req.body.referenceText).trim() : "";

    const book = await readUserBook(req.auth.user, bookId);
    const sourceVersion = findVersion(book, versionId);
    if (!book || !sourceVersion) {
      const error = new Error("没有找到要改写的书籍版本");
      error.status = 404;
      throw error;
    }

    assertRange(start, end, sourceVersion.content.length);
    const selectedText = sourceVersion.content.slice(start, end);
    let rewriteResult;
    try {
      rewriteResult = await callDeepSeek({
        config: await readUserConfig(req.auth.user),
        selectedText,
        instruction,
        bookInfo: book.info,
        referenceText
      });
    } catch (error) {
      await addUserLog(req.auth.user, {
        type: "rewrite",
        status: "error",
        title: "AI 改写失败",
        bookId: book.id,
        bookTitle: book.title,
        versionId: sourceVersion.id,
        versionLabel: sourceVersion.label,
        summary: error.message,
        request: {
          start,
          end,
          selectedLength: selectedText.length,
          selectedText: truncateText(selectedText),
          referenceLength: referenceText.length,
          referenceText: truncateText(referenceText),
          instruction
        },
        response: { error: error.message },
        calls: error.deepSeekCall ? [error.deepSeekCall] : []
      });
      throw error;
    }
    const rewrittenText = rewriteResult.text;

    const changeId = id("chg");
    const content =
      sourceVersion.content.slice(0, start) +
      normalizeNovelText(rewrittenText) +
      sourceVersion.content.slice(end);
    const diff = normalizeNovelText(rewrittenText).length - (end - start);
    const createdAt = nowIso();
    const number = nextVersionNumber(book);
    const version = {
      id: id("ver"),
      number,
      label: `v${number} 改写版本`,
      createdAt,
      parentVersionId: sourceVersion.id,
      content,
      marks: shiftMarks(sourceVersion.marks, start, end, diff, normalizeNovelText(rewrittenText).length, changeId),
      change: {
        id: changeId,
        createdAt,
        sourceVersionId: sourceVersion.id,
        sourceVersionLabel: sourceVersion.label,
        start,
        end: start + normalizeNovelText(rewrittenText).length,
        beforeLength: end - start,
        afterLength: normalizeNovelText(rewrittenText).length,
        instruction,
        beforeText: selectedText,
        afterText: normalizeNovelText(rewrittenText)
      }
    };

    book.versions.push(version);
    book.updatedAt = createdAt;
    await writeUserBook(req.auth.user, book);
    await addUserLog(req.auth.user, {
      type: "rewrite",
      status: "success",
      title: "AI 改写",
      bookId: book.id,
      bookTitle: book.title,
      versionId: sourceVersion.id,
      versionLabel: sourceVersion.label,
      summary: `${sourceVersion.label} → ${version.label}，${end - start} 字改为 ${normalizeNovelText(rewrittenText).length} 字`,
      request: {
        start,
        end,
        selectedLength: selectedText.length,
        selectedText: truncateText(selectedText),
        referenceLength: referenceText.length,
        referenceText: truncateText(referenceText),
        instruction
      },
      response: {
        newVersionId: version.id,
        newVersionLabel: version.label,
        rewrittenText: truncateText(normalizeNovelText(rewrittenText)),
        change: version.change
      },
      calls: [rewriteResult.call]
    });

    res.status(201).json({
      book: serializeBook(book),
      version: {
        ...serializeVersion(version),
        content: version.content,
        marks: version.marks
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 500;
  res.status(status).json({
    error: status >= 500 ? "服务器处理失败" : error.message,
    detail: status >= 500 ? error.message : undefined
  });
});

await ensureDataFiles();
app.listen(PORT, HOST, () => {
  console.log(`Reader app running at http://${HOST}:${PORT}`);
});
