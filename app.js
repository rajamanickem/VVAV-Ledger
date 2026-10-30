const STORAGE_KEY = "ledger-transactions-v1";
const THEME_KEY = "ledger-theme";
const CATEGORY_STORAGE_KEY = "ledger-categories-v1";
const ACCOUNT_STORAGE_KEY = "ledger-accounts-v1";
const DATABASE_NAME = "ledger-local-database";
const DATABASE_VERSION = 3;
const TRANSACTION_STORE = "transactions";
const CATEGORY_STORE = "categories";
const ACCOUNT_STORE = "accounts";
const defaultAccountGroupOrder = ["Bank Accounts", "Salary", "Credit Cards", "Cash", "Loans", "Wallet", "Investments", "Emergency Funds"];
const defaultFoodCategory = {
  id: createId(),
  name: "Food",
  icon: "🍽️",
  children: [
    { id: createId(), name: "Grocery", icon: "🛒", children: [] },
    { id: createId(), name: "Fruits", icon: "🍎", children: [] },
    { id: createId(), name: "Vegetables", icon: "🥦", children: [] },
    { id: createId(), name: "Meat Products", icon: "🥩", children: [] },
    { id: createId(), name: "Milk Products", icon: "🥛", children: [] }
  ]
};
const defaultAccountGroups = [
  { id: createId(), name: "Bank Accounts", icon: "🏦", balanceType: "asset", accounts: [{ id: createId(), name: "Savings", openingBalance: 0 }] },
  { id: createId(), name: "Credit Cards", icon: "💳", balanceType: "liability", accounts: [{ id: createId(), name: "Credit card", openingBalance: 0 }] },
  { id: createId(), name: "Cash", icon: "💵", balanceType: "asset", accounts: [{ id: createId(), name: "Cash", openingBalance: 0 }] },
  { id: createId(), name: "Loans", icon: "🏠", balanceType: "liability", accounts: [] },
  { id: createId(), name: "Wallet", icon: "👛", balanceType: "asset", accounts: [] },
  { id: createId(), name: "Investments", icon: "📈", balanceType: "asset", accounts: [] },
  { id: createId(), name: "Emergency Funds", icon: "🛟", balanceType: "asset", accounts: [] },
  { id: createId(), name: "Salary", icon: "💼", balanceType: "asset", accounts: [] }
];
const previousDefaultAccountGroupLayouts = [[
  { name: "Bank Accounts", accounts: ["Checking", "Savings"] },
  { name: "Credit Cards", accounts: ["Credit card"] },
  { name: "Cash", accounts: ["Cash"] }
], [
  { name: "Bank Accounts", accounts: ["Checking", "Savings"] },
  { name: "Credit Cards", accounts: ["Credit card"] },
  { name: "Cash", accounts: ["Cash"] },
  { name: "Loans", accounts: [] },
  { name: "Wallet", accounts: [] },
  { name: "Investments", accounts: [] }
], [
  { name: "Bank Accounts", accounts: ["Savings"] },
  { name: "Credit Cards", accounts: ["Credit card"] },
  { name: "Cash", accounts: ["Cash"] },
  { name: "Loans", accounts: [] },
  { name: "Wallet", accounts: [] },
  { name: "Investments", accounts: [] }
], [
  { name: "Bank Accounts", accounts: ["Savings"] },
  { name: "Credit Cards", accounts: ["Credit card"] },
  { name: "Cash", accounts: ["Cash"] },
  { name: "Loans", accounts: [] },
  { name: "Wallet", accounts: [] },
  { name: "Investments", accounts: [] },
  { name: "Emergency Funds", accounts: [] }
]];
const defaultCategories = {
  expense: [defaultFoodCategory],
  income: ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"].map((name) => ({ id: createId(), name, icon: "💰", children: [] }))
};
const legacyExpenseCategoryNames = ["Food & dining", "Housing", "Transport", "Shopping", "Health", "Utilities", "Personal", "Other"];
const tabLabels = { expense: "Expenses", income: "Income", transfer: "Transfers" };
const transactionNames = { expense: "expense", income: "income", transfer: "transfer" };
const icons = { expense: "↗", income: "↙", transfer: "⇄" };
let transactions = [];
let categories = { expense: [], income: [] };
let accountGroups = [];
let activeTab = "expense";
let activeView = "home";
let editingTransactionId = null;
let duplicatingTransaction = false;
let selectedPeriod = "month";
let activityDisplay = "list";

const elements = {
  list: document.querySelector("#transaction-list"),
  chart: document.querySelector("#category-chart"),
  activityViewSwitch: document.querySelector("#activity-view-switch"),
  form: document.querySelector("#transaction-form"),
  amount: document.querySelector("#amount"),
  description: document.querySelector("#description"),
  descriptionLabel: document.querySelector("#description-label"),
  category: document.querySelector("#category"),
  subcategory: document.querySelector("#subcategory"),
  detailCategory: document.querySelector("#detail-category"),
  categoryField: document.querySelector("#category-field"),
  account: document.querySelector("#account"),
  accountLabel: document.querySelector("#account-label"),
  destination: document.querySelector("#destination"),
  destinationField: document.querySelector("#destination-field"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  feedback: document.querySelector("#form-feedback"),
  submitLabel: document.querySelector("#submit-label"),
  cancelEdit: document.querySelector("#cancel-transaction-edit"),
  search: document.querySelector("#search-input"),
  categoryDialog: document.querySelector("#category-dialog"),
  categoryTree: document.querySelector("#category-tree"),
  managerType: document.querySelector("#manager-type"),
  categoryParent: document.querySelector("#category-parent"),
  categoryName: document.querySelector("#category-name"),
  categoryIcon: document.querySelector("#category-icon"),
  categoryFeedback: document.querySelector("#category-feedback"),
  accountDialog: document.querySelector("#account-dialog"),
  accountGroupList: document.querySelector("#account-group-list"),
  accountGroupSelect: document.querySelector("#account-group-select"),
  accountGroupName: document.querySelector("#account-group-name"),
  accountGroupIcon: document.querySelector("#account-group-icon"),
  accountGroupBalanceType: document.querySelector("#account-group-balance-type"),
  accountName: document.querySelector("#account-name"),
  accountOpeningBalance: document.querySelector("#account-opening-balance"),
  accountOpeningHint: document.querySelector("#account-opening-hint"),
  accountGroupFeedback: document.querySelector("#account-group-feedback"),
  accountFeedback: document.querySelector("#account-feedback"),
  overviewAccountGroups: document.querySelector("#overview-account-groups"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsFeedback: document.querySelector("#settings-feedback"),
  backupFileInput: document.querySelector("#backup-file-input"),
  csvFileInput: document.querySelector("#csv-file-input"),
  periodSelect: document.querySelector("#period-select"),
  customPeriod: document.querySelector("#custom-period"),
  periodStart: document.querySelector("#period-start"),
  periodEnd: document.querySelector("#period-end"),
  periodRangeLabel: document.querySelector("#period-range-label")
};

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TRANSACTION_STORE)) request.result.createObjectStore(TRANSACTION_STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(CATEGORY_STORE)) request.result.createObjectStore(CATEGORY_STORE, { keyPath: "type" });
      if (!request.result.objectStoreNames.contains(ACCOUNT_STORE)) request.result.createObjectStore(ACCOUNT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLegacyTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && ["expense", "income", "transfer"].includes(item.type)) : [];
  } catch {
    return [];
  }
}

function readDatabaseTransactions(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(TRANSACTION_STORE, "readonly").objectStore(TRANSACTION_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readDatabaseCategories(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(CATEGORY_STORE, "readonly").objectStore(CATEGORY_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readDatabaseAccounts(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(ACCOUNT_STORE, "readonly").objectStore(ACCOUNT_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeDatabaseAccounts(database, groups) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ACCOUNT_STORE, "readwrite");
    const store = transaction.objectStore(ACCOUNT_STORE);
    store.clear();
    groups.forEach((group) => store.put(group));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Account write was cancelled"));
  });
}

function readLegacyAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || "null");
    if (Array.isArray(saved)) return saved;
    return defaultAccountGroups;
  } catch {
    return defaultAccountGroups;
  }
}

function isPreviousDefaultAccountGroups(groups) {
  if (!Array.isArray(groups)) return false;
  return previousDefaultAccountGroupLayouts.some((layout) => {
    if (groups.length !== layout.length) return false;
    return layout.every((expected) => {
      const group = groups.find((item) => item.name === expected.name);
      if (!group || group.accounts.length !== expected.accounts.length) return false;
      return expected.accounts.every((name) => group.accounts.some((account) => account.name === name));
    });
  });
}

function migrateDefaultAccountGroups(previousGroups) {
  return defaultAccountGroups.map((defaults) => {
    const previousGroup = previousGroups.find((group) => group.name === defaults.name);
    if (!previousGroup) return defaults;
    return {
      ...defaults,
      id: previousGroup.id,
      accounts: defaults.accounts.map((account) => {
        const previousAccount = previousGroup.accounts.find((item) => item.name === account.name);
        return {
          ...account,
          id: previousAccount?.id || account.id,
          openingBalance: previousAccount?.openingBalance ?? account.openingBalance
        };
      })
    };
  });
}

async function loadAccountGroups() {
  try {
    const database = await openDatabase();
    const stored = await readDatabaseAccounts(database);
    const savedGroups = stored.length ? stored : readLegacyAccounts();
    if (isPreviousDefaultAccountGroups(savedGroups)) {
      accountGroups = migrateDefaultAccountGroups(savedGroups);
      await writeDatabaseAccounts(database, accountGroups);
    } else {
      accountGroups = savedGroups;
    }
    let needsSave = false;
    accountGroups = accountGroups.map((group) => {
      const defaultGroup = defaultAccountGroups.find((item) => item.name === group.name);
      const balanceType = group.balanceType || defaultGroup?.balanceType || (["Credit Cards", "Loans"].includes(group.name) ? "liability" : "asset");
      const accounts = group.accounts.map((account) => {
        if (typeof account.openingBalance === "number") return account;
        needsSave = true;
        return { ...account, openingBalance: 0 };
      });
      if (group.balanceType) return { ...group, accounts };
      needsSave = true;
      return { ...group, balanceType, accounts };
    });
    accountGroups.sort((first, second) => {
      const firstRank = defaultAccountGroupOrder.indexOf(first.name);
      const secondRank = defaultAccountGroupOrder.indexOf(second.name);
      if (firstRank >= 0 || secondRank >= 0) return (firstRank < 0 ? defaultAccountGroupOrder.length : firstRank) - (secondRank < 0 ? defaultAccountGroupOrder.length : secondRank);
      return (first.order ?? 0) - (second.order ?? 0);
    });
    if (!stored.length || needsSave) await writeDatabaseAccounts(database, accountGroups);
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    accountGroups = readLegacyAccounts();
  }
}

async function saveAccountGroups() {
  try {
    const database = await openDatabase();
    await writeDatabaseAccounts(database, accountGroups);
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    return true;
  } catch {
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accountGroups));
      return true;
    } catch {
      elements.accountFeedback.textContent = "Could not save accounts in this browser.";
      return false;
    }
  }
}

function writeDatabaseCategory(database, type) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CATEGORY_STORE, "readwrite");
    transaction.objectStore(CATEGORY_STORE).put({ type, items: categories[type] });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function readLegacyCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function isLegacyExpenseCategoryTree(items) {
  if (!Array.isArray(items) || items.length !== legacyExpenseCategoryNames.length) return false;
  const names = items.map((item) => item.name).sort();
  return names.every((name, index) => name === [...legacyExpenseCategoryNames].sort()[index])
    && items.every((item) => !item.children?.length);
}

async function loadCategories() {
  try {
    const database = await openDatabase();
    const stored = await readDatabaseCategories(database);
    const legacy = readLegacyCategories();
    for (const type of ["expense", "income"]) {
      const record = stored.find((item) => item.type === type);
      const savedItems = record?.items || legacy[type] || defaultCategories[type];
      const shouldMigrateExpenses = type === "expense" && isLegacyExpenseCategoryTree(savedItems);
      categories[type] = shouldMigrateExpenses ? defaultCategories.expense : savedItems;
      if (!record || shouldMigrateExpenses) await writeDatabaseCategory(database, type);
    }
    localStorage.removeItem(CATEGORY_STORAGE_KEY);
  } catch {
    const legacy = readLegacyCategories();
    categories = {
      expense: legacy.expense || defaultCategories.expense,
      income: legacy.income || defaultCategories.income
    };
  }
}

async function saveCategoryTree(type) {
  try {
    const database = await openDatabase();
    await writeDatabaseCategory(database, type);
    localStorage.removeItem(CATEGORY_STORAGE_KEY);
    return true;
  } catch {
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
      return true;
    } catch {
      elements.categoryFeedback.textContent = "Could not save categories in this browser.";
      return false;
    }
  }
}

function writeDatabaseTransactions(database, items) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TRANSACTION_STORE, "readwrite");
    const store = transaction.objectStore(TRANSACTION_STORE);
    store.clear();
    items.forEach((item) => store.put(item));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Database write was cancelled"));
  });
}

async function loadTransactions() {
  try {
    const database = await openDatabase();
    const saved = await readDatabaseTransactions(database);
    if (saved.length === 0) {
      const legacy = readLegacyTransactions();
      if (legacy.length > 0) {
        await writeDatabaseTransactions(database, legacy);
        localStorage.removeItem(STORAGE_KEY);
        return legacy;
      }
    }
    return saved;
  } catch {
    return readLegacyTransactions();
  }
}

async function saveTransactions() {
  try {
    const database = await openDatabase();
    await writeDatabaseTransactions(database, transactions);
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch {
      elements.feedback.textContent = "Could not save in this browser. Check storage settings.";
      return false;
    }
  }
}

function createFullBackup() {
  return {
    format: "money-manager-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    transactions,
    categories,
    accountGroups
  };
}

function validateFullBackup(backup) {
  if (!backup || backup.format !== "money-manager-backup" || backup.version !== 1) throw new Error("This is not a supported Money Manager backup file.");
  if (!Array.isArray(backup.transactions) || !Array.isArray(backup.accountGroups)) throw new Error("The backup is missing transactions or account groups.");
  if (!backup.categories || !Array.isArray(backup.categories.expense) || !Array.isArray(backup.categories.income)) throw new Error("The backup has invalid category data.");
  const validTypes = ["expense", "income", "transfer"];
  for (const transaction of backup.transactions) {
    if (!transaction || !validTypes.includes(transaction.type) || !Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0 || !transaction.description || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date || "")) {
      throw new Error("The backup contains an invalid transaction.");
    }
  }
  for (const group of backup.accountGroups) {
    if (!group || typeof group.name !== "string" || !Array.isArray(group.accounts)) throw new Error("The backup contains an invalid account group.");
  }
}

async function persistFullBackup() {
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([TRANSACTION_STORE, CATEGORY_STORE, ACCOUNT_STORE], "readwrite");
      const transactionStore = transaction.objectStore(TRANSACTION_STORE);
      const categoryStore = transaction.objectStore(CATEGORY_STORE);
      const accountStore = transaction.objectStore(ACCOUNT_STORE);
      transactionStore.clear();
      categoryStore.clear();
      accountStore.clear();
      transactions.forEach((item) => transactionStore.put(item));
      ["expense", "income"].forEach((type) => categoryStore.put({ type, items: categories[type] }));
      accountGroups.forEach((group) => accountStore.put(group));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Restore was cancelled"));
    });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CATEGORY_STORAGE_KEY);
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    database.close();
    return true;
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accountGroups));
      return true;
    } catch {
      return false;
    }
  }
}

function downloadFile(filename, content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const transactionCsvColumns = [
  "type", "amount", "description", "category", "categoryId", "subcategory", "subcategoryId",
  "detailCategory", "detailCategoryId", "account", "accountId", "destination", "destinationId",
  "date", "time", "createdAt"
];

function createTransactionsCsv(items) {
  const rows = [transactionCsvColumns, ...items.map((transaction) => transactionCsvColumns.map((key) => transaction[key] ?? ""))];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV has no transaction rows.");
  const headers = rows[0].map((header) => header.trim());
  for (const required of ["type", "amount", "description", "date"]) {
    if (!headers.includes(required)) throw new Error(`The CSV is missing the required "${required}" column.`);
  }
  return rows.slice(1).map((cells, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, cells[column] || ""]));
    const type = record.type.trim().toLowerCase();
    const amount = Number(record.amount);
    if (!["expense", "income", "transfer"].includes(type)) throw new Error(`Row ${index + 2}: type must be expense, income, or transfer.`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Row ${index + 2}: amount must be greater than zero.`);
    if (!record.description.trim()) throw new Error(`Row ${index + 2}: description is required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date.trim())) throw new Error(`Row ${index + 2}: date must use YYYY-MM-DD format.`);
    return { ...record, type, amount, description: record.description.trim() };
  });
}

function resolveImportedAccountId(id, name) {
  const allAccounts = accountGroups.flatMap((group) => group.accounts);
  return allAccounts.some((account) => account.id === id) ? id : allAccounts.find((account) => account.name === name)?.id || "";
}

function resolveImportedCategoryId(type, id, name) {
  return findCategoryLocation(type, id)?.node.id || findCategoryIdByName(type, name);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const toggle = document.querySelector("#theme-toggle");
  toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  toggle.title = `Switch to ${isDark ? "light" : "dark"} theme`;
  toggle.firstElementChild.textContent = isDark ? "☀" : "☾";
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPeriodRange() {
  const today = new Date();
  if (selectedPeriod === "custom") {
    const start = elements.periodStart.value;
    const end = elements.periodEnd.value;
    if (!start || !end || start > end) return null;
    return { start, end };
  }
  if (selectedPeriod === "year") {
    return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` };
  }
  if (selectedPeriod === "week") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysSinceMonday = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - daysSinceMonday);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { start: localDateString(startDate), end: localDateString(endDate) };
  }
  return {
    start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
    end: localDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  };
}

function formatPeriodDate(dateString, includeYear = false) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(includeYear ? { year: "numeric" } : {}) }).format(date);
}

function updatePeriodControl() {
  selectedPeriod = elements.periodSelect.value;
  elements.customPeriod.classList.toggle("hidden", selectedPeriod !== "custom");
  if (selectedPeriod === "custom") {
    const today = todayString();
    if (!elements.periodStart.value || !elements.periodEnd.value) {
      const currentRange = getMonthRange();
      elements.periodStart.value ||= currentRange.start;
      elements.periodEnd.value ||= today;
    }
  }
  const periodName = selectedPeriod === "custom" ? "selected period" : `this ${selectedPeriod}`;
  document.querySelector("#income-title").textContent = `Income ${periodName}`;
  document.querySelector("#expense-title").textContent = `Expenses ${periodName}`;
  const range = getPeriodRange();
  if (!range) {
    elements.periodRangeLabel.textContent = "Choose valid dates";
    return;
  }
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  elements.periodRangeLabel.textContent = selectedPeriod === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${todayString().slice(0, 7)}-01T12:00:00`))
    : selectedPeriod === "year"
      ? range.start.slice(0, 4)
      : `${formatPeriodDate(range.start, !sameYear)} – ${formatPeriodDate(range.end, true)}`;
}

function getMonthRange() {
  const today = new Date();
  return {
    start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
    end: localDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  };
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatTime(timeString) {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function findCategoryLocation(type, id, items = categories[type], depth = 0) {
  for (const item of items) {
    if (item.id === id) return { node: item, list: items, depth };
    const nested = findCategoryLocation(type, id, item.children || [], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function getCategoryName(type, id, fallback) {
  return id ? findCategoryLocation(type, id)?.node.name || fallback : fallback;
}

function getCategoryIcon(type, id) {
  return id ? findCategoryLocation(type, id)?.node.icon || "" : "";
}

function findCategoryIdByName(type, name, items = categories[type]) {
  for (const item of items || []) {
    if (item.name === name) return item.id;
    const nestedId = findCategoryIdByName(type, name, item.children || []);
    if (nestedId) return nestedId;
  }
  return "";
}

function transactionCategoryLabel(transaction) {
  return [
    [transaction.categoryId, transaction.category],
    [transaction.subcategoryId, transaction.subcategory],
    [transaction.detailCategoryId, transaction.detailCategory]
  ].map(([id, fallback]) => {
    const name = getCategoryName(transaction.type, id, fallback);
    return name ? `${getCategoryIcon(transaction.type, id)} ${name}`.trim() : "";
  }).filter(Boolean).join(" / ") || "Transfer";
}

const categoryManager = window.createCategoryManager({
  elements,
  getCategories: () => categories,
  getDefaultCategories: () => defaultCategories,
  getActiveTab: () => activeTab,
  findCategoryLocation,
  saveCategoryTree,
  createId,
  onCategoriesChanged: () => renderTransactions()
});
const accountManager = window.createAccountManager({
  elements,
  getGroups: () => accountGroups,
  createId,
  saveGroups: saveAccountGroups,
  onGroupsChanged: () => {
    renderTransactions();
    updateSummary();
  }
});

function setView(view) {
  activeView = view;
  const isHome = view === "home";
  document.querySelector("#accounts-overview").classList.toggle("hidden", !isHome);
  document.querySelector("#transaction-workspace").classList.toggle("hidden", isHome);
  document.querySelectorAll("[data-view]").forEach((button) => {
    const selected = isHome;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".nav-link[data-tab]").forEach((button) => {
    const selected = !isHome && button.dataset.tab === activeTab;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (isHome) {
    document.querySelector("#breadcrumb-label").textContent = "Overview";
    document.querySelector("#page-title").innerHTML = 'Overview<span class="title-period">.</span>';
    document.querySelector(".page-subtitle").textContent = "Your accounts, balances, and the bigger picture.";
  } else {
    document.querySelector("#breadcrumb-label").textContent = tabLabels[activeTab];
    document.querySelector("#page-title").innerHTML = `${tabLabels[activeTab]}<span class="title-period">.</span>`;
    document.querySelector(".page-subtitle").textContent = "Keep the small things in view. The big picture takes care of itself.";
  }
}

function getAccountBalances() {
  const balances = accountGroups.flatMap((group) => group.accounts.map((account) => ({
    ...account,
    groupId: group.id,
    groupName: group.name,
    balance: Number(account.openingBalance) || 0
  })));
  const findAccount = (id, legacyName) => balances.find((account) => account.id === id)
    || balances.find((account) => account.name === legacyName);

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const source = findAccount(transaction.accountId, transaction.account);
    const destination = findAccount(transaction.destinationId, transaction.destination);
    if (transaction.type === "income" && source) source.balance += amount;
    if (transaction.type === "expense" && source) source.balance -= amount;
    if (transaction.type === "transfer") {
      if (source) source.balance -= amount;
      if (destination) destination.balance += amount;
    }
  });
  return balances;
}

function renderOverviewAccounts() {
  const balances = getAccountBalances();
  elements.overviewAccountGroups.replaceChildren();
  if (!accountGroups.length) {
    const empty = document.createElement("p");
    empty.className = "overview-empty";
    empty.textContent = "Add an account to start tracking its balance.";
    elements.overviewAccountGroups.append(empty);
    return;
  }

  accountGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "overview-account-group";
    const header = document.createElement("div");
    header.className = "overview-group-heading";
    const identity = document.createElement("div");
    identity.className = "overview-group-identity";
    const icon = document.createElement("span");
    icon.className = "overview-group-icon";
    icon.textContent = group.icon || "•";
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("h3");
    title.textContent = group.name;
    identity.append(icon, title);
    const groupTotal = balances.filter((account) => account.groupId === group.id).reduce((total, account) => total + account.balance, 0);
    const total = document.createElement("span");
    total.className = "overview-group-total";
    total.textContent = formatMoney(groupTotal);
    header.append(identity, total);
    const list = document.createElement("div");
    list.className = "overview-account-list";
    if (!group.accounts.length) {
      const empty = document.createElement("p");
      empty.className = "overview-empty";
      empty.textContent = "No accounts in this group.";
      list.append(empty);
    }
    group.accounts.forEach((account) => {
      const row = document.createElement("div");
      row.className = "overview-account-row";
      const name = document.createElement("span");
      name.className = "overview-account-name";
      name.textContent = account.name;
      const value = document.createElement("span");
      value.className = "overview-account-balance";
      value.textContent = formatMoney(balances.find((item) => item.id === account.id)?.balance || 0);
      row.append(name, value);
      list.append(row);
    });
    section.append(header, list);
    elements.overviewAccountGroups.append(section);
  });
}

function setTab(tab) {
  if (editingTransactionId) {
    const editingTransaction = transactions.find((item) => item.id === editingTransactionId);
    if (editingTransaction && editingTransaction.type !== tab) cancelTransactionEdit();
  }
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("active", selected);
    if (button.matches("[role='tab']")) button.setAttribute("aria-selected", String(selected));
    if (button.matches(".nav-link")) {
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });

  const title = tabLabels[tab];
  document.querySelector("#breadcrumb-label").textContent = title;
  document.querySelector("#page-title").innerHTML = `${title}<span class="title-period">.</span>`;
  document.querySelector("#activity-title").textContent = `Recent ${title.toLowerCase()}`;
  document.querySelector("#submit-label").textContent = `Add ${transactionNames[tab]}`;
  elements.descriptionLabel.textContent = tab === "transfer" ? "What is the transfer for?" : tab === "income" ? "Where did it come from?" : "What was it for?";
  elements.accountLabel.textContent = tab === "transfer" ? "Move from" : tab === "income" ? "Deposit to" : "Paid from";
  elements.categoryField.classList.toggle("hidden", tab === "transfer");
  elements.category.required = tab !== "transfer";
  elements.destinationField.classList.toggle("hidden", tab !== "transfer");
  elements.description.placeholder = tab === "transfer" ? "e.g. Move to savings" : tab === "income" ? "e.g. Monthly salary" : "e.g. Weekly groceries";
  elements.activityViewSwitch.classList.toggle("hidden", tab === "transfer");
  accountManager.refreshSelects();
  if (tab !== "transfer") categoryManager.refreshSelects();
  elements.feedback.textContent = "";
  renderTransactions();
}

function getPeriodTotals() {
  const range = getPeriodRange();
  return transactions.reduce((totals, transaction) => {
    if (!range || transaction.date < range.start || transaction.date > range.end) return totals;
    if (transaction.type === "income") totals.income += Number(transaction.amount) || 0;
    if (transaction.type === "expense") totals.expense += Number(transaction.amount) || 0;
    return totals;
  }, { income: 0, expense: 0 });
}

function updateSummary() {
  const totals = getPeriodTotals();
  const netWorth = getAccountBalances().reduce((sum, account) => sum + account.balance, 0);
  document.querySelector("#balance-total").textContent = formatMoney(netWorth);
  document.querySelector("#income-total").textContent = formatMoney(totals.income);
  document.querySelector("#expense-total").textContent = formatMoney(totals.expense);
  for (const type of Object.keys(tabLabels)) {
    document.querySelector(`#${type}-count`).textContent = transactions.filter((transaction) => transaction.type === type).length;
  }
  renderOverviewAccounts();
}

function createTransactionRow(transaction) {
  const row = document.createElement("div");
  row.className = "transaction-row";
  const main = document.createElement("div");
  main.className = "transaction-main";
  const icon = document.createElement("span");
  icon.className = `transaction-icon ${transaction.type}`;
  icon.textContent = icons[transaction.type];
  icon.setAttribute("aria-hidden", "true");
  const details = document.createElement("div");
  details.className = "transaction-details";
  const title = document.createElement("div");
  title.className = "transaction-description";
  title.textContent = transaction.description;
  const account = document.createElement("div");
  account.className = "transaction-account";
  const sourceAccount = accountManager.getAccountName(transaction.accountId, transaction.account);
  const destinationAccount = accountManager.getAccountName(transaction.destinationId, transaction.destination);
  account.textContent = transaction.type === "transfer" ? `${sourceAccount} to ${destinationAccount}` : sourceAccount;
  details.append(title, account);
  main.append(icon, details);

  const category = document.createElement("div");
  category.className = "transaction-category";
  category.textContent = transactionCategoryLabel(transaction);
  const date = document.createElement("div");
  date.className = "transaction-date";
  const dateLabel = document.createElement("span");
  dateLabel.textContent = formatDate(transaction.date);
  date.append(dateLabel);
  if (transaction.time) {
    const timeLabel = document.createElement("span");
    timeLabel.className = "transaction-time";
    timeLabel.textContent = formatTime(transaction.time);
    date.append(timeLabel);
  }
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const amount = document.createElement("div");
  amount.className = `transaction-amount${transaction.type === "income" ? " positive" : ""}`;
  amount.textContent = `${transaction.type === "income" ? "+" : transaction.type === "expense" ? "−" : ""}${formatMoney(transaction.amount)}`;
  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Delete ${transaction.description}`);
  remove.addEventListener("click", async () => {
    if (editingTransactionId === transaction.id) cancelTransactionEdit();
    transactions = transactions.filter((item) => item.id !== transaction.id);
    await saveTransactions();
    renderTransactions();
    updateSummary();
  });
  const edit = document.createElement("button");
  edit.className = "edit-button";
  edit.type = "button";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", `Edit ${transaction.description}`);
  edit.title = "Edit transaction";
  edit.addEventListener("click", () => editTransaction(transaction));
  actions.append(amount);
  if (transaction.type === "expense" || transaction.type === "income") {
    const duplicate = document.createElement("button");
    duplicate.className = "duplicate-button";
    duplicate.type = "button";
    duplicate.textContent = "⧉";
    duplicate.setAttribute("aria-label", `Duplicate ${transaction.description}`);
    duplicate.title = "Duplicate transaction";
    duplicate.addEventListener("click", () => duplicateTransaction(transaction));
    actions.append(duplicate);
  }
  actions.append(edit, remove);
  row.append(main, category, date, actions);
  return row;
}

function editTransaction(transaction) {
  duplicatingTransaction = false;
  editingTransactionId = transaction.id;
  setTab(transaction.type);
  elements.amount.value = transaction.amount;
  elements.description.value = transaction.description;
  elements.date.value = transaction.date;
  elements.time.value = transaction.time || "12:00";
  accountManager.selectAccounts(transaction.accountId || "", transaction.destinationId || "", transaction.account, transaction.destination);
  if (transaction.type !== "transfer") {
    categoryManager.selectPath(
      transaction.categoryId || findCategoryIdByName(transaction.type, transaction.category),
      transaction.subcategoryId || findCategoryIdByName(transaction.type, transaction.subcategory),
      transaction.detailCategoryId || findCategoryIdByName(transaction.type, transaction.detailCategory)
    );
  }
  elements.submitLabel.textContent = `Update ${transactionNames[transaction.type]}`;
  elements.cancelEdit.classList.remove("hidden");
  elements.feedback.textContent = `Editing: ${transaction.description}`;
  elements.amount.focus();
  document.querySelector(".entry-panel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function duplicateTransaction(transaction) {
  editTransaction(transaction);
  editingTransactionId = null;
  duplicatingTransaction = true;
  elements.submitLabel.textContent = `Add duplicate ${transactionNames[transaction.type]}`;
  elements.feedback.textContent = `Ready to duplicate: ${transaction.description}`;
}

function cancelTransactionEdit() {
  editingTransactionId = null;
  duplicatingTransaction = false;
  elements.form.reset();
  elements.date.value = todayString();
  elements.time.value = currentTimeString();
  accountManager.refreshSelects();
  if (activeTab !== "transfer") categoryManager.refreshSelects();
  elements.submitLabel.textContent = `Add ${transactionNames[activeTab]}`;
  elements.cancelEdit.classList.add("hidden");
  elements.feedback.textContent = "";
}

function renderTransactions() {
  const query = elements.search.value.trim().toLowerCase();
  const range = getPeriodRange();
  const visible = transactions
    .filter((transaction) => transaction.type === activeTab)
    .filter((transaction) => range && transaction.date >= range.start && transaction.date <= range.end)
    .filter((transaction) => [transaction.description, transactionCategoryLabel(transaction), accountManager.getAccountName(transaction.accountId, transaction.account), accountManager.getAccountName(transaction.destinationId, transaction.destination)].filter(Boolean).join(" ").toLowerCase().includes(query))
    .sort((first, second) => second.date.localeCompare(first.date) || (second.time || "").localeCompare(first.time || "") || second.createdAt - first.createdAt);
  elements.list.replaceChildren();
  elements.list.classList.toggle("hidden", activityDisplay === "pie" && activeTab !== "transfer");
  elements.chart.classList.toggle("hidden", activityDisplay !== "pie" || activeTab === "transfer");
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const illustration = document.createElement("span");
    illustration.className = "empty-illustration";
    illustration.textContent = icons[activeTab];
    illustration.setAttribute("aria-hidden", "true");
    const heading = document.createElement("h3");
    heading.textContent = query ? "Nothing found" : `No ${tabLabels[activeTab].toLowerCase()} yet`;
    const message = document.createElement("p");
    message.textContent = query ? "Try a different search, or clear the search field." : `Your ${tabLabels[activeTab].toLowerCase()} will show up here once you add your first one.`;
    empty.append(illustration, heading, message);
    if (activityDisplay === "pie" && activeTab !== "transfer") {
      renderCategoryPieChart(visible);
    } else {
      elements.list.append(empty);
    }
    return;
  }
  if (activityDisplay === "pie" && activeTab !== "transfer") renderCategoryPieChart(visible);
  else elements.list.append(...visible.map(createTransactionRow));
}

function renderCategoryPieChart(visibleTransactions) {
  const palette = ["#2f8064", "#e07a54", "#4f88a0", "#d2a843", "#7b709b", "#6d9a4d", "#c35773", "#568d91", "#b07846", "#78828d"];
  const totals = new Map();
  visibleTransactions.forEach((transaction) => {
    const label = transactionCategoryLabel(transaction);
    totals.set(label, (totals.get(label) || 0) + (Number(transaction.amount) || 0));
  });
  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  elements.chart.replaceChildren();
  if (!total) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No amounts to chart for this period.";
    elements.chart.append(empty);
    return;
  }

  let currentPercent = 0;
  const segments = entries.map(([label, amount], index) => {
    const percent = amount / total * 100;
    const segment = `${palette[index % palette.length]} ${currentPercent}% ${currentPercent + percent}%`;
    currentPercent += percent;
    return { label, amount, percent, color: palette[index % palette.length], segment };
  });
  const chartLayout = document.createElement("div");
  chartLayout.className = "category-chart-layout";
  const pie = document.createElement("div");
  pie.className = "category-pie";
  pie.style.background = `conic-gradient(${segments.map((item) => item.segment).join(", ")})`;
  pie.setAttribute("role", "img");
  pie.setAttribute("aria-label", `${activeTab === "income" ? "Income" : "Expense"} by category, total ${formatMoney(total)}`);
  const pieTotal = document.createElement("div");
  pieTotal.className = "category-pie-total";
  const pieTotalValue = document.createElement("strong");
  pieTotalValue.textContent = formatMoney(total);
  const pieTotalLabel = document.createElement("span");
  pieTotalLabel.textContent = activeTab === "income" ? "Income" : "Expenses";
  pieTotal.append(pieTotalValue, pieTotalLabel);
  pie.append(pieTotal);
  const legend = document.createElement("div");
  legend.className = "category-pie-legend";
  segments.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "category-legend-row";
    const identity = document.createElement("div");
    identity.className = "category-legend-identity";
    const swatch = document.createElement("span");
    swatch.className = "category-legend-swatch";
    swatch.style.backgroundColor = entry.color;
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "category-legend-label";
    label.textContent = entry.label;
    identity.append(swatch, label);
    const values = document.createElement("div");
    values.className = "category-legend-values";
    const amount = document.createElement("strong");
    amount.textContent = formatMoney(entry.amount);
    const percent = document.createElement("span");
    percent.textContent = `${entry.percent.toFixed(1)}%`;
    values.append(amount, percent);
    row.append(identity, values);
    legend.append(row);
  });
  chartLayout.append(pie, legend);
  elements.chart.append(chartLayout);
}

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
  setTab(button.dataset.tab);
  setView("transactions");
}));
document.querySelector("[data-view='home']").addEventListener("click", () => setView("home"));
document.querySelector("#overview-manage-accounts").addEventListener("click", () => document.querySelector("#manage-accounts").click());
document.querySelector("#open-settings").addEventListener("click", () => {
  elements.settingsFeedback.textContent = "";
  elements.settingsDialog.showModal();
});
document.querySelector("#close-settings").addEventListener("click", () => elements.settingsDialog.close());
document.querySelector("#settings-categories").addEventListener("click", () => {
  elements.settingsDialog.close();
  document.querySelector("#manage-categories").click();
});
document.querySelector("#settings-accounts").addEventListener("click", () => {
  elements.settingsDialog.close();
  document.querySelector("#manage-accounts").click();
});
document.querySelector("#download-backup").addEventListener("click", () => {
  const date = todayString();
  downloadFile(`money-manager-backup-${date}.json`, JSON.stringify(createFullBackup(), null, 2), "application/json");
  elements.settingsFeedback.textContent = "Full backup downloaded.";
});
document.querySelector("#restore-backup").addEventListener("click", () => elements.backupFileInput.click());
elements.backupFileInput.addEventListener("change", async () => {
  const file = elements.backupFileInput.files?.[0];
  elements.backupFileInput.value = "";
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    validateFullBackup(backup);
    if (!window.confirm(`Restore ${backup.transactions.length} transactions and replace all current categories and accounts? This cannot be undone.`)) return;
    const previous = { transactions, categories, accountGroups, theme: document.documentElement.dataset.theme };
    transactions = backup.transactions.map((transaction) => ({ ...transaction, id: transaction.id || createId(), amount: Number(transaction.amount) }));
    categories = backup.categories;
    accountGroups = backup.accountGroups.map((group) => ({
      ...group,
      accounts: group.accounts.map((account) => ({ ...account, openingBalance: Number(account.openingBalance) || 0 }))
    }));
    const saved = await persistFullBackup();
    if (!saved) {
      transactions = previous.transactions;
      categories = previous.categories;
      accountGroups = previous.accountGroups;
      setTheme(previous.theme);
      throw new Error("Could not save the restored data. Existing in-memory data was kept.");
    }
    setTheme(backup.theme === "dark" ? "dark" : "light");
    localStorage.setItem(THEME_KEY, backup.theme === "dark" ? "dark" : "light");
    if (editingTransactionId) cancelTransactionEdit();
    accountManager.refreshSelects();
    categoryManager.refreshSelects();
    updateSummary();
    renderTransactions();
    elements.settingsFeedback.textContent = `Restored ${transactions.length} transactions and app settings.`;
  } catch (error) {
    elements.settingsFeedback.textContent = error instanceof SyntaxError ? "Could not read that JSON backup file." : error.message;
  }
});
document.querySelector("#export-transactions-csv").addEventListener("click", () => {
  downloadFile(`money-manager-transactions-${todayString()}.csv`, createTransactionsCsv(transactions), "text/csv;charset=utf-8");
  elements.settingsFeedback.textContent = `Exported ${transactions.length} transactions as CSV.`;
});
document.querySelector("#import-transactions-csv").addEventListener("click", () => elements.csvFileInput.click());
elements.csvFileInput.addEventListener("change", async () => {
  const file = elements.csvFileInput.files?.[0];
  elements.csvFileInput.value = "";
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    const imported = rows.map((row, index) => {
      if (row.type === "transfer" && !row.destination.trim()) throw new Error(`Row ${index + 2}: destination account is required for transfers.`);
      if (!row.account?.trim()) throw new Error(`Row ${index + 2}: account is required.`);
      const time = row.time?.trim() || "12:00";
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`Row ${index + 2}: time must use HH:MM format.`);
      const type = row.type;
      return {
        id: createId(),
        type,
        amount: row.amount,
        description: row.description,
        category: row.category || (type === "transfer" ? "Transfer" : ""),
        categoryId: type === "transfer" ? "" : resolveImportedCategoryId(type, row.categoryId, row.category),
        subcategory: row.subcategory || "",
        subcategoryId: type === "transfer" ? "" : resolveImportedCategoryId(type, row.subcategoryId, row.subcategory),
        detailCategory: row.detailCategory || "",
        detailCategoryId: type === "transfer" ? "" : resolveImportedCategoryId(type, row.detailCategoryId, row.detailCategory),
        account: row.account.trim(),
        accountId: resolveImportedAccountId(row.accountId, row.account.trim()),
        destination: row.destination?.trim() || "",
        destinationId: resolveImportedAccountId(row.destinationId, row.destination?.trim() || ""),
        date: row.date.trim(),
        time,
        createdAt: Number(row.createdAt) || Date.now() + index
      };
    });
    const previousTransactions = transactions;
    transactions = [...transactions, ...imported];
    const saved = await saveTransactions();
    if (!saved) {
      transactions = previousTransactions;
      renderTransactions();
      updateSummary();
      throw new Error("Could not save imported transactions. Existing transactions were kept.");
    }
    renderTransactions();
    updateSummary();
    elements.settingsFeedback.textContent = `Imported ${imported.length} transactions from CSV.`;
  } catch (error) {
    elements.settingsFeedback.textContent = error.message;
  }
});

function cloneCategoryDefaults(items) {
  return items.map((item) => ({
    ...item,
    id: createId(),
    children: cloneCategoryDefaults(item.children || [])
  }));
}

async function resetApplication() {
  if (!window.confirm("Reset the entire app? This will permanently delete all transactions and restore default categories, account groups, and the light theme.")) return;
  if (editingTransactionId) cancelTransactionEdit();
  transactions = [];
  categories = {
    expense: cloneCategoryDefaults(defaultCategories.expense),
    income: cloneCategoryDefaults(defaultCategories.income)
  };
  accountGroups = defaultAccountGroups.map((group) => ({
    ...group,
    id: createId(),
    accounts: group.accounts.map((account) => ({ ...account, id: createId() }))
  }));

  const results = await Promise.all([
    saveTransactions(),
    saveCategoryTree("expense"),
    saveCategoryTree("income"),
    saveAccountGroups()
  ]);
  if (results.some((saved) => !saved)) {
    elements.settingsFeedback.textContent = "Some defaults could not be saved. Check browser storage settings.";
    return;
  }

  localStorage.setItem(THEME_KEY, "light");
  setTheme("light");
  elements.periodSelect.value = "month";
  elements.periodStart.value = "";
  elements.periodEnd.value = "";
  updatePeriodControl();
  accountManager.refreshSelects();
  categoryManager.refreshSelects();
  activeTab = "expense";
  setTab(activeTab);
  setView("home");
  updateSummary();
  renderTransactions();
  elements.settingsFeedback.textContent = "App reset complete.";
  elements.settingsDialog.close();
}

document.querySelector("#reset-application").addEventListener("click", resetApplication);
elements.search.addEventListener("input", renderTransactions);
document.querySelectorAll("[data-activity-view]").forEach((button) => button.addEventListener("click", () => {
  activityDisplay = button.dataset.activityView;
  document.querySelectorAll("[data-activity-view]").forEach((option) => {
    const selected = option.dataset.activityView === activityDisplay;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
  renderTransactions();
}));
elements.periodSelect.addEventListener("change", () => {
  updatePeriodControl();
  updateSummary();
  renderTransactions();
});
elements.periodStart.addEventListener("input", () => {
  updatePeriodControl();
  updateSummary();
  renderTransactions();
});
elements.periodEnd.addEventListener("input", () => {
  updatePeriodControl();
  updateSummary();
  renderTransactions();
});
categoryManager.bindEvents();
accountManager.bindEvents();
elements.cancelEdit.addEventListener("click", cancelTransactionEdit);
elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(elements.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    elements.feedback.textContent = "Enter an amount greater than zero.";
    elements.amount.focus();
    return;
  }
  if (!elements.account.value || (activeTab === "transfer" && !elements.destination.value)) {
    elements.feedback.textContent = "Add an account before recording a transaction.";
    return;
  }
  if (activeTab === "transfer" && elements.account.value === elements.destination.value) {
    elements.feedback.textContent = "Choose two different accounts for a transfer.";
    elements.destination.focus();
    return;
  }
  const existingTransaction = editingTransactionId ? transactions.find((item) => item.id === editingTransactionId) : null;
  const isDuplicate = duplicatingTransaction;
  const transaction = {
    id: existingTransaction?.id || createId(),
    type: activeTab,
    amount,
    description: elements.description.value.trim(),
    category: activeTab === "transfer" ? "Transfer" : findCategoryLocation(activeTab, elements.category.value)?.node.name || "",
    categoryId: activeTab === "transfer" ? "" : elements.category.value,
    subcategory: activeTab === "transfer" ? "" : findCategoryLocation(activeTab, elements.subcategory.value)?.node.name || "",
    subcategoryId: activeTab === "transfer" ? "" : elements.subcategory.value,
    detailCategory: activeTab === "transfer" ? "" : findCategoryLocation(activeTab, elements.detailCategory.value)?.node.name || "",
    detailCategoryId: activeTab === "transfer" ? "" : elements.detailCategory.value,
    account: accountManager.getAccountName(elements.account.value),
    accountId: elements.account.value,
    destination: activeTab === "transfer" ? accountManager.getAccountName(elements.destination.value) : "",
    destinationId: activeTab === "transfer" ? elements.destination.value : "",
    date: elements.date.value,
    time: elements.time.value,
    createdAt: existingTransaction?.createdAt || Date.now()
  };
  if (!transaction.description || !transaction.date || !transaction.time) {
    elements.feedback.textContent = "Add a description, date, and time to continue.";
    return;
  }
  const existingIndex = transactions.findIndex((item) => item.id === transaction.id);
  if (existingIndex >= 0) transactions[existingIndex] = transaction;
  else transactions.push(transaction);
  const saved = await saveTransactions();
  if (!saved) {
    if (existingTransaction) {
      transactions[existingIndex] = existingTransaction;
      editTransaction(existingTransaction);
    } else {
      transactions = transactions.filter((item) => item.id !== transaction.id);
    }
    renderTransactions();
    updateSummary();
    elements.feedback.textContent = "Could not save in this browser. Check storage settings.";
    return;
  }
  if (saved) {
    editingTransactionId = null;
    duplicatingTransaction = false;
    elements.submitLabel.textContent = `Add ${transactionNames[activeTab]}`;
    elements.cancelEdit.classList.add("hidden");
  }
  elements.form.reset();
  elements.date.value = todayString();
  elements.time.value = currentTimeString();
  accountManager.refreshSelects();
  elements.feedback.textContent = saved ? `${existingTransaction ? "Updated" : isDuplicate ? "Duplicate added" : "Added"} in your ledger.` : "Could not save in this browser. Check storage settings.";
  elements.amount.focus();
  renderTransactions();
  updateSummary();
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
setTheme(localStorage.getItem(THEME_KEY) || "light");
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  setTheme(nextTheme);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});
elements.date.value = todayString();
elements.time.value = currentTimeString();
async function initialize() {
  await loadCategories();
  await loadAccountGroups();
  transactions = await loadTransactions();
  updatePeriodControl();
  accountManager.refreshSelects();
  updateSummary();
  setTab(activeTab);
  setView("home");
}

initialize();