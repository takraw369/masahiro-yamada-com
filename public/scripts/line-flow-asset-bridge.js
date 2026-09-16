(() => {
  const EVENT = 'masa:line-flow-asset';
  const RESULT = 'masa:line-flow-asset-result';

  const emit = (ok, message, requestId) => {
    window.dispatchEvent(new CustomEvent(RESULT, { detail: { ok, message, requestId } }));
  };

  const messageField = () => document.querySelector('.inspect textarea');
  const addButton = () => document.querySelector('.add');

  const setNativeValue = (field, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
  };

  const applyToSelected = ({ text, append, requestId }) => {
    const field = messageField();
    if (!(field instanceof HTMLTextAreaElement)) {
      emit(false, '先にStepを選んでください', requestId);
      return;
    }
    const next = append && field.value.trim()
      ? `${field.value.trim()}\n\n${text}`
      : text;
    setNativeValue(field, next);
    emit(true, append ? '本文へ追記しました' : '本文へ置きました', requestId);
  };

  const createStep = ({ text, requestId }) => {
    const add = addButton();
    if (!(add instanceof HTMLElement)) {
      emit(false, 'Flowを選んでください', requestId);
      return;
    }

    const before = document.querySelectorAll('.step').length;
    add.click();
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const field = messageField();
      const stepReady = document.querySelectorAll('.step').length > before;
      if (field instanceof HTMLTextAreaElement && (stepReady || Date.now() - startedAt > 700)) {
        window.clearInterval(timer);
        setNativeValue(field, text);
        emit(true, '新Stepへ入れました。保存で確定します', requestId);
        return;
      }
      if (Date.now() - startedAt > 4500) {
        window.clearInterval(timer);
        emit(false, '新Stepを準備できませんでした', requestId);
      }
    }, 120);
  };

  window.addEventListener(EVENT, (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!detail || typeof detail.text !== 'string' || !detail.text.trim()) return;
    const request = {
      text: detail.text.trim(),
      requestId: detail.requestId || '',
      append: detail.action === 'append',
    };
    if (detail.action === 'new-step') createStep(request);
    else applyToSelected(request);
  });
})();
