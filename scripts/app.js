(function () {
  "use strict";

  const {
    BOARD_COLUMNS,
    CALENDAR_MODES,
    CATEGORY_STORE_KEY,
    QUADRANTS,
    STORE_KEY,
    UI_KEY,
    VIEW_KEYS
  } = window.NekoTickConfig;
  const {
    addDays,
    addMonths,
    createId,
    createMarkdownRenderer,
    fromDateKey,
    isValidDateKey,
    isValidTime,
    sameDay,
    startOfDay,
    toDateKey
  } = window.NekoTickUtils;
  const { readStorage } = window.NekoTickStorage;
  const {
    applyTheme: applyStoredTheme,
    categoryTone: resolveCategoryTone,
    compareTasks: compareTaskRecords,
    hasSavedTaskList,
    loadCategories: readCategories,
    loadTasks: readTasks,
    loadUI: readUI,
    normalizeTask: normalizeTaskRecord,
    saveCategories: persistCategories,
    saveTasks: persistTasks,
    saveUI: persistUI,
    taskMatchesSearch: matchesTaskSearch
  } = window.NekoTickModel;

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const renderMarkdown = createMarkdownRenderer();

  let today = startOfDay(new Date());
  let categories = readCategories();
  let tasks = readTasks(categories, today);
  let ui = readUI(today);
  let completingTaskId = "";
  let composingSearch = false;
  let composingQuickAdd = false;
  let inlineEdit = null;

  function id() {
    return createId();
  }

  function normalizeTask(task) {
    return normalizeTaskRecord(task, categories);
  }

  function saveTasks() {
    return persistTasks(tasks);
  }

  function saveCategories() {
    return persistCategories(categories);
  }

  function saveUI() {
    return persistUI(ui);
  }

  function applyTheme() {
    return applyStoredTheme(ui);
  }

  function categoryTone(category) {
    return resolveCategoryTone(categories, category);
  }

  function visibleTasks() {
    return tasks.filter(task => matchesTaskSearch(task, ui.search));
  }

  function compareTasks(a, b) {
    return compareTaskRecords(a, b, ui.sort);
  }

  const views = window.NekoTickViews.createViews({
    app,
    renderMarkdown,
    visibleTasks,
    compareTasks,
    categoryTone
  });
  const dialogs = window.NekoTickDialogs.createDialogs({
    root: modalRoot,
    categoryTone
  });

  function currentViewState() {
    return { tasks, ui, categories, today, inlineEdit, completingTaskId };
  }

  function render(options = {}) {
    return views.render(currentViewState(), options);
  }

  function previewTimelineLayout(taskId, start, duration) {
    return views.previewTimelineLayout(currentViewState(), taskId, start, duration);
  }

  window.NekoTickDrag.createDragController({
    app,
    getState: () => ({ tasks, ui }),
    previewTimelineLayout,
    render,
    reorderListTask,
    saveTasks
  });

  // Persist the initial sample set as well. Without this, a refresh before the
  // first edit would generate a fresh set of ids and lose any in-memory state.
  applyTheme();
  if (!hasSavedTaskList()) saveTasks();
  render();
  watchSystemDate();
  watchStorage();

  function reorderListTask(sourceId, targetId, placeAfter = false, adoptTargetQuadrant = false) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const ordered = [...tasks].sort(compareTasks);
    const sourceIndex = ordered.findIndex(task => task.id === sourceId);
    if (sourceIndex < 0 || !ordered.some(task => task.id === targetId)) return false;
    const [source] = ordered.splice(sourceIndex, 1);
    const targetIndex = ordered.findIndex(task => task.id === targetId);
    if (adoptTargetQuadrant) source.quadrant = ordered[targetIndex].quadrant;
    ordered.splice(targetIndex + (placeAfter ? 1 : 0), 0, source);
    ordered.forEach((task, index) => { task.manualOrder = index; });
    ui.sort = "manual";
    saveTasks();
    saveUI();
    return true;
  }

  // -- Lifecycle synchronization -------------------------------------------
  function watchSystemDate() {
    window.setInterval(() => {
      const next = startOfDay(new Date());
      if (sameDay(next, today)) return;
      const previousKey = toDateKey(today);
      const previousMonth = toDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
      const previousYear = today.getFullYear();
      today = next;
      // Keep relative navigation useful when the app stays open overnight,
      // while respecting dates the user is explicitly browsing.
      if (ui.selectedDate === previousKey) ui.selectedDate = toDateKey(today);
      if (ui.monthCursor === previousMonth) ui.monthCursor = toDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
      if (Number(ui.yearCursor) === previousYear) ui.yearCursor = today.getFullYear();
      saveUI();
      render({ keepScroll: true });
    }, 60 * 1000);
  }

  function watchStorage() {
    window.addEventListener("storage", event => {
      if (event.key === STORE_KEY) {
        try {
          const saved = JSON.parse(event.newValue);
          if (!Array.isArray(saved)) return;
          tasks = saved.map(normalizeTask);
          render({ keepScroll: true });
        } catch (_) {}
        return;
      }
      if (event.key === CATEGORY_STORE_KEY) {
        categories = readCategories();
        render({ keepScroll: true });
        return;
      }
      if (event.key !== UI_KEY) return;
      try {
        const saved = JSON.parse(event.newValue);
        if (!saved || typeof saved !== "object") return;
        const search = ui.search;
        const sidebarOpen = ui.sidebarOpen;
        ui = { ...ui, ...saved, search, sidebarOpen };
        if (!["light", "dark"].includes(ui.theme)) ui.theme = "light";
        if (!VIEW_KEYS.includes(ui.view)) ui.view = "list";
        if (!CALENDAR_MODES.includes(ui.calendarMode)) ui.calendarMode = "day";
        applyTheme();
        render({ keepScroll: true });
      } catch (_) {}
    });
  }

  // -- Forms and task mutations ---------------------------------------------
  function openTaskModal(taskId = "", defaultStatus = "todo") {
    ui.taskMenuId = "";
    const current = tasks.find(task => task.id === taskId);
    const isEdit = Boolean(current);
    const defaultDate = ui.view === "calendar" && ui.calendarMode === "day" ? ui.selectedDate : toDateKey(today);
    const task = current || {
      ...normalizeTask({
        id: "",
        title: "",
        date: defaultDate,
        time: "",
        category: "工作",
        notes: "",
        quadrant: "q2",
        status: "todo",
        completed: false,
        createdAt: Date.now()
      }),
      // Drafts should be genuinely empty so the placeholder remains visible.
      title: "",
      status: BOARD_COLUMNS[defaultStatus] ? defaultStatus : "todo"
    };
    dialogs.showTaskForm({ task, isEdit, today, categories });
  }

  function openCategoryManager() {
    dialogs.showCategoryManager(categories);
  }

  function addCategory(value) {
    const category = String(value || "").trim();
    if (!category || categories.includes(category)) return false;
    categories.push(category);
    saveCategories();
    render({ keepScroll: true });
    openCategoryManager();
    return true;
  }

  function deleteCategory(category) {
    if (!categories.includes(category) || categories.length <= 1) return;
    categories = categories.filter(item => item !== category);
    const fallback = categories.includes("其他") ? "其他" : categories[0];
    tasks.forEach(task => { if (task.category === category) task.category = fallback; });
    saveCategories();
    saveTasks();
    render({ keepScroll: true });
    openCategoryManager();
  }

  function closeModal() {
    dialogs.close();
  }

  function submitQuickAdd(form) {
    const input = form.querySelector(".quick-add-input");
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) {
      input?.focus();
      return;
    }
    tasks.push(normalizeTask({
      id: id(),
      title,
      date: String(data.get("date") || ""),
      time: String(data.get("time") || ""),
      category: String(data.get("category") || "工作"),
      notes: String(data.get("notes") || "").trim(),
      quadrant: String(data.get("quadrant") || "q2"),
      status: "todo",
      completed: false,
      createdAt: Date.now()
    }));
    ui.filter = "all";
    ui.search = "";
    saveTasks();
    saveUI();
    render({ keepScroll: true, focusQuickAdd: true });
  }

  function resizeQuickAddInput(input) {
    if (!input?.matches(".quick-add-input")) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  }

  function submitTaskForm(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) {
      showFormError("task-title", "title-error", "请输入任务名称");
      return;
    }
    const date = String(data.get("date") || "");
    if (date && !isValidDateKey(date)) {
      showFormError("task-date", "date-error", "请输入有效的日期");
      return;
    }
    const time = String(data.get("time") || "");
    if (time && !isValidTime(time)) {
      showFormError("task-time", "time-error", "请输入有效的时间");
      return;
    }
    const taskId = form.dataset.id;
    const values = {
      title,
      date,
      time,
      category: String(data.get("category") || "其他"),
      quadrant: String(data.get("quadrant") || "q2"),
      status: String(data.get("status") || "todo"),
      notes: String(data.get("notes") || "").trim()
    };
    if (taskId) {
      const index = tasks.findIndex(task => task.id === taskId);
      if (index >= 0) tasks[index] = normalizeTask({ ...tasks[index], ...values });
    } else {
      tasks.push(normalizeTask({ ...values, id: id(), completed: values.status === "done", createdAt: Date.now() }));
    }
    saveTasks();
    closeModal();
    render({ keepScroll: true });
  }

  function showFormError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input?.classList.add("invalid");
    input?.setAttribute("aria-invalid", "true");
    if (error) error.textContent = message;
    input?.focus();
  }

  function toggleTask(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    const completing = !task.completed;
    task.completed = !task.completed;
    task.status = task.completed ? "done" : task.status === "done" ? "todo" : task.status;
    completingTaskId = completing ? taskId : "";
    saveTasks();
    render({ keepScroll: true });
    if (completing) {
      window.setTimeout(() => {
        if (completingTaskId !== taskId) return;
        completingTaskId = "";
        render({ keepScroll: true });
      }, 420);
    }
  }

  function requestDeleteTask(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    ui.taskMenuId = "";
    closeModal();
    dialogs.showDeleteConfirmation(task);
  }

  function deleteTask(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    tasks = tasks.filter(item => item.id !== taskId);
    saveTasks();
    closeModal();
    render({ keepScroll: true });
  }

  function beginInlineEdit(taskId, field) {
    const task = tasks.find(item => item.id === taskId);
    if (!task || !["title", "date", "time", "category", "notes"].includes(field)) return;
    inlineEdit = { taskId, field };
    render({ keepScroll: true });
    const editor = document.querySelector(`.inline-editor[data-id="${CSS.escape(taskId)}"][data-field="${field}"]`);
    if (!editor) return;
    editor.focus();
    if (field === "title") editor.select();
    if (field === "notes") editor.setSelectionRange(editor.value.length, editor.value.length);
    if (["date", "time", "category"].includes(field)) {
      try { editor.showPicker?.(); } catch (_) {}
    }
  }

  function commitInlineEditor(editor, shouldRender = true) {
    if (!editor || editor.dataset.committed === "true") return;
    editor.dataset.committed = "true";
    const task = tasks.find(item => item.id === editor.dataset.id);
    const field = editor.dataset.field;
    if (!task || !["title", "date", "time", "category", "notes"].includes(field)) return;
    let value = String(editor.value || "");
    if (["title", "notes"].includes(field)) value = value.trim();
    const valid = (field !== "title" || value) &&
      (field !== "date" || !value || isValidDateKey(value)) &&
      (field !== "time" || !value || isValidTime(value)) &&
      (field !== "category" || categories.includes(value));
    if (valid) {
      task[field] = value;
      saveTasks();
    }
    if (inlineEdit?.taskId === task.id && inlineEdit.field === field) inlineEdit = null;
    if (shouldRender) render({ keepScroll: true });
  }

  function cancelInlineEdit() {
    inlineEdit = null;
    render({ keepScroll: true });
  }

  // -- Navigation and view state --------------------------------------------
  function setView(view) {
    if (!VIEW_KEYS.includes(view)) return;
    ui.view = view;
    ui.sidebarOpen = false;
    ui.sortMenuOpen = false;
    ui.taskMenuId = "";
    saveUI();
    render();
  }

  function navigateDate(direction) {
    if (ui.calendarMode === "day") {
      ui.selectedDate = toDateKey(addDays(fromDateKey(ui.selectedDate), direction));
    } else if (ui.calendarMode === "month") {
      ui.monthCursor = toDateKey(addMonths(fromDateKey(ui.monthCursor), direction));
    } else if (ui.calendarMode === "year") {
      ui.yearCursor = Number(ui.yearCursor) + direction;
    }
    saveUI();
    render();
  }

  function resetDate() {
    if (ui.calendarMode === "day") ui.selectedDate = toDateKey(today);
    if (ui.calendarMode === "month") ui.monthCursor = toDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
    if (ui.calendarMode === "year") ui.yearCursor = today.getFullYear();
    saveUI();
    render();
  }

  function setCalendarMode(mode) {
    if (!CALENDAR_MODES.includes(mode)) return;
    if (mode === "month") {
      const selected = fromDateKey(ui.selectedDate);
      ui.monthCursor = toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    if (mode === "year") {
      const source = ui.calendarMode === "month" ? fromDateKey(ui.monthCursor) : fromDateKey(ui.selectedDate);
      ui.yearCursor = source.getFullYear();
    }
    ui.calendarMode = mode;
    saveUI();
    render();
  }

  // -- Delegated application events -----------------------------------------
  app.addEventListener("click", event => {
    if (event.target.closest(".markdown-note a")) return;
    const nav = event.target.closest("[data-view]");
    if (nav) return setView(nav.dataset.view);

    const sortOption = event.target.closest("[data-sort-option]");
    if (sortOption) {
      ui.sort = sortOption.dataset.sortOption;
      ui.sortMenuOpen = false;
      saveUI();
      render({ keepScroll: true });
      return;
    }
    const sortToggle = event.target.closest("[data-action=toggle-sort-menu]");
    if (sortToggle) {
      ui.sortMenuOpen = !ui.sortMenuOpen;
      render({ keepScroll: true });
      return;
    }
    if (ui.sortMenuOpen && !event.target.closest(".sort-menu")) {
      ui.sortMenuOpen = false;
      render({ keepScroll: true });
    }

    const menuToggle = event.target.closest("[data-action=toggle-task-menu]");
    if (menuToggle) {
      ui.taskMenuId = ui.taskMenuId === menuToggle.dataset.id ? "" : menuToggle.dataset.id;
      render({ keepScroll: true });
      return;
    }
    if (ui.taskMenuId && !event.target.closest(".task-actions")) {
      ui.taskMenuId = "";
      render({ keepScroll: true });
    }

    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "inline-edit") return beginInlineEdit(target.dataset.id, target.dataset.field);
    if (action === "open-category-manager") return openCategoryManager();
    if (action === "new-task") openTaskModal();
    if (action === "new-board-task") openTaskModal("", target.dataset.status);
    if (action === "edit-task") openTaskModal(target.dataset.id);
    if (action === "toggle-task") toggleTask(target.dataset.id);
    if (action === "delete-task") requestDeleteTask(target.dataset.id);
    if (action === "open-sidebar") { ui.sidebarOpen = true; render(); }
    if (action === "close-sidebar") { ui.sidebarOpen = false; render(); }
    if (action === "clear-search") { ui.search = ""; render({ focusSearch: true }); }
    if (action === "date-prev") navigateDate(-1);
    if (action === "date-next") navigateDate(1);
    if (action === "date-today") resetDate();
    if (action === "open-day") {
      ui.selectedDate = target.dataset.date;
      ui.view = "calendar";
      ui.calendarMode = "day";
      saveUI();
      render();
    }
  });

  app.addEventListener("input", event => {
    if (event.target.matches(".quick-add-input")) {
      resizeQuickAddInput(event.target);
      return;
    }
    if (!event.target.matches(".search-input")) return;
    ui.search = event.target.value;
    if (composingSearch) return;
    render({ focusSearch: true });
  });

  app.addEventListener("change", event => {
    if (event.target.matches(".inline-editor") && !event.target.matches(".inline-title-editor, .inline-notes-editor")) {
      commitInlineEditor(event.target);
      return;
    }
    const field = event.target.closest(".quick-add [name]");
    if (!field) return;
    const form = field.closest(".quick-add");
    if (field.matches('.quick-add-quadrants input[name="quadrant"]') && form) form.dataset.quadrant = field.value;
    requestAnimationFrame(() => {
      const input = form?.querySelector(".quick-add-input");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  app.addEventListener("submit", event => {
    const form = event.target.closest('[data-form="quick-add"]');
    if (!form) return;
    event.preventDefault();
    submitQuickAdd(form);
  });

  app.addEventListener("compositionstart", event => {
    if (event.target.matches(".search-input")) composingSearch = true;
    if (event.target.matches(".quick-add-input")) composingQuickAdd = true;
  });

  app.addEventListener("compositionend", event => {
    if (event.target.matches(".quick-add-input")) {
      composingQuickAdd = false;
      resizeQuickAddInput(event.target);
      return;
    }
    if (!event.target.matches(".search-input")) return;
    composingSearch = false;
    ui.search = event.target.value;
    render({ focusSearch: true });
  });

  app.addEventListener("click", event => {
    const calendarMode = event.target.closest("[data-calendar-mode]");
    if (calendarMode) return setCalendarMode(calendarMode.dataset.calendarMode);
    const filter = event.target.closest("[data-filter]");
    if (!filter) return;
    ui.filter = filter.dataset.filter;
    saveUI();
    render({ keepScroll: true });
  });

  app.addEventListener("keydown", event => {
    if (event.target.matches(".inline-editor")) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelInlineEdit();
        return;
      }
      const saveNotes = event.target.matches(".inline-notes-editor") && event.key === "Enter" && (event.ctrlKey || event.metaKey);
      const saveField = !event.target.matches(".inline-notes-editor") && event.key === "Enter";
      if (saveNotes || saveField) {
        event.preventDefault();
        commitInlineEditor(event.target);
        return;
      }
    }
    if (event.target.matches(".task-drag-handle") && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      const row = event.target.closest(".task-row");
      const targetRow = event.key === "ArrowUp" ? row?.previousElementSibling : row?.nextElementSibling;
      if (!row || !targetRow?.matches(".task-row")) return;
      event.preventDefault();
      const taskId = row.dataset.taskId;
      if (reorderListTask(taskId, targetRow.dataset.taskId, event.key === "ArrowDown")) {
        render({ keepScroll: true });
        requestAnimationFrame(() => document.querySelector(`.task-row[data-task-id="${CSS.escape(taskId)}"] .task-drag-handle`)?.focus());
      }
      return;
    }
    if (event.target.matches(".quick-add-input") && event.key === "Enter" && !event.shiftKey) {
      if (composingQuickAdd || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.target.form?.requestSubmit();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && event.target.matches('[role="button"][data-action]')) {
      event.preventDefault();
      event.target.click();
    }
  });

  app.addEventListener("focusout", event => {
    if (!event.target.matches(".inline-editor")) return;
    const editor = event.target;
    window.setTimeout(() => commitInlineEditor(editor), 0);
  });

  // -- Modal and keyboard events --------------------------------------------
  modalRoot.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (["set-task-date", "set-task-time"].includes(target.dataset.action)) {
      const form = target.closest("form");
      const fieldName = target.dataset.action === "set-task-date" ? "date" : "time";
      const field = form?.elements[fieldName];
      if (!field) return;
      field.value = target.dataset.value || "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (target.dataset.action === "close-modal" && (target === event.target || target.closest("button"))) closeModal();
    if (target.dataset.action === "open-category-manager") openCategoryManager();
    if (target.dataset.action === "delete-category") deleteCategory(target.dataset.category);
    if (target.dataset.action === "delete-task") requestDeleteTask(target.dataset.id);
    if (target.dataset.action === "confirm-delete") deleteTask(target.dataset.id);
  });

  modalRoot.addEventListener("submit", event => {
    if (event.target.matches('[data-form="category-manager"]')) {
      event.preventDefault();
      addCategory(new FormData(event.target).get("category"));
      return;
    }
    if (!event.target.matches("#task-form")) return;
    event.preventDefault();
    submitTaskForm(event.target);
  });

  modalRoot.addEventListener("input", event => {
    if (["task-title", "task-date", "task-time"].includes(event.target.id)) {
      event.target.classList.remove("invalid");
      event.target.removeAttribute("aria-invalid");
      const error = document.getElementById(`${event.target.id.replace("task-", "")}-error`);
      if (error) error.textContent = "";
    }
    if (["task-date", "task-time"].includes(event.target.id)) dialogs.syncSchedulePresets(event.target.form);
  });

  modalRoot.addEventListener("change", event => {
    if (!event.target.matches('input[name="quadrant"]')) return;
    const modal = event.target.closest(".modal");
    if (modal && QUADRANTS[event.target.value]) modal.dataset.quadrant = event.target.value;
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (modalRoot.innerHTML) closeModal();
      else if (ui.sidebarOpen) { ui.sidebarOpen = false; render(); }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector(".search-input")?.focus();
      return;
    }
    const editing = event.target.matches("input, textarea, select") || modalRoot.innerHTML;
    if (!editing && event.key.toLowerCase() === "n") openTaskModal();
  });

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemThemeChange = event => {
    if (!readStorage(UI_KEY)) {
      ui.theme = event.matches ? "dark" : "light";
      applyTheme();
      render({ keepScroll: true });
    }
  };
  if (typeof systemTheme.addEventListener === "function") {
    systemTheme.addEventListener("change", handleSystemThemeChange);
  } else if (typeof systemTheme.addListener === "function") {
    // Safari versions before 14 and a few embedded webviews only expose the
    // older MediaQueryList API.
    systemTheme.addListener(handleSystemThemeChange);
  }
})();
