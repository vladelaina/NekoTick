(function () {
  "use strict";

  const { BOARD_COLUMNS, CATEGORY_TONES, QUADRANTS, WEEKDAYS } = window.NekoTickConfig;
  const {
    addDays,
    dayDiff: calculateDayDiff,
    esc,
    fromDateKey,
    icon,
    minutesToTime,
    pad,
    sameDay,
    timeToMinutes,
    toDateKey
  } = window.NekoTickUtils;

  let app;
  let renderMarkdown;
  let visibleTasks;
  let compareTasks;
  let categoryTone;
  let tasks = [];
  let ui = {};
  let categories = [];
  let today;
  let inlineEdit = null;
  let completingTaskId = "";

  function setState(state) {
    tasks = state.tasks;
    ui = state.ui;
    categories = state.categories;
    today = state.today;
    inlineEdit = state.inlineEdit;
    completingTaskId = state.completingTaskId;
  }

  function dayDiff(date) {
    return calculateDayDiff(date, today);
  }

  function renderView(options = {}) {
    const currentScroll = document.querySelector(".view-scroll")?.scrollTop || 0;
    const counts = getCounts();
    app.innerHTML = `
      <div class="app-shell">
        <div class="app-frame">
          ${renderSidebar(counts)}
          <div class="sidebar-mask${ui.sidebarOpen ? " open" : ""}" data-action="close-sidebar"></div>
          <main class="workspace">
            ${renderTopbar()}
            <div class="view-scroll">
              ${renderActiveView()}
            </div>
          </main>
        </div>
      </div>`;

    const scroll = document.querySelector(".view-scroll");
    if (scroll && options.keepScroll) scroll.scrollTop = currentScroll;

    if (options.focusSearch) {
      const input = document.querySelector(".search-input");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (options.focusQuickAdd) document.querySelector(".quick-add-input")?.focus();
  }


  function getCounts() {
    const todayKey = toDateKey(today);
    const pending = tasks.filter(task => !task.completed);
    const dueToday = pending.filter(task => task.date === todayKey).length;
    const overdue = pending.filter(task => task.date && task.date < todayKey).length;
    return { pending: pending.length, dueToday, overdue };
  }

  function renderSidebar(counts) {
    const navItems = [
      { key: "list", label: "清单", icon: "list-todo", count: counts.pending },
      { key: "calendar", label: "视图", icon: "calendar-range", count: counts.dueToday },
      { key: "quadrant", label: "四象限", icon: "grid-2x2", count: counts.overdue || "" },
      { key: "counts", label: "计数", icon: "chart-no-axes-column", count: tasks.length }
    ];
    return `<aside class="sidebar${ui.sidebarOpen ? " open" : ""}" aria-label="主导航">
      <div class="brand">
        <div class="brand-logo-wrap"><div class="brand-logo-inner"><img class="brand-logo" src="assets/logo.png" alt="NekoTick"></div></div>
        <div class="brand-copy"><div class="brand-name">Neko<span class="tick">Tick</span></div></div>
      </div>
      <button class="new-task-button" type="button" data-action="new-task">${icon("plus")}<span>新建任务</span></button>
      <nav class="nav-list">
        ${navItems.map(item => `<button class="nav-item${ui.view === item.key ? " active" : ""}" type="button" data-view="${item.key}">
          ${icon(item.icon)}<span class="nav-text">${item.label}</span>${item.count !== undefined && item.count !== "" ? `<span class="nav-count">${item.count}</span>` : ""}
        </button>`).join("")}
      </nav>
    </aside>`;
  }

  function renderTopbar() {
    return `<header class="topbar">
      <button class="icon-button mobile-menu-button" type="button" data-action="open-sidebar" title="打开导航" aria-label="打开导航">${icon("menu")}</button>
      <label class="search-wrap">
        <span class="sr-only">搜索任务</span>${icon("search")}
        <input class="search-input" type="search" value="${esc(ui.search)}" placeholder="搜索任务、备注或分类" autocomplete="off">
        ${ui.search ? `<button class="search-clear" type="button" data-action="clear-search" title="清除搜索" aria-label="清除搜索">${icon("x")}</button>` : ""}
      </label>
    </header>`;
  }

  function renderActiveView() {
    if (ui.view === "calendar") return renderCalendarView();
    if (ui.view === "quadrant") return renderQuadrantView();
    if (ui.view === "counts") return renderCountsView();
    return renderListView();
  }

  function header(title, subtitle, actions = true) {
    return `<header class="view-header">
      <div class="view-heading"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
      ${actions ? `<div class="header-actions"><button class="primary-button" type="button" data-action="new-task">${icon("plus")}<span>添加任务</span></button></div>` : ""}
    </header>`;
  }

  function renderListView() {
    const tabs = [
      ["all", "全部"], ["today", "今天"], ["recent", "最近7天"], ["upcoming", "未来"], ["completed", "已完成"]
    ];
    return `<div class="view-container">
      <form class="quick-add" data-form="quick-add" data-quadrant="q2">
        <div class="quick-add-main">
          ${icon("plus")}
          <textarea class="quick-add-input" name="title" rows="1" maxlength="80" placeholder="添加任务" autocomplete="off" aria-label="任务名称"></textarea>
          <fieldset class="quick-add-quadrants" aria-label="四象限">
            <legend class="sr-only">四象限</legend>
            ${Object.entries(QUADRANTS).map(([key, quadrant]) => `<label class="quick-quadrant-choice ${key}" title="${quadrant.title}"><input name="quadrant" type="radio" value="${key}"${key === "q2" ? " checked" : ""}><span class="quick-quadrant-dot ${key}"></span><span class="sr-only">${quadrant.title}</span></label>`).join("")}
          </fieldset>
          <button class="quick-add-submit" type="submit" title="添加任务" aria-label="添加任务">${icon("arrow-up")}</button>
        </div>
        <div class="quick-add-options">
          <label class="quick-add-option" title="任务日期">${icon("calendar-days")}<span class="sr-only">任务日期</span><input name="date" type="date" value="${toDateKey(today)}" aria-label="任务日期"></label>
          <label class="quick-add-option" title="任务时间">${icon("clock")}<span class="sr-only">任务时间</span><input name="time" type="time" aria-label="任务时间"></label>
          <label class="quick-add-option" title="任务分类">${icon("tag")}<span class="sr-only">任务分类</span><select name="category" aria-label="任务分类">${categories.map(category => `<option value="${esc(category)}"${category === "工作" ? " selected" : ""}>${esc(category)}</option>`).join("")}</select><button class="category-manage-button" type="button" data-action="open-category-manager" title="管理分类" aria-label="管理分类">${icon("plus")}</button></label>
          <label class="quick-add-option quick-add-notes" title="任务备注">${icon("pencil")}<span class="sr-only">任务备注</span><textarea name="notes" maxlength="2000" rows="1" placeholder="备注（可选）" aria-label="任务备注"></textarea></label>
        </div>
      </form>
      <div class="toolbar">
        <div class="segmented" role="tablist" aria-label="任务筛选">
          ${tabs.map(([key, label]) => `<button class="segment${ui.filter === key ? " active" : ""}" type="button" role="tab" aria-selected="${ui.filter === key}" data-filter="${key}">${label}</button>`).join("")}
        </div>
        <div class="toolbar-spacer"></div>
        ${renderSortMenu()}
      </div>
      ${renderListGroups()}
    </div>`;
  }

  function renderSortMenu() {
    const options = [["manual", "手动排序"], ["date", "按日期排序"], ["quadrant", "按四象限排序"], ["created", "按创建时间排序"]];
    const selected = options.find(([value]) => value === ui.sort) || options[0];
    return `<div class="sort-menu${ui.sortMenuOpen ? " open" : ""}">
      <button class="sort-menu-trigger" type="button" data-action="toggle-sort-menu" aria-haspopup="listbox" aria-expanded="${ui.sortMenuOpen}">
        <span>${selected[1]}</span>${icon("chevron-down")}
      </button>
      ${ui.sortMenuOpen ? `<div class="sort-menu-options" role="listbox" aria-label="排序方式">
        ${options.map(([value, label]) => `<button class="sort-menu-option${ui.sort === value ? " selected" : ""}" type="button" role="option" aria-selected="${ui.sort === value}" data-sort-option="${value}">${label}</button>`).join("")}
      </div>` : ""}
    </div>`;
  }

  function renderListGroups() {
    const todayKey = toDateKey(today);
    let items = visibleTasks();
    if (ui.filter === "today") items = items.filter(task => task.date === todayKey && !task.completed);
    if (ui.filter === "recent") {
      const recentStartKey = toDateKey(addDays(today, -6));
      items = items.filter(task => !task.completed && task.date >= recentStartKey && task.date <= todayKey);
    }
    if (ui.filter === "upcoming") items = items.filter(task => task.date > todayKey && !task.completed);
    if (ui.filter === "completed") items = items.filter(task => task.completed);
    if (ui.filter === "all") {
      const groups = [
        { label: "已逾期", className: "pink", items: items.filter(task => !task.completed && task.date && task.date < todayKey) },
        { label: "今天", className: "pink", items: items.filter(task => !task.completed && task.date === todayKey) },
        { label: "接下来", className: "", items: items.filter(task => !task.completed && task.date > todayKey) },
        { label: "暂未安排", className: "", items: items.filter(task => !task.completed && !task.date) },
        { label: "已完成", className: "", items: items.filter(task => task.completed) }
      ];
      const nonEmpty = groups.filter(group => group.items.length);
      if (!nonEmpty.length) return renderEmpty(ui.search ? "没有匹配的任务" : "清单已经空了", ui.search ? "换个关键词再试试。" : "添加一个任务，给今天一个清晰的开始。", false);
      return nonEmpty.map(group => renderTaskSection(group.label, group.items, group.className)).join("");
    }
    if (!items.length) return renderEmpty(ui.search ? "没有匹配的任务" : "这里还没有任务", ui.search ? "换个关键词或筛选条件试试。" : "添加一个任务后，它会出现在这里。", false);
    const label = { today: "今天", recent: "最近 7 天", upcoming: "未来任务", completed: "已完成" }[ui.filter];
    return renderTaskSection(label, items, ["today", "recent"].includes(ui.filter) ? "pink" : "");
  }

  function renderTaskSection(label, items, className = "") {
    const sorted = [...items].sort(compareTasks);
    return `<section class="task-section"><div class="section-heading ${className}">${esc(label)} <span>${sorted.length}</span></div><div class="task-list">${sorted.map(renderTaskRow).join("")}</div></section>`;
  }

  function renderTaskRow(task) {
    const dateMeta = task.date ? formatTaskDate(task.date) : "未安排日期";
    const overdue = !task.completed && task.date && task.date < toDateKey(today);
    const editing = inlineEdit?.taskId === task.id ? inlineEdit.field : "";
    return `<article class="task-row${task.completed ? " completed" : ""}" draggable="true" data-task-id="${esc(task.id)}">
      <button class="task-drag-handle" type="button" title="拖动排序" aria-label="拖动任务排序">${icon("grip-vertical")}</button>
      <button class="task-check${task.completed ? " checked" : ""}${completingTaskId === task.id ? " just-completed" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.completed ? "标记为未完成" : "标记为完成"}">${icon("check-square")}</button>
      <div class="task-content">
        <div class="task-body">
          <div class="task-title-line">${editing === "title"
            ? `<input class="inline-editor inline-title-editor task-title ${task.quadrant}" data-id="${esc(task.id)}" data-field="title" value="${esc(task.title)}" maxlength="80" aria-label="任务名称">`
            : `<button class="task-title inline-edit-trigger ${task.quadrant}" type="button" data-action="inline-edit" data-id="${esc(task.id)}" data-field="title" title="点击编辑任务名称">${esc(task.title)}</button>`}
          </div>
          <div class="task-meta">
            ${editing === "date"
              ? `<input class="inline-editor inline-meta-editor" data-id="${esc(task.id)}" data-field="date" type="date" value="${esc(task.date)}" aria-label="任务日期">`
              : `<button class="task-meta-item inline-edit-trigger${overdue ? " overdue" : ""}" type="button" data-action="inline-edit" data-id="${esc(task.id)}" data-field="date" title="点击编辑日期">${icon("calendar-days")}${esc(dateMeta)}</button>`}
            ${editing === "time"
              ? `<input class="inline-editor inline-meta-editor" data-id="${esc(task.id)}" data-field="time" type="time" value="${esc(task.time)}" aria-label="任务时间">`
              : `<button class="task-meta-item inline-edit-trigger${task.time ? "" : " empty"}" type="button" data-action="inline-edit" data-id="${esc(task.id)}" data-field="time" title="点击编辑时间">${icon("clock")}${esc(task.time || "时间")}</button>`}
            ${editing === "category"
              ? `<select class="inline-editor inline-category-editor" data-id="${esc(task.id)}" data-field="category" aria-label="任务分类">${categories.map(category => `<option value="${esc(category)}"${task.category === category ? " selected" : ""}>${esc(category)}</option>`).join("")}</select>`
              : `<button class="category-chip ${categoryTone(task.category)} inline-edit-trigger" type="button" data-action="inline-edit" data-id="${esc(task.id)}" data-field="category" title="点击编辑分类">${esc(task.category)}</button>`}
            ${!task.notes && editing !== "notes" ? `<button class="task-meta-item inline-edit-trigger empty" type="button" data-action="inline-edit" data-id="${esc(task.id)}" data-field="notes" title="点击添加备注">${icon("pencil")}备注</button>` : ""}
          </div>
        </div>
        ${editing === "notes"
          ? `<textarea class="inline-editor inline-notes-editor" data-id="${esc(task.id)}" data-field="notes" maxlength="2000" rows="2" aria-label="任务备注">${esc(task.notes)}</textarea>`
          : task.notes
            ? `<div class="markdown-note inline-edit-trigger" data-action="inline-edit" data-id="${esc(task.id)}" data-field="notes" tabindex="0" role="button" title="点击编辑备注">${renderMarkdown(task.notes)}</div>`
            : ""}
      </div>
      <div class="task-actions">
        <button class="icon-button small" type="button" data-action="toggle-task-menu" data-id="${esc(task.id)}" aria-expanded="${ui.taskMenuId === task.id}" title="更多操作" aria-label="更多操作">${icon("more-horizontal")}</button>
        ${ui.taskMenuId === task.id ? `<div class="task-menu" role="menu">
          <button type="button" role="menuitem" data-action="edit-task" data-id="${esc(task.id)}">${icon("pencil")}编辑</button>
          <button type="button" role="menuitem" class="danger" data-action="delete-task" data-id="${esc(task.id)}">${icon("trash")}删除</button>
        </div>` : ""}
      </div>
    </article>`;
  }

  function renderEmpty(title, text, withAction = true) {
    return `<div class="empty-state"><div class="empty-state-inner"><div class="empty-cat"><img src="assets/logo.png" alt=""></div><h3>${esc(title)}</h3><p>${esc(text)}</p>${withAction ? `<button class="primary-button" type="button" data-action="new-task">${icon("plus")}添加任务</button>` : ""}</div></div>`;
  }

  function formatTaskDate(key) {
    const diff = dayDiff(fromDateKey(key));
    if (diff === -1) return "昨天";
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    const date = fromDateKey(key);
    if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function dateNavigator(label) {
    return `<div class="date-navigator">
      <button class="icon-button" type="button" data-action="date-prev" title="上一个" aria-label="上一个">${icon("chevron-left")}</button>
      <button class="date-label-button" type="button" data-action="date-today">${esc(label)}</button>
      <button class="icon-button" type="button" data-action="date-next" title="下一个" aria-label="下一个">${icon("chevron-right")}</button>
    </div>`;
  }

  function renderCalendarView() {
    const modes = [["day", "日视图"], ["month", "月视图"], ["year", "年视图"], ["board", "看板"]];
    let label = `${Number(ui.yearCursor)}年`;
    if (ui.calendarMode === "day") {
      const selected = fromDateKey(ui.selectedDate);
      label = `${selected.getMonth() + 1}月${selected.getDate()}日`;
    }
    if (ui.calendarMode === "month") {
      const cursor = fromDateKey(ui.monthCursor);
      label = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
    }
    const subtitles = {
      day: "按时间查看当天安排。",
      month: "从整月节奏中查看任务密度，点击日期进入当天安排。",
      year: "俯瞰一整年的任务分布，蓝色圆点代表当天有安排。",
      board: "按工作状态推进任务，可以直接拖动任务换列。"
    };
    return `<div class="view-container calendar-view-container">
      ${header("视图", subtitles[ui.calendarMode])}
      <div class="calendar-view-toolbar">
        <div class="segmented calendar-mode-switch" role="tablist" aria-label="视图模式">
          ${modes.map(([key, text]) => `<button class="segment${ui.calendarMode === key ? " active" : ""}" type="button" role="tab" aria-selected="${ui.calendarMode === key}" data-calendar-mode="${key}">${text}</button>`).join("")}
        </div>
        <div class="toolbar-spacer"></div>
        ${ui.calendarMode === "board" ? "" : dateNavigator(label)}
      </div>
      ${ui.calendarMode === "board" ? renderBoardView() : ui.calendarMode === "month" ? renderMonthView() : ui.calendarMode === "year" ? renderYearView() : renderDayView()}
    </div>`;
  }

  function renderBoardView() {
    const items = visibleTasks().sort(compareTasks);
    return `<div class="board-shell">
      ${Object.entries(BOARD_COLUMNS).map(([status, column]) => {
        const columnTasks = items.filter(task => task.status === status);
        return `<section class="board-column ${column.color}" data-board-status="${status}">
          <header class="board-column-header">
            <span class="board-status-dot"></span>
            <strong>${column.title}</strong>
            <span class="board-count">${columnTasks.length}</span>
            <button class="icon-button small" type="button" data-action="new-board-task" data-status="${status}" title="添加到${column.title}" aria-label="添加到${column.title}">${icon("plus")}</button>
          </header>
          <div class="board-list">
            ${columnTasks.length ? columnTasks.map(renderBoardTask).join("") : `<div class="board-empty">暂无任务</div>`}
          </div>
        </section>`;
      }).join("")}
    </div>`;
  }

  function renderBoardTask(task) {
    const dateMeta = task.date ? formatTaskDate(task.date) : "未安排日期";
    return `<article class="board-task${task.completed ? " completed" : ""}" draggable="true" data-board-task-id="${esc(task.id)}" data-action="edit-task" data-id="${esc(task.id)}" tabindex="0" role="button">
      <div class="board-task-topline">
        <button class="task-check${task.completed ? " checked" : ""}${completingTaskId === task.id ? " just-completed" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.completed ? "标记为未完成" : "标记为完成"}">${icon("check-square")}</button>
        <strong class="board-task-title ${task.quadrant}">${esc(task.title)}</strong>
      </div>
      <div class="board-task-meta">${icon("calendar-days")}<span>${esc(dateMeta)}${task.time ? ` ${esc(task.time)}` : ""}</span><span class="category-chip ${categoryTone(task.category)}">${esc(task.category)}</span></div>
    </article>`;
  }

  function renderDayView() {
    const selectedTasks = visibleTasks().filter(task => task.date === ui.selectedDate).sort(compareTasks);
    const scheduled = selectedTasks.filter(task => task.time);
    const unscheduled = selectedTasks.filter(task => !task.time);
    const starts = scheduled.map(task => timeToMinutes(task.time));
    const ends = scheduled.map(task => timeToMinutes(task.time) + task.duration);
    const startHour = Math.min(8, ...starts.map(minutes => Math.floor(minutes / 60)));
    const endHour = Math.max(22, ...ends.map(minutes => Math.ceil(minutes / 60)));
    const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, index) => startHour + index);
    const layouts = layoutTimelineTasks(scheduled);
    return `<div class="day-layout">
        <div class="timeline">
          ${hours.map(hour => `<div class="timeline-row"><div class="timeline-time">${pad(hour)}:00</div><div class="timeline-slot"></div></div>`).join("")}
          <div class="timeline-events-layer" data-start-hour="${startHour}" data-end-hour="${endHour}">${layouts.map(layout => renderTimelineTask(layout, startHour)).join("")}</div>
        </div>
        <aside class="unscheduled-panel">
          <div class="panel-heading">全天任务 <span>${unscheduled.length}</span></div>
          <div class="mini-task-list">${unscheduled.length ? unscheduled.map(renderMiniTask).join("") : `<div class="mini-empty">暂无全天任务</div>`}</div>
          <div class="panel-heading">快速操作 <button class="icon-button small" type="button" data-action="new-task" title="添加当天任务" aria-label="添加当天任务">${icon("plus")}</button></div>
        </aside>
    </div>`;
  }

  function layoutTimelineTasks(scheduled) {
    const sorted = scheduled.map(task => ({ task, start: timeToMinutes(task.time), end: timeToMinutes(task.time) + task.duration }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const layouts = [];
    let active = [];
    let group = [];
    let groupColumns = 1;

    const finishGroup = () => {
      group.forEach(item => { item.columns = groupColumns; });
      group = [];
      groupColumns = 1;
    };

    sorted.forEach(item => {
      active = active.filter(entry => entry.end > item.start);
      if (!active.length && group.length) finishGroup();
      const used = new Set(active.map(entry => entry.column));
      let column = 0;
      while (used.has(column)) column += 1;
      const layout = { ...item, column, columns: 1 };
      active.push(layout);
      group.push(layout);
      groupColumns = Math.max(groupColumns, active.length, column + 1);
      layouts.push(layout);
    });
    if (group.length) finishGroup();
    return layouts;
  }

  function renderTimelineTask(layout, startHour) {
    const { task, start, column, columns } = layout;
    const top = Math.round((start - startHour * 60) / 60 * 68) + 5;
    const height = Math.max(34, Math.round(task.duration / 60 * 68) - 8);
    const left = column / columns * 100;
    const right = (columns - column - 1) / columns * 100;
    const end = minutesToTime(start + task.duration);
    return `<div class="timeline-task ${task.quadrant}${task.completed ? " completed" : ""}" data-action="edit-task" data-id="${esc(task.id)}" tabindex="0" role="button" style="top:${top}px;height:${height}px;left:calc(${left}% + 9px);right:calc(${right}% + 9px)">
      <button class="task-resize-handle top" type="button" data-action="resize-task" data-edge="top" data-id="${esc(task.id)}" aria-label="调整任务开始时间"></button>
      <button class="task-check${task.completed ? " checked" : ""}${completingTaskId === task.id ? " just-completed" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.completed ? "标记为未完成" : "标记为完成"}">${icon("check-square")}</button>
      <div class="timeline-task-copy"><strong class="${task.quadrant}">${esc(task.title)}</strong><span class="timeline-task-range">${esc(task.time)}-${esc(end)} · ${esc(task.category)}</span></div>
      <button class="task-resize-handle bottom" type="button" data-action="resize-task" data-edge="bottom" data-id="${esc(task.id)}" aria-label="调整任务结束时间"></button>
    </div>`;
  }

  function renderTimelinePreview(taskId, start, duration) {
    const layer = app.querySelector(".timeline-events-layer");
    if (!layer) return;
    const startHour = Number(layer.dataset.startHour);
    const scheduled = visibleTasks()
      .filter(task => task.date === ui.selectedDate && task.time)
      .map(task => task.id === taskId ? { ...task, time: minutesToTime(start), duration } : task);
    layoutTimelineTasks(scheduled).forEach(({ task, start: taskStart, column, columns }) => {
      const card = [...layer.querySelectorAll(".timeline-task")].find(item => item.dataset.id === task.id);
      if (!card) return;
      const left = column / columns * 100;
      const right = (columns - column - 1) / columns * 100;
      card.style.top = `${Math.round((taskStart - startHour * 60) / 60 * 68) + 5}px`;
      card.style.height = `${Math.max(34, Math.round(task.duration / 60 * 68) - 8)}px`;
      card.style.left = `calc(${left}% + 9px)`;
      card.style.right = `calc(${right}% + 9px)`;
      card.style.transform = "";
    });
  }

  function renderMiniTask(task) {
    return `<div class="mini-task">
      <button class="task-check${task.completed ? " checked" : ""}${completingTaskId === task.id ? " just-completed" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.completed ? "标记为未完成" : "标记为完成"}">${icon("check-square")}</button>
      <div class="mini-task-copy" data-action="edit-task" data-id="${esc(task.id)}"><strong class="${task.quadrant}">${esc(task.title)}</strong><span>${esc(task.category)}</span></div>
    </div>`;
  }

  function renderMonthView() {
    const cursor = fromDateKey(ui.monthCursor);
    const cells = monthCells(cursor);
    return `<div class="calendar-shell">
        <div class="calendar-weekdays">${WEEKDAYS.map(day => `<div class="calendar-weekday">周${day}</div>`).join("")}</div>
        <div class="calendar-grid">${cells.map(({ date, outside }) => renderCalendarCell(date, outside, cursor)).join("")}</div>
    </div>`;
  }

  function monthCells(cursor) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    const start = addDays(first, -mondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);
      return { date, outside: date.getMonth() !== cursor.getMonth() };
    });
  }

  function renderCalendarCell(date, outside) {
    const key = toDateKey(date);
    const dayTasks = visibleTasks().filter(task => task.date === key).sort(compareTasks);
    return `<div class="calendar-cell${outside ? " outside" : ""}${sameDay(date, today) ? " today" : ""}${key === ui.selectedDate ? " selected" : ""}" data-action="open-day" data-date="${key}" role="button" tabindex="0" aria-label="${date.getMonth() + 1}月${date.getDate()}日，${dayTasks.length}项任务">
      <div class="day-number">${date.getDate()}</div>
      <div class="calendar-events">
        ${dayTasks.slice(0, 3).map(task => `<div class="calendar-event ${task.quadrant}${task.completed ? " completed" : ""}" data-month-task-id="${esc(task.id)}" data-action="edit-task" data-id="${esc(task.id)}" role="button" tabindex="0"><span class="calendar-event-label">${esc(task.time ? `${task.time} ${task.title}` : task.title)}</span></div>`).join("")}
        ${dayTasks.length > 3 ? `<div class="more-events">还有 ${dayTasks.length - 3} 项</div>` : ""}
      </div>
    </div>`;
  }

  function renderYearView() {
    const year = Number(ui.yearCursor);
    const months = Array.from({ length: 12 }, (_, month) => new Date(year, month, 1));
    return `<div class="year-grid">${months.map(renderYearMonth).join("")}</div>`;
  }

  function renderYearMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const monthTasks = visibleTasks().filter(task => task.date && fromDateKey(task.date).getFullYear() === year && fromDateKey(task.date).getMonth() === month);
    const cells = [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1))
    ];
    return `<section class="year-month">
      <div class="year-month-title">${month + 1}月 <span>${monthTasks.length} 项</span></div>
      <div class="mini-calendar-weekdays">${WEEKDAYS.map(day => `<div class="mini-weekday">${day}</div>`).join("")}</div>
      <div class="mini-calendar-grid">${cells.map(day => {
        if (!day) return `<span class="mini-day empty"></span>`;
        const key = toDateKey(day);
        const hasTask = monthTasks.some(task => task.date === key);
        return `<button class="mini-day${sameDay(day, today) ? " today" : ""}${hasTask ? " has-task" : ""}" type="button" data-action="open-day" data-date="${key}" aria-label="${month + 1}月${day.getDate()}日">${day.getDate()}</button>`;
      }).join("")}</div>
    </section>`;
  }

  function renderCountsView() {
    const source = visibleTasks();
    const todayKey = toDateKey(today);
    const weekEndKey = toDateKey(addDays(today, 7));
    const monthPrefix = todayKey.slice(0, 7);
    const pending = source.filter(task => !task.completed);
    const completed = source.filter(task => task.completed);
    const overdue = pending.filter(task => task.date && task.date < todayKey);
    const rate = source.length ? Math.round(completed.length / source.length * 100) : 0;
    const schedule = [
      ["今天待办", pending.filter(task => task.date === todayKey).length, "pink"],
      ["未来 7 天", pending.filter(task => task.date > todayKey && task.date <= weekEndKey).length, "blue"],
      ["已经逾期", overdue.length, "danger"],
      ["暂未安排", pending.filter(task => !task.date).length, "muted"],
      ["本月任务", source.filter(task => task.date?.startsWith(monthPrefix)).length, "green"]
    ];
    const category = categories.map((label, index) => [label, source.filter(task => task.category === label).length, CATEGORY_TONES[index % CATEGORY_TONES.length]]);
    const quadrant = Object.entries(QUADRANTS).map(([key, item], index) => [`${item.number} · ${item.title}`, source.filter(task => task.quadrant === key).length, ["pink", "blue", "warning", "muted"][index]]);
    return `<div class="view-container counts-view">
      ${header("计数", "从数量、时间、分类和四象限查看任务分布。", false)}
      ${ui.search ? `<div class="count-filter-note">当前统计已按“${esc(ui.search)}”筛选</div>` : ""}
      <div class="count-overview">
        ${renderCountCard("list-todo", "blue", source.length, "任务总数", "所有已记录任务")}
        ${renderCountCard("clock", "pink", pending.length, "进行中", "仍需处理的任务")}
        ${renderCountCard("circle-check", "green", completed.length, "已完成", `完成率 ${rate}%`)}
        ${renderCountCard("flag", "danger", overdue.length, "已逾期", overdue.length ? "建议优先处理" : "当前没有逾期")}
      </div>
      <div class="count-detail-grid">
        ${renderCountPanel("日期安排", "按当前日期计算", schedule, Math.max(source.length, 1))}
        ${renderCountPanel("任务分类", "不同领域的任务数量", category, Math.max(source.length, 1))}
        ${renderCountPanel("四象限", "重要性与紧急程度", quadrant, Math.max(source.length, 1))}
      </div>
    </div>`;
  }

  function renderCountCard(iconName, color, value, label, detail) {
    return `<section class="count-card">
      <div class="count-card-icon ${color}">${icon(iconName)}</div>
      <div class="count-card-copy"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(detail)}</small></div>
    </section>`;
  }

  function renderCountPanel(title, subtitle, rows, total) {
    return `<section class="count-panel">
      <header class="count-panel-header"><div><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div><span>${rows.length} 项指标</span></header>
      <div class="count-rows">${rows.map(([label, value, color]) => {
        const percentage = Math.round(value / total * 100);
        return `<div class="count-row">
          <div class="count-row-label"><span>${esc(label)}</span><strong>${value}</strong></div>
          <div class="count-bar"><span class="${color}" style="width:${percentage}%"></span></div>
        </div>`;
      }).join("")}</div>
    </section>`;
  }

  function renderQuadrantView() {
    const items = visibleTasks().sort(compareTasks);
    return `<div class="view-container">
      ${header("四象限", "按重要性与紧急程度做取舍；可以直接拖动任务调整象限。")}
      <div class="quadrant-board">
        ${Object.entries(QUADRANTS).map(([key, quadrant]) => {
          const quadrantTasks = items.filter(task => task.quadrant === key);
          return `<section class="quadrant" data-quadrant="${key}">
            <div class="quadrant-header"><div class="quadrant-number">${quadrant.number}</div><div class="quadrant-title"><strong>${quadrant.title}</strong><span>${quadrant.hint}</span></div><span class="quadrant-count">${quadrantTasks.length} 项</span></div>
            <div class="quadrant-list">${quadrantTasks.length ? quadrantTasks.map(renderQuadrantTask).join("") : `<div class="quadrant-empty">把任务拖到这里<br>或新建一项</div>`}</div>
          </section>`;
        }).join("")}
      </div>
    </div>`;
  }

  function renderQuadrantTask(task) {
    return `<article class="quadrant-task${task.completed ? " completed" : ""}" draggable="true" data-task-id="${esc(task.id)}">
      <div class="quadrant-task-line">
        <button class="task-check${task.completed ? " checked" : ""}${completingTaskId === task.id ? " just-completed" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.completed ? "标记为未完成" : "标记为完成"}">${icon("check-square")}</button>
        <div class="quadrant-task-title ${task.quadrant}" data-action="edit-task" data-id="${esc(task.id)}">${esc(task.title)}</div>
      </div>
      <div class="quadrant-task-meta">${esc(task.date ? formatTaskDate(task.date) : "未安排日期")} · ${esc(task.category)}</div>
    </article>`;
  }


  function createViews(shared) {
    app = shared.app;
    renderMarkdown = shared.renderMarkdown;
    visibleTasks = shared.visibleTasks;
    compareTasks = shared.compareTasks;
    categoryTone = shared.categoryTone;

    return Object.freeze({
      render(state, options = {}) {
        setState(state);
        return renderView(options);
      },
      previewTimelineLayout(state, taskId, start, duration) {
        setState(state);
        return renderTimelinePreview(taskId, start, duration);
      }
    });
  }

  window.NekoTickViews = Object.freeze({ createViews });
})();
