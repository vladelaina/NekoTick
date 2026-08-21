(function () {
  "use strict";

  const { QUADRANTS } = window.NekoTickConfig;
  const { addDays, esc, icon, toDateKey } = window.NekoTickUtils;

  function createDialogs({ root, categoryTone }) {
    function showTaskForm({ task, isEdit, today, categories }) {
      const datePresets = [
        { label: "今天", value: toDateKey(today) },
        { label: "明天", value: toDateKey(addDays(today, 1)) },
        { label: "下周", value: toDateKey(addDays(today, 7)) }
      ];
      const timePresets = ["09:00", "14:00", "20:00"];

      root.innerHTML = `<div class="modal-mask" data-action="close-modal">
        <section class="modal" data-quadrant="${esc(task.quadrant)}" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
          <header class="modal-header">
            <div class="modal-header-copy"><h2 id="task-modal-title">${isEdit ? "编辑任务" : "新建任务"}</h2><p>${isEdit ? "更新后会同步到所有视图" : "先记下来，再放入合适的象限"}</p></div>
            <button class="icon-button small" type="button" data-action="close-modal" title="关闭" aria-label="关闭">${icon("x")}</button>
          </header>
          <form id="task-form" data-id="${isEdit ? esc(task.id) : ""}" novalidate>
            <input type="hidden" name="status" value="${esc(task.status)}">
            <div class="modal-body">
              <div class="form-group">
                <div class="form-label-row">
                  <label class="form-label" for="task-title">任务名称 <span class="required">*</span></label>
                  <fieldset class="modal-quadrant-picker" aria-label="四象限">
                    <legend class="sr-only">四象限</legend>
                    ${Object.entries(QUADRANTS).map(([key, quadrant]) => `<label class="modal-quadrant-choice ${key}" title="${quadrant.title}"><input name="quadrant" type="radio" value="${key}"${task.quadrant === key ? " checked" : ""}><span></span><span class="sr-only">${quadrant.title}</span></label>`).join("")}
                  </fieldset>
                </div>
                <input class="form-input" id="task-title" name="title" maxlength="80" value="${esc(task.title)}" placeholder="例如：完成项目周报" autocomplete="off" aria-describedby="title-error">
                <div class="form-error" id="title-error"></div>
              </div>
              <div class="schedule-section">
                <span class="form-label">安排</span>
                <div class="schedule-grid">
                  <div class="schedule-column">
                    <label class="schedule-control" for="task-date">${icon("calendar-days")}<span class="sr-only">日期</span><input id="task-date" name="date" type="date" value="${esc(task.date)}" aria-describedby="date-error"></label>
                    <div class="schedule-presets" aria-label="快捷日期">
                      ${datePresets.map(preset => `<button class="schedule-preset${task.date === preset.value ? " active" : ""}" type="button" data-action="set-task-date" data-value="${preset.value}" aria-pressed="${task.date === preset.value}">${preset.label}</button>`).join("")}
                      <button class="schedule-preset clear${!task.date ? " active" : ""}" type="button" data-action="set-task-date" data-value="" aria-pressed="${!task.date}">${icon("x")}日期</button>
                    </div>
                    <div class="form-error" id="date-error"></div>
                  </div>
                  <div class="schedule-column">
                    <label class="schedule-control" for="task-time">${icon("clock")}<span class="sr-only">时间</span><input id="task-time" name="time" type="time" value="${esc(task.time)}" aria-describedby="time-error"></label>
                    <div class="schedule-presets" aria-label="快捷时间">
                      ${timePresets.map(value => `<button class="schedule-preset${task.time === value ? " active" : ""}" type="button" data-action="set-task-time" data-value="${value}" aria-pressed="${task.time === value}">${value}</button>`).join("")}
                      <button class="schedule-preset clear${!task.time ? " active" : ""}" type="button" data-action="set-task-time" data-value="" aria-pressed="${!task.time}">${icon("x")}时间</button>
                    </div>
                    <div class="form-error" id="time-error"></div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="form-label-row">
                  <label class="form-label" for="task-category">分类</label>
                  <button class="category-manage-button" type="button" data-action="open-category-manager" title="管理分类" aria-label="管理分类">${icon("plus")}管理</button>
                </div>
                <select class="form-select" id="task-category" name="category">${categories.map(category => `<option value="${esc(category)}"${task.category === category ? " selected" : ""}>${esc(category)}</option>`).join("")}</select>
              </div>
              <div class="form-group">
                <label class="form-label" for="task-notes">备注</label>
                <textarea class="form-textarea" id="task-notes" name="notes" maxlength="2000" placeholder="补充一些细节…">${esc(task.notes)}</textarea>
              </div>
            </div>
            <footer class="modal-footer">
              ${isEdit ? `<button class="danger-link" type="button" data-action="delete-task" data-id="${esc(task.id)}">删除任务</button>` : ""}
              <div class="modal-footer-spacer"></div>
              <button class="secondary-button" type="button" data-action="close-modal">取消</button>
              <button class="primary-button" type="submit">${isEdit ? "保存更改" : "创建任务"}</button>
            </footer>
          </form>
        </section>
      </div>`;

      requestAnimationFrame(() => root.querySelector("#task-title")?.focus());
    }

    function showCategoryManager(categories) {
      root.innerHTML = `<div class="modal-mask" data-action="close-modal">
        <section class="category-manager-modal" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
          <header class="modal-header">
            <div class="modal-header-copy"><h2 id="category-manager-title">管理分类</h2><p>新增或删除任务分类，颜色会自动分配。</p></div>
            <button class="icon-button small" type="button" data-action="close-modal" title="关闭" aria-label="关闭">${icon("x")}</button>
          </header>
          <form class="category-manager-form" data-form="category-manager">
            <div class="category-add-row"><input class="form-input" name="category" maxlength="20" placeholder="输入新分类" autocomplete="off"><button class="primary-button" type="submit">${icon("plus")}添加</button></div>
          </form>
          <div class="category-manager-list">${categories.map(category => `<div class="category-manager-item"><span class="category-chip ${categoryTone(category)}">${esc(category)}</span><button class="icon-button small danger" type="button" data-action="delete-category" data-category="${esc(category)}" title="删除分类" aria-label="删除${esc(category)}"${categories.length <= 1 ? " disabled" : ""}>${icon("trash")}</button></div>`).join("")}</div>
        </section>
      </div>`;

      requestAnimationFrame(() => root.querySelector('input[name="category"]')?.focus());
    }

    function showDeleteConfirmation(task) {
      root.innerHTML = `<div class="modal-mask" data-action="close-modal">
        <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div class="confirm-icon">${icon("trash")}</div>
          <div class="confirm-copy"><h2 id="delete-modal-title">删除任务？</h2><p>确定要删除“${esc(task.title)}”吗？此操作无法撤销。</p></div>
          <div class="confirm-actions"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="danger-button" type="button" data-action="confirm-delete" data-id="${esc(task.id)}">删除</button></div>
        </section>
      </div>`;

      requestAnimationFrame(() => root.querySelector("[data-action=confirm-delete]")?.focus());
    }

    function close() {
      root.innerHTML = "";
    }

    function syncSchedulePresets(form) {
      if (!form) return;
      const values = {
        "set-task-date": form.elements.date?.value || "",
        "set-task-time": form.elements.time?.value || ""
      };
      Object.entries(values).forEach(([action, value]) => {
        form.querySelectorAll(`[data-action="${action}"]`).forEach(button => {
          const active = button.dataset.value === value;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      });
    }

    return Object.freeze({
      close,
      showCategoryManager,
      showDeleteConfirmation,
      showTaskForm,
      syncSchedulePresets
    });
  }

  window.NekoTickDialogs = Object.freeze({ createDialogs });
})();
