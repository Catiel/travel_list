(function () {
  const root = document.getElementById("prototype-root");
  const historyStack = [];
  const pages = window.LUGGAGE_PROTOTYPE.pages;
  let current = { page: pages[0].id, state: pages[0].primaryState };

  const pageById = id => pages.find(page => page.id === id);

  function readRoute() {
    const params = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
    const page = pageById(params.get("page"));
    if (!page) return current;
    const state = page.states.some(item => item.id === params.get("state")) ? params.get("state") : page.primaryState;
    return { page: page.id, state };
  }

  function render(route = readRoute(), updateHash = false) {
    const page = pageById(route.page) || pages[0];
    current = { page: page.id, state: page.states.some(state => state.id === route.state) ? route.state : page.primaryState };
    root.innerHTML = window.LuggageRenderer.render(current.page, current.state);
    if (updateHash) location.hash = `page=${current.page}&state=${current.state}`;
  }

  function navigate(pageId, stateId, record = true) {
    const page = pageById(pageId);
    if (!page) return;
    if (record) historyStack.push({ ...current });
    render({ page: page.id, state: stateId || page.primaryState }, true);
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
    const previous = historyStack.pop();
    if (previous) return render(previous, true);
    const fallback = fallbackFor(current.page);
    if (!fallback) return toast("已返回上一级（原型演示边界）");
    const [page, state] = fallback;
    render({ page, state }, true);
  }

  function toast(message) {
    root.querySelector(".demo-toast")?.remove();
    const node = document.createElement("div");
    node.className = "demo-toast";
    node.textContent = message;
    root.firstElementChild.appendChild(node);
    window.setTimeout(() => node.remove(), 1800);
  }

  function validateForm() {
    const input = root.querySelector("[data-form-name]");
    if (!input || input.value.trim()) return true;
    const page = pageById(current.page);
    if (page.states.some(state => state.id === "validation")) render({ page: current.page, state: "validation" }, true);
    return false;
  }

  function updatePicker() {
    const count = root.querySelectorAll('[data-action="select-item"].selected').length;
    const counter = root.querySelector("[data-selected-count], [data-library-selected], [data-template-selected], [data-template-asset-selected]");
    const save = root.querySelector(".selection-dock button, .picker-selection-bar button");
    if (counter) counter.textContent = String(count);
    if (save) save.disabled = count === 0;
  }

  root.addEventListener("click", event => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    if (action === "goto") return navigate(control.dataset.page, control.dataset.state);
    if (action === "scene-state") return render({ page: current.page, state: control.dataset.state }, true);
    if (action === "back") return goBack();
    if (action === "toast") return toast(control.dataset.message || "操作已完成");
    if (action === "toggle-check") {
      const mark = control.matches(".carry-check") ? control : control.querySelector(".check");
      mark.classList.toggle("off");
      mark.classList.toggle("done", !mark.classList.contains("off"));
      mark.textContent = mark.classList.contains("off") ? "" : "✓";
      const marks = Array.from(root.querySelectorAll(".carry-check"));
      const done = marks.filter(item => !item.classList.contains("off")).length;
      if (root.querySelector("[data-progress-label]")) root.querySelector("[data-progress-label]").textContent = `${done} / ${marks.length}`;
      if (root.querySelector("[data-progress-bar]")) root.querySelector("[data-progress-bar]").style.width = `${Math.round(done / marks.length * 100)}%`;
      return;
    }
    if (action === "filter") {
      control.classList.toggle("active");
      control.textContent = control.classList.contains("active") ? "显示全部" : "只看未完成";
      root.querySelectorAll(".personal-edit-row").forEach(row => { row.hidden = control.classList.contains("active") && !row.querySelector(".carry-check.off"); });
      return;
    }
    if (action === "step") {
      const stepper = control.closest(".stepper"), counter = stepper.querySelector("[data-count]");
      counter.textContent = String(Math.max(Number(stepper.dataset.min || 1), Math.min(99, Number(counter.textContent) + Number(control.dataset.delta))));
      return;
    }
    if (action === "toggle-add-team") return render({ page: current.page, state: control.classList.contains("on") ? "personal" : "team-all" }, true);
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
    if (action === "save-picker" || action === "save-to") {
      if (control.disabled) return;
      navigate(control.dataset.page, control.dataset.state);
      return window.setTimeout(() => toast("操作已保存"), 0);
    }
    if (action === "save-form") {
      if (!validateForm()) return;
      navigate(control.dataset.page, control.dataset.state);
      return window.setTimeout(() => toast("已保存"), 0);
    }
    if (action === "continue-add") {
      if (!validateForm()) return;
      const input = root.querySelector("[data-form-name]");
      input.value = "";
      root.querySelectorAll("[data-count]").forEach(node => { node.textContent = "1"; });
      const notice = root.querySelector("[data-inline-success]");
      if (notice) notice.hidden = false;
      input.focus();
      return toast("当前物品已保存，可继续添加");
    }
    if (action === "toggle-carriers") {
      const list = control.nextElementSibling;
      list.hidden = !list.hidden;
      control.setAttribute("aria-expanded", String(!list.hidden));
      control.textContent = list.hidden ? "查看携带成员⌄" : "收起携带成员⌃";
      return;
    }
    if (action === "remind") return toast(`已在计划群聊提醒${control.dataset.name}携带${control.dataset.item}`);
    if (action === "toggle-batch-share") {
      control.classList.toggle("on");
      const card = control.closest(".batch-card");
      if (control.classList.contains("on")) {
        card.querySelector(".field")?.remove();
        card.insertAdjacentHTML("beforeend", '<span class="field-label">携带方式</span><div class="segmented"><button data-action="toast" data-message="已选择所有成员" class="active">所有成员</button><button data-action="toast" data-message="已选择指定成员">指定成员</button></div><div class="member-quantities"><div><span><i>我</i><b>我</b></span><div class="stepper" data-min="1"><button data-action="step" data-delta="-1">−</button><b data-count>1</b><button data-action="step" data-delta="1">＋</button></div></div></div>');
      } else {
        card.querySelector(".field-label")?.remove(); card.querySelector(".segmented")?.remove(); card.querySelector(".member-quantities")?.remove();
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
      const layer = root.querySelector(".member-picker-layer");
      if (layer) layer.hidden = false;
      return;
    }
    if (action === "close-member-picker") {
      const layer = control.closest(".member-picker-layer");
      if (layer) layer.hidden = true;
      return;
    }
    if (action === "toggle-member-selection") {
      const row = control.closest(".member-select-row"), selected = !row.classList.contains("selected");
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
        root.querySelectorAll(".carrier-selected-summary strong b").forEach(label => { label.textContent = count ? `我等${count}人` : "请选择成员"; });
      }
      return;
    }
    if (action === "save-opinion") {
      const textarea = root.querySelector("[data-opinion]");
      if (!textarea?.value.trim()) return render({ page: current.page, state: "validation" }, true);
      navigate("team-info", "passport");
      return window.setTimeout(() => toast("意见已保存"), 0);
    }
    if (action === "move-row") {
      const row = control.closest(".template-item, .template-category"), direction = control.dataset.direction;
      const sibling = direction === "up" ? row.previousElementSibling : row.nextElementSibling;
      if (sibling && sibling.matches(row.matches(".template-item") ? ".template-item" : ".template-category")) {
        if (direction === "up") row.parentElement.insertBefore(row, sibling); else row.parentElement.insertBefore(sibling, row);
        toast("顺序已调整");
      }
    }
  });

  window.addEventListener("hashchange", () => render(readRoute()));
  render(readRoute());
})();
