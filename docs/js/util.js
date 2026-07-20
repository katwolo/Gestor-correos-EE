const Util = (function () {
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments, ctx = this;
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  let toastTimer = null;
  function showToast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 4000);
  }

  function extractSheetId(url) {
    if (!url) return null;
    const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    // Allow pasting a bare ID directly.
    if (/^[a-zA-Z0-9-_]{20,}$/.test(url.trim())) return url.trim();
    return null;
  }

  return { qs: qs, escapeHtml: escapeHtml, debounce: debounce, showToast: showToast, extractSheetId: extractSheetId };
})();
