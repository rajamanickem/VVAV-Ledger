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
    const year = today.getFullYear() + periodOffset;
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (selectedPeriod === "week") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + periodOffset * 7);
    const daysSinceMonday = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - daysSinceMonday);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { start: localDateString(startDate), end: localDateString(endDate) };
  }
  const first = new Date(today.getFullYear(), today.getMonth() + periodOffset, 1);
  return {
    start: localDateString(first),
    end: localDateString(new Date(first.getFullYear(), first.getMonth() + 1, 0))
  };
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function syncPeriodJump(range) {
  const monthSelect = document.querySelector("#jump-month");
  const yearSelect = document.querySelector("#jump-year");
  const dateInput = document.querySelector("#jump-date");
  if (!monthSelect.options.length) {
    const names = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2000, i, 1)));
    monthSelect.innerHTML = names.map((name, i) => `<option value="${i}">${name}</option>`).join("");
    const thisYear = new Date().getFullYear();
    const years = [];
    for (let y = thisYear + 1; y >= thisYear - 20; y -= 1) years.push(`<option value="${y}">${y}</option>`);
    yearSelect.innerHTML = years.join("");
  }
  monthSelect.hidden = selectedPeriod !== "month";
  yearSelect.hidden = selectedPeriod !== "month" && selectedPeriod !== "year";
  dateInput.hidden = selectedPeriod !== "week";
  document.querySelector("#period-range-label").hidden = selectedPeriod === "month" || selectedPeriod === "year";
  monthSelect.value = String(Number(range.start.slice(5, 7)) - 1);
  yearSelect.value = range.start.slice(0, 4);
  dateInput.value = range.start;
}

function jumpPeriod() {
  const now = new Date();
  const year = Number(document.querySelector("#jump-year").value);
  if (selectedPeriod === "year") {
    periodOffset = year - now.getFullYear();
  } else if (selectedPeriod === "month") {
    const month = Number(document.querySelector("#jump-month").value);
    periodOffset = (year - now.getFullYear()) * 12 + (month - now.getMonth());
  } else if (selectedPeriod === "week") {
    const value = document.querySelector("#jump-date").value;
    if (!value) return;
    const picked = mondayOf(new Date(`${value}T12:00:00`));
    periodOffset = Math.round((picked - mondayOf(now)) / (7 * 86400000));
  }
  updatePeriodControl();
  updateSummary();
  renderTransactions();
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
  if (selectedPeriod === "custom") periodOffset = 0;
  document.querySelectorAll(".period-step").forEach((button) => { button.hidden = selectedPeriod === "custom"; });
  const periodName = selectedPeriod === "custom" ? "selected period" : periodOffset === 0 ? `this ${selectedPeriod}` : `in ${selectedPeriod}`;
  document.querySelector("#income-title").textContent = `Income ${periodName}`;
  document.querySelector("#expense-title").textContent = `Expenses ${periodName}`;
  const range = getPeriodRange();
  if (!range) {
    elements.periodRangeLabel.textContent = "Choose valid dates";
    return;
  }
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  syncPeriodJump(range);
  elements.periodRangeLabel.textContent = selectedPeriod === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${range.start}T12:00:00`))
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

