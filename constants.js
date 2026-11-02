function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

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
