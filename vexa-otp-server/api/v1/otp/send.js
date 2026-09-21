import crypto from 'node:crypto';
import {
  applyCors,
  enforceRateLimits,
  getIp,
  hmac,
  json,
  makeOtp,
  normalizePhone,
  otpHash,
  publicError,
  sendWhatsAppOtp,
  supabase,
} from '../../_lib/core.js';

export default async function handler(req, res) {
  try {
    if (applyCors(req, res)) return res.status(204).end();
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

    const phone = normalizePhone(req.body?.phone);
    const ip = getIp(req);
    const phoneHash = hmac(`phone:${phone}`);
    const ipHash = hmac(`ip:${ip}`);
    await enforceRateLimits(phoneHash, ipHash);

    const id = crypto.randomUUID();
    const otp = makeOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const hash = otpHash(id, otp);

    const { error: insertError } = await supabase.from('vexa_otp_challenges').insert({
      id,
      phone_hash: phoneHash,
      ip_hash: ipHash,
      otp_hash: hash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    try {
      const messageId = await sendWhatsAppOtp(phone, otp);
      const { error: updateError } = await supabase
        .from('vexa_otp_challenges')
        .update({ provider_message_id: messageId })
        .eq('id', id);
      if (updateError) console.error('provider_message_id update failed', updateError);

      return json(res, 200, {
        request_id: id,
        message_id: messageId,
        expires_in: 300,
      });
    } catch (providerError) {
      await supabase.from('vexa_otp_challenges').delete().eq('id', id);
      console.error('WhatsApp send failed', providerError);
      return json(res, 502, { error: 'whatsapp_send_failed' });
    }
  } catch (error) {
    console.error('OTP send error', error);
    const out = publicError(error);
    return json(res, out.status, { error: out.error });
  }
}
