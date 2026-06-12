(function () {
  'use strict';

  /** @type {string} */
  var category = 'vectors';
  var page = 1;
  /** @type {{ id: string, pageURL: string, title?: string, previewURL?: string, user?: string } | null} */
  var selected = null;
  var state = { loading: false };

  var qs = document.querySelector.bind(document);
  var qsa = document.querySelectorAll.bind(document);

  function searchPath(cat) {
    return cat === 'sound-effects' ? '/api/v1/sound-effects/search' : '/api/v1/' + cat + '/search';
  }

  function buildSearchUrl(q, p) {
    var params = new URLSearchParams();
    params.set('q', (q || '').trim() || ' ');
    params.set('page', String(Math.max(1, p)));
    return searchPath(category) + '?' + params.toString();
  }

  function fileDownloadUrl(id, extraUrl) {
    var base = '/api/v1/' + category + '/assets/' + encodeURIComponent(id) + '/file';
    if (extraUrl) return base + '?url=' + encodeURIComponent(extraUrl);
    return base;
  }

  function setVisible(el, show) {
    el.classList.toggle('hidden', !show);
  }

  function setTabsUI() {
    qsa('.tab').forEach(function (btn) {
      var cat = btn.getAttribute('data-category');
      var on = cat === category;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function setPagerUI(hasItems) {
    qs('#page-label').textContent = 'Page ' + page;
    qs('#prev-page').disabled = page <= 1 || state.loading;
    qs('#next-page').disabled = state.loading || !hasItems;
  }

  async function runSearch() {
    var queryInput = qs('#query');
    var q = queryInput.value;
    state.loading = true;
    setVisible(qs('#loading-msg'), true);
    setVisible(qs('#error-box'), false);
    setVisible(qs('#empty-msg'), false);
    setVisible(qs('#cf-alert'), false);
    qs('#search-btn').disabled = true;
    setPagerUI(false);

    try {
      var res = await fetch(buildSearchUrl(q, page));
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        var parts = [data.message || res.statusText || 'Search failed'];
        if (data.hint) parts.push(data.hint);
        if (data.error) parts.push('(' + data.error + ')');
        throw new Error(parts.join(' — '));
      }

      setVisible(
        qs('#cf-alert'),
        !!data.cloudflareChallengeLikely,
      );
      if (data.cloudflareChallengeLikely) {
        qs('#cf-alert').innerHTML =
          '<strong>Cloudflare challenge detected.</strong> Results may be empty until the server can reach Pixabay (for example set <code>PIXABAY_COOKIE</code> from a browser session that already passed the check).';
      }

      var grid = qs('#grid');
      grid.innerHTML = '';
      var items = data.items || [];
      items.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card';
        var thumbWrap = document.createElement('div');
        thumbWrap.className = 'card-thumb';
        if (item.previewURL) {
          var img = document.createElement('img');
          img.alt = '';
          img.loading = 'lazy';
          img.src = String(item.previewURL);
          thumbWrap.appendChild(img);
        } else {
          var ph = document.createElement('span');
          ph.className = 'placeholder';
          ph.textContent = 'No preview';
          thumbWrap.appendChild(ph);
        }
        var body = document.createElement('div');
        body.className = 'card-body';
        var idSpan = document.createElement('span');
        idSpan.className = 'card-id';
        idSpan.textContent = '#' + String(item.id);
        body.appendChild(idSpan);
        if (item.title) {
          var t = document.createElement('span');
          t.className = 'card-title';
          t.textContent = item.title;
          body.appendChild(t);
        }
        if (item.user) {
          var u = document.createElement('span');
          u.className = 'card-title';
          u.textContent = item.user;
          body.appendChild(u);
        }
        btn.appendChild(thumbWrap);
        btn.appendChild(body);
        btn.addEventListener('click', function () {
          openSheet(item);
        });
        grid.appendChild(btn);
      });

      setVisible(qs('#empty-msg'), !state.loading && items.length === 0);
      if (items.length === 0) {
        qs('#empty-msg').textContent =
          'No items returned. Try another query or check the message above.';
      }
      setPagerUI(items.length > 0);
    } catch (e) {
      qs('#grid').innerHTML = '';
      var errEl = qs('#error-box');
      errEl.textContent = e.message || 'Search failed';
      setVisible(errEl, true);
      setPagerUI(false);
    } finally {
      state.loading = false;
      setVisible(qs('#loading-msg'), false);
      qs('#search-btn').disabled = false;
      setPagerUI((qs('#grid').children || []).length > 0);
    }
  }

  function openSheet(item) {
    selected = item;
    qs('#sheet-title').textContent = 'Asset #' + item.id;
    var link = qs('#sheet-pixabay-link');
    link.href = item.pageURL || '#';
    qs('#try-dl').href = fileDownloadUrl(item.id);
    setVisible(qs('#sheet-dl-error'), false);
    setVisible(qs('#sheet-dl-info'), false);
    qs('#sheet-candidates').innerHTML = '';
    qs('#resolve-dl').disabled = false;
    qs('#resolve-dl').textContent = 'Resolve download URLs';
    setVisible(qs('#overlay'), true);
  }

  function closeSheet() {
    setVisible(qs('#overlay'), false);
    selected = null;
  }

  async function resolveDownload() {
    if (!selected) return;
    qs('#resolve-dl').disabled = true;
    qs('#resolve-dl').textContent = 'Resolving…';
    setVisible(qs('#sheet-dl-error'), false);
    try {
      var res = await fetch(
        '/api/v1/' + category + '/assets/' + encodeURIComponent(selected.id) + '/download-info',
      );
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.message || res.statusText);
      qs('#sheet-page-title').textContent = 'Detail page title: ' + (data.pageTitle || '');
      qs('#sheet-candidates-count').textContent =
        'Candidates (' + (data.candidates || []).length + ')';
      var ul = qs('#sheet-candidates');
      ul.innerHTML = '';
      (data.candidates || []).forEach(function (c) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = fileDownloadUrl(selected.id, c.url);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = c.contentType || 'link';
        li.appendChild(a);
        li.appendChild(document.createTextNode(' — '));
        var u = c.url || '';
        li.appendChild(document.createTextNode(u.length > 120 ? u.slice(0, 120) + '…' : u));
        ul.appendChild(li);
      });
      setVisible(qs('#sheet-dl-info'), true);
    } catch (e) {
      var err = qs('#sheet-dl-error');
      err.textContent = e.message || 'Failed to resolve download';
      setVisible(err, true);
    } finally {
      qs('#resolve-dl').disabled = false;
      qs('#resolve-dl').textContent = 'Resolve download URLs';
    }
  }

  qsa('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-category');
      if (!cat || cat === category) return;
      category = cat;
      page = 1;
      setTabsUI();
      runSearch();
    });
  });

  qs('#search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    page = 1;
    runSearch();
  });

  qs('#prev-page').addEventListener('click', function () {
    if (page > 1) {
      page--;
      runSearch();
    }
  });

  qs('#next-page').addEventListener('click', function () {
    page++;
    runSearch();
  });

  qs('#close-sheet').addEventListener('click', closeSheet);
  qs('#overlay').addEventListener('click', function (e) {
    if (e.target === qs('#overlay')) closeSheet();
  });
  qs('#sheet').addEventListener('click', function (e) {
    e.stopPropagation();
  });
  qs('#resolve-dl').addEventListener('click', function () {
    resolveDownload();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !qs('#overlay').classList.contains('hidden')) closeSheet();
  });

  setTabsUI();
  runSearch();
})();
