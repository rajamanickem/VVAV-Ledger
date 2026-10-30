(function () {
  window.createAccountManager = function ({ elements, getGroups, createId, saveGroups, onGroupsChanged }) {
    let editingGroupId = null;
    let editingAccountId = null;

    function flattenAccounts() {
      return getGroups().flatMap((group) => group.accounts.map((account) => ({ ...account, groupId: group.id, groupName: group.name, groupIcon: group.icon || "" })));
    }

    function getAccountName(id, fallback = "") {
      return flattenAccounts().find((account) => account.id === id)?.name || fallback;
    }

    function addOption(select, value, label) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }

    function refreshSelects() {
      const accounts = flattenAccounts();
      const previousSource = elements.account.value;
      const previousDestination = elements.destination.value;
      const options = accounts.map((account) => addOption(selectForTemporary(), account.id, `${account.name} · ${account.groupIcon} ${account.groupName}`.trim()));
      elements.account.replaceChildren(...options);
      if (accounts.some((account) => account.id === previousSource)) elements.account.value = previousSource;
      else if (accounts.length) elements.account.value = accounts[0].id;
      const destinations = accounts.filter((account) => account.id !== elements.account.value);
      elements.destination.replaceChildren(...destinations.map((account) => addOption(selectForTemporary(), account.id, `${account.name} · ${account.groupIcon} ${account.groupName}`.trim())));
      if (destinations.some((account) => account.id === previousDestination)) elements.destination.value = previousDestination;
      else if (destinations.length) elements.destination.value = destinations[0].id;
    }

    function selectAccounts(sourceId, destinationId, sourceName = "", destinationName = "") {
      refreshSelects();
      const accounts = flattenAccounts();
      const source = accounts.find((account) => account.id === sourceId) || accounts.find((account) => account.name === sourceName);
      if (source) elements.account.value = source.id;
      refreshSelects();
      const destination = accounts.find((account) => account.id === destinationId) || accounts.find((account) => account.name === destinationName);
      if (destination && [...elements.destination.options].some((option) => option.value === destination.id)) elements.destination.value = destination.id;
    }

    function selectForTemporary() {
      return document.createElement("select");
    }

    function populateGroups(selectedId = "") {
      const groups = getGroups();
      const previous = selectedId || elements.accountGroupSelect.value;
      elements.accountGroupSelect.replaceChildren(...groups.map((group) => addOption(selectForTemporary(), group.id, `${group.icon || ""} ${group.name}`.trim())));
      if (groups.some((group) => group.id === previous)) elements.accountGroupSelect.value = previous;
      else if (groups.length) elements.accountGroupSelect.value = groups[0].id;
    }

    function resetGroupEditor() {
      editingGroupId = null;
      elements.accountGroupName.value = "";
      elements.accountGroupIcon.value = "";
      elements.accountGroupBalanceType.value = "asset";
      elements.accountGroupFeedback.textContent = "";
      document.querySelector("#account-group-kicker").textContent = "ADD A GROUP";
      document.querySelector("#account-group-heading").textContent = "New account group";
      document.querySelector("#save-account-group").textContent = "Add group";
      document.querySelector("#cancel-account-group-edit").classList.add("hidden");
    }

    function resetAccountEditor() {
      editingAccountId = null;
      elements.accountName.value = "";
      elements.accountOpeningBalance.value = "0";
      elements.accountFeedback.textContent = "";
      document.querySelector("#account-editor-kicker").textContent = "ADD AN ACCOUNT";
      document.querySelector("#account-editor-heading").textContent = "New account";
      document.querySelector("#save-account").textContent = "Add account";
      document.querySelector("#cancel-account-edit").classList.add("hidden");
      populateGroups();
      updateOpeningBalanceHint();
    }

    function editGroup(group) {
      editingGroupId = group.id;
      elements.accountGroupName.value = group.name;
      elements.accountGroupIcon.value = group.icon || "";
      elements.accountGroupBalanceType.value = group.balanceType || "asset";
      elements.accountGroupFeedback.textContent = "";
      document.querySelector("#account-group-kicker").textContent = "EDIT GROUP";
      document.querySelector("#account-group-heading").textContent = "Rename account group";
      document.querySelector("#save-account-group").textContent = "Save group";
      document.querySelector("#cancel-account-group-edit").classList.remove("hidden");
    }

    function editAccount(group, account) {
      editingAccountId = account.id;
      elements.accountName.value = account.name;
      elements.accountOpeningBalance.value = Math.abs(Number(account.openingBalance) || 0).toFixed(2);
      elements.accountFeedback.textContent = "";
      document.querySelector("#account-editor-kicker").textContent = "EDIT ACCOUNT";
      document.querySelector("#account-editor-heading").textContent = "Rename or move account";
      document.querySelector("#save-account").textContent = "Save account";
      document.querySelector("#cancel-account-edit").classList.remove("hidden");
      populateGroups(group.id);
      updateOpeningBalanceHint();
    }

    function updateOpeningBalanceHint() {
      const group = getGroups().find((item) => item.id === elements.accountGroupSelect.value);
      const isLiability = group?.balanceType === "liability";
      elements.accountOpeningHint.textContent = isLiability
        ? "Enter the amount owed. It will be stored as a negative balance and reduce net worth."
        : "Enter the amount currently held. It will be added to net worth.";
    }

    function renderGroups() {
      elements.accountGroupList.replaceChildren();
      if (getGroups().length === 0) {
        const empty = document.createElement("p");
        empty.className = "category-tree-empty";
        empty.textContent = "No account groups yet. Add one to get started.";
        elements.accountGroupList.append(empty);
      }
      getGroups().forEach((group) => {
        const section = document.createElement("section");
        section.className = "account-group-section";
        const header = document.createElement("div");
        header.className = "account-group-heading";
        const title = document.createElement("h3");
        title.textContent = `${group.icon || ""} ${group.name}`.trim();
        const groupActions = document.createElement("div");
        groupActions.className = "category-tree-actions";
        const editGroupButton = document.createElement("button");
        editGroupButton.type = "button";
        editGroupButton.textContent = "Edit group";
        editGroupButton.setAttribute("aria-label", `Edit group ${group.name}`);
        editGroupButton.addEventListener("click", () => editGroup(group));
        const removeGroupButton = document.createElement("button");
        removeGroupButton.type = "button";
        removeGroupButton.textContent = "Remove group";
        removeGroupButton.setAttribute("aria-label", `Remove group ${group.name}`);
        removeGroupButton.addEventListener("click", () => removeGroup(group));
        groupActions.append(editGroupButton, removeGroupButton);
        header.append(title, groupActions);
        const list = document.createElement("div");
        list.className = "account-items";
        if (!group.accounts.length) {
          const empty = document.createElement("p");
          empty.className = "category-tree-empty";
          empty.textContent = "No accounts in this group.";
          list.append(empty);
        }
        group.accounts.forEach((account) => {
          const row = document.createElement("div");
          row.className = "account-item-row";
          const name = document.createElement("span");
          name.textContent = account.name;
          const actions = document.createElement("div");
          actions.className = "category-tree-actions";
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "Edit";
          edit.setAttribute("aria-label", `Edit account ${account.name}`);
          edit.addEventListener("click", () => editAccount(group, account));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove";
          remove.setAttribute("aria-label", `Remove account ${account.name}`);
          remove.addEventListener("click", () => removeAccount(group, account));
          actions.append(edit, remove);
          row.append(name, actions);
          list.append(row);
        });
        section.append(header, list);
        elements.accountGroupList.append(section);
      });
      populateGroups();
    }

    async function persistChanges(messageElement) {
      const saved = await saveGroups();
      refreshSelects();
      renderGroups();
      onGroupsChanged();
      if (messageElement) messageElement.textContent = saved ? "Changes saved." : "Could not save account changes.";
    }

    async function saveGroup(event) {
      event.preventDefault();
      const name = elements.accountGroupName.value.trim();
      const icon = elements.accountGroupIcon.value.trim();
      if (!name) return;
      const duplicate = getGroups().some((group) => group.name.toLowerCase() === name.toLowerCase() && group.id !== editingGroupId);
      if (duplicate) {
        elements.accountGroupFeedback.textContent = "A group with that name already exists.";
        return;
      }
      if (editingGroupId) {
        const group = getGroups().find((item) => item.id === editingGroupId);
        if (!group) return;
        const previousType = group.balanceType || "asset";
        const nextType = elements.accountGroupBalanceType.value;
        if (previousType !== nextType) {
          group.accounts.forEach((account) => {
            account.openingBalance = -(Number(account.openingBalance) || 0);
          });
        }
        group.name = name;
        group.icon = icon;
        group.balanceType = nextType;
      } else {
        getGroups().push({ id: createId(), name, icon, balanceType: elements.accountGroupBalanceType.value, accounts: [] });
      }
      const wasEditing = Boolean(editingGroupId);
      resetGroupEditor();
      await persistChanges(elements.accountGroupFeedback);
      if (!wasEditing) elements.accountGroupFeedback.textContent = "Group added.";
    }

    async function saveAccount(event) {
      event.preventDefault();
      const name = elements.accountName.value.trim();
      const group = getGroups().find((item) => item.id === elements.accountGroupSelect.value);
      if (!name || !group) {
        elements.accountFeedback.textContent = "Add a group before creating accounts.";
        return;
      }
      const duplicate = getGroups().some((item) => item.accounts.some((account) => account.name.toLowerCase() === name.toLowerCase() && account.id !== editingAccountId));
      if (duplicate) {
        elements.accountFeedback.textContent = "An account with that name already exists.";
        return;
      }
      if (editingAccountId) {
        const current = getGroups().flatMap((item) => item.accounts.map((account) => ({ group: item, account }))).find((item) => item.account.id === editingAccountId);
        if (!current) return;
        current.group.accounts.splice(current.group.accounts.findIndex((item) => item.id === editingAccountId), 1);
        current.account.name = name;
        current.account.openingBalance = group.balanceType === "liability" ? -Math.abs(Number(elements.accountOpeningBalance.value) || 0) : Math.abs(Number(elements.accountOpeningBalance.value) || 0);
        group.accounts.push(current.account);
      } else {
        const enteredBalance = Math.abs(Number(elements.accountOpeningBalance.value) || 0);
        group.accounts.push({
          id: createId(),
          name,
          openingBalance: group.balanceType === "liability" ? -enteredBalance : enteredBalance
        });
      }
      resetAccountEditor();
      await persistChanges(elements.accountFeedback);
    }

    async function removeGroup(group) {
      if (!window.confirm(`Remove account group "${group.name}" and its ${group.accounts.length} account(s)? Existing transactions keep their saved account labels.`)) return;
      const groups = getGroups();
      groups.splice(groups.findIndex((item) => item.id === group.id), 1);
      await persistChanges(elements.accountGroupFeedback);
    }

    async function removeAccount(group, account) {
      if (!window.confirm(`Remove account "${account.name}"? Existing transactions keep their saved account label.`)) return;
      group.accounts.splice(group.accounts.findIndex((item) => item.id === account.id), 1);
      await persistChanges(elements.accountFeedback);
    }

    function open() {
      resetGroupEditor();
      resetAccountEditor();
      renderGroups();
      elements.accountDialog.showModal();
    }

    function bindEvents() {
      document.querySelector("#manage-accounts").addEventListener("click", open);
      document.querySelector("#close-account-dialog").addEventListener("click", () => elements.accountDialog.close());
      document.querySelector("#account-group-form").addEventListener("submit", saveGroup);
      document.querySelector("#account-form").addEventListener("submit", saveAccount);
      document.querySelector("#cancel-account-group-edit").addEventListener("click", resetGroupEditor);
      document.querySelector("#cancel-account-edit").addEventListener("click", resetAccountEditor);
      elements.account.addEventListener("change", refreshSelects);
      elements.accountGroupSelect.addEventListener("change", updateOpeningBalanceHint);
    }

    return { bindEvents, refreshSelects, getAccountName, selectAccounts };
  };
})();
