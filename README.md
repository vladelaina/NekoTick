# NekoTick

一个无需构建步骤的本地任务清单 demo。直接双击 `index.html` 即可运行，任务、分类和界面偏好保存在当前浏览器的 `localStorage` 中。

## 目录结构

```text
index.html              页面骨架、图标库和脚本加载顺序
styles.css              CSS 入口（按职责导入 styles/）
styles/
  tokens.css            主题变量与颜色 token
  base.css              重置、可访问性和通用元素
  shell.css             应用外壳、侧栏和顶栏
  workspace.css         工作区、工具栏和共享控件
  quick-add.css         快速添加任务
  tasks.css             清单、任务行、行内编辑和拖动状态
  calendar.css          日/月/年视图与时间轴
  boards.css            四象限和看板
  modals.css            任务、分类和确认弹窗
  responsive.css        移动端断点
scripts/
  config.js             常量、视图键、四象限和看板列定义
  utils.js              日期、时间、Markdown、转义和图标工具
  storage.js            localStorage 读写适配
  model.js              任务/分类/UI 数据模型、校验和排序
  views.js              所有页面 HTML 渲染函数（无业务写入）
  dialogs.js            任务、分类和删除确认弹窗视图
  drag.js               列表、月历、四象限、看板和时间轴拖动控制器
  app.js                应用状态、业务变更、事件委托和生命周期
```

## 运行约定

脚本使用经典 `<script>` 和 `window.NekoTick*` 命名空间，而不是 ES Module。这是为了兼容 Chromium 对 `file://` 页面模块导入的限制。脚本加载顺序必须保持 `config → utils → storage → model → views → dialogs → drag → app`。

第三方 Markdown 资源位于 `assets/vendor/`，不需要 npm 或开发服务器。

## 快速检查

```bash
for file in scripts/*.js; do node --check "$file"; done
```

页面可直接使用：

```text
file:///绝对路径/nekotick/index.html
```
