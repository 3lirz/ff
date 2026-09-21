import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  pepper: required('OTP_PEPPER'),
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v25.0',
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  accessToken: required('WHATSAPP_ACCESS_TOKEN'),
  templateName: required('WHATSAPP_TEMPLATE_NAME'),
  templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://3lirz.github.io')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
};

export const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

export const json = (res, status, body) => res.status(status).json(body);

export function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
  res.setHeader('Cache-Control', 'no-store');
  return req.method === 'OPTIONS';
}

export function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) throw new Error('INVALID_PHONE');
  return digits;
}

export function makeOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hmac(value) {
  return crypto.createHmac('sha256', config.pepper).update(String(value)).digest('hex');
}

export function otpHash(id, phone, otp) {
  return hmac(`otp:${id}:${phone}:${otp}`);
}

export function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export async function enforceRateLimits(phoneHash, ipHash) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [{ count: phoneCount, error: phoneError }, { count: ipCount, error: ipError }] = await Promise.all([
    supabase.from('vexa_otp_challenges').select('id', { count: 'exact', head: true }).eq('phone_hash', phoneHash).gte('created_at', since),
    supabase.from('vexa_otp_challenges').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
  ]);
  if (phoneError || ipError) throw phoneError || ipError;
  if ((phoneCount || 0) >= 5) throw new Error('PHONE_RATE_LIMIT');
  if ((ipCount || 0) >= 20) throw new Error('IP_RATE_LIMIT');
}

export async function sendWhatsAppOtp(phone, otp) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: config.templateName,
      language: { code: config.templateLang },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: otp }],
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `WhatsApp API HTTP ${response.status}`;
    const error = new Error(message);
    error.code = data?.error?.code;
    throw error;
  }
  const messageId = data?.messages?.[0]?.id;
  if (!messageId) throw new Error('WHATSAPP_NO_MESSAGE_ID');
  return messageId;
}

export function publicError(error) {
  const code = error?.message || 'UNKNOWN_ERROR';
  if (code === 'INVALID_PHONE') return { status: 400, error: 'invalid_phone' };
  if (code === 'PHONE_RATE_LIMIT') return { status: 429, error: 'too_many_requests_for_phone' };
  if (code === 'IP_RATE_LIMIT') return { status: 429, error: 'too_many_requests_from_network' };
  return { status: 500, error: 'server_error' };
}
