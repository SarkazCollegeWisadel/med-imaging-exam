(() => {
  const nav = document.querySelector('.study-desk-links,.masthead,.topline');
  if (!nav) return;
  const root = new URL('..', document.currentScript.src);
  const page = new URL(location.href).pathname.slice(root.pathname.length) || 'index.html';
  const relative = decodeURIComponent(page).replace(/\/$/, '/index.html');
  const source = new URL(relative, 'https://sarkazcollegewisadel.github.io/med-imaging-exam/').href;
  const KEY = 'study-desk:web-receipt:v1:';
  let memory = [];
  let context = null;
  function stored() {
    const records = new Map(memory.map(item => [item.id,item]));
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(KEY)) continue;
        const item = JSON.parse(localStorage.getItem(key));
        if (item?.id && key === KEY + item.id) records.set(item.id,item);
      }
    } catch {}
    return [...records.values()].sort((a,b) => a.at.localeCompare(b.at));
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const s = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
    return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'transfer-toggle';
  toggle.textContent = '学习记录 / 问 DSH';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'study-transfer');
  nav.append(toggle);
  const panel = document.createElement('section');
  panel.id = 'study-transfer';
  panel.hidden = true;
  panel.innerHTML = `
    <h2>学习记录与提问</h2>
    <p data-current></p>
    <form>
      <label>学习位置<input name="topic" maxlength="120" required></label>
      <label>学习方式<select name="action"><option value="browse">已查阅</option><option value="practice">已练习</option><option value="review">已复习</option></select></label>
      <div class="transfer-actions"><button type="submit">记下一条</button><button type="button" data-ask>复制给 DSH</button><button type="button" data-code>复制学习码</button><button type="button" data-file>下载记录</button></div>
    </form>
    <p data-feedback role="status"></p>
    <textarea aria-label="可手动复制的内容" readonly hidden></textarea>
    <p class="transfer-help">学习码可跨设备转发，到电脑双击本机「导入网页学习记录」粘贴归档。每条记录只在你确认后生成。</p>`;
  nav.closest('.desk,.study-desk-nav') === nav.closest('.desk')
    ? nav.after(panel)
    : nav.closest('.study-desk-nav').after(panel);
  const form = panel.querySelector('form');
  const topic = form.elements.topic;
  const status = panel.querySelector('[data-feedback]');
  const output = panel.querySelector('textarea');

  function clean(text, max) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0,max);
  }
  function capture() {
    const selection = window.getSelection();
    const selected = selection?.anchorNode?.parentElement?.closest('main,.card,.wrap') ? clean(selection, 600) : '';
    const question = document.querySelector('#question')?.textContent;
    const caption = document.querySelector('#caption')?.textContent;
    const custom = document.querySelector('[data-study-card-active]');
    const card = custom || context;
    const position = clean(caption || card?.querySelector('.no,.tag,.ct')?.textContent || document.querySelector('h1')?.textContent, 120);
    const stem = clean(question || card?.querySelector('h3,.stem,.st,.ask,.q,.prompt')?.textContent, 600);
    return {position,title:clean(document.querySelector('h1')?.textContent || document.title,120), detail:selected || stem,source};
  }
  document.addEventListener('pointerdown', event => {
    const card = event.target.closest('.card, .qi, .q:has(.qh), article');
    if (card && !card.closest('#study-transfer')) context = card;
  }, true);
  let active = null;
  let resource = null;
  if (nav.classList.contains('topline')) {
    const field = document.createElement('label');
    field.textContent = '资料';
    resource = document.createElement('select');
    resource.setAttribute('aria-label','资料');
    resource.append(new Option('帮学总入口',''));
    for (const link of document.querySelectorAll('.resources a')) {
      const authored = link.getAttribute('href');
      const target = authored.startsWith('https:') ? link.href : new URL(authored,source).href;
      if (new URL(target).hostname === 'sarkazcollegewisadel.github.io') {
        resource.append(new Option(link.querySelector('strong').textContent,target));
      }
    }
    field.append(resource);
    form.prepend(field);
    resource.onchange = () => {
      active = resource.value
        ? {source:resource.value,title:resource.selectedOptions[0].textContent,position:resource.selectedOptions[0].textContent,detail:''}
        : capture();
      topic.value = active.position;
      panel.querySelector('[data-current]').textContent = '当前资料 · ' + active.title;
    };
  }
  toggle.addEventListener('click', () => {
    if (panel.hidden) {
      active = capture();
      if (resource) resource.value = '';
      topic.value = active.position;
      panel.querySelector('[data-current]').textContent = '当前资料 · ' + active.title;
      status.textContent = '本浏览器可备份 ' + stored().length + ' 条记录';
      output.hidden = true;
    }
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const locator = clean(topic.value,120);
    if (!locator) return;
    if (stored().length >= 120) {
      status.textContent = '已存 120 条，请先下载并导入，再从下载按钮旁清理旧记录。';
      if (!panel.querySelector('[data-clear]')) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.dataset.clear = '';
        clear.textContent = '清理已备份记录';
        clear.onclick = () => {
          if (!confirm('确认已经备份或导入本浏览器中的记录？')) return;
          memory = [];
          try {
            const keys = Array.from({length:localStorage.length},(_,i) => localStorage.key(i));
            for (const key of keys) if (key?.startsWith(KEY)) localStorage.removeItem(key);
          } catch {}
          clear.remove();
          status.textContent = '已清理本浏览器记录';
        };
        panel.querySelector('.transfer-actions').append(clear);
      }
      return;
    }
    const record = {id:uuid(),at:new Date().toISOString(),source:active.source,title:active.title,locator,action:form.elements.action.value};
    try {
      localStorage.setItem(KEY + record.id, JSON.stringify(record));
      status.textContent = '已记下 · ' + stored().length + ' 条可备份';
    } catch {
      memory.push(record);
      status.textContent = '已暂存，请在离开页面前下载记录';
    }
  });
  function code(records) { return 'STUDY-DESK/1\n' + JSON.stringify({events:records}, null, 2); }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      output.hidden = true;
      status.textContent = '已复制';
    } catch {
      output.value = text;
      output.hidden = false;
      output.focus();
      output.select();
      status.textContent = '请在下方长按或使用复制快捷键';
    }
  }
  panel.querySelector('[data-ask]').onclick = () => {
    const pieces = [
      '请按课程复习方式帮我理解下面的问题。先给我一个提示，再说明判断依据和容易混淆的点；区分课件口径与补充解释。',
      '资料：' + active.title, '位置：' + topic.value, '链接：' + active.source,
      active.detail ? '题干或选中文字：' + active.detail : '', '我想弄懂：'
    ];
    copy(pieces.filter(Boolean).join('\n'));
  };
  panel.querySelector('[data-code]').onclick = () => {
    const records = stored();
    if (records.length) copy(code(records));
    else status.textContent = '先记下一条学习记录';
  };
  panel.querySelector('[data-file]').onclick = () => {
    const records = stored();
    if (!records.length) { status.textContent = '先记下一条学习记录'; return; }
    const url = URL.createObjectURL(new Blob([code(records)], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = '网页学习记录-' + new Date().toISOString().slice(0,10) + '.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
})();
