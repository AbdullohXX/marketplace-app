export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function integer(value, name, min = 1, max = 2147483647) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new HttpError(400, `${name} must be an integer`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new HttpError(400, `${name} must be between ${min} and ${max}`);
  return n;
}
export function text(value, name, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${name} must contain ${min}–${max} characters`);
  return value.trim();
}
export function checkoutInput(body) {
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new HttpError(400, 'Cart must contain 1–50 items');
  const items = new Map();
  for (const item of body.items) {
    const id = integer(item?.product_id, 'product_id');
    const qty = integer(item?.quantity, 'quantity', 1, 99);
    items.set(id, integer((items.get(id) || 0) + qty, 'Combined quantity', 1, 99));
  }
  const email = text(body.email, 'Email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  return { name: text(body.name, 'Name', 2, 100), email, city: text(body.city, 'City', 2, 80), address: text(body.address, 'Address', 5, 300), items: [...items].sort((a,b) => a[0]-b[0]) };
}
export function productInput(body) {
  return {
    name: text(body?.name, 'Product name', 2, 120),
    description: text(body?.description, 'Description', 5, 2000),
    price: integer(body?.price, 'Price in whole UZS', 1, 100000000),
    stock: integer(body?.stock, 'Stock', 0, 1000000),
    category_id: integer(body?.category_id, 'category_id'),
    seller_id: integer(body?.seller_id, 'seller_id'),
    approved: body?.approved === true,
    icon: '📦'
  };
}
