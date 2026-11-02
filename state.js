let transactions = [];
let categories = { expense: [], income: [] };
let accountGroups = [];
let activeTab = "expense";
let activeView = "home";
let editingTransactionId = null;
let duplicatingTransaction = false;
let selectedPeriod = "month";
let periodOffset = 0;
let activityDisplay = "list";
const TRANSACTION_PAGE_SIZE = 50;
let visibleLimit = TRANSACTION_PAGE_SIZE;
let lastFilterKey = "";
let searchTimer = null;

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

