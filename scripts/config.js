(function () {
  "use strict";

  const QUADRANTS = {
    q1: { number: "I", title: "重要且紧急", hint: "立即处理" },
    q2: { number: "II", title: "重要不紧急", hint: "计划推进" },
    q3: { number: "III", title: "紧急不重要", hint: "适当委派" },
    q4: { number: "IV", title: "不重要不紧急", hint: "稍后再看" }
  };

  const BOARD_COLUMNS = {
    backlog: { title: "待整理", color: "muted" },
    todo: { title: "待办", color: "green" },
    doing: { title: "进行中", color: "blue" },
    done: { title: "已完成", color: "pink" }
  };

  window.NekoTickConfig = Object.freeze({
    STORE_KEY: "nekotick-web-v1",
    UI_KEY: "nekotick-ui-v1",
    CATEGORY_STORE_KEY: "nekotick-categories-v1",
    VIEW_KEYS: ["list", "calendar", "quadrant", "counts"],
    CALENDAR_MODES: ["day", "month", "year", "board"],
    DEFAULT_CATEGORIES: ["工作", "学习", "生活", "健康", "其他"],
    CATEGORY_TONES: ["pink", "blue", "green", "orange", "purple", "muted"],
    WEEKDAYS: ["一", "二", "三", "四", "五", "六", "日"],
    QUADRANTS,
    BOARD_COLUMNS
  });
})();
