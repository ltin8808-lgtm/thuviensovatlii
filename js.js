
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.title').forEach(function (title) {
    // make titles keyboard-focusable
    if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '0');
    if (!title.hasAttribute('role')) title.setAttribute('role', 'button');

    function toggleSection() {
      const item = title.closest('.item');
      if (item) {
        item.classList.toggle('active');
        return;
      }
      // fallback: toggle next sibling with class 'content'
      const next = title.nextElementSibling;
      if (next && next.classList && next.classList.contains('content')) {
        const isShown = window.getComputedStyle(next).display !== 'none';
        next.style.display = isShown ? 'none' : 'block';
      }
    }

    title.addEventListener('click', function () {
      toggleSection();
    });

    title.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSection();
      }
    });
  });
});

// Search box initialization: use embedded index if available, otherwise fetch and fallback to anchors
document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.search-box');
  if (!form) return;
  const input = form.querySelector('input[name="q"]') || form.querySelector('input');

  function normalize(s) {
    if (!s) return '';
    return s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\\/]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function attachHandlersWithIndex(index) {
    // populate datalist suggestions if present
    try {
      const datalist = document.getElementById('search-suggestions');
      if (datalist) {
        datalist.innerHTML = '';
        const seen = new Set();
        index.forEach(function (entry) {
          const label = (entry.title || entry.url || '').toString();
          if (!label) return;
          if (seen.has(label)) return;
          seen.add(label);
          const opt = document.createElement('option');
          opt.value = label;
          datalist.appendChild(opt);
        });
      }
    } catch (err) {}

    const resultsEl = document.getElementById('search-results');

    function renderResults(matches) {
      if (!resultsEl) return;
      resultsEl.innerHTML = '';
      if (!matches || !matches.length) {
        resultsEl.textContent = 'Không tìm thấy kết quả.';
        return;
      }
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.margin = '0';
      ul.style.padding = '6px';
      ul.style.background = '#fff';
      ul.style.border = '1px solid rgba(0,0,0,0.08)';
      ul.style.borderRadius = '6px';
      ul.style.boxShadow = '0 6px 18px rgba(2,58,90,0.06)';
      matches.slice(0,5).forEach(function (entry) {
        const li = document.createElement('li');
        li.style.padding = '6px 8px';
        const a = document.createElement('a');
        a.href = entry.url;
        a.textContent = entry.title || entry.url;
        a.style.color = '#023A5A';
        a.style.textDecoration = 'none';
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          window.location.href = entry.url;
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      resultsEl.appendChild(ul);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const q = normalize(input && input.value);
      console.log('[search] query:', q);
      if (!q) { renderResults([]); return; }

      // build candidate list with simple scoring
      const parts = q.split(' ');
      const candidates = index.map(function (entry) {
        const t = normalize((entry.title || '') + ' ' + (entry.url || ''));
        let score = 0;
        if (t.indexOf(q) !== -1) score += 100; // phrase match
        parts.forEach(function (p) { if (t.indexOf(p) !== -1) score += 10; });
        // prefer shorter URL/title distance
        score -= (t.length - q.length) * 0.01;
        return { entry: entry, score: score };
      }).filter(function (c) { return c.score > 0; });
      function extractFirstNumber(s) {
        if (!s) return Infinity;
        const m = s.match(/(\d+(?:\.\d+)?)/);
        if (!m) return Infinity;
        const n = parseFloat(m[1]);
        return isFinite(n) ? n : Infinity;
      }

      // sort by score desc, then by first numeric token asc (so '1,2,3' ordering)
      candidates.sort(function (a, b) {
        const sd = b.score - a.score;
        if (Math.abs(sd) > 1e-6) return sd;
        const na = extractFirstNumber((a.entry.title || '') + ' ' + (a.entry.url || ''));
        const nb = extractFirstNumber((b.entry.title || '') + ' ' + (b.entry.url || ''));
        if (na === nb) return 0;
        if (!isFinite(na)) return 1;
        if (!isFinite(nb)) return -1;
        return na - nb;
      });
      const matches = candidates.map(function (c) { return c.entry; });
      console.log('[search] matches:', matches.slice(0,5));

      if (matches.length > 0) {
        // Nếu có ít nhất 1 kết quả, điều hướng tới kết quả đứng đầu khi người dùng bấm 'Tìm kiếm'
        window.location.href = matches[0].url;
        return;
      }

      // không có kết quả: hiển thị thông báo
      renderResults(matches);
    });
  }

  // prefer embedded index (works for local file://), otherwise fetch
  if (window.__SEARCH_INDEX && Array.isArray(window.__SEARCH_INDEX) && window.__SEARCH_INDEX.length) {
    attachHandlersWithIndex(window.__SEARCH_INDEX);
  } else {
    fetch('search_index.json').then(function (res) {
      if (!res.ok) throw new Error('no index');
      return res.json();
    }).then(function (index) {
      attachHandlersWithIndex(index);
    }).catch(function () {
      // if embedded index appears later, try it; otherwise fallback to anchor-only search
      if (window.__SEARCH_INDEX && Array.isArray(window.__SEARCH_INDEX) && window.__SEARCH_INDEX.length) {
        attachHandlersWithIndex(window.__SEARCH_INDEX);
        return;
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const q = normalize(input && input.value);
        if (!q) return;
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const aFound = anchors.find(function (a) {
          return normalize(a.textContent || a.innerText || '').includes(q) || normalize(a.getAttribute('href') || '').includes(q);
        });
        if (aFound) window.location.href = aFound.getAttribute('href');
        else alert('Không tìm thấy bài phù hợp.');
      });
    });
  }
});
