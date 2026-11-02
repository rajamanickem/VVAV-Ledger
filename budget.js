const BUDGET_STORAGE_KEY = "ledger-budget-v1";
const BUDGET_FREQUENCY_LABELS = { daily: "day", weekly: "week", weekend: "weekend", monthly: "month" };
let budgetPlan = { items: [] };
let editingBudgetId = null;
let activeBudgetTab = "summary";
let budgetFilter = "all";

function applyBudgetTab() {
  document.querySelector("#budget-onetime-panel").classList.toggle("hidden", activeBudgetTab !== "onetime");
  document.querySelector("#budget-results").classList.toggle("hidden", activeBudgetTab !== "plans");
  document.querySelector("#budget-filter-bar").classList.toggle("hidden", activeBudgetTab !== "plans" || !budgetPlan.items.length);
  document.querySelector("#budget-summary-panel").classList.toggle("hidden", activeBudgetTab !== "summary");
  document.querySelectorAll("[data-budget-tab]").forEach((button) => {
    const selected = button.dataset.budgetTab === activeBudgetTab;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
}

document.querySelector("#budget-filter").addEventListener("change", (event) => {
  budgetFilter = event.target.value;
  renderBudgetPlanner();
});
document.querySelectorAll("[data-budget-tab]").forEach((button) => button.addEventListener("click", () => {
  activeBudgetTab = button.dataset.budgetTab;
  applyBudgetTab();
}));

function normalizeBudgetPlan(plan) {
  const items = Array.isArray(plan?.items)
    ? plan.items.filter((item) => item && typeof item.accountId === "string" && typeof item.name === "string"
      && Number(item.amount) > 0 && item.frequency in BUDGET_FREQUENCY_LABELS)
      .map((item) => {
        const amount = Number(item.amount);
        const paidMonth = typeof item.paidMonth === "string" ? item.paidMonth : typeof item.doneMonth === "string" ? item.doneMonth : "";
        const paid = Number.isFinite(Number(item.paidAmount)) && item.paidAmount !== undefined ? Number(item.paidAmount) : item.doneMonth ? amount : 0;
        return { id: item.id || createId(), accountId: item.accountId, name: item.name, amount, frequency: item.frequency, paidMonth, paidAmount: paid, remarks: typeof item.remarks === "string" ? item.remarks : "" };
      })
    : [];
  return { items };
}

function loadBudgetPlan() {
  try {
    budgetPlan = normalizeBudgetPlan(JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY) || "null"));
  } catch {
    budgetPlan = normalizeBudgetPlan(null);
  }
}

function saveBudgetPlan() {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgetPlan));
    return true;
  } catch {
    document.querySelector("#budget-feedback").textContent = "Could not save the plan in this browser.";
    return false;
  }
}

function budgetElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getRemainingPeriod() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = lastDay - now.getDate() + 1;
  const weekends = new Set();
  for (let day = now.getDate(); day <= lastDay; day += 1) {
    const weekday = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    if (weekday === 6) weekends.add(day);
    if (weekday === 0) weekends.add(day - 1);
  }
  return { days, weeks: Math.ceil(days / 7), weekendDays: weekends.size };
}

function currentMonthKey() {
  return todayString().slice(0, 7);
}

function paidAmount(item) {
  if (item.frequency !== "monthly" || item.paidMonth !== currentMonthKey()) return 0;
  return Math.min(item.amount, Math.max(0, item.paidAmount));
}

function isBudgetItemDone(item) {
  return item.frequency === "monthly" && paidAmount(item) >= item.amount;
}

function monthlyEquivalent(item) {
  const period = getRemainingPeriod();
  if (item.frequency === "monthly") return item.amount - paidAmount(item);
  if (item.frequency === "daily") return item.amount * period.days;
  if (item.frequency === "weekly") return item.amount * period.weeks;
  if (item.frequency === "weekend") return item.amount * period.weekendDays;
  return item.amount;
}

function renderBudgetPlanner() {
  const validIds = new Set(accountGroups.flatMap((group) => group.accounts.map((account) => account.id)));
  budgetPlan.items = budgetPlan.items.filter((item) => validIds.has(item.accountId));
  const balances = getAccountBalances();

  const accountSelect = document.querySelector("#budget-account");
  const previous = accountSelect.value;
  accountSelect.replaceChildren(...accountGroups.filter((group) => group.accounts.length).map((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.name;
    group.accounts.forEach((account) => optgroup.append(new Option(account.name, account.id)));
    return optgroup;
  }));
  if (validIds.has(previous)) accountSelect.value = previous;

  const results = document.querySelector("#budget-results");
  const accountIds = [...new Set(budgetPlan.items.map((item) => item.accountId))];
  let totalBalance = 0;
  let totalNeeded = 0;
  const cards = accountIds.map((accountId) => {
    const account = balances.find((item) => item.id === accountId);
    const items = budgetPlan.items.filter((item) => item.accountId === accountId)
      .sort((first, second) => Number(isBudgetItemDone(first)) - Number(isBudgetItemDone(second)));
    const needed = items.reduce((sum, item) => sum + monthlyEquivalent(item), 0);
    const difference = account.balance - needed;
    totalBalance += account.balance;
    totalNeeded += needed;
    const card = budgetElement("article", "budget-card");
    card.dataset.accountId = accountId;
    const head = budgetElement("div", "budget-card-head");
    head.append(budgetElement("strong", "", `${account.groupName} · ${account.name}`));
    head.append(budgetElement("span", "", `Balance ${formatMoney(account.balance)}`));
    card.append(head);
    items.forEach((item) => {
      const row = budgetElement("div", "budget-row");
      const edit = budgetElement("button", "budget-remove", "✎");
      edit.type = "button";
      edit.setAttribute("aria-label", `Edit plan ${item.name}`);
      edit.addEventListener("click", () => startBudgetEdit(item));
      const duplicateButton = budgetElement("button", "budget-remove", "⧉");
      duplicateButton.type = "button";
      duplicateButton.setAttribute("aria-label", `Duplicate plan ${item.name}`);
      duplicateButton.title = "Duplicate";
      duplicateButton.addEventListener("click", () => startBudgetEdit(item, true));
      const remove = budgetElement("button", "budget-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove plan ${item.name}`);
      remove.addEventListener("click", () => {
        budgetPlan.items = budgetPlan.items.filter((entry) => entry.id !== item.id);
        saveBudgetPlan();
        renderBudgetPlanner();
      });
      const done = isBudgetItemDone(item);
      const paid = paidAmount(item);
      const nameCell = budgetElement("span", done ? "budget-name budget-done" : "budget-name");
      if (item.remarks) row.title = item.remarks;
      const label = done ? `${item.name} (paid)` : paid > 0 ? `${item.name} (paid ${formatMoney(paid)} of ${formatMoney(item.amount)})` : item.name;
      nameCell.append(budgetElement("span", "", label));
      row.append(
        nameCell,
        budgetElement("span", "budget-muted", `${formatMoney(item.amount)} / ${BUDGET_FREQUENCY_LABELS[item.frequency]}`),
        budgetElement("span", "", formatMoney(monthlyEquivalent(item))),
        edit,
        duplicateButton,
        remove
      );
      card.append(row);
    });
    card.append(budgetElement("div", "budget-line", `Needed for the rest of the month: ${formatMoney(needed)}`));
    card.append(budgetElement("div", difference < 0 ? "budget-result over" : "budget-result", `${difference < 0 ? "Deficit" : "Excess"}: ${formatMoney(Math.abs(difference))}`));
    return card;
  });
  if (budgetFilter !== "all" && !accountIds.includes(budgetFilter)) budgetFilter = "all";
  const filterSelect = document.querySelector("#budget-filter");
  filterSelect.replaceChildren(new Option("All accounts", "all"), ...accountIds.map((accountId) => {
    const account = balances.find((item) => item.id === accountId);
    return new Option(`${account.groupName} · ${account.name}`, accountId);
  }));
  filterSelect.value = budgetFilter;
  results.replaceChildren(...cards.filter((card) => budgetFilter === "all" || card.dataset.accountId === budgetFilter));
  const summaryPanel = document.querySelector("#budget-summary-panel");
  summaryPanel.replaceChildren();
  const period = getRemainingPeriod();
  const summary = document.querySelector("#budget-period");
  summary.classList.toggle("hidden", !cards.length);
  summary.textContent = `Rest of this month (today included): ${period.days} day${period.days === 1 ? "" : "s"} · ${period.weeks} week${period.weeks === 1 ? "" : "s"} · ${period.weekendDays} weekend${period.weekendDays === 1 ? "" : "s"}`;
  if (cards.length) {
    const difference = totalBalance - totalNeeded;
    const table = budgetElement("div", "budget-summary budget-total");
    table.append(budgetElement("h3", "", "Summary of all planned accounts"));
    const addRow = (cells, className) => {
      const row = budgetElement("div", className ? `budget-summary-row ${className}` : "budget-summary-row");
      cells.forEach((text) => row.append(budgetElement("span", "", text)));
      table.append(row);
    };
    addRow(["Account", "Balance", "Needed", "Excess / Deficit"], "budget-summary-head");
    accountIds.forEach((accountId) => {
      const account = balances.find((item) => item.id === accountId);
      const needed = budgetPlan.items.filter((item) => item.accountId === accountId).reduce((sum, item) => sum + monthlyEquivalent(item), 0);
      const gap = account.balance - needed;
      addRow([`${account.groupName} · ${account.name}`, formatMoney(account.balance), formatMoney(needed), `${gap < 0 ? "Deficit" : "Excess"} ${formatMoney(Math.abs(gap))}`], gap < 0 ? "over" : "");
    });
    addRow(["Total", formatMoney(totalBalance), formatMoney(totalNeeded), `${difference < 0 ? "Deficit" : "Excess"} ${formatMoney(Math.abs(difference))}`], `budget-summary-total${difference < 0 ? " over" : ""}`);
    summaryPanel.replaceChildren(table);
  }
  document.querySelector("#budget-tabs").classList.toggle("hidden", !cards.length);
  renderBudgetOneTime(balances);
  applyBudgetTab();
  document.querySelector("#budget-add").disabled = !accountSelect.options.length;
}

function renderBudgetOneTime(balances) {
  const panel = document.querySelector("#budget-onetime-panel");
  const items = budgetPlan.items.filter((item) => item.frequency === "monthly")
    .sort((first, second) => Number(isBudgetItemDone(first)) - Number(isBudgetItemDone(second)));
  const feedback = budgetElement("p", "form-feedback");
  feedback.setAttribute("role", "status");
  if (!items.length) {
    panel.replaceChildren(budgetElement("p", "budget-empty", "No one-time plans yet. Add a plan with Every set to Month (one-time)."));
    return;
  }
  const head = budgetElement("div", "budget-onetime-row budget-onetime-head");
  ["Plan", "Account", "Amount", "Paid so far", "Remaining"].forEach((text) => head.append(budgetElement("span", "", text)));
  const rows = items.map((item) => {
    const account = balances.find((entry) => entry.id === item.accountId);
    const paid = paidAmount(item);
    const row = budgetElement("div", isBudgetItemDone(item) ? "budget-onetime-row budget-done" : "budget-onetime-row");
    if (item.remarks) row.title = item.remarks;
    const input = document.createElement("input");
    input.type = "number";
    input.className = "budget-paid-input";
    input.min = "0";
    input.max = String(item.amount);
    input.step = "0.01";
    input.inputMode = "decimal";
    input.placeholder = "0.00";
    input.value = paid > 0 ? String(paid) : "";
    input.setAttribute("aria-label", `Amount paid so far for ${item.name}`);
    input.addEventListener("change", () => {
      const value = input.value.trim() === "" ? 0 : Number(input.value);
      if (!Number.isFinite(value) || value < 0) {
        feedback.textContent = "Enter a paid amount of zero or more.";
        return;
      }
      item.paidMonth = value > 0 ? currentMonthKey() : "";
      item.paidAmount = Math.min(item.amount, value);
      saveBudgetPlan();
      renderBudgetPlanner();
    });
    const full = budgetElement("button", "budget-remove", "✓");
    full.type = "button";
    full.title = "Mark fully paid";
    full.setAttribute("aria-label", `Mark ${item.name} fully paid`);
    full.addEventListener("click", () => {
      item.paidMonth = currentMonthKey();
      item.paidAmount = item.amount;
      saveBudgetPlan();
      renderBudgetPlanner();
    });
    const paidCell = budgetElement("span", "budget-onetime-paid");
    paidCell.append(input, full);
    row.append(
      budgetElement("span", "", item.name),
      budgetElement("span", "budget-muted", account ? `${account.groupName} · ${account.name}` : ""),
      budgetElement("span", "", formatMoney(item.amount)),
      paidCell,
      budgetElement("span", "", formatMoney(item.amount - paid))
    );
    return row;
  });
  panel.replaceChildren(head, ...rows, feedback);
}

function syncBudgetPaidField() {
  const isOneTime = document.querySelector("#budget-frequency").value === "monthly";
  document.querySelector("#budget-paid-field").classList.toggle("hidden", !isOneTime);
}

function startBudgetEdit(item, duplicate = false) {
  setBudgetFormOpen(true);
  editingBudgetId = duplicate ? null : item.id;
  document.querySelector("#budget-account").value = item.accountId;
  document.querySelector("#budget-name").value = duplicate ? `${item.name} (copy)` : item.name;
  document.querySelector("#budget-amount").value = item.amount;
  document.querySelector("#budget-frequency").value = item.frequency;
  const paid = duplicate ? 0 : paidAmount(item);
  document.querySelector("#budget-paid").value = paid > 0 ? String(paid) : "";
  document.querySelector("#budget-remarks").value = item.remarks || "";
  document.querySelector("#budget-save").textContent = duplicate ? "Save copy" : "Update plan";
  syncBudgetPaidField();
}

function setBudgetFormOpen(open) {
  editingBudgetId = null;
  document.querySelector("#budget-save").textContent = "Save plan";
  document.querySelector("#budget-form").reset();
  syncBudgetPaidField();
  document.querySelector("#budget-form").classList.toggle("hidden", !open);
  document.querySelector("#budget-feedback").textContent = "";
  if (open) document.querySelector("#budget-name").focus();
}

document.querySelector("#budget-frequency").addEventListener("change", syncBudgetPaidField);

document.querySelector("#budget-add").addEventListener("click", () => setBudgetFormOpen(true));
document.querySelector("#budget-cancel").addEventListener("click", () => setBudgetFormOpen(false));
document.querySelector("#budget-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#budget-feedback");
  const name = document.querySelector("#budget-name").value.trim();
  const amount = Number(document.querySelector("#budget-amount").value);
  const accountId = document.querySelector("#budget-account").value;
  const frequency = document.querySelector("#budget-frequency").value;
  if (!accountId || !name) {
    feedback.textContent = "Choose an account and enter what the plan is for.";
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    feedback.textContent = "Enter an amount greater than zero.";
    return;
  }
  const paidText = document.querySelector("#budget-paid").value.trim();
  const paid = frequency === "monthly" && paidText !== "" ? Number(paidText) : 0;
  if (!Number.isFinite(paid) || paid < 0) {
    feedback.textContent = "Enter an already-paid amount of zero or more.";
    return;
  }
  const remarks = document.querySelector("#budget-remarks").value.trim();
  const paidFields = { remarks, paidMonth: paid > 0 ? currentMonthKey() : "", paidAmount: Math.min(amount, paid) };
  const existing = editingBudgetId
    ? budgetPlan.items.find((item) => item.id === editingBudgetId)
    : budgetPlan.items.find((item) => item.accountId === accountId && item.name.toLowerCase() === name.toLowerCase());
  const duplicate = budgetPlan.items.find((item) => item !== existing && item.accountId === accountId && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    feedback.textContent = "That account already has a plan with this name.";
    return;
  }
  if (existing) Object.assign(existing, { accountId, name, amount, frequency, ...paidFields });
  else budgetPlan.items.push({ id: createId(), accountId, name, amount, frequency, ...paidFields });
  if (!saveBudgetPlan()) return;
  setBudgetFormOpen(false);
  renderBudgetPlanner();
});

document.querySelector("[data-view='budget']").addEventListener("click", () => {
  activeBudgetTab = "summary";
  setView("budget");
});
