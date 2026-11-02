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
  document.querySelector(".summary-grid").classList.toggle("hidden", !isHome);
  document.querySelector("#entry-toggle").classList.toggle("hidden", isHome);
  if (isHome) setEntryExpanded(false);
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
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `View activity for ${account.name}`);
      row.addEventListener("click", () => openAccountActivity(account.id));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAccountActivity(account.id);
        }
      });
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
  setEntryExpanded(true);
}

function setEntryExpanded(expanded) {
  document.querySelector(".entry-panel").classList.toggle("open", expanded);
  if (!expanded && entryReturnsToActivity) {
    entryReturnsToActivity = false;
    const workspace = document.querySelector("#transaction-workspace");
    workspace.classList.remove("overlay-only");
    workspace.classList.toggle("hidden", activeView === "home");
    if (activeView === "home") setView("home");
    reopenAccountActivity();
  }
}

document.querySelector("#entry-toggle").addEventListener("click", () => setEntryExpanded(true));
document.querySelector("#entry-close").addEventListener("click", () => setEntryExpanded(false));
elements.cancelEdit.addEventListener("click", () => setEntryExpanded(false));

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
  if (document.querySelector("#account-activity-dialog").open) renderAccountActivity();
  const query = elements.search.value.trim().toLowerCase();
  const range = getPeriodRange();
  const filterKey = `${activeTab}|${query}|${range?.start}|${range?.end}`;
  if (filterKey !== lastFilterKey) {
    lastFilterKey = filterKey;
    visibleLimit = TRANSACTION_PAGE_SIZE;
  }
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
  else {
    const shown = visible.slice(0, visibleLimit);
    elements.list.append(...shown.map(createTransactionRow));
    if (visible.length > shown.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "add-entry-button show-more-button";
      more.textContent = `Show more (${visible.length - shown.length} remaining)`;
      more.addEventListener("click", () => {
        visibleLimit += TRANSACTION_PAGE_SIZE;
        renderTransactions();
      });
      elements.list.append(more);
    }
  }
}

let selectedMainCategory = "";

function categoryLevelLabel(transaction, level) {
  const [id, fallback] = level === 0
    ? [transaction.categoryId, transaction.category]
    : [transaction.subcategoryId, transaction.subcategory];
  const name = getCategoryName(transaction.type, id, fallback);
  return name ? `${getCategoryIcon(transaction.type, id)} ${name}`.trim() : "";
}

function renderCategoryPieChart(visibleTransactions) {
  const mainTotals = new Map();
  const subTotalsByMain = new Map();
  visibleTransactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const main = categoryLevelLabel(transaction, 0) || "Uncategorized";
    const sub = categoryLevelLabel(transaction, 1) || "No subcategory";
    mainTotals.set(main, (mainTotals.get(main) || 0) + amount);
    if (!subTotalsByMain.has(main)) subTotalsByMain.set(main, new Map());
    const subTotals = subTotalsByMain.get(main);
    subTotals.set(sub, (subTotals.get(sub) || 0) + amount);
  });
  const mainEntries = [...mainTotals.entries()].sort((first, second) => second[1] - first[1]);
  elements.chart.replaceChildren();
  if (!mainEntries.reduce((sum, entry) => sum + entry[1], 0)) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No amounts to chart for this period.";
    elements.chart.append(empty);
    return;
  }
  // Fall back to the largest category when nothing (or a stale category) is selected.
  const selected = mainTotals.has(selectedMainCategory) ? selectedMainCategory : mainEntries[0][0];
  const subEntries = [...subTotalsByMain.get(selected).entries()].sort((first, second) => second[1] - first[1]);
  const kind = activeTab === "income" ? "Income" : "Expenses";
  const mainHeading = document.createElement("h3");
  mainHeading.className = "category-chart-heading";
  mainHeading.textContent = "By category";
  const subHeading = document.createElement("h3");
  subHeading.className = "category-chart-heading";
  subHeading.textContent = `Subcategories of ${selected}`;
  elements.chart.append(
    mainHeading,
    buildPieChart(mainEntries, kind, selected, (label) => {
      selectedMainCategory = label;
      renderCategoryPieChart(visibleTransactions);
    }),
    subHeading,
    buildPieChart(subEntries, selected, "", null)
  );
}

function buildPieChart(entries, totalLabel, selectedLabel, onSelect) {
  const palette = ["#2f8064", "#e07a54", "#4f88a0", "#d2a843", "#7b709b", "#6d9a4d", "#c35773", "#568d91", "#b07846", "#78828d"];
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  let currentPercent = 0;
  const segments = entries.map(([label, amount], index) => {
    const percent = amount / total * 100;
    const segment = `${palette[index % palette.length]} ${currentPercent}% ${currentPercent + percent}%`;
    currentPercent += percent;
    return { label, amount, percent, color: palette[index % palette.length], segment, end: currentPercent };
  });
  const chartLayout = document.createElement("div");
  chartLayout.className = "category-chart-layout";
  const pie = document.createElement("div");
  pie.className = "category-pie";
  pie.style.background = `conic-gradient(${segments.map((item) => item.segment).join(", ")})`;
  pie.setAttribute("role", "img");
  pie.setAttribute("aria-label", `${totalLabel} by category, total ${formatMoney(total)}`);
  const pieTotal = document.createElement("div");
  pieTotal.className = "category-pie-total";
  const pieTotalValue = document.createElement("strong");
  pieTotalValue.textContent = formatMoney(total);
  const pieTotalLabel = document.createElement("span");
  pieTotalLabel.textContent = totalLabel;
  pieTotal.append(pieTotalValue, pieTotalLabel);
  pie.append(pieTotal);
  if (onSelect) {
    pie.classList.add("selectable");
    pie.addEventListener("click", (event) => {
      const box = pie.getBoundingClientRect();
      const x = event.clientX - (box.left + box.width / 2);
      const y = event.clientY - (box.top + box.height / 2);
      if (Math.hypot(x, y) < box.width * 0.29) return;
      // Angle measured clockwise from the top, matching conic-gradient.
      const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
      const hit = segments.find((item) => angle / 360 * 100 < item.end);
      if (hit) onSelect(hit.label);
    });
  }
  const legend = document.createElement("div");
  legend.className = "category-pie-legend";
  segments.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "category-legend-row";
    if (entry.label === selectedLabel) row.classList.add("selected");
    if (onSelect) {
      row.classList.add("selectable");
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.addEventListener("click", () => onSelect(entry.label));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(entry.label);
        }
      });
    }
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
  return chartLayout;
}

