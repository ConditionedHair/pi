import { rpc, on } from "../bridge.js";

/**
 * SVG saver — when the user hovers over any <svg> in the page, show a
 * floating menu with "Copy to clipboard" / "Download file" options.
 * Both call into the host via RPC methods `svg.copy` and `svg.save`.
 *
 * The page owns the menu and the SVG serialization; the host owns the OS
 * dialogs and file IO. The menu is inert until the bridge delivers the
 * `final` chunk — the feature listens for that itself; no globals.
 */

const HIDE_DELAY_MS = 450;
const MENU_TRANSIT_MS = 120;
const POST_ACTION_DISMISS_MS = 900;
const RESTORE_LABEL_MS = 1200;
const TRIGGER_SIZE = 28;
const TRIGGER_INSET = 8;

interface MenuItem { item: HTMLButtonElement; label: HTMLSpanElement; }

const COPY_LABEL = "Copy to clipboard";
const SAVE_LABEL = "Download file";

function menuItem(iconSVG: string, text: string): MenuItem {
  const item = document.createElement("button");
  item.type = "button";
  item.style.cssText =
    "width:100%;height:38px;margin:0;border:0;border-radius:0;background:transparent;color:#d8d5cf;" +
    "display:flex;align-items:center;gap:12px;padding:0 14px;font:400 15px/1 system-ui,-apple-system,sans-serif;" +
    "text-align:left;cursor:default;white-space:nowrap;transition:background .16s ease;";

  const iconBox = document.createElement("span");
  iconBox.innerHTML = iconSVG;
  iconBox.style.cssText =
    "width:20px;height:20px;color:#d8d5cf;flex:0 0 20px;display:flex;align-items:center;justify-content:center;";

  const label = document.createElement("span");
  label.textContent = text;
  item.append(iconBox, label);

  item.addEventListener("mouseenter", () => {
    if (!item.disabled) item.style.background = "#141413";
  });
  item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });

  return { item, label };
}

/** Pick a human-friendly suggestion. Host re-sanitizes — this is just a hint. */
function suggestName(svg: SVGElement): string {
  const titleNode = svg.querySelector("title");
  return svg.getAttribute("aria-label")
    || (titleNode && titleNode.textContent)
    || document.title
    || "diagram";
}

function collectStyles(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try { return Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join("\n"); }
      catch { return ""; }
    })
    .filter(Boolean)
    .join("\n");
}

function serialize(svg: SVGElement): string {
  const clone = svg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink")) clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const css = collectStyles();
  if (css) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function install(): void {
  let activeSvg: SVGElement | null = null;
  let triggerHideTimer: ReturnType<typeof setTimeout> | null = null;
  let menuHideTimer: ReturnType<typeof setTimeout> | null = null;
  let restoreTimer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let exportReady = false;

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;z-index:2147483647;display:none;font-family:system-ui,-apple-system,sans-serif;color:#d8d5cf;";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.innerHTML = "<span></span><span></span><span></span>";
  trigger.setAttribute("aria-label", "SVG actions");
  trigger.style.cssText =
    `width:${TRIGGER_SIZE}px;height:${TRIGGER_SIZE}px;border:0;border-radius:7px;background:#262624;` +
    "display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:0;" +
    "transition:background .16s ease;";
  Array.from(trigger.children).forEach((dot) => {
    (dot as HTMLElement).style.cssText = "width:3.5px;height:3.5px;border-radius:50%;background:#c8c5bd;display:block;";
  });

  const menu = document.createElement("div");
  menu.style.cssText =
    "position:absolute;right:0;top:34px;width:198px;padding:6px 0;border-radius:12px;background:#262624;" +
    "border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 28px rgba(0,0,0,.36);display:none;overflow:hidden;";

  const copy = menuItem(
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<rect x="8" y="8" width="12" height="12" rx="2"/><rect x="4" y="4" width="12" height="12" rx="2"/></svg>',
    COPY_LABEL,
  );
  const download = menuItem(
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/>' +
    '<path d="M5 20h14"/></svg>',
    SAVE_LABEL,
  );

  menu.append(copy.item, download.item);
  host.append(trigger, menu);
  document.body.appendChild(host);

  function setExportReady(ready: boolean): void {
    exportReady = ready;
    for (const m of [copy.item, download.item]) {
      m.disabled = !ready;
      m.style.opacity = ready ? "1" : ".45";
      m.style.cursor = ready ? "default" : "not-allowed";
      if (!ready) m.style.background = "transparent";
    }
  }
  setExportReady(false);

  // We become active once the host has pushed the final chunk. Until then
  // we still show the menu on hover so users see something — but inert.
  on("content", (msg) => { if (msg.final) setExportReady(true); });

  function restoreLabels(): void {
    if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
    copy.label.textContent = COPY_LABEL;
    download.label.textContent = SAVE_LABEL;
  }

  // Two independent layers:
  //   - trigger visibility (host display): follows SVG hover
  //   - menu visibility (dropdown): follows trigger+menu hover, plus explicit
  //     click/Escape/outside-click. Collapsing the menu doesn't hide the
  //     trigger; hiding the trigger always collapses the menu first.

  function showMenu(): void {
    menu.style.display = "block";
    trigger.style.background = "#141413";
  }
  function hideMenu(): void {
    menu.style.display = "none";
    trigger.style.background = "#262624";
  }
  function hideTrigger(): void {
    if (triggerHideTimer) { clearTimeout(triggerHideTimer); triggerHideTimer = null; }
    hideMenu();
    host.style.display = "none";
    activeSvg = null;
  }
  function scheduleTriggerHide(): void {
    if (triggerHideTimer) clearTimeout(triggerHideTimer);
    triggerHideTimer = setTimeout(hideTrigger, HIDE_DELAY_MS);
  }
  function showFor(svg: SVGElement): void {
    activeSvg = svg;
    if (triggerHideTimer) { clearTimeout(triggerHideTimer); triggerHideTimer = null; }
    const rect = svg.getBoundingClientRect();
    host.style.display = "block";
    host.style.left = Math.max(
      TRIGGER_INSET,
      Math.min(window.innerWidth - TRIGGER_SIZE - TRIGGER_INSET, rect.right - TRIGGER_SIZE - TRIGGER_INSET),
    ) + "px";
    host.style.top = Math.max(TRIGGER_INSET, rect.top + TRIGGER_INSET) + "px";
  }

  async function dispatch(action: "copy" | "download"): Promise<void> {
    if (!exportReady || pending) return;
    const svg = activeSvg || document.querySelector("svg");
    if (!svg) return;
    activeSvg = svg as SVGElement;
    pending = true;

    const target = action === "copy" ? copy : download;
    target.label.textContent = action === "copy" ? "Copying…" : "Choosing file…";

    let cancelled = false;
    try {
      const payload = serialize(svg as SVGElement);
      if (action === "copy") {
        await rpc("svg.copy", { svg: payload });
        target.label.textContent = "Copied";
      } else {
        const result = await rpc<{ cancelled?: boolean }>("svg.save", {
          svg: payload,
          suggestedName: suggestName(svg as SVGElement),
        });
        cancelled = !!result?.cancelled;
        target.label.textContent = cancelled ? SAVE_LABEL : "Saved";
      }
    } catch (err) {
      target.label.textContent = "Failed";
      console.error("[glimpse-ui] svg action failed:", err);
    } finally {
      pending = false;
      restoreTimer = setTimeout(restoreLabels, RESTORE_LABEL_MS);
      // Dismiss the menu after the user sees the outcome. Skip the dismiss
      // on a cancelled save dialog — they're likely about to try again.
      if (!cancelled) setTimeout(() => { cancelMenuHide(); hideMenu(); }, POST_ACTION_DISMISS_MS);
    }
  }

  // Trigger appears when hovering an SVG.
  document.addEventListener("mouseover", (event) => {
    const target = event.target as Element | null;
    const svg = target?.closest?.("svg");
    if (svg) showFor(svg as SVGElement);
  });
  // Trigger schedules-hide when leaving an SVG (unless cursor moved into host).
  document.addEventListener("mouseout", (event) => {
    const target = event.target as Element | null;
    const svg = target?.closest?.("svg");
    const related = (event as MouseEvent).relatedTarget as Node | null;
    if (svg && !svg.contains(related) && !host.contains(related)) scheduleTriggerHide();
  });
  // The menu is position:absolute, so the trigger and menu have a small
  // visual gap (and separate hit areas). Hovering either keeps the menu
  // open; leaving both for MENU_TRANSIT_MS closes it. The transit timer
  // is independent of the SVG-hover trigger timer.
  function cancelMenuHide(): void {
    if (menuHideTimer) { clearTimeout(menuHideTimer); menuHideTimer = null; }
  }
  function scheduleMenuHide(): void {
    cancelMenuHide();
    menuHideTimer = setTimeout(hideMenu, MENU_TRANSIT_MS);
  }
  function keepAlive(): void {
    cancelMenuHide();
    if (triggerHideTimer) { clearTimeout(triggerHideTimer); triggerHideTimer = null; }
  }

  trigger.addEventListener("mouseenter", () => { keepAlive(); showMenu(); });
  trigger.addEventListener("mouseleave", scheduleMenuHide);
  menu.addEventListener("mouseenter", keepAlive);
  menu.addEventListener("mouseleave", scheduleMenuHide);

  // Clicking the trigger toggles the menu. Hover opens it too, but a click
  // gives keyboard / touchpad users a deterministic way to dismiss it.
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (menu.style.display === "block") hideMenu();
    else showMenu();
  });

  copy.item.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); void dispatch("copy"); });
  download.item.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); void dispatch("download"); });

  window.addEventListener("scroll", () => { if (activeSvg) showFor(activeSvg); }, true);
  window.addEventListener("resize", () => { if (activeSvg) showFor(activeSvg); });

  // Click anywhere outside the menu+trigger dismisses the menu. Trigger
  // stays if the cursor is still over an SVG. Capture phase so this runs
  // before any in-widget click handlers.
  document.addEventListener("pointerdown", (event) => {
    if (menu.style.display === "none") return;
    const target = event.target as Node | null;
    if (target && host.contains(target)) return;
    cancelMenuHide();
    hideMenu();
  }, true);

  // Escape collapses the menu.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.style.display === "block") {
      cancelMenuHide();
      hideMenu();
    }
  });
}
