import { createHash } from 'node:crypto';
import { checkoutInput, HttpError } from './domain.js';

export async function placeOrder(pool, body, requestKey, buyerUserId) {
  const input = checkoutInput(body);
  if (requestKey !== undefined && !/^[0-9a-f-]{36}$/i.test(requestKey)) throw new HttpError(400, 'Invalid checkout request key');
  const fingerprint = createHash('sha256').update(JSON.stringify({input, expectedTotal:body.expectedTotal,buyerUserId:buyerUserId||null})).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (requestKey) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [requestKey]);
      const { rows: [previous] } = await client.query('SELECT fingerprint,response FROM checkout_requests WHERE request_key=$1', [requestKey]);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'This checkout request was already used with different details. Start a new checkout.');
        await client.query('COMMIT');
        return previous.response;
      }
    }
    // Consistent lock ordering prevents deadlocks between overlapping carts.
    const { rows: products } = await client.query(
      'SELECT id, seller_id, price, stock FROM products WHERE id = ANY($1::int[]) AND active AND approved AND EXISTS(SELECT 1 FROM sellers WHERE sellers.id=products.seller_id AND operating_state=$$active$$ AND is_approved) ORDER BY id FOR UPDATE',
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
    if (body.expectedTotal !== undefined && (!Number.isSafeInteger(body.expectedTotal) || body.expectedTotal !== total)) throw new HttpError(409, 'Prices changed. Reload your bag to review the updated total before ordering.');
    const { rows: [customer] } = await client.query(
      'INSERT INTO customers(name,email,city) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city RETURNING id',
      [input.name, input.email, input.city]);
    const { rows: [order] } = await client.query(
      'INSERT INTO orders(customer_id,address,total,buyer_user_id) VALUES($1,$2,$3,$4) RETURNING id,total,status,created_at', [customer.id, input.address, total,buyerUserId||null]);
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
    const response = { ...order, seller_orders: splits, payment_method: 'cash_on_delivery' };
    if (requestKey) await client.query('INSERT INTO checkout_requests(request_key,fingerprint,response,buyer_user_id) VALUES($1,$2,$3,$4)', [requestKey,fingerprint,JSON.stringify(response),buyerUserId||null]);
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
