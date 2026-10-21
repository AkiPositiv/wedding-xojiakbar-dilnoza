// Принимает ответы анкеты и записывает их в Google Таблицу.
// Установка — см. README.md, раздел «Анкета гостя».

const SHEET_NAME = "Ответы";
const FIELDS = ["name", "attend", "guest", "drinks", "food", "comment", "lang"];
const HEADERS = ["Время", "Имя", "Присутствие", "Спутник", "Напитки", "Питание", "Комментарий", "Язык"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    const p = e.parameter;
    sheet.appendRow([new Date()].concat(FIELDS.map((f) => String(p[f] || "").slice(0, 1000))));

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
