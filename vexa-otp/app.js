(() => {
  const $ = (id) => document.getElementById(id);
  const sendForm = $('sendForm');
  const verifyForm = $('verifyForm');
  const sendBtn = $('sendBtn');
  const verifyBtn = $('verifyBtn');
  const sendResult = $('sendResult');
  const verifyResult = $('verifyResult');
  const requestId = $('requestId');
  const apiBaseInput = $('apiBaseInput');
  const saveApi = $('saveApi');
  const headerStatus = $('headerStatus');
  const connectionBadge = $('connectionBadge');
  const apiMetric = $('apiMetric');
  const connectionLine = $('connectionLine');

  const normalizeBase = (value) => (value || '').trim().replace(/\/+$/, '');
  let apiBase = normalizeBase(window.VEXA_CONFIG?.API_BASE || '');
  apiBaseInput.value = apiBase;

  const setResult = (el, ok, text) => {
    el.hidden = false;
    el.className = `result ${ok ? 'ok' : 'err'}`;
    el.textContent = text;
  };

  const setStatus = (state, detail = '') => {
    headerStatus.classList.remove('online', 'offline');
    connectionBadge.classList.remove('online', 'offline');

    if (state === 'online') {
      headerStatus.classList.add('online');
      headerStatus.querySelector('span').textContent = 'API متصل';
      connectionBadge.classList.add('online');
      connectionBadge.textContent = 'Backend متصل';
      apiMetric.textContent = 'ONLINE';
      apiMetric.classList.add('good');
      connectionLine.innerHTML = `<span class="time">API</span><span>${detail || 'Backend online'}</span>`;
      sendBtn.disabled = false;
      verifyBtn.disabled = false;
    } else if (state === 'offline') {
      headerStatus.classList.add('offline');
      headerStatus.querySelector('span').textContent = 'API غير متصل';
      connectionBadge.classList.add('offline');
      connectionBadge.textContent = 'Backend غير متصل';
      apiMetric.textContent = 'OFFLINE';
      apiMetric.classList.remove('good');
      connectionLine.innerHTML = `<span class="time">API</span><span>${detail || 'ضع عنوان الـ backend لتفعيل الإرسال الحقيقي'}</span>`;
      sendBtn.disabled = true;
      verifyBtn.disabled = true;
    } else {
      headerStatus.querySelector('span').textContent = 'فحص الاتصال...';
      connectionBadge.textContent = 'فحص Backend...';
      apiMetric.textContent = 'CHECKING';
      apiMetric.classList.remove('good');
      sendBtn.disabled = true;
      verifyBtn.disabled = true;
    }
  };

  const checkHealth = async () => {
    if (!apiBase) {
      setStatus('offline', 'Backend not configured yet');
      return false;
    }

    setStatus('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${apiBase}/health`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setStatus('online', data.service ? `${data.service} / ${data.status || 'online'}` : 'VEXA OTP backend online');
      return true;
    } catch (err) {
      clearTimeout(timer);
      setStatus('offline', `Backend unavailable${err?.message ? `: ${err.message}` : ''}`);
      return false;
    }
  };

  sendForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiBase) {
      setResult(sendResult, false, 'Backend غير مضبوط. افتح إعداد عنوان الـ Backend وأضف رابط API أولاً.');
      return;
    }

    const local = $('phone').value.replace(/\D/g, '').replace(/^0+/, '');
    const code = $('countryCode').value.replace(/\D/g, '');
    if (!local || local.length < 6) {
      setResult(sendResult, false, 'رقم الهاتف غير صالح.');
      return;
    }

    const phone = `${code}${local}`;
    sendBtn.disabled = true;
    sendBtn.textContent = 'جاري الإرسال...';
    sendResult.hidden = true;

    try {
      const res = await fetch(`${apiBase}/v1/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.request_id) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      requestId.value = data.request_id;
      setResult(sendResult, true, `ACCEPTED | request_id=${data.request_id}${data.message_id ? ` | whatsapp_message_id=${data.message_id}` : ''}`);
    } catch (err) {
      setResult(sendResult, false, `SEND FAILED | ${err?.message || 'Unknown error'}`);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'إرسال OTP عبر WhatsApp';
    }
  });

  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiBase) {
      setResult(verifyResult, false, 'Backend غير مضبوط.');
      return;
    }

    const code = $('otp').value.replace(/\D/g, '');
    const id = requestId.value.trim();
    if (code.length !== 6 || !id) {
      setResult(verifyResult, false, 'أدخل Request ID ورمز OTP من 6 أرقام.');
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'جاري التحقق...';
    verifyResult.hidden = true;

    try {
      const res = await fetch(`${apiBase}/v1/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_id: id, code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.verified !== true) throw new Error(data.error || data.message || 'OTP غير صحيح أو منتهي');
      setResult(verifyResult, true, `VERIFIED | request_id=${id}`);
    } catch (err) {
      setResult(verifyResult, false, `VERIFY FAILED | ${err?.message || 'Unknown error'}`);
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'تحقق من الرمز';
    }
  });

  saveApi.addEventListener('click', async () => {
    apiBase = normalizeBase(apiBaseInput.value);
    if (apiBase) localStorage.setItem('vexa_otp_api_base', apiBase);
    else localStorage.removeItem('vexa_otp_api_base');
    await checkHealth();
  });

  checkHealth();
})();
