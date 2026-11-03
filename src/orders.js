import { checkoutInput, HttpError } from './domain.js';

export async function placeOrder(pool, body) {
  const input = checkoutInput(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Consistent lock ordering prevents deadlocks between overlapping carts.
    const { rows: products } = await client.query(
      'SELECT id, seller_id, price, stock FROM products WHERE id = ANY($1::int[]) AND active AND approved ORDER BY id FOR UPDATE',
      [input.items.map(([id]) => id)]);
    if (products.length !== input.items.length) throw new HttpError(409, 'A product is unavailable. Refresh your cart.');
    const quantities = new Map(input.items);
    const totals = new Map();
    let total = 0;
    for (const p of products) {
      const qty = quantities.get(p.id);
      if (p.stock < qty) throw new HttpError(409, `Not enough stock for product ${p.id}`);
      const subtotal = Number(p.price) * qty;
      total += subtotal;
      totals.set(p.seller_id, (totals.get(p.seller_id) || 0) + subtotal);
    }
    const { rows: [customer] } = await client.query(
      'INSERT INTO customers(name,email,city) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city RETURNING id',
      [input.name, input.email, input.city]);
    const { rows: [order] } = await client.query(
      'INSERT INTO orders(customer_id,address,total) VALUES($1,$2,$3) RETURNING id,total,status,created_at', [customer.id, input.address, total]);
    const splits = [];
    for (const [sellerId, subtotal] of totals) {
      const { rows: [split] } = await client.query(
        'INSERT INTO seller_orders(order_id,seller_id,total) VALUES($1,$2,$3) RETURNING id,seller_id,total,status', [order.id, sellerId, subtotal]);
      splits.push(split);
      await client.query('INSERT INTO payouts(seller_order_id,amount) VALUES($1,$2)', [split.id, subtotal]);
    }
    for (const p of products) {
      const split = splits.find(s => s.seller_id === p.seller_id);
      const qty = quantities.get(p.id);
      await client.query('INSERT INTO order_items(order_id,seller_order_id,seller_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4,$5,$6)',
        [order.id, split.id, p.seller_id, p.id, qty, p.price]);
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [qty, p.id]);
    }
    await client.query('INSERT INTO payments(order_id,amount) VALUES($1,$2)', [order.id, total]);
    await client.query('COMMIT');
    return { ...order, seller_orders: splits, payment_method: 'cash_on_delivery' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
