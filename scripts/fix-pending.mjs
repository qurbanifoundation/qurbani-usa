import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const s = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: pending } = await s.from('donations').select('id, stripe_payment_intent_id, amount').eq('status', 'pending');
console.log('Found', pending.length, 'pending donations');

let fixed = 0;
for (const d of pending) {
  if (!d.stripe_payment_intent_id) continue;
  try {
    const pi = await stripe.paymentIntents.retrieve(d.stripe_payment_intent_id);
    let newStatus = null;
    if (pi.status === 'succeeded') newStatus = 'completed';
    else if (pi.status === 'canceled') newStatus = 'cancelled';
    else if (pi.status === 'requires_payment_method') newStatus = 'failed';
    if (newStatus) {
      await s.from('donations').update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      }).eq('id', d.id);
      console.log('Fixed', d.id, '->', newStatus, '($' + d.amount + ')');
      fixed++;
    } else {
      console.log('Skipped', d.id, 'stripe status:', pi.status);
    }
  } catch (e) {
    console.log('Error for', d.id, e.message);
  }
}
console.log('Total fixed:', fixed);
