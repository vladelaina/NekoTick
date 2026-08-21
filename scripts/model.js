(function () {
  "use strict";

  const {
    BOARD_COLUMNS,
    CALENDAR_MODES,
    CATEGORY_STORE_KEY,
    CATEGORY_TONES,
    DEFAULT_CATEGORIES,
    QUADRANTS,
    STORE_KEY,
    UI_KEY,
    VIEW_KEYS
  } = window.NekoTickConfig;
  const { addDays, createId, isValidDateKey, isValidTime, toDateKey } = window.NekoTickUtils;
  const { readStorage, writeStorage } = window.NekoTickStorage;

  function seedTasks(today) {
    const date = offset => toDateKey(addDays(today, offset));
    return [
      { id: createId(), title: "整理本周产品需求", date: date(0), time: "09:30", category: "工作", notes: "确认三个核心页面的交互范围。", quadrant: "q1", status: "doing", completed: false, createdAt: Date.now() - 50000 },
      { id: createId(), title: "完成 NekoTick 视觉走查", date: date(0), time: "14:00", category: "工作", notes: "检查浅色与深色主题。", quadrant: "q1", status: "doing", completed: false, createdAt: Date.now() - 45000 },
      { id: createId(), title: "阅读设计系统章节", date: date(0), time: "20:00", category: "学习", notes: "记录组件状态与间距规范。", quadrant: "q2", status: "todo", completed: false, createdAt: Date.now() - 40000 },
      { id: createId(), title: "预约周末体检", date: date(1), time: "", category: "健康", notes: "", quadrant: "q3", status: "backlog", completed: false, createdAt: Date.now() - 35000 },
      { id: createId(), title: "准备下周分享材料", date: date(3), time: "10:00", category: "工作", notes: "先完成提纲。", quadrant: "q2", status: "todo", completed: false, createdAt: Date.now() - 30000 },
      { id: createId(), title: "清理稍后阅读列表", date: date(6), time: "", category: "生活", notes: "", quadrant: "q4", status: "backlog", completed: false, createdAt: Date.now() - 25000 },
      { id: createId(), title: "回复项目邮件", date: date(-1), time: "16:30", category: "工作", notes: "", quadrant: "q1", status: "doing", completed: false, createdAt: Date.now() - 20000 },
      { id: createId(), title: "晨间拉伸 15 分钟", date: date(0), time: "07:30", category: "健康", notes: "", quadrant: "q2", status: "done", completed: true, createdAt: Date.now() - 15000 }
    ];
  }

  function normalizeTask(task, categories) {
    const rawDate = String(task.date || "");
    const rawTime = String(task.time || "");
    const completed = Boolean(task.completed);
    const requestedStatus = BOARD_COLUMNS[task.status] ? task.status : completed ? "done" : "todo";
    const status = completed ? "done" : requestedStatus === "done" ? "todo" : requestedStatus;
    const fallbackCategory = categories.includes("其他") ? "其他" : categories[0] || "其他";

    return {
      id: String(task.id || createId()),
      title: String(task.title || "未命名任务"),
      date: isValidDateKey(rawDate) ? rawDate : "",
      time: isValidTime(rawTime) ? rawTime : "",
      duration: Math.min(480, Math.max(15, Math.round((Number(task.duration) || 60) / 15) * 15)),
      category: categories.includes(task.category) ? task.category : fallbackCategory,
      notes: String(task.notes || ""),
      quadrant: QUADRANTS[task.quadrant] ? task.quadrant : "q2",
      status,
      completed,
      createdAt: Number(task.createdAt) || Date.now(),
      manualOrder: task.manualOrder !== null && task.manualOrder !== "" && Number.isFinite(Number(task.manualOrder))
        ? Number(task.manualOrder)
        : null
    };
  }

  function loadTasks(categories, today) {
    try {
      const saved = JSON.parse(readStorage(STORE_KEY));
      if (Array.isArray(saved)) return saved.map(task => normalizeTask(task, categories));
    } catch (_) {}
    return seedTasks(today).map(task => normalizeTask(task, categories));
  }

  function loadCategories() {
    try {
      const saved = JSON.parse(readStorage(CATEGORY_STORE_KEY));
      if (Array.isArray(saved)) {
        const result = [...new Set(saved.map(value => String(value || "").trim()).filter(Boolean))];
        if (result.length) return result;
      }
    } catch (_) {}
    return [...DEFAULT_CATEGORIES];
  }

  function loadUI(today) {
    const defaults = {
      view: "list",
      calendarMode: "day",
      selectedDate: toDateKey(today),
      monthCursor: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      yearCursor: today.getFullYear(),
      filter: "all",
      sort: "date",
      sortMenuOpen: false,
      search: "",
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      sidebarOpen: false,
      taskMenuId: ""
    };

    try {
      const saved = JSON.parse(readStorage(UI_KEY));
      const merged = { ...defaults, ...saved, sidebarOpen: false, search: "" };
      if (CALENDAR_MODES.includes(merged.view)) {
        merged.calendarMode = merged.view;
        merged.view = "calendar";
      }
      if (!VIEW_KEYS.includes(merged.view)) merged.view = "list";
      if (!CALENDAR_MODES.includes(merged.calendarMode)) merged.calendarMode = "day";
      if (!isValidDateKey(merged.selectedDate)) merged.selectedDate = defaults.selectedDate;
      if (!isValidDateKey(merged.monthCursor)) merged.monthCursor = defaults.monthCursor;
      if (!Number.isInteger(Number(merged.yearCursor)) || Number(merged.yearCursor) < 1) merged.yearCursor = defaults.yearCursor;
      if (!["all", "today", "recent", "upcoming", "completed"].includes(merged.filter)) merged.filter = "all";
      if (!["date", "quadrant", "created", "manual"].includes(merged.sort)) merged.sort = "date";
      if (!["light", "dark"].includes(merged.theme)) merged.theme = defaults.theme;
      return merged;
    } catch (_) {
      return defaults;
    }
  }

  function hasSavedTaskList() {
    try {
      return Array.isArray(JSON.parse(readStorage(STORE_KEY)));
    } catch (_) {
      return false;
    }
  }

  function saveTasks(tasks) {
    return writeStorage(STORE_KEY, JSON.stringify(tasks));
  }

  function saveCategories(categories) {
    return writeStorage(CATEGORY_STORE_KEY, JSON.stringify(categories));
  }

  function saveUI(ui) {
    const { sidebarOpen, search, taskMenuId, sortMenuOpen, ...persisted } = ui;
    return writeStorage(UI_KEY, JSON.stringify(persisted));
  }

  function applyTheme(ui) {
    document.documentElement.dataset.theme = ui.theme;
    document.documentElement.style.colorScheme = ui.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = ui.theme === "dark" ? "#101214" : "#eef3f8";
  }

  function categoryTone(categories, category) {
    const index = Math.max(0, categories.indexOf(category));
    return CATEGORY_TONES[index % CATEGORY_TONES.length];
  }

  function taskMatchesSearch(task, search) {
    const query = search.trim().toLocaleLowerCase("zh-CN");
    if (!query) return true;
    return [task.title, task.notes, task.category].join(" ").toLocaleLowerCase("zh-CN").includes(query);
  }

  function compareTasks(a, b, sort) {
    if (a.date === b.date && Boolean(a.time) !== Boolean(b.time)) return a.time ? 1 : -1;
    if (sort === "manual") {
      const aOrder = Number.isFinite(a.manualOrder) ? a.manualOrder : a.createdAt;
      const bOrder = Number.isFinite(b.manualOrder) ? b.manualOrder : b.createdAt;
      return aOrder - bOrder || a.createdAt - b.createdAt;
    }
    if (sort === "quadrant") {
      const order = { q1: 0, q2: 1, q3: 2, q4: 3 };
      return order[a.quadrant] - order[b.quadrant] || compareDateTime(a, b);
    }
    if (sort === "created") return b.createdAt - a.createdAt;
    return compareDateTime(a, b);
  }

  function compareDateTime(a, b) {
    const aKey = `${a.date || "9999-99-99"}T${a.time || "00:00"}`;
    const bKey = `${b.date || "9999-99-99"}T${b.time || "00:00"}`;
    return aKey.localeCompare(bKey) || b.createdAt - a.createdAt;
  }

  window.NekoTickModel = Object.freeze({
    seedTasks,
    normalizeTask,
    loadTasks,
    loadCategories,
    loadUI,
    hasSavedTaskList,
    saveTasks,
    saveCategories,
    saveUI,
    applyTheme,
    categoryTone,
    taskMatchesSearch,
    compareTasks,
    compareDateTime
  });
})();
