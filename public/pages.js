const app = document.querySelector('#app');
const page = document.body.dataset.page;
const { api, card, money, getFavorites } = window.Savdo;
const el = (tag, className = '', text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const link = (text, href, className = '') => {
  const element = el('a', className, text);
  element.href = href;
  return element;
};
const image = product => {
  const element = el('img');
  element.src = `/assets/product-${((product.id - 1) % 12) + 1}.svg`;
  element.alt = '';
  element.width = 480;
  element.height = 480;
  element.loading = 'lazy';
  return element;
};
function heading(kicker, title, description) {
  const top = el('section', 'directory-heading');
  top.append(el('span', 'experience-kicker', kicker), el('h1', '', title), el('p', '', description));
  return top;
}
function empty(title, description, action, href) {
  const panel = el('div', 'directory-empty');
  panel.append(el('span', 'directory-empty-mark', '✳'), el('h2', '', title), el('p', '', description), link(action, href, 'btn'));
  return panel;
}
function failure(error) {
  app.replaceChildren(empty('This page could not load', error.message || 'Please try again shortly.', 'Try again', location.href));
}
async function categories() {
  const items = await api('/categories');
  const collections = await Promise.all(items.map(item => api(`/products?category=${item.id}`)));
  app.replaceChildren(heading('THE WHOLE COLLECTION', 'Explore by category', 'Find the things you need and the things you did not know you wanted.'));
  const grid = el('div', 'directory-grid categories-grid');
  for (const [index, category] of items.entries()) {
    const matches = collections[index].products;
    const tile = link('', `/?category=${category.id}#collection`, 'directory-tile category-tile');
    const art = el('div', 'directory-art');
    for (const product of matches.slice(0, 2)) art.append(image(product));
    if (!matches.length) art.append(el('span', '', category.icon || '✳'));
    const copy = el('div', 'directory-copy');
    copy.append(el('small', '', `${collections[index].total} finds in the collection`), el('h2', '', category.name), el('span', '', 'Explore category ↗'));
    tile.append(art, copy);
    grid.append(tile);
  }
  app.append(grid);
}
async function shops() {
  const sellers = await api('/sellers');
  const collections = await Promise.all(sellers.map(seller => api(`/products?seller=${seller.id}`)));
  app.replaceChildren(heading('THE PEOPLE BEHIND THE FINDS', 'Meet the shops', 'Explore independent sellers from across Uzbekistan.'));
  const grid = el('div', 'directory-grid shops-grid');
  for (const [index, seller] of sellers.entries()) {
    const matches = collections[index].products;
    const tile = link('', `/shop.html?id=${seller.id}`, 'directory-tile shop-tile');
    const art = el('div', 'directory-art');
    for (const product of matches.slice(0, 3)) art.append(image(product));
    const copy = el('div', 'directory-copy');
    copy.append(el('small', '', `${seller.city} · ${collections[index].total} finds`), el('h2', '', seller.name), el('span', '', 'Visit shop ↗'));
    tile.append(art, copy);
    grid.append(tile);
  }
  app.append(grid);
}
async function shop() {
  const id = Number(new URLSearchParams(location.search).get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a shop from the directory.');
  const sellers = await api('/sellers');
  const seller = sellers.find(item => item.id === id);
  if (!seller) throw new Error('This shop is not available.');
  const data = await api(`/products?seller=${id}`);
  app.replaceChildren(link('← All shops', '/shops.html', 'breadcrumb'), heading(`INDEPENDENT SELLER · ${seller.city.toUpperCase()}`, seller.name, `Discover ${data.total} considered finds from ${seller.city}.`));
  if (!data.products.length) return app.append(empty('New finds are coming', 'This seller has no published products right now.', 'Browse other shops', '/shops.html'));
  const grid = el('div', 'product-grid');
  grid.append(...data.products.map(card));
  app.append(grid);
}
async function saved() {
  app.replaceChildren(heading('YOUR PERSONAL EDIT', 'Saved finds', 'Keep your favorite pieces close while you decide. Saved on this browser.'));
  const area = el('div', 'saved-area');
  app.append(area);
  let products = [];
  async function render() {
    const ids = getFavorites().filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 50);
    if (!ids.length) return area.replaceChildren(empty('Your collection starts here', 'Tap the heart on a find to save it for later.', 'Explore the collection', '/#collection'));
    area.replaceChildren(el('p', 'loading', 'Gathering your saved finds…'));
    products = (await Promise.all(ids.map(id => api(`/products/${id}`).catch(() => null)))).filter(Boolean);
    const grid = el('div', 'product-grid');
    grid.append(...products.map(card));
    area.replaceChildren(el('p', 'catalog-status', `${products.length} saved find${products.length === 1 ? '' : 's'}`), grid);
  }
  window.addEventListener('savdo:favoriteschange', render);
  await render();
}
function orders() {
  app.replaceChildren(heading('YOUR PURCHASES', 'Your orders', 'Receipts from checkouts completed in this browser.'));
  const note = el('p', 'orders-note', 'Savdo does not have customer sign-in yet. These receipts stay on this browser, so they will not appear on another device. Orders are recorded in the project database; this page only keeps a local copy of each receipt.');
  app.append(note);
  let receipts = [];
  try {
    const value = JSON.parse(localStorage.getItem('savdo-receipts-v1') || '[]');
    if (Array.isArray(value)) receipts = value.filter(item => Number.isSafeInteger(item.id) && Array.isArray(item.items));
  } catch {}
  if (!receipts.length) return app.append(empty('No receipts on this browser yet', 'When you complete checkout, your receipt will appear here.', 'Find something good', '/#collection'));
  const list = el('div', 'orders-list');
  for (const receipt of receipts) {
    const section = el('section', 'order-card');
    const top = el('div', 'order-card-top');
    const left = el('div');
    left.append(el('span', 'experience-kicker', 'ORDER RECEIPT'), el('h2', '', `Order #${receipt.id}`));
    const date = new Date(receipt.placedAt);
    top.append(left, el('span', 'order-date', Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })));
    section.append(top);
    for (const item of receipt.items) {
      const row = el('div', 'order-line');
      const visual = el('div', 'order-line-art');
      visual.append(image(item));
      const details = el('div');
      details.append(link(item.name, `/product.html?id=${item.id}`), el('small', '', `${item.seller} · Qty ${item.quantity}`));
      row.append(visual, details, el('strong', '', money(Number(item.price) * item.quantity)));
      section.append(row);
    }
    const total = el('div', 'order-total');
    total.append(el('span', '', 'Order total · cash on delivery'), el('strong', '', money(receipt.total)));
    section.append(total);
    list.append(section);
  }
  app.append(list);
}

const routes = { categories, shops, shop, saved, orders };
if (routes[page]) {
  document.querySelector(`[data-nav="${page === 'shop' ? 'shops' : page}"]`)?.classList.add('active');
  try { await routes[page](); } catch (error) { failure(error); }
}
