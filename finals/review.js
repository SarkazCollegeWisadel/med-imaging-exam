(() => {
  const prefix = 'med-finals-v1:' + document.body.dataset.course + ':';
  const fallback = new Map();
  function read(key) {
    if (fallback.has(key)) return fallback.get(key);
    try { return localStorage.getItem(prefix + key); } catch { return null; }
  }
  function save(key, value) {
    fallback.set(key, value);
    try { localStorage.setItem(prefix + key, value); } catch {}
  }
  for (const box of document.querySelectorAll('input[data-day]')) {
    box.checked = read(box.dataset.day) === 'done';
    box.addEventListener('change', () => save(box.dataset.day, box.checked ? 'done' : ''));
  }
  function openLinkedSection() {
    const section = document.getElementById(location.hash.slice(1));
    if (section instanceof HTMLDetailsElement) section.open = true;
  }
  window.addEventListener('hashchange', openLinkedSection);
  openLinkedSection();
  const cards = [...document.querySelectorAll('.question')];
  const filter = document.querySelector('#filter');
  if (!filter) return;
  function refresh() {
    let shown = 0;
    for (const card of cards) {
      const marked = read(card.id) === 'again';
      const btn = card.querySelector('[data-mark]');
      btn.setAttribute('aria-pressed', String(marked));
      btn.textContent = marked ? '已加入回练 · 移出' : '加入回练';
      card.hidden = (filter.value === 'again' && !marked) ||
        (filter.value === 'check' && !card.dataset.check);
      if (!card.hidden) shown++;
    }
    for (const group of document.querySelectorAll('.group')) {
      group.hidden = !group.querySelector('.question:not([hidden])');
    }
    document.querySelector('#count').textContent = shown + ' 题' + (shown ? '' : ' · 先在题下点“加入回练”');
  }
  for (const card of cards) {
    const btn = card.querySelector('[data-mark]');
    btn.hidden = false;
    btn.addEventListener('click', () => {
      save(card.id, read(card.id) === 'again' ? '' : 'again');
      refresh();
    });
  }
  filter.addEventListener('change', () => {
    refresh();
    for (const group of document.querySelectorAll('.group')) group.open = filter.value !== 'all' && !group.hidden;
  });
  document.querySelector('#filters').hidden = false;
  refresh();
})();
