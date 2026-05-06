let fuse = null;
let allCatalogs = [];

async function loadIndex() {
  try {
    const res = await fetch('index.json?t=' + Date.now());
    if (!res.ok) throw new Error('index.json 없음');
    const data = await res.json();
    allCatalogs = data.catalogs || [];

    fuse = new Fuse(allCatalogs, {
      keys: [
        { name: 'text', weight: 0.7 },
        { name: 'supplier', weight: 0.3 },
        { name: 'filename', weight: 0.1 },
      ],
      includeMatches: true,
      threshold: 0.3,
      minMatchCharLength: 2,
    });

    document.getElementById('total-count').textContent = `카탈로그 ${data.total}개`;
    const d = new Date(data.built_at);
    document.getElementById('built-at').textContent =
      `갱신 ${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) {
    document.getElementById('total-count').textContent = 'index.json 없음 — 파싱 먼저 실행해줘';
  }
}

function highlight(text, matches, key) {
  const match = matches?.find(m => m.key === key);
  if (!match || !match.indices?.length) {
    return truncate(text, 120);
  }

  // 첫 번째 매치 주변 텍스트 추출
  const [start] = match.indices[0];
  const begin = Math.max(0, start - 40);
  const snippet = text.slice(begin, begin + 200);
  const offset = start - begin;

  let result = '';
  let cursor = 0;
  for (const [s, e] of match.indices) {
    const adjS = s - begin;
    const adjE = e - begin;
    if (adjS < 0 || adjE > snippet.length) continue;
    result += escape(snippet.slice(cursor, adjS));
    result += `<mark>${escape(snippet.slice(adjS, adjE + 1))}</mark>`;
    cursor = adjE + 1;
  }
  result += escape(snippet.slice(cursor));
  return (begin > 0 ? '…' : '') + result + '…';
}

function escape(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function truncate(str, len) {
  if (!str) return '';
  const clean = str.replace(/\n+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

function renderResults(results) {
  const container = document.getElementById('results');
  const header = document.getElementById('results-header');
  const empty = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');

  container.innerHTML = '';

  if (results === null) {
    empty.classList.remove('hidden');
    noResults.classList.add('hidden');
    header.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');

  if (results.length === 0) {
    noResults.classList.remove('hidden');
    header.classList.add('hidden');
    return;
  }

  noResults.classList.add('hidden');
  header.classList.remove('hidden');
  const q = document.getElementById('search-input').value.trim();
  header.innerHTML = `"<span>${escape(q)}</span>" — ${results.length}개 거래처`;

  for (const r of results) {
    const c = r.item;
    const snippetHtml = highlight(c.text, r.matches, 'text');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div class="supplier">${escape(c.supplier)}</div>
        <div class="filename">${escape(c.filename)}</div>
      </div>
      <div class="snippet">${snippetHtml}</div>
      <div class="card-meta">
        <span>📄 ${c.pages}페이지</span>
        <span>🕒 ${c.parsed_at ? new Date(c.parsed_at).toLocaleDateString('ko-KR') : '—'}</span>
      </div>
    `;
    container.appendChild(card);
  }
}

let debounceTimer = null;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const q = e.target.value.trim();
    if (!q) {
      renderResults(null);
      return;
    }
    if (!fuse) return;
    const results = fuse.search(q, { limit: 30 });
    renderResults(results);
  }, 200);
});

async function refreshIndex() {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  btn.textContent = '로딩중…';
  fuse = null;
  allCatalogs = [];
  await loadIndex();
  const q = document.getElementById('search-input').value.trim();
  if (q && fuse) {
    renderResults(fuse.search(q, { limit: 30 }));
  } else {
    renderResults(null);
  }
  btn.disabled = false;
  btn.textContent = '새로고침';
}

loadIndex();
