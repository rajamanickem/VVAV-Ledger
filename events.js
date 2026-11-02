document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
  elements.periodSelect.value = "month";
  periodOffset = 0;
  updatePeriodControl();
  updateSummary();
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
  periodOffset = 0;
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
elements.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderTransactions, 200);
});
document.querySelectorAll("[data-activity-view]").forEach((button) => button.addEventListener("click", () => {
  activityDisplay = button.dataset.activityView;
  document.querySelectorAll("[data-activity-view]").forEach((option) => {
    const selected = option.dataset.activityView === activityDisplay;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
  renderTransactions();
}));
function stepPeriod(delta) {
  periodOffset += delta;
  updatePeriodControl();
  updateSummary();
  renderTransactions();
}
document.querySelector("#period-prev").addEventListener("click", () => stepPeriod(-1));
["#jump-month", "#jump-year", "#jump-date"].forEach((selector) => document.querySelector(selector).addEventListener("change", jumpPeriod));
document.querySelector("#period-next").addEventListener("click", () => stepPeriod(1));
elements.periodSelect.addEventListener("change", () => {
  periodOffset = 0;
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
  elements.feedback.textContent = "";
  setEntryExpanded(false);
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
