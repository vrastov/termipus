// Функция валидации адреса сервера
export function validateServerUrl(url: string): boolean {
  return url.startsWith('ws://') || url.startsWith('wss://');
}

// Загрузка сохраненного адреса из chrome.storage.sync
export async function loadServerUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverUrl'], (result: { serverUrl?: string }) => {
      const defaultUrl = 'ws://localhost:8080/terminal';
      const url = result.serverUrl || defaultUrl;
      resolve(url);
    });
  });
}

// Сохранение адреса в chrome.storage.sync
export async function saveServerUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ serverUrl: url }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Инициализация popup
export async function initPopup(): Promise<void> {
  const inputElement = document.getElementById('server-url') as HTMLInputElement;
  const saveButton = document.getElementById('save-btn') as HTMLButtonElement;
  const closeButton = document.getElementById('close-btn') as HTMLButtonElement;
  const messageDiv = document.getElementById('message') as HTMLDivElement;

  if (!inputElement || !saveButton || !messageDiv) {
    console.error('Required elements not found');
    return;
  }

  // Загружаем сохраненное значение
  const savedUrl = await loadServerUrl();
  inputElement.value = savedUrl;

  // Обработчик закрытия
  closeButton?.addEventListener('click', () => window.close());

  // Обработчик сохранения
  saveButton.addEventListener('click', async () => {
    const url = inputElement.value.trim();
    if (!validateServerUrl(url)) {
      messageDiv.textContent = 'Ошибка: URL должен начинаться с ws:// или wss://';
      messageDiv.className = 'message error';
      return;
    }

    try {
      await saveServerUrl(url);
      messageDiv.textContent = 'Настройки сохранены успешно!';
      messageDiv.className = 'message success';
    } catch (error: unknown) {
      let msg: string;
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        msg = String((error as { message: unknown }).message);
      } else {
        msg = String(error);
      }
      messageDiv.textContent = `Ошибка сохранения: ${msg}`;
      messageDiv.className = 'message error';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { initPopup(); });
