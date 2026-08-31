const menu = window.SILVANA_MENU;
const config = window.SILVANA_CONFIG;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const state = {
  category: 'Todos',
  search: '',
  cart: JSON.parse(localStorage.getItem('silvana-cart') || '{}')
};

const $ = (selector) => document.querySelector(selector);
const productsGrid = $('#productsGrid');
const categoryTabs = $('#categoryTabs');
const cartDrawer = $('#cartDrawer');
const overlay = $('#overlay');
const checkoutDialog = $('#checkoutDialog');

function categories() {
  return ['Todos', ...new Set(menu.map(item => item.category))];
}

function renderTabs() {
  categoryTabs.innerHTML = categories().map(category => `
    <button type="button" class="category-tab ${state.category === category ? 'active' : ''}" data-category="${category}">${category}</button>
  `).join('');
}

function filteredMenu() {
  const term = state.search.trim().toLocaleLowerCase('pt-BR');
  return menu.filter(item => {
    const inCategory = state.category === 'Todos' || item.category === state.category;
    const inSearch = !term || `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(term);
    return inCategory && inSearch;
  });
}

function renderProducts() {
  const products = filteredMenu();
  productsGrid.innerHTML = products.length ? products.map(item => `
    <article class="product-card">
      <div class="product-visual" aria-hidden="true"><span>${item.icon}</span></div>
      <div class="product-content">
        <div class="product-category">${item.category}</div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="product-bottom">
          <strong>${item.fromPrice ? 'A partir de ' : ''}${money.format(item.price)}</strong>
          <button type="button" class="add-btn" data-add="${item.id}" aria-label="Adicionar ${item.name}">+</button>
        </div>
      </div>
    </article>
  `).join('') : '<div class="empty-search">Nenhum item encontrado. Tente outro nome. 🔎</div>';
}

function saveCart() {
  localStorage.setItem('silvana-cart', JSON.stringify(state.cart));
}

function addItem(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  updateCartUI();
}

function changeQty(id, delta) {
  const next = (state.cart[id] || 0) + delta;
  if (next <= 0) delete state.cart[id];
  else state.cart[id] = next;
  saveCart();
  updateCartUI();
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ item: menu.find(item => item.id === id), qty }))
    .filter(entry => entry.item && entry.qty > 0);
}

function cartTotals() {
  const entries = cartEntries();
  return {
    count: entries.reduce((sum, entry) => sum + entry.qty, 0),
    total: entries.reduce((sum, entry) => sum + entry.item.price * entry.qty, 0)
  };
}

function updateCartUI() {
  const { count, total } = cartTotals();
  $('#cartCountTop').textContent = count;
  $('#cartCountBottom').textContent = count;
  $('#cartTotalBottom').textContent = money.format(total);
  $('#drawerTotal').textContent = money.format(total);
  $('#checkoutTotal').textContent = money.format(total);

  const items = cartEntries();
  $('#cartItems').innerHTML = items.length ? items.map(({ item, qty }) => `
    <article class="cart-item">
      <div class="cart-item-icon">${item.icon}</div>
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <small>${money.format(item.price)} cada</small>
        <div class="qty-control">
          <button type="button" data-qty="${item.id}" data-delta="-1">−</button>
          <span>${qty}</span>
          <button type="button" data-qty="${item.id}" data-delta="1">+</button>
        </div>
      </div>
      <strong class="cart-line-total">${money.format(item.price * qty)}</strong>
    </article>
  `).join('') : `
    <div class="empty-cart">
      <div>🛒</div>
      <h3>Seu carrinho está vazio</h3>
      <p>Adicione seus lanches favoritos para continuar.</p>
    </div>
  `;

  $('.floating-cart').classList.toggle('visible', count > 0);
  $('#startCheckout').disabled = count === 0;
}

function openCart() {
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('visible'));
  document.body.classList.add('no-scroll');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('visible');
  setTimeout(() => { overlay.hidden = true; }, 180);
  document.body.classList.remove('no-scroll');
}

function syncFulfillment() {
  const delivery = document.querySelector('input[name="fulfillment"]:checked').value === 'Entrega';
  $('#addressFields').hidden = !delivery;
  $('#deliveryAddress').required = delivery;
  $('#deliveryComplement').required = delivery;
}

function syncPayment() {
  const cash = $('#paymentMethod').value === 'Dinheiro';
  $('#changeField').hidden = !cash;
}

function buildWhatsAppMessage() {
  const entries = cartEntries();
  const { total } = cartTotals();
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked').value;
  const lines = [
    `${config.checkoutMode === 'test' ? '🧪 *TESTE — NÃO É PEDIDO REAL*\n\n' : ''}🍔 *NOVO PEDIDO - ${config.businessName.toUpperCase()}*`,
    '',
    `👤 *Cliente:* ${$('#customerName').value.trim()}`,
    `📦 *Tipo:* ${fulfillment}`
  ];

  if (fulfillment === 'Entrega') {
    lines.push(`📍 *Endereço:* ${$('#deliveryAddress').value.trim()}`);
    lines.push(`🏠 *Complemento/Referência:* ${$('#deliveryComplement').value.trim()}`);
  }

  lines.push('', '🛒 *ITENS DO PEDIDO*');
  entries.forEach(({ item, qty }) => {
    lines.push(`• ${qty}x ${item.name} — ${money.format(item.price * qty)}`);
  });

  lines.push('', `💰 *Total dos itens:* ${money.format(total)}`);
  lines.push(`💳 *Pagamento:* ${$('#paymentMethod').value}`);

  if ($('#paymentMethod').value === 'Dinheiro' && $('#changeFor').value.trim()) {
    lines.push(`💵 *Troco para:* R$ ${$('#changeFor').value.trim()}`);
  }

  const notes = $('#orderNotes').value.trim();
  if (notes) lines.push('', `📝 *Observações:* ${notes}`);

  lines.push('', '✅ Aguardo a confirmação do pedido.');
  return lines.join('\n');
}

categoryTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderTabs();
  renderProducts();
});

$('#searchInput').addEventListener('input', event => {
  state.search = event.target.value;
  renderProducts();
});

document.addEventListener('click', event => {
  const add = event.target.closest('[data-add]');
  if (add) addItem(add.dataset.add);

  const qty = event.target.closest('[data-qty]');
  if (qty) changeQty(qty.dataset.qty, Number(qty.dataset.delta));
});

$('#openCartTop').addEventListener('click', openCart);
$('#openCartBottom').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

$('#startCheckout').addEventListener('click', () => {
  closeCart();
  syncFulfillment();
  syncPayment();
  checkoutDialog.showModal();
});

$('#closeCheckout').addEventListener('click', () => checkoutDialog.close());
document.querySelectorAll('input[name="fulfillment"]').forEach(input => input.addEventListener('change', syncFulfillment));
$('#paymentMethod').addEventListener('change', syncPayment);

$('#checkoutForm').addEventListener('submit', event => {
  event.preventDefault();
  syncFulfillment();
  if (!event.currentTarget.reportValidity()) return;

  const message = buildWhatsAppMessage();
  if (config.checkoutMode === 'disabled') {
    alert('WhatsApp ainda não configurado nesta versão pública.');
    return;
  }
  const checkoutNumber = config.checkoutMode === 'production' ? config.whatsappProduction : config.whatsappTest;
  if (!checkoutNumber) {
    alert('Número de WhatsApp ainda não foi configurado.');
    return;
  }
  const url = `https://wa.me/${checkoutNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});

renderTabs();
renderProducts();
updateCartUI();
