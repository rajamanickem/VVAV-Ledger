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
    groups.forEach((group, index) => store.put({ ...group, order: index }));
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
    const hasSavedOrder = accountGroups.every((group) => typeof group.order === "number");
    accountGroups.sort((first, second) => {
      if (hasSavedOrder) return first.order - second.order;
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

