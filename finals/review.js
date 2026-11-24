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
    if (!section) return;
    for (let node = section; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    section.scrollIntoView();
  }
  window.addEventListener('hashchange', openLinkedSection);
  openLinkedSection();
  const picker = document.querySelector('[data-local-picker]');
  if (picker) {
    const input = picker.querySelector('input[type=file]');
    if ('webkitdirectory' in input) {
      picker.hidden = false;
      const objectUrls = [];
      input.addEventListener('change', () => {
        const byPath = new Map(Array.from(input.files, file => [
          file.webkitRelativePath.split('/').slice(1).join('/'), file
        ]));
        objectUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
        let count = 0;
        for (const slot of document.querySelectorAll('[data-local-paths]')) {
          slot.replaceChildren();
          const file = JSON.parse(slot.dataset.localPaths).map(path => byPath.get(path)).find(Boolean);
          if (!file) continue;
          const link = document.createElement('a');
          const url = URL.createObjectURL(file);
          objectUrls.push(url);
          link.href = url;
          if (/\.pdf$/i.test(file.name)) {
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = '阅读 PDF';
          } else {
            link.download = file.name;
            link.textContent = '打开原件';
          }
          slot.append(' · ', link);
          count++;
        }
        picker.querySelector('output').textContent = count
          ? '已匹配 ' + count + ' 份章节资料'
          : '没有匹配到章节文件，请选择这门课的“期末教师资料_20261125”文件夹。';
      });
    }
  }


  const shelf = document.querySelector('[data-shelf-search]');
  if (shelf) {
    const input = shelf.querySelector('input');
    const groups = [...document.querySelectorAll('[data-files]')];
    shelf.hidden = false;
    input.addEventListener('input', () => {
      const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let found = 0;
      for (const group of groups) {
        const title = group.querySelector('summary').textContent;
        for (const item of group.querySelectorAll('li')) {
          const text = (title + ' ' + item.textContent).toLowerCase();
          item.hidden = !terms.every(term => text.includes(term));
          if (!item.hidden) found++;
        }
        group.hidden = !group.querySelector('li:not([hidden])');
        if (terms.length) group.open = !group.hidden;
      }
      shelf.querySelector('output').textContent = found + ' 份';
    });
  }
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
    const grade = card.querySelector('[data-grade]');
    if (grade) {
      grade.hidden = false;
      grade.addEventListener('click', () => {
        const choice = [...card.querySelectorAll('.choices input:checked')].map(el => el.value).join('');
        const reply = card.querySelector('.reply');
        if (!choice) { reply.textContent = '请先选择答案'; return; }
        card.querySelector('.solution').open = true;
        if (card.dataset.check) {
          reply.textContent = '请对照下方原资料提示自评';
        } else if (choice === grade.dataset.grade) {
          reply.textContent = '与来源答案一致';
        } else {
          reply.textContent = '与来源答案不同，已加入回练';
          save(card.id, 'again');
          refresh();
        }
      });
    }
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
