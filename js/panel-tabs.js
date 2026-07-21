const TAB_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

export function getNextTabIndex(currentIndex, key, tabCount) {
  if (!Number.isInteger(currentIndex) || tabCount < 1) return 0;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  return currentIndex;
}

export function createPanelTabs({ tablist, scrollContainer }) {
  if (!tablist || !scrollContainer) {
    throw new Error("panel tabs require a tablist and scroll container");
  }

  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  if (!tabs.length) throw new Error("panel tabs require at least one tab");

  const entries = tabs.map((tab) => {
    const panelId = tab.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel || panel.getAttribute("role") !== "tabpanel") {
      throw new Error(`missing tabpanel for ${tab.id || panelId || "unknown tab"}`);
    }
    return { tab, panel, view: panel.dataset.panelView };
  });

  const scrollPositions = new Map(entries.map(({ view }) => [view, 0]));
  let activeIndex = Math.max(0, entries.findIndex(({ tab }) => tab.getAttribute("aria-selected") === "true"));

  function rememberScroll() {
    const active = entries[activeIndex];
    if (active) scrollPositions.set(active.view, scrollContainer.scrollTop);
  }

  function resolveIndex(target) {
    if (Number.isInteger(target)) return Math.max(0, Math.min(entries.length - 1, target));
    const index = entries.findIndex(({ tab, panel, view }) => target === view || target === tab.id || target === panel.id);
    return index >= 0 ? index : activeIndex;
  }

  function activate(target, { focus = false, restoreScroll = true } = {}) {
    const nextIndex = resolveIndex(target);
    if (nextIndex !== activeIndex) rememberScroll();
    activeIndex = nextIndex;

    entries.forEach(({ tab, panel }, index) => {
      const selected = index === activeIndex;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    });

    const active = entries[activeIndex];
    tablist.dataset.activeTab = active.view;
    if (restoreScroll) scrollContainer.scrollTop = scrollPositions.get(active.view) || 0;
    if (focus) active.tab.focus();
    tablist.dispatchEvent(new CustomEvent("paneltabchange", { detail: { view: active.view, index: activeIndex } }));
    return active.view;
  }

  function onClick(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !tablist.contains(tab)) return;
    activate(tab.id);
  }

  function onKeyDown(event) {
    if (!TAB_KEYS.has(event.key)) return;
    const index = tabs.indexOf(event.currentTarget);
    event.preventDefault();
    activate(getNextTabIndex(index, event.key, tabs.length), { focus: true });
  }

  function onScroll() {
    const active = entries[activeIndex];
    if (active) scrollPositions.set(active.view, scrollContainer.scrollTop);
  }

  tablist.addEventListener("click", onClick);
  tabs.forEach((tab) => tab.addEventListener("keydown", onKeyDown));
  scrollContainer.addEventListener("scroll", onScroll, { passive: true });
  activate(activeIndex, { restoreScroll: false });

  return Object.freeze({
    activate,
    getState() {
      const active = entries[activeIndex];
      rememberScroll();
      return {
        activeView: active.view,
        activeIndex,
        scrollTop: scrollContainer.scrollTop,
        scrollPositions: Object.fromEntries(scrollPositions),
        tabs: entries.map(({ tab, panel, view }, index) => ({
          view,
          tabId: tab.id,
          panelId: panel.id,
          selected: index === activeIndex,
          tabIndex: tab.tabIndex,
          hidden: panel.hidden,
        })),
      };
    },
    setScrollTop(value) {
      scrollContainer.scrollTop = Math.max(0, Number(value) || 0);
      rememberScroll();
      return scrollContainer.scrollTop;
    },
    destroy() {
      tablist.removeEventListener("click", onClick);
      tabs.forEach((tab) => tab.removeEventListener("keydown", onKeyDown));
      scrollContainer.removeEventListener("scroll", onScroll);
    },
  });
}
