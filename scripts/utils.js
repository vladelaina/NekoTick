(function () {
  "use strict";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function icon(name, className = "") {
    return `<svg class="icon${className ? ` ${className}` : ""}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function createMarkdownRenderer() {
    const renderer = window.marked ? new window.marked.Renderer() : null;
    if (renderer) renderer.html = token => esc(typeof token === "string" ? token : token.text);

    return value => {
      const source = String(value || "").trim();
      if (!source) return "";
      if (!window.marked || !window.DOMPurify || !renderer) return esc(source);
      try {
        const parsed = window.marked.parse(source, { gfm: true, breaks: true, renderer });
        const safe = window.DOMPurify.sanitize(parsed, { FORBID_TAGS: ["style"], FORBID_ATTR: ["style"] });
        const template = document.createElement("template");
        template.innerHTML = safe;
        template.content.querySelectorAll("a").forEach(link => {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        });
        return template.innerHTML;
      } catch (_) {
        return esc(source);
      }
    };
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromDateKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function isValidDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const date = fromDateKey(value);
    const [year, month, day] = String(value).split("-").map(Number);
    return Number.isFinite(date.getTime()) && date.getFullYear() === year &&
      date.getMonth() === month - 1 && date.getDate() === day;
  }

  function isValidTime(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return false;
    const [hours, minutes] = String(value).split(":").map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value).split(":").map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(value) {
    const minutes = Math.min(24 * 60, Math.max(0, Math.round(value / 15) * 15));
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
  }

  function sameDay(a, b) {
    return toDateKey(a) === toDateKey(b);
  }

  function dayDiff(date, base) {
    return Math.round((startOfDay(date) - startOfDay(base)) / 86400000);
  }

  function createId() {
    return window.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.NekoTickUtils = Object.freeze({
    esc,
    icon,
    createMarkdownRenderer,
    pad,
    toDateKey,
    fromDateKey,
    isValidDateKey,
    isValidTime,
    timeToMinutes,
    minutesToTime,
    startOfDay,
    addDays,
    addMonths,
    sameDay,
    dayDiff,
    createId
  });
})();
