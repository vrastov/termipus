/**
 * @jest-environment jsdom
 */
import {
  validateServerUrl,
  loadServerUrl,
  saveServerUrl,
  initPopup,
} from '../src/popup/popup';

// Мокаем chrome.storage.sync и chrome.runtime, чтобы тесты не зависели от реального API браузера.
const mockGet = jest.fn();
const mockSet = jest.fn();

(globalThis as any).chrome = {
  storage: {
    sync: {
      get: mockGet,
      set: mockSet,
    },
  },
  runtime: {
    lastError: undefined,
  },
};

// Вспомогательная функция для ожидания завершения всех асинхронных операций в очереди микрозадач.
// Используем setTimeout, так как setImmediate может отсутствовать в среде Jest.
const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('validateServerUrl', () => {
  // Тест: валидный URL с протоколом ws:// должен вернуть true.
  it('должен вернуть true для URL начинающегося с ws://', () => {
    // Подготовка: задаем строку с корректным протоколом ws://.
    const url = 'ws://localhost:8080/terminal';
    // Выполнение: вызываем функцию валидации.
    const result = validateServerUrl(url);
    // Проверка: ожидаем true, так как протокол подходит.
    expect(result).toBe(true);
  });

  // Тест: валидный URL с протоколом wss:// (защищенный WebSocket).
  it('должен вернуть true для URL начинающегося с wss://', () => {
    // Подготовка: строка с протоколом wss://.
    const url = 'wss://example.com/ws';
    // Выполнение: вызов валидации.
    const result = validateServerUrl(url);
    // Проверка: результат должен быть true.
    expect(result).toBe(true);
  });

  // Тест: невалидный URL с протоколом http:// (не поддерживается WebSocket).
  it('должен вернуть false для URL с http://', () => {
    // Подготовка: URL с http-протоколом.
    const url = 'http://localhost:8080/terminal';
    // Выполнение: валидация.
    const result = validateServerUrl(url);
    // Проверка: ожидаем false.
    expect(result).toBe(false);
  });

  // Тест: URL без явного протокола.
  it('должен вернуть false для URL без протокола', () => {
    // Подготовка: строка без протокола.
    const url = 'localhost:8080/terminal';
    // Выполнение: валидация.
    const result = validateServerUrl(url);
    // Проверка: false, так как нет ws:// или wss://.
    expect(result).toBe(false);
  });

  // Тест: пустая строка.
  it('должен вернуть false для пустой строки', () => {
    // Подготовка: пустая строка.
    const url = '';
    // Выполнение: валидация.
    const result = validateServerUrl(url);
    // Проверка: false.
    expect(result).toBe(false);
  });
});

describe('loadServerUrl', () => {
  beforeEach(() => {
    // Сбрасываем мок get перед каждым тестом, чтобы избежать влияния предыдущих вызовов.
    mockGet.mockClear();
  });

  // Тест: загрузка сохраненного пользователем URL из chrome.storage.sync.
  it('должен вернуть сохраненный URL, если он есть', async () => {
    // Подготовка: задаем сохраненный URL.
    const savedUrl = 'ws://saved.example.com';
    // Мокаем chrome.storage.sync.get: вызываем переданный колбэк с объектом, содержащим serverUrl.
    mockGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: savedUrl });
    });
    // Выполнение: вызываем loadServerUrl.
    const result = await loadServerUrl();
    // Проверка: функция должна вернуть сохраненный URL.
    expect(result).toBe(savedUrl);
    // Проверка: метод get был вызван с правильными ключами.
    expect(mockGet).toHaveBeenCalledWith(['serverUrl'], expect.any(Function));
  });

  // Тест: если в хранилище нет значения, должно вернуться значение по умолчанию.
  it('должен вернуть значение по умолчанию, если сохраненного нет', async () => {
    // Подготовка: мокаем get, возвращая пустой объект (нет сохраненного URL).
    mockGet.mockImplementation((keys, callback) => {
      callback({});
    });
    // Выполнение: загружаем URL.
    const result = await loadServerUrl();
    // Проверка: функция должна вернуть значение по умолчанию.
    expect(result).toBe('ws://localhost:8080/terminal');
  });
});

describe('saveServerUrl', () => {
  beforeEach(() => {
    // Сбрасываем мок set перед каждым тестом.
    mockSet.mockClear();
    // Сбрасываем возможную ошибку runtime.
    if ((globalThis as any).chrome.runtime) {
      (globalThis as any).chrome.runtime.lastError = undefined;
    }
  });

  // Тест: успешное сохранение URL в chrome.storage.sync.
  it('должен сохранить URL и разрешить промис', async () => {
    // Подготовка: URL для сохранения.
    const urlToSave = 'wss://test.com';
    // Мокаем chrome.storage.sync.set: вызываем колбэк без ошибки.
    mockSet.mockImplementation((items, callback) => {
      callback();
    });
    // Выполнение и проверка: промис должен успешно разрешиться.
    await expect(saveServerUrl(urlToSave)).resolves.toBeUndefined();
    // Проверка: метод set был вызван с корректными аргументами.
    expect(mockSet).toHaveBeenCalledWith({ serverUrl: urlToSave }, expect.any(Function));
  });

  // Тест: ошибка при сохранении (например, проблемы с хранилищем).
  it('должен отклонить промис при ошибке chrome.runtime.lastError', async () => {
    // Подготовка: мокаем set, устанавливая lastError и вызывая колбэк.
    mockSet.mockImplementation((items, callback) => {
      (globalThis as any).chrome.runtime.lastError = { message: 'Ошибка сохранения' };
      callback();
    });
    const urlToSave = 'ws://error.com';
    // Выполнение и проверка: промис должен быть отклонен с ошибкой.
    await expect(saveServerUrl(urlToSave)).rejects.toThrow('Ошибка сохранения');
  });
});

describe('initPopup', () => {
  beforeEach(() => {
    // Перед каждым тестом создаем заново DOM-структуру, необходимую для popup.
    document.body.innerHTML = `
      <input id="server-url" />
      <button id="save-btn"></button>
      <button id="close-btn"></button>
      <div id="message"></div>
    `;
    // Сбрасываем состояния моков и runtime ошибки.
    mockGet.mockClear();
    mockSet.mockClear();
    (globalThis as any).chrome.runtime.lastError = undefined;
  });

  // Тест: при инициализации popup должно загрузить сохраненный URL и установить его в поле ввода.
  it('должен загрузить сохраненный URL и установить его в input', async () => {
    // Подготовка: мокаем get, возвращающий тестовый URL.
    const testUrl = 'ws://mock-url';
    mockGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: testUrl });
    });
    // Выполнение: инициализируем popup.
    await initPopup();
    // Получаем ссылку на поле ввода.
    const input = document.getElementById('server-url') as HTMLInputElement;
    // Проверка: значение в input должно соответствовать загруженному URL.
    expect(input.value).toBe(testUrl);
  });

  // Тест: при попытке сохранить невалидный URL (не ws:// или wss://) должно отобразиться сообщение об ошибке.
  it('должен показать ошибку при сохранении невалидного URL', async () => {
    // Подготовка: мокаем get, чтобы initPopup успешно завершил загрузку начального значения.
    mockGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: 'ws://default' });
    });
    // Инициализируем popup.
    await initPopup();
    // Получаем элементы DOM.
    const input = document.getElementById('server-url') as HTMLInputElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;
    // Устанавливаем заведомо невалидный URL.
    input.value = 'invalid-url';
    // Симулируем клик по кнопке сохранения.
    saveBtn.click();
    // Ждем завершения всех асинхронных операций (хотя в данном случае ошибка синхронна, но безопаснее подождать).
    await flushPromises();
    // Проверка: в блоке сообщения появился текст с указанием на ошибку валидации.
    expect(messageDiv.textContent).toContain('должен начинаться с ws:// или wss://');
    // Проверка: у сообщения добавлен класс error (красный цвет).
    expect(messageDiv.className).toContain('error');
  });

  // Тест: успешное сохранение валидного URL должно приводить к сообщению об успехе и вызову chrome.storage.sync.set.
  it('должен показать сообщение об успехе при сохранении валидного URL', async () => {
    // Подготовка: мокаем get для начальной загрузки.
    mockGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: 'ws://initial' });
    });
    // Мокаем успешное сохранение (set вызывает колбэк без ошибок).
    mockSet.mockImplementation((items, callback) => {
      callback();
    });
    // Инициализируем popup.
    await initPopup();
    // Получаем элементы DOM.
    const input = document.getElementById('server-url') as HTMLInputElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;
    // Устанавливаем корректный WebSocket URL.
    const validUrl = 'wss://valid.com';
    input.value = validUrl;
    // Кликаем по кнопке сохранения.
    saveBtn.click();
    // Ждем асинхронного сохранения.
    await flushPromises();
    // Проверка: сообщение об успехе.
    expect(messageDiv.textContent).toBe('Настройки сохранены успешно!');
    // Проверка: класс сообщения success (зеленый цвет).
    expect(messageDiv.className).toContain('success');
    // Проверка: метод set был вызван с правильным URL.
    expect(mockSet).toHaveBeenCalledWith({ serverUrl: validUrl }, expect.any(Function));
  });

  // Тест: если при сохранении возникает ошибка chrome.runtime.lastError, должно отобразиться сообщение об ошибке.
  it('должен показать сообщение об ошибке при неудачном сохранении', async () => {
    // Подготовка: мокаем get для начальной загрузки.
    mockGet.mockImplementation((keys, callback) => {
      callback({ serverUrl: 'ws://initial' });
    });
    // Мокаем set, устанавливая lastError.
    mockSet.mockImplementation((items, callback) => {
      (globalThis as any).chrome.runtime.lastError = { message: 'Ошибка сети' };
      callback();
    });
    // Инициализируем popup.
    await initPopup();
    // Получаем элементы DOM.
    const input = document.getElementById('server-url') as HTMLInputElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;
    // Устанавливаем валидный URL.
    input.value = 'wss://fail.com';
    // Кликаем по кнопке сохранения.
    saveBtn.click();
    // Ждем асинхронной операции сохранения.
    await flushPromises();
    // Проверка: сообщение содержит текст об ошибке.
    expect(messageDiv.textContent).toContain('Ошибка сохранения: Ошибка сети');
    // Проверка: класс сообщения error.
    expect(messageDiv.className).toContain('error');
  });

  // Тест: если в DOM отсутствуют необходимые элементы (input, button, div), инициализация не должна выбрасывать исключение.
  it('не должен выбрасывать исключение, если элементы не найдены', async () => {
    // Подготовка: очищаем DOM от нужных элементов.
    document.body.innerHTML = '<div></div>';
    // Выполнение: вызываем initPopup в пустом DOM.
    await expect(initPopup()).resolves.toBeUndefined();
    // Проверка: никаких исключений не возникло, функция завершилась без ошибок.
  });
});
