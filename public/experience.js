const $ = (selector, root = document) => root.querySelector(selector);
const node = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
const productImage = product => {
  const image = node('img', 'experience-product-image');
  image.src = `/assets/product-${((product.id - 1) % 12) + 1}.svg`;
  image.alt = product.name;
  image.width = 480;
  image.height = 480;
  return image;
};
const formatMoney = amount => window.Savdo.money(amount);
async function productById(id) {
  const response = await fetch(`/api/products/${id}`);
  if (!response.ok) throw new Error('This find is unavailable right now.');
  return response.json();
}
function makeDialog(className) {
  const dialog = node('dialog', className);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

const quickDialog = makeDialog('experience-dialog quick-dialog');
async function openQuickView(id) {
  quickDialog.replaceChildren(node('p', 'experience-loading', 'Loading this find…'));
  quickDialog.showModal();
  try {
    const product = await productById(id);
    if (!quickDialog.open) return;
    const shell = node('div', 'quick-shell');
    const image = node('div', 'quick-image');
    image.append(productImage(product));
    const content = node('div', 'quick-content');
    const close = node('button', 'dialog-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close quick look');
    close.addEventListener('click', () => quickDialog.close());
    const title = node('h2', '', product.name);
    title.id = 'quick-title';
    quickDialog.setAttribute('aria-labelledby', title.id);
    const price = node('strong', 'quick-price', formatMoney(product.price));
    const description = node('p', 'quick-description', product.description);
    const seller = node('p', 'quick-seller', `By ${product.seller} · ${product.city}`);
    const stock = node('p', 'quick-stock', product.stock > 0 ? `${product.stock} available` : 'Sold out');
    const actions = node('div', 'quick-actions');
    const add = node('button', 'btn', 'Add to bag +');
    add.type = 'button';
    add.disabled = product.stock <= 0;
    add.addEventListener('click', () => {
      window.Savdo.addToCart(product);
      quickDialog.close();
      openBag();
    });
    const details = node('a', 'btn secondary', 'View full details ↗');
    details.href = `/product.html?id=${product.id}`;
    actions.append(add, details);
    content.append(close, node('span', 'experience-kicker', product.category), title, seller, price, description, stock, actions);
    shell.append(image, content);
    quickDialog.replaceChildren(shell);
    close.focus();
  } catch (error) {
    quickDialog.replaceChildren(node('p', 'experience-error', error.message));
  }
}

const bagDialog = makeDialog('experience-dialog bag-dialog');
let bagGeneration = 0;
async function renderBag() {
  const run = ++bagGeneration;
  const cart = window.Savdo.getCart();
  const shell = node('div', 'bag-shell');
  const top = node('div', 'bag-top');
  const heading = node('div');
  heading.append(node('span', 'experience-kicker', 'THE GOOD THINGS YOU FOUND'), node('h2', '', 'Your bag'));
  const close = node('button', 'dialog-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close bag');
  close.addEventListener('click', () => bagDialog.close());
  top.append(heading, close);
  shell.append(top);
  if (!cart.length) {
    const empty = node('div', 'bag-empty');
    empty.append(node('span', 'bag-empty-symbol', '✳'), node('h3', '', 'Your bag has room for something good.'), node('p', '', 'Explore independent makers and collect your favorites.'));
    const browse = node('a', 'btn', 'Explore the collection ↗');
    browse.href = '/#collection';
    empty.append(browse);
    shell.append(empty);
    bagDialog.replaceChildren(shell);
    return;
  }
  const list = node('div', 'bag-items');
  list.append(node('p', 'experience-loading', 'Checking availability…'));
  shell.append(list);
  bagDialog.replaceChildren(shell);
  const products = await Promise.all(cart.map(async item => {
    try { return { ...await productById(item.id), quantity: item.quantity }; }
    catch { return { id: item.id, quantity: item.quantity, unavailable: true }; }
  }));
  if (run !== bagGeneration || !bagDialog.open) return;
  list.replaceChildren();
  let total = 0;
  let invalid = false;
  for (const product of products) {
    const row = node('article', 'bag-item');
    if (!product.unavailable) {
      const image = node('a', 'bag-item-image');
      image.href = `/product.html?id=${product.id}`;
      image.append(productImage(product));
      row.append(image);
    } else row.append(node('span', 'bag-item-image', '×'));
    const info = node('div', 'bag-item-info');
    const name = node('a', 'bag-item-name', product.name || `Unavailable item #${product.id}`);
    name.href = `/product.html?id=${product.id}`;
    info.append(name, node('small', '', product.seller || 'Remove this item to check out'));
    const controls = node('div', 'bag-item-controls');
    const decrement = node('button', '', '−');
    const increment = node('button', '', '+');
    for (const button of [decrement, increment]) button.type = 'button';
    decrement.setAttribute('aria-label', `Decrease quantity of ${product.name || product.id}`);
    increment.setAttribute('aria-label', `Increase quantity of ${product.name || product.id}`);
    increment.disabled = product.unavailable || product.quantity >= Math.min(product.stock, 99);
    decrement.addEventListener('click', () => window.Savdo.changeQuantity(product.id, product.quantity - 1));
    increment.addEventListener('click', () => window.Savdo.changeQuantity(product.id, product.quantity + 1));
    controls.append(decrement, node('span', '', String(product.quantity)), increment);
    const remove = node('button', 'bag-remove', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => window.Savdo.changeQuantity(product.id, 0));
    info.append(controls, remove);
    row.append(info, node('strong', 'bag-item-price', product.unavailable ? '—' : formatMoney(Number(product.price) * product.quantity)));
    if (product.unavailable || product.quantity > product.stock) invalid = true;
    if (!product.unavailable) total += Number(product.price) * product.quantity;
    list.append(row);
  }
  const foot = node('div', 'bag-foot');
  const totalLine = node('div', 'bag-total');
  totalLine.append(node('span', '', 'Subtotal'), node('strong', '', formatMoney(total)));
  foot.append(totalLine, node('p', '', 'Cash on delivery · One bag, multiple sellers'));
  const checkout = node('a', 'btn bag-checkout', 'Continue to checkout ↗');
  checkout.href = '/cart.html';
  if (invalid) {
    checkout.classList.add('disabled');
    checkout.setAttribute('aria-disabled', 'true');
    checkout.addEventListener('click', event => event.preventDefault());
    foot.append(node('p', 'experience-error', 'Review unavailable items before checkout.'));
  }
  foot.append(checkout);
  shell.append(foot);
}
function openBag() {
  if (!bagDialog.open) bagDialog.showModal();
  renderBag().catch(() => bagDialog.replaceChildren(node('p', 'experience-error', 'Could not load your bag. Please try again.')));
}
window.addEventListener('savdo:cartchange', () => { if (bagDialog.open) renderBag(); });
document.querySelector('.bag-link')?.addEventListener('click', event => {
  if (document.body.dataset.page === 'cart') return;
  event.preventDefault();
  openBag();
});

const searchDialog = makeDialog('experience-dialog search-dialog');
let searchGeneration = 0;
function openSearch() {
  const shell = node('div', 'search-shell');
  const top = node('div', 'search-top');
  const input = node('input', 'search-input');
  input.type = 'search';
  input.placeholder = 'Search the collection…';
  input.setAttribute('aria-label', 'Search the collection');
  input.maxLength = 100;
  const close = node('button', 'dialog-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close search');
  close.addEventListener('click', () => searchDialog.close());
  top.append(node('span', '', '⌕'), input, close);
  const results = node('div', 'search-results');
  shell.append(top, results);
  searchDialog.replaceChildren(shell);
  if (!searchDialog.open) searchDialog.showModal();
  input.focus();
  let timer;
  async function search() {
    const run = ++searchGeneration;
    const query = input.value.trim();
    results.replaceChildren(node('p', 'search-help', query ? 'Searching…' : 'Try “ceramic”, “bag”, or “home”.'));
    if (!query) return;
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      if (run !== searchGeneration || !searchDialog.open) return;
      results.replaceChildren();
      if (!data.products.length) results.append(node('p', 'search-help', 'No matches yet. Try another word.'));
      for (const product of data.products.slice(0, 5)) {
        const result = node('a', 'search-result');
        result.href = `/product.html?id=${product.id}`;
        result.append(productImage(product));
        const text = node('span');
        text.append(node('strong', '', product.name), node('small', '', `${product.seller} · ${formatMoney(product.price)}`));
        result.append(text, node('span', '', '↗'));
        results.append(result);
      }
      const all = node('a', 'search-all', `View all ${data.total} results →`);
      all.href = `/?search=${encodeURIComponent(query)}#collection`;
      results.append(all);
    } catch {
      if (run === searchGeneration) results.replaceChildren(node('p', 'experience-error', 'Search is temporarily unavailable.'));
    }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 220); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      location.href = `/?search=${encodeURIComponent(input.value.trim())}#collection`;
    }
  });
  search();
}
const searchButton = node('button', 'header-search', '⌕');
searchButton.type = 'button';
searchButton.setAttribute('aria-label', 'Search products');
searchButton.title = 'Search products (Ctrl+K)';
searchButton.addEventListener('click', openSearch);
document.querySelector('.bag-link')?.before(searchButton);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch();
  }
});

async function decorateCatalog() {
  const hero = $('.hero');
  if (!hero || $('.collection-stories')) return;
  const main = $('#app');
  const stories = node('section', 'collection-stories');
  const intro = node('div', 'stories-heading');
  intro.append(node('span', 'experience-kicker', 'SHOP BY MOOD'), node('h2', '', 'Good things for every day.'));
  stories.append(intro);
  const tiles = node('div', 'story-tiles');
  for (const [label, caption, imageId, search] of [
    ['The slow morning', 'Thoughtful pieces for rituals at home', 9, 'ceramic'],
    ['The everyday carry', 'Made to go wherever you do', 5, 'bag'],
    ['The creative corner', 'A little inspiration for your desk', 12, 'notebook']
  ]) {
    const tile = node('a', 'story-tile');
    tile.href = `/?search=${encodeURIComponent(search)}#collection`;
    const visual = node('div', 'story-visual');
    visual.append(productImage({ id: imageId, name: '' }));
    const copy = node('div', 'story-copy');
    copy.append(node('span', '', caption), node('h3', '', label), node('span', 'story-arrow', 'Explore edit ↗'));
    tile.append(visual, copy);
    tiles.append(tile);
  }
  stories.append(tiles);
  $('.benefits')?.after(stories);
  const note = node('section', 'trust-strip');
  note.append(node('span', 'experience-kicker', 'WHY SAVDO'), node('h2', '', 'Discover well. Shop simply.'));
  for (const [icon, title, body] of [
    ['01', 'Independent sellers', 'Browse a growing collection of local shops in one place.'],
    ['02', 'One simple bag', 'Collect finds from multiple makers before checkout.'],
    ['03', 'Pay on delivery', 'No card details needed to place a demo order.']
  ]) {
    const item = node('div', 'trust-item');
    item.append(node('span', '', icon), node('h3', '', title), node('p', '', body));
    note.append(item);
  }
  $('.maker-banner')?.before(note);
  main.classList.add('experience-catalog');
}
window.addEventListener('savdo:catalogready', decorateCatalog);
if (document.readyState === 'complete') decorateCatalog();
else window.addEventListener('DOMContentLoaded', decorateCatalog);

window.SavdoExperience = { openQuickView, openBag, openSearch };
