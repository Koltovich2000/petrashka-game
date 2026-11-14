type LifecycleEvent = 'activated' | 'deactivated';

interface WebApp {
 initData: string;
 ready(): void;
 expand(): void;
 isVersionAtLeast(version: string): boolean;
 setHeaderColor(color: string): void;
 setBackgroundColor(color: string): void;
 disableVerticalSwipes?(): void;
 onEvent(event: LifecycleEvent, callback: () => void): void;
 offEvent(event: LifecycleEvent, callback: () => void): void;
 HapticFeedback?: {impactOccurred(style: 'light'): void};
}

declare global { interface Window { Telegram?: {WebApp: WebApp} } }

const telegram = window.Telegram?.WebApp;

function hasLaunchData(params: string) {
 const values = new URLSearchParams(params.slice(1));
 return values.has('tgWebAppData') || values.has('tgWebAppPlatform');
}

export const inTelegram = Boolean(telegram?.initData)
 || hasLaunchData(window.location.hash) || hasLaunchData(window.location.search);

export function initTelegram() {
 if (!inTelegram || !telegram) return;
 telegram.ready();
 telegram.expand();
 if (telegram.isVersionAtLeast('6.9')) telegram.setHeaderColor('#211e30');
 if (telegram.isVersionAtLeast('6.1')) telegram.setBackgroundColor('#211e30');
 if (telegram.isVersionAtLeast('7.7')) telegram.disableVerticalSwipes?.();
}

export function onTelegramLifecycle(activate: () => void, deactivate: () => void) {
 if (!inTelegram || !telegram?.isVersionAtLeast('8.0')) return;
 telegram.onEvent('activated', activate);
 telegram.onEvent('deactivated', deactivate);
 return () => {
  telegram.offEvent('activated', activate);
  telegram.offEvent('deactivated', deactivate);
 };
}

export async function authenticateTelegram(signal: AbortSignal): Promise<string> {
 if (!telegram?.initData) throw new Error('Откройте игру заново через кнопку бота в Telegram.');
 const controller = new AbortController();
 const abort = () => controller.abort();
 signal.addEventListener('abort', abort, {once:true});
 const timeout = window.setTimeout(abort, 12_000);
 try {
  const response = await fetch('/api/telegram/auth', {
   method: 'POST',
   headers: {'Content-Type':'application/json'},
   body: JSON.stringify({initData:telegram.initData}),
   signal: controller.signal,
  });
  if (response.status === 401) throw new Error('Данные входа недействительны или устарели. Откройте игру заново через бота.');
  if (response.status === 503) throw new Error('Вход через Telegram пока недоступен. Попробуйте позже.');
  if (!response.ok) throw new Error('Сервер входа недоступен. Попробуйте ещё раз.');
  const {user} = await response.json();
  if (typeof user?.id !== 'string' || !/^[1-9]\d*$/.test(user.id)) throw new Error('Сервер не подтвердил профиль Telegram.');
  return user.id;
 } catch (error) {
  if (controller.signal.aborted || error instanceof TypeError || error instanceof SyntaxError) {
   throw new Error('Не удалось связаться с сервером входа. Попробуйте ещё раз.');
  }
  throw error;
 } finally {
  window.clearTimeout(timeout);
  signal.removeEventListener('abort', abort);
 }
}

export function haptic() {
 if (inTelegram && telegram?.isVersionAtLeast('6.1')) telegram.HapticFeedback?.impactOccurred('light');
}
