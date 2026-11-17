import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { visitControlApi } from '../services/api/visit-control-api';
import { PasswordResetError } from '../services/api/password-reset-contract';
import { takePasswordResetEmail } from '../services/auth/password-reset-email';
import { isValidEmail } from '../utils/email-validation';

type Step =
  | { name: 'email' }
  | { name: 'code'; expiresAt: number }
  | { name: 'password'; resetToken: string; expiresAt: number }
  | { name: 'expired' }
  | { name: 'uncertain' }
  | { name: 'success'; accessToken: string };

type Operation = 'request' | 'verify' | 'confirm';
type Notice = { type: 'error'; text: string } | { type: 'limit'; retryAt?: number };

const EMAIL_STEP = { name: 'email' } as const;
const EXPIRED_STEP = { name: 'expired' } as const;
const NETWORK = 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.';

export function usePasswordReset() {
  const [step, setStep] = useState<Step>(EMAIL_STEP);
  const [email, setEmail] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const [fieldError, setFieldError] = useState<string>();
  const [resendAt, setResendAt] = useState(0);
  const [requestLimit, setRequestLimit] = useState(0);
  const [submitLimit, setSubmitLimit] = useState(0);
  const [now, setNow] = useState(Date.now);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const initialEmail = takePasswordResetEmail();
    if (initialEmail) {
      setEmail(initialEmail);
      setPrefilled(true);
    }
    return () => {
      const request = inFlight.current;
      inFlight.current = null;
      request?.abort();
    };
  }, []);

  const expiresAt = 'expiresAt' in step ? step.expiresAt : 0;
  const lastDeadline = Math.max(expiresAt, resendAt, requestLimit, submitLimit);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = lastDeadline > Date.now() ? setInterval(() => {
      refresh();
      if (Date.now() >= lastDeadline) clearInterval(timer);
    }, 500) : undefined;
    const state = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      state.remove();
    };
  }, [lastDeadline]);

  useEffect(() => {
    if (expiresAt && now >= expiresAt && !busy) {
      setStep(EXPIRED_STEP);
      setFieldError(undefined);
      setNotice(undefined);
    }
  }, [expiresAt, now, busy]);

  const goToEmail = useCallback(() => {
    const request = inFlight.current;
    inFlight.current = null;
    request?.abort();
    setStep(EMAIL_STEP);
    setBusy(null);
    setFieldError(undefined);
    setNotice(undefined);
  }, []);

  function editEmail(value: string) {
    setPrefilled(false);
    setEmail(value);
    setFieldError(undefined);
    setNotice(undefined);
  }

  function changeEmail() {
    setPrefilled(false);
    goToEmail();
  }

  async function run<T>(
    operation: Operation,
    task: (signal: AbortSignal) => Promise<T>,
    onSuccess: (result: T) => void,
    onError: (error: PasswordResetError) => void,
  ) {
    if (inFlight.current) return;
    const request = new AbortController();
    inFlight.current = request;
    setBusy(operation);
    setNotice(undefined);
    setFieldError(undefined);
    try {
      const result = await task(request.signal);
      if (inFlight.current === request) onSuccess(result);
    } catch (error) {
      if (inFlight.current === request) {
        onError(error instanceof PasswordResetError ? error : new PasswordResetError(null));
      }
    } finally {
      if (inFlight.current === request) {
        inFlight.current = null;
        setBusy(null);
      }
    }
  }

  function limit(error: PasswordResetError, setDeadline: (retryAt: number) => void) {
    setDeadline(error.retryAt ?? 0);
    setNotice({ type: 'limit', retryAt: error.retryAt });
  }

  function requestCode() {
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address) || requestLimit > Date.now()) return;
    void run('request', (signal) => visitControlApi.requestPasswordReset(address, signal), (result) => {
      const received = Date.now();
      setNow(received);
      setEmail(address);
      setResendAt(received + result.resend_after_sec * 1000);
      setStep({ name: 'code', expiresAt: received + result.code_ttl_sec * 1000 });
    }, (error) => {
      if (error.status === 429) {
        limit(error, setRequestLimit);
      } else if (error.status === 400 && error.code === 'VALIDATION' && step.name === 'email') {
        setFieldError('Проверьте адрес электронной почты');
      } else {
        setNotice({ type: 'error', text: NETWORK });
      }
    });
  }

  function verifyCode(code: string) {
    if (step.name !== 'code' || !/^\d{6}$/.test(code) || submitLimit > Date.now()) return;
    if (step.expiresAt <= Date.now()) {
      setStep(EXPIRED_STEP);
      return;
    }
    void run('verify', (signal) => visitControlApi.verifyPasswordReset(email, code, signal), (result) => {
      const received = Date.now();
      setNow(received);
      setStep({ name: 'password', resetToken: result.reset_token, expiresAt: received + result.expires_in_sec * 1000 });
    }, (error) => {
      if (error.status === 410) {
        setStep(EXPIRED_STEP);
      } else if (error.status === 429) {
        limit(error, setSubmitLimit);
      } else if (error.code === 'RESET_CODE_INVALID') {
        setFieldError(error.attemptsLeft === undefined
          ? 'Неверный код'
          : `Неверный код. Осталось попыток: ${error.attemptsLeft}`);
      } else {
        setNotice({
          type: 'error',
          text: 'Не удалось подтвердить код. Повторите проверку или запросите новый код.',
        });
      }
    });
  }

  function confirmPassword(password: string) {
    if (step.name !== 'password' || submitLimit > Date.now()) return;
    if (step.expiresAt <= Date.now()) {
      setStep(EXPIRED_STEP);
      return;
    }
    void run('confirm', (signal) => visitControlApi.confirmPasswordReset(step.resetToken, password, signal), (accessToken) => {
      setStep({ name: 'success', accessToken });
    }, (error) => {
      if (error.status === 410) {
        setStep(EXPIRED_STEP);
      } else if (error.status === 400 && error.code === 'VALIDATION') {
        setFieldError('Сервер не принял пароль. Проверьте его и попробуйте ещё раз.');
      } else if (error.status === 429) {
        limit(error, setSubmitLimit);
      } else {
        setStep({ name: 'uncertain' });
      }
    });
  }

  const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
  const limitLeft = secondsLeft(notice?.type === 'limit' ? notice.retryAt ?? 0 : 0);
  const requestLimitLeft = step.name === 'email' ? secondsLeft(requestLimit) : 0;
  const wait = limitLeft || requestLimitLeft;
  const message = notice?.type === 'error'
    ? notice.text
    : wait
      ? `Слишком много запросов. Повторите через ${formatCountdown(wait)}.`
      : notice?.type === 'limit' && !notice.retryAt
        ? 'Слишком много запросов. Попробуйте позже.'
        : undefined;

  return {
    step, email, prefilled, busy, message, fieldError,
    canRequest: isValidEmail(email) && secondsLeft(requestLimit) === 0,
    canSubmit: secondsLeft(submitLimit) === 0,
    resendSeconds: secondsLeft(Math.max(resendAt, requestLimit)),
    codeSeconds: step.name === 'code' ? secondsLeft(step.expiresAt) : 0,
    editEmail, changeEmail, goToEmail, requestCode, verifyCode, confirmPassword,
    clearFieldError: () => setFieldError(undefined),
  };
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
