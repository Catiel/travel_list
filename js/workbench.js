(function () {
  const data = window.LUGGAGE_PROTOTYPE;
  const workspace = document.getElementById("demo-view");
  const pageTree = document.getElementById("page-tree");
  const stateSelect = document.getElementById("state-select");
  const demoRoot = document.getElementById("demo-root");
  const detailTitle = document.getElementById("detail-title");
  const detailTabs = document.getElementById("detail-tabs");
  const detailContent = document.getElementById("detail-content");
  const staticCanvas = document.getElementById("static-canvas");
  const openGroups = new Set(data.modules.map(module => module.id));
  const navigationHistory = [];
  const contentOverrides = new Map();
  let current = { page: data.pages[0].id, state: data.pages[0].primaryState };
  let activeDetailTab = "logic";

  const detailLabels = { logic: "逻辑", design: "设计", operations: "运营" };
  const pageById = id => data.pages.find(page => page.id === id);

  function renderTree() {
    pageTree.innerHTML = data.modules.map(module => {
      const pages = module.pages.map(pageById);
      const expanded = openGroups.has(module.id);
      return `<section class="tree-group"><button class="tree-group-toggle" data-tree-module="${module.id}" aria-expanded="${expanded}"><i>${expanded ? '⌄' : '›'}</i><span>${module.name}</span><small>${pages.length}</small></button><div class="tree-pages" ${expanded ? '' : 'hidden'}>${pages.map(page => `<button class="${page.id === current.page ? 'active' : ''}" data-page-id="${page.id}" title="${page.title}"><span>${page.title}</span><em>${page.type === 'modal' ? '弹窗' : '页面'}</em></button>`).join('')}</div></section>`;
    }).join("");
  }

  function renderStateSelect(page) {
    const states = staticStates(page);
    stateSelect.hidden = states.length <= 1;
    stateSelect.innerHTML = states.map(state => `<option value="${state.id}" ${state.id === current.state ? 'selected' : ''}>${state.name}</option>`).join("");
  }

  function renderDetails() {
    const page = pageById(current.page);
    const tabs = ["logic", "design", "operations"];
    if (!tabs.includes(activeDetailTab)) activeDetailTab = "logic";
    detailTitle.textContent = page.title;
    detailTabs.innerHTML = tabs.map(tab => `<button role="tab" data-detail-tab="${tab}" class="${tab === activeDetailTab ? 'active' : ''}" aria-selected="${tab === activeDetailTab}">${detailLabels[tab]}</button>`).join("");
    if (activeDetailTab === "operations") {
      const fields = editableContentNodes();
      detailContent.innerHTML = `<div class="scene-meta"><span>当前画面可编辑内容</span><p>修改会即时作用于当前演示画面，切换页面后仍在本次会话中保留。</p></div><div class="operation-form">${fields.map((field, index) => `<label><span>${field.label}</span>${field.multiline ? `<textarea data-operation-index="${index}">${escapeHtml(field.value)}</textarea>` : `<input data-operation-index="${index}" value="${escapeAttribute(field.value)}">`}</label>`).join('') || '<p class="operation-note">当前画面没有可编辑文案。</p>'}</div>`;
      return;
    }
    detailContent.innerHTML = `<div class="scene-meta"><span>${page.type === 'modal' ? '弹窗画面' : '业务页面'}</span><p>${page.description}</p></div><ul class="detail-copy">${page[activeDetailTab].map(item => `<li>${item}</li>`).join('')}</ul>`;
  }

  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function editableContentNodes() {
    const app = demoRoot.querySelector(".business-app");
    if (!app) return [];
    const modals = app.querySelectorAll(".phone-modal, .demo-modal-layer");
    const scope = modals.length ? modals[modals.length - 1] : app;
    const selectors = [
      ".app-topbar > b", ".demo-top > span:nth-child(2)", "h1", "h2", ".empty-state > b", ".empty-state > p", ".gooh-empty > b", ".gooh-empty > span",
      ".checklist-summary > span", ".weather-recommendation > span", ".team-summary > b", ".team-summary > span",
      ".section-title > b", ".section-title > span", ".demo-group-head > span", ".notice > b", ".notice > span",
      ".template-overview > span", ".template-overview > b", ".template-overview > small",
      ".share-heading > small", ".share-heading > p", ":scope > header > b", ".phone-modal > header > b",
      ".phone-modal-scroll p", ".phone-modal-scroll small", ".demo-modal p", ".demo-modal small", ".gooh-form label > span", ".field > span",
      ".action-dock button span", ".selection-dock > span", ".modal-actions button"
    ];
    const seen = new Set();
    return Array.from(scope.querySelectorAll(selectors.join(","))).filter(node => {
      const value = node.textContent.replace(/\s+/g, " ").trim();
      if (!value || seen.has(node)) return false;
      seen.add(node);
      return true;
    }).map((node, index) => {
      node.dataset.operationNode = String(index);
      const value = node.textContent.replace(/\s+/g, " ").trim();
      let label = "页面文案";
      if (node.matches(".app-topbar > b, .phone-modal > header > b")) label = "页面标题";
      else if (node.matches("h1, h2, .empty-state > b, .notice > b, .team-summary > b")) label = "主要标题";
      else if (node.matches("button, button span, .modal-actions button")) label = "操作文案";
      else if (node.matches(".section-title > b, .section-title > span")) label = "分组内容";
      else if (node.matches("small, p, .notice > span, .team-summary > span, .weather-recommendation > span")) label = "说明文案";
      return { node, label: `${label} ${index + 1}`, value, multiline: value.length > 28 || node.matches("p") };
    });
  }

  function applyContentOverrides() {
    editableContentNodes().forEach((field, index) => {
      const key = `${current.page}:${current.state}:${index}`;
      if (contentOverrides.has(key)) field.node.textContent = contentOverrides.get(key);
    });
  }

  function renderCurrent() {
    const page = pageById(current.page);
    if (!page.states.some(state => state.id === current.state)) current.state = page.primaryState;
    renderTree();
    renderStateSelect(page);
    demoRoot.innerHTML = window.LuggageRenderer.render(current.page, current.state);
    applyContentOverrides();
    renderDetails();
  }

  function navigate(pageId, stateId, record = true) {
    const page = pageById(pageId);
    if (!page) return;
    if (record) navigationHistory.push({ ...current });
    current = { page: page.id, state: page.states.some(state => state.id === stateId) ? stateId : page.primaryState };
    renderCurrent();
  }

  function fallbackFor(pageId) {
    const map = {
      "edit-personal-single": ["single-checklist", "default"], "add-personal-single": ["single-checklist", "default"],
      "plan-library-single": ["single-checklist", "default"], "plan-template-list-single": ["single-checklist", "default"], "plan-template-items-single": ["plan-template-list-single", "available"],
      "edit-personal-group": ["group-checklist", "personal"], "edit-team": ["group-checklist", "team"], "add-group": ["group-checklist", "personal"],
      "team-info": ["group-checklist", "team"], "opinion-editor": ["team-info", "passport"],
      "plan-library-group": ["group-checklist", "personal"], "plan-template-list-group": ["group-checklist", "personal"], "plan-template-items-group": ["plan-template-list-group", "available"],
      "batch-edit": ["group-checklist", "personal"], "discussion-share": ["group-checklist", "team"],
      "template-list": ["profile", "default"], "personal-template": ["template-list", "default"], "system-template": ["template-list", "default"],
      "new-template": ["template-list", "default"], "template-settings": ["personal-template", "default"], "template-add-custom": ["personal-template", "default"],
      "template-library-picker": ["personal-template", "default"], "template-source-list": ["personal-template", "default"], "template-source-picker": ["template-source-list", "default"], "template-empty": ["template-list", "default"]
    };
    return map[pageId] || null;
  }

  function goBack() {
    const previous = navigationHistory.pop();
    if (previous) return navigate(previous.page, previous.state, false);
    const fallback = fallbackFor(current.page);
    if (!fallback) return businessToast("已返回上一级（原型演示边界）");
    const [page, state] = fallback;
    navigate(page, state, false);
  }

  function toast(message) {
    const node = document.getElementById("workbench-toast");
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { node.hidden = true; }, 2200);
  }

  function businessToast(message) {
    demoRoot.querySelector(".demo-toast")?.remove();
    const node = document.createElement("div");
    node.className = "demo-toast";
    node.textContent = message;
    demoRoot.firstElementChild.appendChild(node);
    window.setTimeout(() => node.remove(), 1800);
  }

  function validateForm() {
    const input = demoRoot.querySelector("[data-form-name]");
    if (!input || input.value.trim()) return true;
    const page = pageById(current.page);
    if (page.states.some(state => state.id === "validation")) {
      current.state = "validation";
      renderCurrent();
      demoRoot.querySelector("[data-form-name]")?.focus();
    }
    return false;
  }

  function updatePicker() {
    const count = demoRoot.querySelectorAll('[data-action="select-item"].selected').length;
    const counter = demoRoot.querySelector("[data-selected-count], [data-library-selected], [data-template-selected], [data-template-asset-selected]");
    const save = demoRoot.querySelector(".selection-dock button, .picker-selection-bar button");
    if (counter) counter.textContent = String(count);
    if (save) save.disabled = count === 0;
  }

  function handleBusinessAction(control) {
    const action = control.dataset.action;
    if (action === "goto") return navigate(control.dataset.page, control.dataset.state);
    if (action === "scene-state") { current.state = control.dataset.state; return renderCurrent(); }
    if (action === "back") return goBack();
    if (action === "toast") return businessToast(control.dataset.message || "操作已完成");
    if (action === "toggle-check") {
      const mark = control.matches(".carry-check") ? control : control.querySelector(".check");
      mark.classList.toggle("off");
      mark.classList.toggle("done", !mark.classList.contains("off"));
      mark.textContent = mark.classList.contains("off") ? "" : "✓";
      const marks = Array.from(demoRoot.querySelectorAll(".carry-check"));
      const done = marks.filter(item => !item.classList.contains("off")).length;
      if (demoRoot.querySelector("[data-progress-label]")) demoRoot.querySelector("[data-progress-label]").textContent = `${done} / ${marks.length}`;
      if (demoRoot.querySelector("[data-progress-bar]")) demoRoot.querySelector("[data-progress-bar]").style.width = `${Math.round(done / marks.length * 100)}%`;
      return;
    }
    if (action === "filter") {
      control.classList.toggle("active");
      control.textContent = control.classList.contains("active") ? "显示全部" : "只看未完成";
      demoRoot.querySelectorAll(".personal-edit-row").forEach(row => { row.hidden = control.classList.contains("active") && !row.querySelector(".carry-check.off"); });
      return;
    }
    if (action === "step") {
      const stepper = control.closest(".stepper");
      const counter = stepper.querySelector("[data-count]");
      const minimum = Number(stepper.dataset.min || 1);
      counter.textContent = String(Math.max(minimum, Math.min(99, Number(counter.textContent) + Number(control.dataset.delta))));
      return;
    }
    if (action === "toggle-add-team") {
      current.state = control.classList.contains("on") ? "personal" : "team-all";
      return renderCurrent();
    }
    if (action === "select-item") {
      control.classList.toggle("selected");
      const mark = control.querySelector(".check");
      if (mark) {
        mark.classList.toggle("done");
        mark.textContent = mark.classList.contains("done") ? "✓" : "";
      } else {
        control.textContent = control.classList.contains("selected") ? "" : "＋";
      }
      return updatePicker();
    }
    if (action === "save-picker") {
      if (control.disabled) return;
      navigate(control.dataset.page, control.dataset.state);
      return window.setTimeout(() => businessToast("已保存所选物品"), 0);
    }
    if (action === "save-to") {
      navigate(control.dataset.page, control.dataset.state);
      return window.setTimeout(() => businessToast("操作已保存"), 0);
    }
    if (action === "save-form") {
      if (!validateForm()) return;
      navigate(control.dataset.page, control.dataset.state);
      return window.setTimeout(() => businessToast("已保存"), 0);
    }
    if (action === "continue-add") {
      if (!validateForm()) return;
      const input = demoRoot.querySelector("[data-form-name]");
      input.value = "";
      demoRoot.querySelectorAll("[data-count]").forEach(node => { node.textContent = "1"; });
      const notice = demoRoot.querySelector("[data-inline-success]");
      if (notice) notice.hidden = false;
      input.focus();
      return businessToast("当前物品已保存，可继续添加");
    }
    if (action === "toggle-carriers") {
      const list = control.nextElementSibling;
      list.hidden = !list.hidden;
      control.setAttribute("aria-expanded", String(!list.hidden));
      control.textContent = list.hidden ? "查看携带成员⌄" : "收起携带成员⌃";
      return;
    }
    if (action === "remind") return businessToast(`已在计划群聊提醒${control.dataset.name}携带${control.dataset.item}`);
    if (action === "toggle-batch-share") {
      control.classList.toggle("on");
      const card = control.closest(".batch-card");
      const field = card.querySelector(".field");
      if (control.classList.contains("on")) {
        field?.remove();
        card.insertAdjacentHTML("beforeend", '<span class="field-label">携带方式</span><div class="segmented"><button data-action="toast" data-message="已选择所有成员" class="active">所有成员</button><button data-action="toast" data-message="已选择指定成员">指定成员</button></div><div class="member-quantities"><div><span><i>我</i><b>我</b></span><div class="stepper" data-min="1"><button data-action="step" data-delta="-1">−</button><b data-count>1</b><button data-action="step" data-delta="1">＋</button></div></div><div><span><i>林</i><b>小林</b></span><div class="stepper" data-min="1"><button data-action="step" data-delta="-1">−</button><b data-count>1</b><button data-action="step" data-delta="1">＋</button></div></div></div>');
      } else {
        card.querySelector(".field-label")?.remove();
        card.querySelector(".segmented")?.remove();
        card.querySelector(".member-quantities")?.remove();
        card.insertAdjacentHTML("beforeend", '<label class="field"><span>个人数量</span><div class="stepper" data-min="1"><button data-action="step" data-delta="-1">−</button><b data-count>1</b><button data-action="step" data-delta="1">＋</button></div></label>');
      }
      return;
    }
    if (action === "toggle-item-share") {
      control.classList.toggle("on");
      control.setAttribute("aria-pressed", String(control.classList.contains("on")));
      const scope = control.closest(".gooh-form, article");
      const setting = scope?.querySelector(".conditional-carrier");
      const quantity = scope?.querySelector(".quantity-field, .personal-quantity");
      if (setting) setting.hidden = !control.classList.contains("on");
      if (quantity) quantity.hidden = control.classList.contains("on");
      return;
    }
    if (action === "choice") {
      control.parentElement.querySelectorAll("button").forEach(item => item.classList.toggle("selected", item === control));
      const setting = control.closest(".inline-carry-setting");
      if (setting && control.dataset.mode) {
        const custom = control.dataset.mode === "custom";
        setting.dataset.carryMode = control.dataset.mode;
        const allCount = setting.querySelector(".all-carry-count");
        const members = setting.querySelector(".member-carry-counts");
        if (allCount) allCount.hidden = custom;
        if (members) members.hidden = !custom;
      }
      return;
    }
    if (action === "open-member-picker") {
      const layer = demoRoot.querySelector(".member-picker-layer");
      if (layer) layer.hidden = false;
      return;
    }
    if (action === "close-member-picker") {
      const layer = control.closest(".member-picker-layer");
      if (layer) layer.hidden = true;
      return;
    }
    if (action === "toggle-member-selection") {
      const row = control.closest(".member-select-row");
      const selected = !row.classList.contains("selected");
      row.classList.toggle("selected", selected);
      control.setAttribute("aria-pressed", String(selected));
      control.textContent = selected ? "✓" : "";
      const stepper = row.querySelector(".stepper");
      if (stepper) stepper.hidden = !selected;
      const picker = control.closest(".member-picker-layer");
      if (picker) {
        const count = picker.querySelectorAll(".member-select-row.selected").length;
        const confirm = picker.querySelector(".member-picker-confirm");
        if (confirm) { confirm.textContent = `确定（${count}人）`; confirm.disabled = count === 0; }
        demoRoot.querySelectorAll(".carrier-selected-summary strong b").forEach(label => { label.textContent = count ? `我等${count}人` : "请选择成员"; });
      }
      return;
    }
    if (action === "save-opinion") {
      const textarea = demoRoot.querySelector("[data-opinion]");
      if (!textarea?.value.trim()) { current.state = "validation"; return renderCurrent(); }
      navigate("team-info", "passport");
      return window.setTimeout(() => businessToast("意见已保存"), 0);
    }
    if (action === "move-row") {
      const row = control.closest(".template-item, .template-category");
      const direction = control.dataset.direction;
      const sibling = direction === "up" ? row.previousElementSibling : row.nextElementSibling;
      if (sibling && sibling.matches(row.matches(".template-item") ? ".template-item" : ".template-category")) {
        if (direction === "up") row.parentElement.insertBefore(row, sibling);
        else row.parentElement.insertBefore(sibling, row);
        businessToast("顺序已调整");
      }
    }
  }

  const STATIC_CARD_WIDTH = 438;
  const STATIC_CARD_GAP = 64;
  const STATIC_PHONE_WIDTH = 390;
  const STATIC_STATE_GAP = 14;
  const STATIC_GALLERY_PADDING = 30;

  const STATIC_STATE_EXCLUSIONS = new Set([
    "plan-library-single::empty",
    "plan-template-list-single::empty",
    "plan-template-items-single::empty",
    "plan-template-list-group::empty"
  ]);

  function staticStates(page) {
    return page.states.filter(state => state.id !== "validation" && !STATIC_STATE_EXCLUSIONS.has(`${page.id}::${state.id}`));
  }

  function staticCardWidth(states) {
    return Math.max(STATIC_CARD_WIDTH, states.length * STATIC_PHONE_WIDTH + Math.max(0, states.length - 1) * STATIC_STATE_GAP + STATIC_GALLERY_PADDING);
  }

  function staticPhone(page, state, index) {
    return `<div class="static-state ${index === 0 ? 'primary' : 'secondary'}"><div class="static-state-label">${page.title} - ${state.name}</div><div class="static-phone">${window.LuggageRenderer.render(page.id, state.id)}</div></div>`;
  }

  function renderStatic() {
    staticCanvas.innerHTML = data.modules.map((module, moduleIndex) => {
      const pages = module.pages.map(pageById);
      const cards = pages.map((page, pageIndex) => {
        const states = staticStates(page);
        const galleryClass = states.length === 1 ? "one" : states.length === 2 ? "two" : "many";
        const cardWidth = staticCardWidth(states);
        return `<article class="static-card ${pageIndex === 0 ? 'module-primary-page' : 'module-secondary-page'}" style="width:${cardWidth}px"><div class="static-card-heading"><div><b>${page.title}</b><span>${page.type === 'modal' ? '弹窗画面' : '业务页面'} · ${states.length} 个状态</span></div></div><div class="state-gallery ${galleryClass}" style="--state-count:${states.length}">${states.map((state, index) => staticPhone(page, state, index)).join('')}</div><div class="static-card-note"><ul>${page.logic.slice(0, 3).map(item => `<li>${item}</li>`).join('')}</ul></div></article>`;
      }).join("");
      const rowWidth = pages.reduce((width, page) => width + staticCardWidth(staticStates(page)), 0) + Math.max(0, pages.length - 1) * STATIC_CARD_GAP;
      return `<section class="static-module"><div class="static-module-heading"><small>模块 ${String(moduleIndex + 1).padStart(2, '0')}</small><h3>${module.name}</h3><p>${module.description}</p></div><div class="static-module-scroll"><div class="static-flow" style="width:${rowWidth}px"><div class="static-row">${cards}</div></div></div></section>`;
    }).join("");
  }

  pageTree.addEventListener("click", event => {
    const group = event.target.closest("[data-tree-module]");
    if (group) {
      const id = group.dataset.treeModule;
      openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id);
      return renderTree();
    }
    const pageButton = event.target.closest("[data-page-id]");
    if (pageButton) {
      navigationHistory.length = 0;
      navigate(pageButton.dataset.pageId, undefined, false);
    }
  });

  stateSelect.addEventListener("change", () => { current.state = stateSelect.value; renderCurrent(); });
  demoRoot.addEventListener("click", event => { const control = event.target.closest("[data-action]"); if (control) handleBusinessAction(control); });
  detailTabs.addEventListener("click", event => { const tab = event.target.closest("[data-detail-tab]"); if (tab) { activeDetailTab = tab.dataset.detailTab; renderDetails(); } });
  detailContent.addEventListener("input", event => {
    const field = event.target.closest("[data-operation-index]");
    if (!field) return;
    const index = Number(field.dataset.operationIndex);
    const nodes = editableContentNodes();
    if (!nodes[index]) return;
    nodes[index].node.textContent = field.value;
    contentOverrides.set(`${current.page}:${current.state}:${index}`, field.value);
  });

  document.querySelectorAll("[data-collapse]").forEach(button => button.addEventListener("click", () => {
    const side = button.dataset.collapse;
    workspace.classList.add(`${side}-collapsed`);
    document.getElementById(side === "left" ? "page-panel" : "detail-panel").hidden = true;
    document.getElementById(side === "left" ? "open-left" : "open-right").hidden = false;
  }));
  document.getElementById("open-left").addEventListener("click", event => { workspace.classList.remove("left-collapsed"); document.getElementById("page-panel").hidden = false; event.currentTarget.hidden = true; });
  document.getElementById("open-right").addEventListener("click", event => { workspace.classList.remove("right-collapsed"); document.getElementById("detail-panel").hidden = false; event.currentTarget.hidden = true; });

  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
    const isDemo = button.dataset.view === "demo";
    document.querySelectorAll("[data-view]").forEach(item => { item.classList.toggle("active", item === button); item.setAttribute("aria-selected", String(item === button)); });
    document.getElementById("demo-view").hidden = !isDemo;
    document.getElementById("static-view").hidden = isDemo;
    if (!isDemo) renderStatic();
  }));

  document.getElementById("version-info-button").addEventListener("click", () => document.getElementById("version-dialog").showModal());

  document.getElementById("download-button").addEventListener("click", async event => {
    const button = event.currentTarget;
    const page = pageById(current.page);
    button.disabled = true;
    button.textContent = "正在生成…";
    try {
      const dataUrl = await window.htmlToImage.toPng(demoRoot.firstElementChild, { pixelRatio: 2, backgroundColor: "#f4f7f5", cacheBust: true, skipFonts: true, fontEmbedCSS: "" });
      const link = document.createElement("a");
      link.download = `${page.title}-${page.states.find(state => state.id === current.state).name}.png`;
      link.href = dataUrl;
      link.click();
      toast(`已下载“${link.download}”`);
    } catch (error) {
      console.error(error);
      toast("图片生成失败，请重试");
    } finally {
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">↓</span> 下载图片';
    }
  });

  renderCurrent();
  renderStatic();
})();
