document.addEventListener('submit', (e) => {
  const message = e.target.dataset.confirm;
  if (message && !confirm(message)) e.preventDefault();
});

document.querySelectorAll('[data-edit-cat]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const c = JSON.parse(btn.dataset.editCat);
    const form = document.getElementById('cat-form');
    form.id.value = c.id;
    form.title.value = c.title;
    form.slug.value = c.slug;
    form.description.value = c.description || '';
    form.sort.value = c.sort;
    document.getElementById('cat-form-title').textContent = 'Редагування: ' + c.title;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

const reset = document.querySelector('[data-cat-reset]');
if (reset) reset.addEventListener('click', () => {
  const form = document.getElementById('cat-form');
  form.id.value = '';
  document.getElementById('cat-form-title').textContent = 'Нова категорія';
});

document.querySelectorAll('input[type=file][accept^="image"]:not(#img-input)').forEach((input) => {
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    const box = input.closest('.panel, label')?.querySelector('.img-preview');
    if (!file || !box) return;
    const url = URL.createObjectURL(file);
    box.innerHTML = `<img src="${url}" alt="">`;
  });
});

(function imageManager() {
  const box = document.getElementById('img-manager');
  if (!box) return;
  const input = document.getElementById('img-input');
  const status = document.getElementById('img-status');
  const addUrl = document.querySelector('[data-add-url]');
  const HINT = 'Перше фото — головне. Перетягуйте картки, щоб змінити порядок.';

  let images = [];
  try { images = JSON.parse(box.dataset.images || '[]'); } catch { images = []; }

  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function render() {
    box.innerHTML = images.length
      ? images.map((src, i) => `<figure class="img-card${i === 0 ? ' is-main' : ''}" draggable="true" data-index="${i}">
          <img src="${esc(src)}" alt="">
          <input type="hidden" name="images" value="${esc(src)}">
          ${i === 0 ? '<span class="img-main">Головне</span>' : ''}
          <div class="img-tools">
            <button type="button" data-move="-1" title="Перемістити ліворуч">←</button>
            <button type="button" data-main title="Зробити головним">★</button>
            <button type="button" data-move="1" title="Перемістити праворуч">→</button>
            <button type="button" data-del title="Видалити">✕</button>
          </div>
        </figure>`).join('')
      : '<p class="img-empty">Ще немає зображень. Завантажте одне або кілька фото.</p>';
    status.textContent = images.length ? `${HINT} Всього: ${images.length}.` : HINT;
  }

  function move(from, to) {
    if (to < 0 || to >= images.length || from === to) return;
    images.splice(to, 0, images.splice(from, 1)[0]);
    render();
  }

  box.addEventListener('click', (e) => {
    const card = e.target.closest('.img-card');
    if (!card) return;
    const i = Number(card.dataset.index);
    if (e.target.closest('[data-del]')) { images.splice(i, 1); render(); }
    else if (e.target.closest('[data-main]')) move(i, 0);
    else if (e.target.closest('[data-move]')) move(i, i + Number(e.target.closest('[data-move]').dataset.move));
  });

  let dragFrom = null;
  box.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.img-card');
    if (!card) return;
    dragFrom = Number(card.dataset.index);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  box.addEventListener('dragend', () => {
    dragFrom = null;
    box.querySelectorAll('.img-card').forEach((c) => c.classList.remove('dragging', 'drop-target'));
  });
  box.addEventListener('dragover', (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const card = e.target.closest('.img-card');
    box.querySelectorAll('.img-card').forEach((c) => c.classList.toggle('drop-target', c === card && Number(c.dataset.index) !== dragFrom));
  });
  box.addEventListener('drop', (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const card = e.target.closest('.img-card');
    if (card) move(dragFrom, Number(card.dataset.index));
    dragFrom = null;
  });

  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    status.textContent = `Завантаження (${files.length})…`;
    const data = new FormData();
    files.forEach((file) => data.append('files', file));
    try {
      const res = await fetch('/admin/upload', { method: 'POST', body: data });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Не вдалося завантажити');
      images.push(...result.urls.filter((url) => !images.includes(url)));
      input.value = '';
      render();
      if (result.skipped) status.textContent += ` Пропущено файлів непідтримуваного формату: ${result.skipped}.`;
    } catch (error) {
      status.textContent = 'Помилка завантаження: ' + error.message;
    }
  });

  if (addUrl) addUrl.addEventListener('click', () => {
    const url = prompt('Посилання на зображення або шлях (/uploads/file.jpg)');
    if (url && url.trim() && !images.includes(url.trim())) { images.push(url.trim()); render(); }
  });

  render();
})();
