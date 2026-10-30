(function () {
  window.createCategoryManager = function ({ elements, getCategories, getDefaultCategories, getActiveTab, findCategoryLocation, saveCategoryTree, createId, onCategoriesChanged }) {
    let editingCategoryId = null;

    function addSelectOptions(select, items, placeholder, selectedId = "") {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = placeholder;
      select.replaceChildren(placeholderOption, ...items.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.icon || ""} ${item.name}`.trim();
        return option;
      }));
      if (items.some((item) => item.id === selectedId)) select.value = selectedId;
      else if (items.length) select.value = items[0].id;
    }

    function refreshSelects() {
      const type = getActiveTab() === "income" ? "income" : "expense";
      const rootSelection = elements.category.value;
      const categories = getCategories();
      addSelectOptions(elements.category, categories[type], "Choose a category", rootSelection);
      const selectedRoot = categories[type].find((item) => item.id === elements.category.value);
      const childNodes = selectedRoot?.children || [];
      elements.subcategory.classList.toggle("hidden", childNodes.length === 0);
      addSelectOptions(elements.subcategory, childNodes, "Subcategory", elements.subcategory.value);
      const selectedChild = childNodes.find((item) => item.id === elements.subcategory.value);
      const detailNodes = selectedChild?.children || [];
      elements.detailCategory.classList.toggle("hidden", detailNodes.length === 0);
      addSelectOptions(elements.detailCategory, detailNodes, "Detail subcategory", elements.detailCategory.value);
    }

    function selectPath(categoryId, subcategoryId, detailCategoryId) {
      const type = getActiveTab() === "income" ? "income" : "expense";
      elements.category.value = categoryId || "";
      refreshSelects();
      if (subcategoryId) {
        elements.subcategory.value = subcategoryId;
        refreshSelects();
      }
      if (detailCategoryId) {
        elements.detailCategory.value = detailCategoryId;
        refreshSelects();
      }
    }

    function refreshParentOptions() {
      const type = elements.managerType.value;
      const categories = getCategories();
      const selectedParent = elements.categoryParent.value;
      const excluded = editingCategoryId ? findCategoryLocation(type, editingCategoryId)?.node : null;
      const excludedIds = new Set();
      function markExcluded(node) {
        if (!node) return;
        excludedIds.add(node.id);
        (node.children || []).forEach(markExcluded);
      }
      markExcluded(excluded);
      const options = [{ id: "", name: "Top level category", depth: 0 }];
      function flatten(nodes, depth = 0) {
        nodes.forEach((node) => {
          if (excludedIds.has(node.id)) return;
          options.push({ id: node.id, name: node.name, depth });
          flatten(node.children || [], depth + 1);
        });
      }
      flatten(categories[type]);
      elements.categoryParent.replaceChildren(...options.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${"  ".repeat(item.depth)}${item.name}`;
        option.disabled = item.depth >= 2;
        return option;
      }));
      if (options.some((item) => item.id === selectedParent)) elements.categoryParent.value = selectedParent;
    }

    function resetEditor() {
      editingCategoryId = null;
      elements.categoryName.value = "";
      elements.categoryIcon.value = "";
      elements.categoryFeedback.textContent = "";
      document.querySelector("#category-editor-kicker").textContent = "ADD A CATEGORY";
      document.querySelector("#category-editor-title").textContent = "New category";
      document.querySelector("#save-category").textContent = "Add category";
      document.querySelector("#cancel-category-edit").classList.add("hidden");
      refreshParentOptions();
    }

    function renderTree() {
      const type = elements.managerType.value;
      const categories = getCategories();
      elements.categoryTree.replaceChildren();
      if (categories[type].length === 0) {
        const empty = document.createElement("p");
        empty.className = "category-tree-empty";
        empty.textContent = "No categories yet. Add one to get started.";
        elements.categoryTree.append(empty);
      }

      function appendNodes(nodes, depth = 0) {
        nodes.forEach((node) => {
          const row = document.createElement("div");
          row.className = "category-tree-row";
          row.style.setProperty("--tree-depth", depth);
          const name = document.createElement("span");
          name.className = "category-tree-name";
          name.textContent = `${node.icon || ""} ${node.name}`.trim();
          const actions = document.createElement("div");
          actions.className = "category-tree-actions";
          const addChild = document.createElement("button");
          addChild.type = "button";
          addChild.textContent = "+ Subcategory";
          addChild.setAttribute("aria-label", `Add subcategory under ${node.name}`);
          addChild.disabled = depth >= 2;
          addChild.addEventListener("click", () => {
            resetEditor();
            elements.categoryParent.value = node.id;
            elements.categoryName.focus();
          });
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "Edit";
          edit.setAttribute("aria-label", `Edit ${node.name}`);
          edit.addEventListener("click", () => beginEdit(type, node.id));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove";
          remove.setAttribute("aria-label", `Remove ${node.name}`);
          remove.addEventListener("click", () => removeCategory(type, node.id));
          actions.append(addChild, edit, remove);
          row.append(name, actions);
          elements.categoryTree.append(row);
          appendNodes(node.children || [], depth + 1);
        });
      }

      appendNodes(categories[type]);
      refreshParentOptions();
    }

    function beginEdit(type, id) {
      const location = findCategoryLocation(type, id);
      if (!location) return;
      editingCategoryId = id;
      elements.categoryName.value = location.node.name;
      elements.categoryIcon.value = location.node.icon || "";
      elements.categoryFeedback.textContent = "";
      document.querySelector("#category-editor-kicker").textContent = "EDIT CATEGORY";
      document.querySelector("#category-editor-title").textContent = "Rename or move";
      document.querySelector("#save-category").textContent = "Save changes";
      document.querySelector("#cancel-category-edit").classList.remove("hidden");
      refreshParentOptions();
      elements.categoryParent.value = location.depth === 0 ? "" : findParentId(getCategories()[type], id);
      elements.categoryName.focus();
    }

    function findParentId(nodes, id, parentId = "") {
      for (const node of nodes) {
        if (node.id === id) return parentId;
        const result = findParentId(node.children || [], id, node.id);
        if (result !== null) return result;
      }
      return null;
    }

    function categoryContains(node, id) {
      return node.id === id || (node.children || []).some((child) => categoryContains(child, id));
    }

    function categorySubtreeHeight(node) {
      const children = node.children || [];
      return children.length ? 1 + Math.max(...children.map(categorySubtreeHeight)) : 0;
    }

    async function removeCategory(type, id) {
      const location = findCategoryLocation(type, id);
      if (!location) return;
      if (!window.confirm(`Remove "${location.node.name}" and its subcategories? Existing transactions keep their saved category names.`)) return;
      const editingLocation = editingCategoryId ? findCategoryLocation(type, editingCategoryId) : null;
      if (editingLocation && categoryContains(location.node, editingCategoryId)) resetEditor();
      location.list.splice(location.list.findIndex((item) => item.id === id), 1);
      const saved = await saveCategoryTree(type);
      renderTree();
      refreshSelects();
      onCategoriesChanged(type);
      elements.categoryFeedback.textContent = saved ? "Category removed." : "Could not save category changes.";
    }

    async function saveCategory(event) {
      event.preventDefault();
      const type = elements.managerType.value;
      const categories = getCategories();
      const name = elements.categoryName.value.trim();
      const icon = elements.categoryIcon.value.trim();
      const parentId = elements.categoryParent.value;
      const parent = parentId ? findCategoryLocation(type, parentId) : null;
      if (!name) return;
      if (parent && parent.depth >= 2) {
        elements.categoryFeedback.textContent = "Categories can have up to two subcategory levels.";
        return;
      }
      let node;
      if (editingCategoryId) {
        const location = findCategoryLocation(type, editingCategoryId);
        if (!location) return;
        node = location.node;
        const targetDepth = parent ? parent.depth + 1 : 0;
        if (targetDepth + categorySubtreeHeight(node) > 2) {
          elements.categoryFeedback.textContent = "Moving this category would exceed two subcategory levels.";
          return;
        }
        location.list.splice(location.list.findIndex((item) => item.id === editingCategoryId), 1);
        node.name = name;
        node.icon = icon;
      } else {
        node = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, icon, children: [] };
      }
      const destination = parent ? parent.node.children : categories[type];
      destination.push(node);
      const saved = await saveCategoryTree(type);
      resetEditor();
      renderTree();
      refreshSelects();
      onCategoriesChanged(type);
      elements.categoryFeedback.textContent = saved ? "Category saved." : "Could not save categories in this browser.";
    }

    function cloneWithFreshIds(items) {
      return items.map((item) => ({
        ...item,
        id: createId(),
        children: cloneWithFreshIds(item.children || [])
      }));
    }

    async function resetToDefaults() {
      const type = elements.managerType.value;
      const label = type === "expense" ? "expense" : "income";
      if (!window.confirm(`Reset ${label} categories to defaults? Custom ${label} categories will be removed. Transactions will be kept.`)) return;
      getCategories()[type] = cloneWithFreshIds(getDefaultCategories()[type]);
      resetEditor();
      const saved = await saveCategoryTree(type);
      renderTree();
      refreshSelects();
      onCategoriesChanged(type);
      elements.categoryFeedback.textContent = saved ? `${type === "expense" ? "Expense" : "Income"} categories reset to defaults.` : "Could not save the default categories.";
    }

    function open(type) {
      elements.managerType.value = type === "income" ? "income" : "expense";
      resetEditor();
      renderTree();
      elements.categoryDialog.showModal();
    }

    function bindEvents() {
      elements.category.addEventListener("change", () => {
        elements.subcategory.value = "";
        elements.detailCategory.value = "";
        refreshSelects();
      });
      elements.subcategory.addEventListener("change", () => {
        elements.detailCategory.value = "";
        refreshSelects();
      });
      document.querySelector("#manage-categories").addEventListener("click", () => open(getActiveTab()));
      document.querySelector("#close-category-dialog").addEventListener("click", () => elements.categoryDialog.close());
      document.querySelector("#cancel-category-edit").addEventListener("click", resetEditor);
      elements.managerType.addEventListener("change", () => {
        resetEditor();
        renderTree();
      });
      document.querySelector("#reset-categories").addEventListener("click", resetToDefaults);
      elements.categoryParent.addEventListener("change", () => {
        const type = elements.managerType.value;
        const parent = elements.categoryParent.value ? findCategoryLocation(type, elements.categoryParent.value) : null;
        if (parent?.depth >= 2) {
          elements.categoryFeedback.textContent = "Categories can have up to two subcategory levels.";
          elements.categoryParent.value = "";
        } else {
          elements.categoryFeedback.textContent = "";
        }
      });
      document.querySelector("#category-editor").addEventListener("submit", saveCategory);
    }

    return { bindEvents, open, refreshSelects, selectPath };
  };
})();