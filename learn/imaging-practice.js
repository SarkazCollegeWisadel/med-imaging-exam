(() => {
  const cards = [...document.querySelectorAll('main .card')];
  const tools = document.querySelector('.top .tools');
  const film = document.getElementById('btnFilm');
  if (!cards.length || !tools || !film) return;
  const KEY = 'med-imaging:past-questions:v1';
  let answers = {};
  let wrongOnly = false;
  try { answers = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const wrong = document.createElement('button');
  wrong.type = 'button';
  wrong.textContent = '只看错题';
  wrong.setAttribute('aria-pressed','false');
  const score = document.createElement('span');
  score.setAttribute('role','status');
  score.className = 'practice-score';
  tools.append(wrong,score);
  const empty = document.createElement('p');
  empty.textContent = '当前筛选没有错题。';
  empty.hidden = true;
  document.querySelector('main').prepend(empty);

  function sync() {
    let tried = 0, missed = 0, shown = 0;
    const filmOnly = document.body.classList.contains('only-film');
    for (const card of cards) {
      const id = card.dataset.practiceId;
      const answer = answers[id];
      const failed = Boolean(answer && answer.pick !== card.dataset.answer);
      if (answer) tried++;
      if (failed) missed++;
      card.hidden = wrongOnly && !failed;
      if (!card.hidden && !(filmOnly && card.classList.contains('nofilm'))) shown++;
    }
    empty.hidden = shown > 0;
    score.textContent = '已答 ' + tried + ' / ' + cards.length + ' · 错题 ' + missed;
  }
  function activate(card) {
    for (const old of document.querySelectorAll('[data-study-card-active]')) delete old.dataset.studyCardActive;
    card.dataset.studyCardActive = '';
  }
  for (const card of cards) {
    const options = [...card.querySelectorAll('.opts li')];
    const id = card.querySelector('.no')?.textContent.trim();
    const correct = card.querySelector('.opts li.right b')?.textContent.trim();
    if (!id || !correct) continue;
    card.dataset.practiceId = id;
    card.dataset.answer = correct;
    const feedback = document.createElement('p');
    feedback.className = 'practice-feedback';
    feedback.setAttribute('role','status');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'practice-retry';
    retry.textContent = '重做此题';
    card.querySelector('.opts').after(feedback,retry);
    let reveal = Boolean(answers[id]);
    const choiceButtons = [];
    function render() {
      const pick = reveal ? answers[id]?.pick : null;
      card.classList.toggle('practice-revealed',Boolean(pick));
      for (const button of choiceButtons) {
        button.disabled = Boolean(pick);
        button.classList.toggle('practice-pick',button.dataset.choice === pick);
      }
      retry.hidden = !pick;
      feedback.hidden = !pick;
      feedback.textContent = pick ? (pick === correct ? '答对了' : '本次选 ' + pick + '，参考答案 ' + correct) : '';
    }
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'practice-choice';
      const label = option.querySelector('b').textContent.trim();
      button.dataset.choice = label;
      button.append(...option.childNodes);
      option.append(button);
      choiceButtons.push(button);
      button.onclick = () => {
        activate(card);
        answers[id] = {pick:label};
        reveal = true;
        try { localStorage.setItem(KEY,JSON.stringify(answers)); } catch {}
        render();
        sync();
        if (card.hidden) wrong.focus();
        else retry.focus({preventScroll:true});
      };
    }
    retry.onclick = () => {
      reveal = false;
      render();
      choiceButtons[0]?.focus({preventScroll:true});
    };
    card.addEventListener('focusin', () => activate(card));
    render();
  }
  film.addEventListener('click',sync);
  film.classList.toggle('on',document.body.classList.contains('only-film'));
  wrong.onclick = () => {
    wrongOnly = !wrongOnly;
    wrong.classList.toggle('on',wrongOnly);
    wrong.setAttribute('aria-pressed',String(wrongOnly));
    sync();
  };
  sync();
})();
