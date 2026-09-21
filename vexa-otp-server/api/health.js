import { applyCors, config, json, supabase } from './_lib/core.js';

export default async function handler(req, res) {
  try {
    if (applyCors(req, res)) return res.status(204).end();
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

    const { error } = await supabase
      .from('vexa_otp_challenges')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (error) throw error;

    return json(res, 200, {
      status: 'online',
      service: 'VEXA OTP',
      channel: 'whatsapp',
      graph_version: config.graphVersion,
    });
  } catch (error) {
    console.error('health error', error);
    return json(res, 503, { status: 'degraded', service: 'VEXA OTP' });
  }
}
