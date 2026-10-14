import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

// Execute the actual proposed migration in isolated PostgreSQL; never remote DB.
test('booking migration executes with private ACLs, overlap protection, expiry and payment replay', async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    await db.exec('create schema extensions; create role anon; create role authenticated; create role service_role;');
    const sql = await readFile(new URL('../migrations/20261014_smart_booking_holds.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const acl = await db.query("select has_table_privilege('anon','public.ace_booking_holds','select') as readable, has_function_privilege('authenticated','public.ace_booking_paid_v1(uuid,text,text)','execute') as callable");
    assert.deepEqual(acl.rows[0], { readable: false, callable: false });
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const start = day + 'T10:00:00+09:00', end = day + 'T11:30:00+09:00';
    const create = async key => (await db.query('select ace_booking_hold_create_v1($1::uuid,$2::timestamptz,$3::timestamptz,$4,$5,$6) as result', [key,start,end,'online','online-private','kunitachi'])).rows[0].result;
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const hold = await create(key);
    assert.equal(hold.state, 'held');
    assert.equal((await create(key)).id, hold.id);
    assert.equal((await create('aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff')).error, 'slot_conflict');
    await assert.rejects(() => db.query('select ace_booking_hold_create_v1($1::uuid,$2::timestamptz,$3::timestamptz,$4,$5,$6)', [key,start,end,'online','online-private','tachikawa']), /idempotency_collision/);
    assert.equal((await db.query('select ace_booking_attach_checkout_v1($1,$2) as result',[hold.id,'cs_test_one'])).rows[0].result.state,'checkout_started');
    const pay = async (pi='pi_test_one') => (await db.query('select ace_booking_paid_v1($1,$2,$3) as result',[hold.id,'cs_test_one',pi])).rows[0].result;
    assert.equal((await pay()).state,'paid');
    assert.equal((await pay()).state,'paid');
    assert.equal((await pay('pi_wrong')).error,'payment_id_mismatch');
    assert.equal((await db.query('select ace_booking_confirm_v1($1,$2) as result',[hold.id,'masa_test_event'])).rows[0].result.state,'confirmed');
    assert.equal((await pay()).state,'confirmed');
    // Different timezone cannot affect the UTC collision expression.
    await db.exec("set timezone='America/New_York'");
    assert.equal((await create('aaaaaaaa-bbbb-4ccc-8ddd-dddddddddddd')).error,'slot_conflict');
    // Release the confirmed test fixture solely inside this disposable DB.
    await db.query("update ace_booking_holds set state='canceled' where id=$1",[hold.id]);
    const expired = await create('aaaaaaaa-bbbb-4ccc-8ddd-cccccccccccc');
    await db.query('select ace_booking_attach_checkout_v1($1,$2)',[expired.id,'cs_late_payment']);
    await db.query("update ace_booking_holds set expires_at=now()-interval '1 minute' where id=$1",[expired.id]);
    const late = (await db.query('select ace_booking_paid_v1($1,$2,$3) as result',[expired.id,'cs_late_payment','pi_late_payment'])).rows[0].result;
    assert.equal(late.state,'refund_required');
    assert.equal((await db.query('select ace_booking_confirm_v1($1,$2) as result',[expired.id,'masa_late_event'])).rows[0].result.error,'invalid_state');
  } finally { await db.close(); }
});
