// Full-screen list of every expense, income and transfer for one account (opened from Overview).
const ACTIVITY_PAGE_SIZE = 50;
let activityAccountId = "";
let activityTypeFilter = "all";
let activityLimit = ACTIVITY_PAGE_SIZE;

function transactionTouchesAccount(transaction, account) {
  const matches = (id, legacyName) => (id ? id === account.id : Boolean(legacyName) && legacyName === account.name);
  return {
    asSource: matches(transaction.accountId, transaction.account),
    asDestination: transaction.type === "transfer" && matches(transaction.destinationId, transaction.destination)
  };
}

function findAccountById(id) {
  for (const group of accountGroups) {
    const account = group.accounts.find((item) => item.id === id);
    if (account) return { account, group };
  }
  return null;
}

function openAccountActivity(accountId) {
  activityAccountId = accountId;
  activityTypeFilter = "all";
  activityLimit = ACTIVITY_PAGE_SIZE;
  renderAccountActivity();
  const dialog = document.querySelector("#account-activity-dialog");
  if (!dialog.open) dialog.showModal();
}

function renderAccountActivity() {
  const found = findAccountById(activityAccountId);
  if (!found) return;
  const { account, group } = found;
  document.querySelector("#account-activity-kicker").textContent = group.name.toUpperCase();
  document.querySelector("#account-activity-title").textContent = account.name;

  const entries = transactions
    .map((transaction) => ({ transaction, ...transactionTouchesAccount(transaction, account) }))
    .filter((entry) => entry.asSource || entry.asDestination)
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date) || (b.transaction.time || "").localeCompare(a.transaction.time || "") || b.transaction.createdAt - a.transaction.createdAt);

  const balance = getAccountBalances().find((item) => item.id === account.id)?.balance || 0;
  const summary = document.querySelector("#account-activity-summary");
  summary.replaceChildren();
  const balanceLabel = document.createElement("span");
  balanceLabel.textContent = "Current balance";
  const balanceValue = document.createElement("strong");
  balanceValue.textContent = formatMoney(balance);
  summary.append(balanceLabel, balanceValue);

  const add = document.querySelector("#account-activity-add");
  add.replaceChildren();
  [["expense", "+ Expense"], ["income", "+ Income"], ["transfer", "+ Transfer"]].forEach(([type, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add-entry-button";
    button.textContent = label;
    button.addEventListener("click", () => addActivityTransaction(type));
    add.append(button);
  });

  const filters = document.querySelector("#account-activity-filters");
  filters.replaceChildren();
  [["all", "All"], ["expense", "Expenses"], ["income", "Income"], ["transfer", "Transfers"]].forEach(([type, label]) => {
    const count = type === "all" ? entries.length : entries.filter((entry) => entry.transaction.type === type).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "activity-filter";
    button.classList.toggle("active", activityTypeFilter === type);
    button.setAttribute("aria-pressed", String(activityTypeFilter === type));
    button.textContent = `${label} (${count})`;
    button.addEventListener("click", () => {
      activityTypeFilter = type;
      activityLimit = ACTIVITY_PAGE_SIZE;
      renderAccountActivity();
    });
    filters.append(button);
  });

  const visible = entries.filter((entry) => activityTypeFilter === "all" || entry.transaction.type === activityTypeFilter);
  const list = document.querySelector("#account-activity-list");
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "category-tree-empty";
    empty.textContent = "No transactions for this account yet.";
    list.append(empty);
    return;
  }
  visible.slice(0, activityLimit).forEach((entry) => list.append(createActivityRow(entry)));
  if (visible.length > activityLimit) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "add-entry-button show-more-button";
    more.textContent = `Show more (${visible.length - activityLimit} remaining)`;
    more.addEventListener("click", () => {
      activityLimit += ACTIVITY_PAGE_SIZE;
      renderAccountActivity();
    });
    list.append(more);
  }
}

let entryReturnsToActivity = false;

// Opens the full-screen entry form on top of the Overview and comes back to the account screen afterwards.
function openEntryFromActivity(prepare) {
  document.querySelector("#account-activity-dialog").close();
  const workspace = document.querySelector("#transaction-workspace");
  workspace.classList.remove("hidden");
  workspace.classList.add("overlay-only");
  prepare();
  entryReturnsToActivity = true;
  setEntryExpanded(true);
}

function reopenAccountActivity() {
  renderAccountActivity();
  const dialog = document.querySelector("#account-activity-dialog");
  if (!dialog.open) dialog.showModal();
}

function addActivityTransaction(type) {
  openEntryFromActivity(() => {
    cancelTransactionEdit();
    setTab(type);
    elements.account.value = activityAccountId;
  });
}

async function deleteActivityTransaction(transaction) {
  if (!window.confirm(`Delete "${transaction.description || tabLabels[transaction.type]}"?`)) return;
  transactions = transactions.filter((item) => item.id !== transaction.id);
  await saveTransactions();
  renderTransactions();
  updateSummary();
}

function createActivityRow({ transaction, asSource, asDestination }) {
  const amount = Number(transaction.amount) || 0;
  // Money leaves the account for expenses and outgoing transfers.
  const outgoing = transaction.type === "expense" || (transaction.type === "transfer" && asSource && !asDestination);
  const row = document.createElement("div");
  row.className = "activity-row";
  const icon = document.createElement("span");
  icon.className = `transaction-icon ${transaction.type}`;
  icon.textContent = icons[transaction.type];
  icon.setAttribute("aria-hidden", "true");
  const details = document.createElement("div");
  details.className = "activity-details";
  const title = document.createElement("div");
  title.className = "transaction-description";
  const sourceName = accountManager.getAccountName(transaction.accountId, transaction.account);
  const destinationName = accountManager.getAccountName(transaction.destinationId, transaction.destination);
  title.textContent = transaction.description || tabLabels[transaction.type];
  const meta = document.createElement("div");
  meta.className = "transaction-account";
  const detail = transaction.type === "transfer" ? `${sourceName} to ${destinationName}` : transactionCategoryLabel(transaction);
  meta.textContent = `${formatDate(transaction.date)} · ${detail}`;
  details.append(title, meta);
  const value = document.createElement("div");
  value.className = `activity-amount ${outgoing ? "out" : "in"}`;
  value.textContent = `${outgoing ? "−" : "+"}${formatMoney(amount)}`;
  const amountBox = document.createElement("div");
  amountBox.className = "activity-amount-box";
  const actions = document.createElement("div");
  actions.className = "activity-actions";
  const makeButton = (label, text, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "activity-action";
    button.textContent = text;
    button.setAttribute("aria-label", `${label} ${transaction.description}`);
    button.addEventListener("click", handler);
    return button;
  };
  actions.append(makeButton("Edit", "Edit", () => openEntryFromActivity(() => editTransaction(transaction))));
  if (transaction.type !== "transfer") {
    actions.append(makeButton("Copy", "Copy", () => openEntryFromActivity(() => duplicateTransaction(transaction))));
  }
  actions.append(makeButton("Delete", "Delete", () => deleteActivityTransaction(transaction)));
  amountBox.append(value, actions);
  row.append(icon, details, amountBox);
  return row;
}

document.querySelector("#close-account-activity").addEventListener("click", () => document.querySelector("#account-activity-dialog").close());
