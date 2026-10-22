// Принимает ответы анкеты: записывает их в Google Таблицу и присылает уведомление в Telegram.
// Установка — см. НАСТРОЙКА.md рядом с этим файлом.
//
// Токен бота и ID чата хранятся в «Свойствах скрипта» (Настройки проекта → Свойства скрипта),
// а не в коде: так их не видно ни на сайте, ни в репозитории.

const SHEET_NAME = "Ответы";
const FIELDS = ["name", "attend", "side", "relation", "wishes", "lang"];
const HEADERS = ["Время", "Имя и фамилия", "Присутствие", "Чей гость", "Кем приходится", "Пожелания и просьбы", "Язык"];

function doPost(e) {
  const p = (e && e.parameter) || {};
  const row = FIELDS.map((f) => String(p[f] || "").slice(0, 2000));

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow([new Date()].concat(row));
  } finally {
    lock.releaseLock();
  }

  notify_(p);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Проверка из браузера: откройте URL веб-приложения — увидите, доступна ли таблица.
function doGet() {
  let result;
  try {
    result = { ok: true, rows: getSheet_().getLastRow(), telegram: Boolean(setting_("TELEGRAM_TOKEN") && setting_("TELEGRAM_CHAT_ID")) };
  } catch (err) {
    result = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

// Настройка из «Свойств скрипта»; если её там нет — из файла Secrets.gs внутри проекта Apps Script
// (этот файл есть только в Google, в репозиторий он не попадает).
function setting_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (value) return value;
  return typeof SECRETS !== "undefined" ? SECRETS[name] : null;
}

function notify_(p) {
  const token = setting_("TELEGRAM_TOKEN");
  const chat = setting_("TELEGRAM_CHAT_ID");
  if (!token || !chat) return;

  const coming = p.attend === "Приду";
  const lines = [`${coming ? "✅" : "❌"} ${p.name || "Без имени"} — ${coming ? "придёт" : "не сможет прийти"}`];
  if (p.side) lines.push(`Гость со стороны: ${p.side === "Жених" ? "жениха" : "невесты"}`);
  if (p.relation) lines.push(`Кем приходится: ${p.relation}`);
  if (p.wishes) lines.push(`Пожелания: ${p.wishes}`);

  try {
    UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "post",
      payload: { chat_id: chat, text: lines.join("\n") },
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error(err);
  }
}

// Запустите один раз вручную, после того как напишете своему боту любое сообщение
// (или /start в общем чате, куда добавлен бот). Функция найдёт ID чата,
// сохранит его и пришлёт тестовое уведомление.
function connectTelegram() {
  const props = PropertiesService.getScriptProperties();
  const token = setting_("TELEGRAM_TOKEN");
  if (!token) throw new Error("Сначала добавьте TELEGRAM_TOKEN в «Свойства скрипта» (Настройки проекта).");

  const res = JSON.parse(UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getUpdates`).getContentText());
  const msg = (res.result || [])
    .map((u) => u.message || u.my_chat_member)
    .filter(Boolean)
    .pop();
  if (!msg) throw new Error("Бот пока не получил сообщений. Напишите ему что-нибудь и запустите функцию снова.");

  props.setProperty("TELEGRAM_CHAT_ID", String(msg.chat.id));
  notify_({ name: "Тестовое сообщение", attend: "Приду", wishes: "Уведомления об ответах гостей подключены 🎉" });
}

// Проверка без сайта: добавляет в таблицу тестовую строку и присылает уведомление.
function testRow() {
  doPost({ parameter: { name: "Тест Тестов", attend: "Приду", side: "Жених", relation: "Друг/подруга", wishes: "Проверка связи", lang: "ru" } });
}
