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

  // "Esquelets" de càrrega: formes grises animades que ocupen el lloc del
  // contingut mentre arriba la resposta del servidor (Apps Script pot trigar
  // uns segons), en lloc de deixar la pantalla buida.
  function repetir_(n, html) { return new Array(n + 1).join(html); }

  function skeletonTiles(n) {
    return repetir_(n, '<div class="tile skeleton-tile" aria-hidden="true"><span class="skeleton skeleton-line" style="width:60%"></span><span class="skeleton skeleton-num"></span></div>');
  }

  function skeletonCards(n) {
    return '<div class="skeleton-list" role="status" aria-label="Carregant...">' +
      repetir_(n, '<div class="skeleton-card"><span class="skeleton skeleton-line" style="width:45%"></span><span class="skeleton skeleton-line skeleton-line-sm" style="width:30%"></span><span class="skeleton skeleton-bar"></span></div>') +
      '</div>';
  }

  return {
    qs: qs, escapeHtml: escapeHtml, debounce: debounce, showToast: showToast, extractSheetId: extractSheetId,
    skeletonTiles: skeletonTiles, skeletonCards: skeletonCards
  };
})();
