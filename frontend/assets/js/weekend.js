(function(){
  const ENDPOINT = 'http://127.0.0.1:8000/weekend-data/';
  const grid = document.getElementById('weekendCardsGrid');
  if (!grid) return;

  function createCard(item){
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-3 mb-4'; // 4 per row on lg

    const card = document.createElement('article');
    card.className = 'card h-100 shadow-lg border-0 hover-card';

    const img = document.createElement('img');
    img.src = item.image_path;
    img.alt = item.title;
    img.className = 'card-img-top news-image rounded-top';

    const body = document.createElement('div');
    body.className = 'card-body d-flex flex-column';

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'mb-2';
    const badge = document.createElement('span');
    badge.className = 'badge bg-gradient mb-2 px-3 py-2 rounded-pill text-white';
    badge.style.fontSize = '0.9rem';
    badge.textContent = item.day || 'Выходные';
    badgeWrap.appendChild(badge);

    const title = document.createElement('h5');
    title.className = 'card-title fw-bold mb-2 news-title';
    title.textContent = item.title;

    const excerpt = document.createElement('div');
    excerpt.className = 'card-text text-muted flex-grow-1 mb-2 news-excerpt';
    const plain = (item.description || '').replace(/<[^>]*>/g, '');
    excerpt.textContent = plain.split(' ').slice(0, 20).join(' ') + '...';

    const meta = document.createElement('div');
    meta.className = 'mt-auto';
    const metaRow = document.createElement('div');
    metaRow.className = 'd-flex justify-content-between align-items-center mb-3 news-meta';
    const dateEl = document.createElement('small');
    dateEl.className = 'text-muted';
    dateEl.innerHTML = '<i class="bi bi-calendar3 fs-6 me-1"></i>' + (item.date_str || '');
    const venueEl = document.createElement('small');
    venueEl.className = 'text-muted';
    venueEl.innerHTML = '<i class="bi bi-person fs-6 me-1"></i>' + (item.venue || 'Иркутск');
    metaRow.appendChild(dateEl);
    metaRow.appendChild(venueEl);

    const link = document.createElement('a');
    link.href = 'weekend-details.html?id=' + item.id;
    link.className = 'btn btn-primary w-100 rounded-pill fw-bold';
    link.innerHTML = 'Подробнее <i class="bi bi-arrow-right ms-1"></i>';

    meta.appendChild(metaRow);
    meta.appendChild(link);

    body.appendChild(badgeWrap);
    body.appendChild(title);
    body.appendChild(excerpt);
    body.appendChild(meta);

    card.appendChild(img);
    card.appendChild(body);
    col.appendChild(card);
    return col;
  }

  function render(list){
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(item => frag.appendChild(createCard(item)));
    grid.appendChild(frag);
  }

  function showError(){
    grid.innerHTML = '<div class="col-12 text-center py-5"><h3 class="text-muted">Ошибка загрузки данных</h3><p class="text-muted">Проверьте, что API доступен по '+ENDPOINT+'</p></div>';
  }

  fetch(ENDPOINT, { credentials: 'omit' })
    .then(r => { if(!r.ok) throw new Error('Bad status'); return r.json(); })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('Bad data');
      render(data);
    })
    .catch(showError);
})();



