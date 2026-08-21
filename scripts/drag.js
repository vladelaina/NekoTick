(function () {
  "use strict";

  const { BOARD_COLUMNS, QUADRANTS } = window.NekoTickConfig;
  const { isValidDateKey, minutesToTime, timeToMinutes } = window.NekoTickUtils;

  function createDragController(shared) {
    const {
      app,
      getState,
      previewTimelineLayout,
      render,
      reorderListTask,
      saveTasks
    } = shared;

    let draggedTaskId = "";
    let listDragArmedId = "";
    let listPointerDrag = null;
    let monthPointerDrag = null;
    let suppressMonthClickId = "";
    let taskResize = null;
    let taskMove = null;
    let suppressTimelineClickId = "";
    let quadrantPointerDrag = null;
    let suppressQuadrantClickId = "";
    let boardPointerDrag = null;
    let suppressBoardClickId = "";

    function getTasks() {
      return getState().tasks;
    }

    function getUI() {
      return getState().ui;
    }

    app.addEventListener("click", event => {
      const monthTask = event.target.closest(".calendar-event");
      if (monthTask && suppressMonthClickId === monthTask.dataset.monthTaskId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressMonthClickId = "";
        return;
      }
      const boardTask = event.target.closest(".board-task");
      if (boardTask && suppressBoardClickId === boardTask.dataset.boardTaskId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressBoardClickId = "";
        return;
      }
      const quadrantTask = event.target.closest(".quadrant-task");
      if (quadrantTask && suppressQuadrantClickId === quadrantTask.dataset.taskId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressQuadrantClickId = "";
        return;
      }
      const timelineTask = event.target.closest(".timeline-task");
      if (timelineTask && suppressTimelineClickId === timelineTask.dataset.id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressTimelineClickId = "";
      }
    }, true);

    function startTaskResize(handle, clientY) {
      if (!handle || getUI().view !== "calendar" || getUI().calendarMode !== "day") return false;
      if (taskResize) return;
      const task = getTasks().find(item => item.id === handle.dataset.id);
      const card = handle.closest(".timeline-task");
      if (!task?.time || !card) return false;
      const start = timeToMinutes(task.time);
      taskResize = {
        taskId: task.id,
        edge: handle.dataset.edge,
        startY: clientY,
        originalStart: start,
        originalDuration: task.duration,
        currentStart: start,
        currentDuration: task.duration,
        card
      };
      document.body.classList.add("resizing-task");
      return true;
    }

    app.addEventListener("pointerdown", event => {
      const handle = event.target.closest("[data-action=resize-task]");
      if (!startTaskResize(handle, event.clientY)) return;
      event.preventDefault();
      try { handle.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    app.addEventListener("mousedown", event => {
      if (taskResize) return;
      const handle = event.target.closest("[data-action=resize-task]");
      if (!startTaskResize(handle, event.clientY)) return;
      event.preventDefault();
    });

    function startTaskMove(card, clientY) {
      if (!card || taskMove || taskResize || getUI().view !== "calendar" || getUI().calendarMode !== "day") return false;
      const task = getTasks().find(item => item.id === card.dataset.id);
      if (!task?.time) return false;
      const start = timeToMinutes(task.time);
      const layer = card.closest(".timeline-events-layer");
      taskMove = {
        taskId: task.id,
        startY: clientY,
        originalStart: start,
        currentStart: start,
        duration: task.duration,
        minStart: Number(layer?.dataset.startHour || 0) * 60,
        maxEnd: Number(layer?.dataset.endHour || 24) * 60,
        card,
        moved: false
      };
      return true;
    }

    app.addEventListener("pointerdown", event => {
      if (event.target.closest(".task-check, .task-resize-handle, button")) return;
      const card = event.target.closest(".timeline-task");
      if (!startTaskMove(card, event.clientY)) return;
      try { card.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    app.addEventListener("mousedown", event => {
      if (taskMove || event.target.closest(".task-check, .task-resize-handle, button")) return;
      startTaskMove(event.target.closest(".timeline-task"), event.clientY);
    });

    function updateTaskMove(clientY) {
      if (!taskMove) return;
      const distance = clientY - taskMove.startY;
      if (!taskMove.moved && Math.abs(distance) < 4) return;
      if (!taskMove.moved) {
        taskMove.moved = true;
        document.body.classList.add("moving-task");
        taskMove.card.classList.add("moving");
      }
      const delta = Math.round(distance / 68 * 60 / 15) * 15;
      const maxStart = Math.max(taskMove.minStart, taskMove.maxEnd - taskMove.duration);
      taskMove.currentStart = Math.min(maxStart, Math.max(taskMove.minStart, taskMove.originalStart + delta));
      previewTimelineLayout(taskMove.taskId, taskMove.currentStart, taskMove.duration);
      const range = taskMove.card.querySelector(".timeline-task-range");
      const task = getTasks().find(item => item.id === taskMove.taskId);
      if (range && task) range.textContent = `${minutesToTime(taskMove.currentStart)}-${minutesToTime(taskMove.currentStart + taskMove.duration)} · ${task.category}`;
    }

    function finishTaskMove() {
      if (!taskMove) return;
      const moved = taskMove.moved;
      const taskId = taskMove.taskId;
      if (moved) {
        const task = getTasks().find(item => item.id === taskId);
        if (task) {
          task.time = minutesToTime(taskMove.currentStart);
          saveTasks();
        }
        suppressTimelineClickId = taskId;
        window.setTimeout(() => { if (suppressTimelineClickId === taskId) suppressTimelineClickId = ""; }, 300);
      }
      taskMove.card.classList.remove("moving");
      taskMove = null;
      document.body.classList.remove("moving-task");
      if (moved) render({ keepScroll: true });
    }

    function updateTaskResize(clientY) {
      if (!taskResize) return;
      const delta = Math.round((clientY - taskResize.startY) / 68 * 60 / 15) * 15;
      let start = taskResize.originalStart;
      let duration = taskResize.originalDuration;
      let topShift = 0;
      const layer = taskResize.card.closest(".timeline-events-layer");
      const minStart = Number(layer?.dataset.startHour || 0) * 60;
      const maxEnd = Number(layer?.dataset.endHour || 24) * 60;
      if (taskResize.edge === "bottom") {
        duration = Math.min(480, Math.max(15, Math.min(maxEnd - start, duration + delta)));
      } else {
        start = Math.min(taskResize.originalStart + taskResize.originalDuration - 15, Math.max(minStart, taskResize.originalStart + delta));
        topShift = start - taskResize.originalStart;
        duration = taskResize.originalDuration - topShift;
      }
      taskResize.currentStart = start;
      taskResize.currentDuration = duration;
      previewTimelineLayout(taskResize.taskId, start, duration);
      const range = taskResize.card.querySelector(".timeline-task-range");
      if (range) range.textContent = `${minutesToTime(start)}-${minutesToTime(start + duration)} · ${getTasks().find(item => item.id === taskResize.taskId)?.category || ""}`;
    }

    document.addEventListener("pointermove", event => { updateTaskResize(event.clientY); updateTaskMove(event.clientY); });
    document.addEventListener("mousemove", event => { updateTaskResize(event.clientY); updateTaskMove(event.clientY); });

    function finishTaskResize() {
      if (!taskResize) return;
      const task = getTasks().find(item => item.id === taskResize.taskId);
      if (task) {
        task.time = minutesToTime(taskResize.currentStart);
        task.duration = taskResize.currentDuration;
        saveTasks();
      }
      taskResize = null;
      document.body.classList.remove("resizing-task");
      render({ keepScroll: true });
    }

    document.addEventListener("mouseup", finishTaskResize);
    document.addEventListener("mouseup", finishTaskMove);

    app.addEventListener("pointerdown", event => {
      const handle = event.target.closest(".task-drag-handle");
      if (!handle) {
        listDragArmedId = "";
        return;
      }
      const row = handle.closest(".task-row");
      if (!row) return;
      if (event.pointerType === "mouse") {
        listDragArmedId = row.dataset.taskId;
        return;
      }
      const rect = row.getBoundingClientRect();
      listPointerDrag = {
        taskId: row.dataset.taskId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        row,
        list: row.closest(".task-list"),
        target: null,
        placeAfter: false,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        preview: null
      };
      try { handle.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    document.addEventListener("pointermove", event => {
      if (!listPointerDrag || event.pointerId !== listPointerDrag.pointerId) return;
      const distance = Math.hypot(event.clientX - listPointerDrag.startX, event.clientY - listPointerDrag.startY);
      if (!listPointerDrag.active && distance < 7) return;
      if (!listPointerDrag.active) {
        listPointerDrag.active = true;
        listPointerDrag.row.classList.add("dragging");
        document.body.classList.add("dragging-list-task");
        const preview = listPointerDrag.row.cloneNode(true);
        preview.classList.remove("dragging", "drop-before", "drop-after");
        preview.classList.add("task-drag-preview");
        preview.removeAttribute("draggable");
        preview.setAttribute("aria-hidden", "true");
        preview.style.width = `${listPointerDrag.width}px`;
        document.body.append(preview);
        listPointerDrag.preview = preview;
      }
      event.preventDefault();
      listPointerDrag.preview.style.transform = `translate3d(${event.clientX - listPointerDrag.offsetX}px, ${event.clientY - listPointerDrag.offsetY}px, 0)`;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".task-row") || null;
      const validTarget = target && target !== listPointerDrag.row && target.closest(".task-list") === listPointerDrag.list ? target : null;
      const placeAfter = Boolean(validTarget && event.clientY >= validTarget.getBoundingClientRect().top + validTarget.offsetHeight / 2);
      document.querySelectorAll(".task-row.drop-before, .task-row.drop-after").forEach(item => item.classList.remove("drop-before", "drop-after"));
      if (validTarget) validTarget.classList.add(placeAfter ? "drop-after" : "drop-before");
      listPointerDrag.target = validTarget;
      listPointerDrag.placeAfter = placeAfter;
    });

    function finishListPointerDrag(event) {
      if (!listPointerDrag || event.pointerId !== listPointerDrag.pointerId) return;
      const { active, row, target, taskId, placeAfter, preview } = listPointerDrag;
      listPointerDrag = null;
      preview?.remove();
      row.classList.remove("dragging");
      document.body.classList.remove("dragging-list-task");
      document.querySelectorAll(".task-row.drop-before, .task-row.drop-after").forEach(item => item.classList.remove("drop-before", "drop-after"));
      if (active && target && reorderListTask(taskId, target.dataset.taskId, placeAfter, true)) render({ keepScroll: true });
    }

    app.addEventListener("pointerdown", event => {
      const card = event.target.closest(".calendar-event");
      if (!card || getUI().view !== "calendar" || getUI().calendarMode !== "month") return;
      const rect = card.getBoundingClientRect();
      monthPointerDrag = {
        taskId: card.dataset.monthTaskId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        active: false,
        card,
        target: null,
        preview: null
      };
      try { card.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    document.addEventListener("pointermove", event => {
      if (!monthPointerDrag || event.pointerId !== monthPointerDrag.pointerId) return;
      const distance = Math.hypot(event.clientX - monthPointerDrag.startX, event.clientY - monthPointerDrag.startY);
      if (!monthPointerDrag.active && distance < 7) return;
      if (!monthPointerDrag.active) {
        monthPointerDrag.active = true;
        monthPointerDrag.card.classList.add("dragging");
        document.body.classList.add("dragging-month-task");
        const preview = monthPointerDrag.card.cloneNode(true);
        preview.classList.remove("dragging");
        preview.classList.add("month-drag-preview");
        preview.removeAttribute("draggable");
        preview.removeAttribute("tabindex");
        preview.setAttribute("aria-hidden", "true");
        preview.style.width = `${monthPointerDrag.width}px`;
        document.body.append(preview);
        monthPointerDrag.preview = preview;
      }
      event.preventDefault();
      monthPointerDrag.preview.style.transform = `translate3d(${event.clientX - monthPointerDrag.offsetX}px, ${event.clientY - monthPointerDrag.offsetY}px, 0)`;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".calendar-cell") || null;
      document.querySelectorAll(".calendar-cell.month-drag-over").forEach(item => item.classList.remove("month-drag-over"));
      if (target) target.classList.add("month-drag-over");
      monthPointerDrag.target = target;
    });

    function finishMonthPointerDrag(event) {
      if (!monthPointerDrag || event.pointerId !== monthPointerDrag.pointerId) return;
      const { active, card, target, taskId, preview } = monthPointerDrag;
      monthPointerDrag = null;
      preview?.remove();
      card.classList.remove("dragging");
      document.body.classList.remove("dragging-month-task");
      document.querySelectorAll(".calendar-cell.month-drag-over").forEach(item => item.classList.remove("month-drag-over"));
      if (!active) return;
      suppressMonthClickId = taskId;
      window.setTimeout(() => { if (suppressMonthClickId === taskId) suppressMonthClickId = ""; }, 350);
      const task = getTasks().find(item => item.id === taskId);
      const date = target?.dataset.date;
      if (!task || !isValidDateKey(date) || task.date === date) return;
      task.date = date;
      saveTasks();
      render({ keepScroll: true });
    }

    app.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || getUI().view !== "quadrant" || event.target.closest("button")) return;
      const card = event.target.closest(".quadrant-task");
      if (!card) return;
      quadrantPointerDrag = {
        taskId: card.dataset.taskId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        card,
        target: null
      };
      try { card.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    document.addEventListener("pointermove", event => {
      if (!quadrantPointerDrag || event.pointerId !== quadrantPointerDrag.pointerId) return;
      const distance = Math.hypot(event.clientX - quadrantPointerDrag.startX, event.clientY - quadrantPointerDrag.startY);
      if (!quadrantPointerDrag.active && distance < 8) return;
      if (!quadrantPointerDrag.active) {
        quadrantPointerDrag.active = true;
        quadrantPointerDrag.card.classList.add("dragging");
        document.body.classList.add("dragging-quadrant-task");
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".quadrant") || null;
      document.querySelectorAll(".quadrant").forEach(item => item.classList.toggle("drag-over", item === target));
      quadrantPointerDrag.target = target;
    });

    function finishQuadrantPointerDrag(event) {
      if (!quadrantPointerDrag || event.pointerId !== quadrantPointerDrag.pointerId) return;
      const { active, card, target, taskId } = quadrantPointerDrag;
      quadrantPointerDrag = null;
      card.classList.remove("dragging");
      document.body.classList.remove("dragging-quadrant-task");
      document.querySelectorAll(".quadrant.drag-over").forEach(item => item.classList.remove("drag-over"));
      if (!active) return;
      suppressQuadrantClickId = taskId;
      window.setTimeout(() => { if (suppressQuadrantClickId === taskId) suppressQuadrantClickId = ""; }, 350);
      const task = getTasks().find(item => item.id === taskId);
      const quadrant = target?.dataset.quadrant;
      if (!task || !QUADRANTS[quadrant] || task.quadrant === quadrant) return;
      task.quadrant = quadrant;
      saveTasks();
      render({ keepScroll: true });
    }

    function moveTaskToBoardStatus(taskId, status) {
      const task = getTasks().find(item => item.id === taskId);
      if (!task || !BOARD_COLUMNS[status] || task.status === status) return false;
      task.status = status;
      task.completed = status === "done";
      saveTasks();
      return true;
    }

    app.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || getUI().view !== "calendar" || getUI().calendarMode !== "board" || event.target.closest("button")) return;
      const card = event.target.closest(".board-task");
      if (!card) return;
      boardPointerDrag = {
        taskId: card.dataset.boardTaskId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        card,
        target: null
      };
      try { card.setPointerCapture?.(event.pointerId); } catch (_) {}
    });

    document.addEventListener("pointermove", event => {
      if (!boardPointerDrag || event.pointerId !== boardPointerDrag.pointerId) return;
      const distance = Math.hypot(event.clientX - boardPointerDrag.startX, event.clientY - boardPointerDrag.startY);
      if (!boardPointerDrag.active && distance < 8) return;
      if (!boardPointerDrag.active) {
        boardPointerDrag.active = true;
        boardPointerDrag.card.classList.add("dragging");
        document.body.classList.add("dragging-board-task");
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".board-column") || null;
      document.querySelectorAll(".board-column").forEach(item => item.classList.toggle("drag-over", item === target));
      boardPointerDrag.target = target;
    });

    function finishBoardPointerDrag(event) {
      if (!boardPointerDrag || event.pointerId !== boardPointerDrag.pointerId) return;
      const { active, card, target, taskId } = boardPointerDrag;
      boardPointerDrag = null;
      card.classList.remove("dragging");
      document.body.classList.remove("dragging-board-task");
      document.querySelectorAll(".board-column.drag-over").forEach(item => item.classList.remove("drag-over"));
      if (!active) return;
      suppressBoardClickId = taskId;
      window.setTimeout(() => { if (suppressBoardClickId === taskId) suppressBoardClickId = ""; }, 350);
      if (moveTaskToBoardStatus(taskId, target?.dataset.boardStatus)) render({ keepScroll: true });
    }

    function finishPointerInteractions(event) {
      finishTaskResize();
      finishTaskMove();
      finishListPointerDrag(event);
      finishMonthPointerDrag(event);
      finishQuadrantPointerDrag(event);
      finishBoardPointerDrag(event);
    }

    document.addEventListener("pointerup", finishPointerInteractions);
    document.addEventListener("pointercancel", finishPointerInteractions);

    app.addEventListener("dragstart", event => {
      const row = event.target.closest(".task-row");
      if (row) {
        if (listDragArmedId !== row.dataset.taskId) {
          event.preventDefault();
          return;
        }
        draggedTaskId = row.dataset.taskId;
        row.classList.add("dragging");
        document.body.classList.add("dragging-list-task");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedTaskId);
        event.dataTransfer.setDragImage(row, 28, Math.min(30, row.offsetHeight / 2));
        return;
      }
      const task = event.target.closest(".quadrant-task, .board-task");
      if (!task) return;
      draggedTaskId = task.dataset.taskId || task.dataset.boardTaskId;
      task.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedTaskId);
    });

    app.addEventListener("dragover", event => {
      const listRow = event.target.closest(".task-row");
      const draggedRow = document.querySelector(".task-row.dragging");
      if (listRow && draggedRow && listRow !== draggedRow && listRow.closest(".task-list") === draggedRow.closest(".task-list")) {
        event.preventDefault();
        const placeAfter = event.clientY >= listRow.getBoundingClientRect().top + listRow.offsetHeight / 2;
        document.querySelectorAll(".task-row.drop-before, .task-row.drop-after").forEach(item => item.classList.remove("drop-before", "drop-after"));
        listRow.classList.add(placeAfter ? "drop-after" : "drop-before");
        event.dataTransfer.dropEffect = "move";
        return;
      }
      const dropTarget = event.target.closest(".quadrant, .board-column");
      if (!dropTarget) return;
      event.preventDefault();
      document.querySelectorAll(".drag-over").forEach(item => item.classList.remove("drag-over"));
      dropTarget.classList.add("drag-over");
      event.dataTransfer.dropEffect = "move";
    });

    app.addEventListener("drop", event => {
      const listRow = event.target.closest(".task-row");
      const draggedRow = document.querySelector(".task-row.dragging");
      if (listRow && draggedRow && listRow !== draggedRow && listRow.closest(".task-list") === draggedRow.closest(".task-list")) {
        event.preventDefault();
        const placeAfter = listRow.classList.contains("drop-after");
        const taskId = draggedTaskId || event.dataTransfer.getData("text/plain");
        draggedTaskId = "";
        listDragArmedId = "";
        document.body.classList.remove("dragging-list-task");
        if (reorderListTask(taskId, listRow.dataset.taskId, placeAfter, true)) render({ keepScroll: true });
        return;
      }
      const quadrant = event.target.closest(".quadrant");
      const boardColumn = event.target.closest(".board-column");
      if (!quadrant && !boardColumn) return;
      event.preventDefault();
      const taskId = draggedTaskId || event.dataTransfer.getData("text/plain");
      const task = getTasks().find(item => item.id === taskId);
      if (quadrant && task && task.quadrant !== quadrant.dataset.quadrant) {
        task.quadrant = quadrant.dataset.quadrant;
        saveTasks();
      }
      if (boardColumn) moveTaskToBoardStatus(taskId, boardColumn.dataset.boardStatus);
      draggedTaskId = "";
      render({ keepScroll: true });
    });

    app.addEventListener("dragend", () => {
      draggedTaskId = "";
      listDragArmedId = "";
      document.body.classList.remove("dragging-list-task");
      document.body.classList.remove("dragging-month-task");
      document.querySelectorAll(".dragging, .drag-over, .drop-before, .drop-after").forEach(item => item.classList.remove("dragging", "drag-over", "drop-before", "drop-after"));
    });
  }

  window.NekoTickDrag = Object.freeze({ createDragController });
})();
