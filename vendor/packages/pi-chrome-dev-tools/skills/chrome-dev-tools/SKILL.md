---
name: chrome-dev-tools
description: "Browser control via Playwright. Lazily launches Chrome with a persistent profile. Use for navigating pages, clicking elements, typing, taking screenshots, reading accessibility trees, and managing tabs."
---

# Chrome Dev Tools

Browser control via Playwright. Chrome launches lazily on first tool call with a persistent profile (~/.chrome-dev-tools/profile), so logins persist across sessions.

## Tools

| Tool | Purpose |
|------|---------|
| chrome_navigate | Navigate to a URL |
| chrome_snapshot | **DEFAULT** — accessibility tree with @(x,y) click coordinates |
| chrome_click | Click at viewport coordinates |
| chrome_type | Type text into focused element |
| chrome_press_key | Press a key (Enter, Tab, Escape, arrows, etc.) |
| chrome_execute_js | Evaluate JS in page context — surgical DOM reads |
| chrome_screenshot | Capture PNG screenshot (visual verification only) |
| chrome_scroll | Scroll the page (deltaY positive=down, negative=up) |
| chrome_list_tabs | List open tabs |
| chrome_switch_tab | Switch to tab by index |
| chrome_new_tab | Open a new tab |
| chrome_close_tab | Close a tab |
| chrome_page_info | Page URL, title, viewport, scroll position |
| chrome_wait | Wait N seconds |
| chrome_wait_for_load | Wait for page load complete |
| chrome_go_back | History back |
| chrome_go_forward | History forward |
| chrome_reload | Reload page |
| chrome_close | Close the browser |

## Patterns

**Page inspection:** chrome_snapshot first, then chrome_execute_js for specific values. Screenshot only for visual checks.

**Navigation:** chrome_navigate → chrome_wait_for_load → chrome_snapshot

**Form filling:** chrome_snapshot → chrome_click(x,y) on input → chrome_type("text") → chrome_press_key("Tab")

**Data extraction:** chrome_execute_js("document.querySelector('.price').innerText")

**Multi-tab:** chrome_new_tab("url") → chrome_list_tabs → chrome_switch_tab(index)
