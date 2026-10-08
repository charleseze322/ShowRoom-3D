const finishData = { walnut: { name: 'Dark Smoked Walnut', color: '#6b3a1e', modifier: 0 }, marble: { name: 'White Carrara Marble', color: '#d8d5cc', modifier: 25000 }, charcoal: { name: 'Charred Oak', color: '#252321', modifier: 12000 } };
const money = value => `₦${value.toLocaleString('en-NG')}`;
const orderLink = (phone, message) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

function setupProduct() {
  const page = document.querySelector('[data-product-page]');
  if (!page) return;
  let selected = finishData.walnut;
  let rotation = -27;
  let scale = 1;
  const table = document.querySelector('.scene-table');
  const price = document.querySelector('[data-price]');
  const finishName = document.querySelector('[data-finish-name]');
  const toast = document.querySelector('[data-toast]');
  const render = () => {
    table.querySelector('.table-top').style.background = `linear-gradient(135deg, ${selected.color}, #2e1e14 75%)`;
    table.style.transform = `translate(-50%,-50%) scale(${scale}) rotateX(57deg) rotateZ(${rotation}deg)`;
    price.textContent = money(150000 + selected.modifier);
    finishName.textContent = selected.name;
    document.querySelectorAll('.finish-option').forEach(button => button.classList.toggle('active', button.dataset.finish === selected.name));
  };
  document.querySelectorAll('.finish-option').forEach(button => button.addEventListener('click', () => { selected = Object.values(finishData).find(item => item.name === button.dataset.finish); render(); }));
  document.querySelector('[data-rotate-left]').addEventListener('click', () => { rotation -= 12; render(); });
  document.querySelector('[data-rotate-right]').addEventListener('click', () => { rotation += 12; render(); });
  document.querySelector('[data-zoom-in]').addEventListener('click', () => { scale = Math.min(1.24, scale + .08); render(); });
  document.querySelector('[data-zoom-out]').addEventListener('click', () => { scale = Math.max(.78, scale - .08); render(); });
  document.querySelector('[data-order]').addEventListener('click', () => { const link = orderLink('2348000000000', `Hello Vertex Crafts, I am interested in ${page.dataset.product} (${page.dataset.sku}) in ${selected.name}. Quoted price: ${money(150000 + selected.modifier)}. ${window.location.href}`); window.open(link, '_blank'); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); });
  let dragging = false; let lastX = 0;
  table.addEventListener('pointerdown', event => { dragging = true; lastX = event.clientX; table.setPointerCapture(event.pointerId); });
  table.addEventListener('pointermove', event => { if (!dragging) return; rotation += (event.clientX - lastX) * .45; lastX = event.clientX; render(); });
  table.addEventListener('pointerup', () => { dragging = false; });
  render();
}
setupProduct();