import {
  applyCors,
  json,
  otpHash,
  safeEqualHex,
  supabase,
} from '../../_lib/core.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (applyCors(req, res)) return res.status(204).end();
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

    const id = String(req.body?.request_id || '').trim();
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!uuidPattern.test(id) || !/^\d{6}$/.test(code)) {
      return json(res, 400, { verified: false, error: 'invalid_request' });
    }

    const { data: challenge, error } = await supabase
      .from('vexa_otp_challenges')
      .select('id,otp_hash,expires_at,attempts,verified_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!challenge) return json(res, 404, { verified: false, error: 'challenge_not_found' });
    if (challenge.verified_at) return json(res, 200, { verified: true, request_id: id });
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      return json(res, 410, { verified: false, error: 'otp_expired' });
    }
    if ((challenge.attempts || 0) >= 5) {
      return json(res, 429, { verified: false, error: 'too_many_attempts' });
    }

    const expected = otpHash(id, code);
    if (!safeEqualHex(challenge.otp_hash, expected)) {
      const attempts = (challenge.attempts || 0) + 1;
      const { error: updateError } = await supabase
        .from('vexa_otp_challenges')
        .update({ attempts })
        .eq('id', id)
        .is('verified_at', null);
      if (updateError) throw updateError;
      return json(res, 401, {
        verified: false,
        error: 'invalid_otp',
        attempts_remaining: Math.max(0, 5 - attempts),
      });
    }

    const verifiedAt = new Date().toISOString();
    const { error: verifyError } = await supabase
      .from('vexa_otp_challenges')
      .update({ verified_at: verifiedAt })
      .eq('id', id)
      .is('verified_at', null);
    if (verifyError) throw verifyError;

    return json(res, 200, { verified: true, request_id: id, verified_at: verifiedAt });
  } catch (error) {
    console.error('OTP verify error', error);
    return json(res, 500, { verified: false, error: 'server_error' });
  }
}
