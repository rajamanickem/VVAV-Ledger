function createFullBackup() {
  return {
    format: "money-manager-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    transactions,
    categories,
    accountGroups,
    budget: budgetPlan
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

