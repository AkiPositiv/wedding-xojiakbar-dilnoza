// Все данные приглашения редактируются здесь.
// Поля вида { ru, uz, kk } — текст на трёх языках: русском, узбекском (латиница) и казахском.
window.WEDDING = {
  groom: { ru: "Хожиакбар", uz: "Xojiakbar", kk: "Хожиакбар" },
  bride: { ru: "Дилноза", uz: "Dilnoza", kk: "Дилноза" },
  initials: { ru: "Х&Д", uz: "X&D", kk: "Х&Д" },

  // Название события для Google Календаря
  eventTitle: {
    ru: "Свадьба Хожиакбара и Дилнозы",
    uz: "Xojiakbar va Dilnozaning toʻyi",
    kk: "Хожиакбар мен Дилнозаның тойы",
  },

  // Дата и время начала (с часовым поясом Ташкента)
  date: "2026-11-26T17:30:00+05:00",
  timeZone: "Asia/Tashkent",
  durationHours: 6, // длительность события в календаре
  city: { ru: "Нурафшон", uz: "Nurafshon", kk: "Нурафшон" },

  // Музыка играет по кругу после открытия конверта
  music: "assets/music/Mecano-Hijo de la luna.mp3",
  musicVolume: 0.6,

  // Язык по умолчанию, если браузер гостя не на узбекском или казахском.
  // Ссылка на конкретный язык: index.html?lang=uz  (ru | uz | kk)
  defaultLang: "ru",

  venue: {
    name: { ru: "«Дийора»", uz: "«Diyora»", kk: "«Дийора»" },
    address: {
      ru: "Ташкентская область, г. Нурафшон",
      uz: "Toshkent viloyati, Nurafshon shahri",
      kk: "Ташкент облысы, Нурафшон қаласы",
    },
    mapUrl: "https://yandex.uz/maps/?text=" + encodeURIComponent("Дийора Нурафшон"),
  },

  // Фон страницы следует за временем: до 17:00 день, с 17:00 золотой час,
  // с 18:30 закат, с 21:00 вечер. sparkles: true — на этом пункте вспыхивают бенгальские огни.
  schedule: [
    {
      time: "17:30",
      title: { ru: "Сбор гостей", uz: "Mehmonlar yigʻilishi", kk: "Қонақтардың жиналуы" },
      text: { ru: "Встреча и фотозона", uz: "Kutib olish va fotozona", kk: "Қарсы алу және фотоаймақ" },
    },
    {
      time: "18:00",
      title: { ru: "Встреча молодожёнов", uz: "Kelin-kuyovni kutib olish", kk: "Жас жұбайларды қарсы алу" },
      text: {
        ru: "Торжественный выход жениха и невесты",
        uz: "Kelin va kuyovning tantanali kirib kelishi",
        kk: "Күйеу жігіт пен қалыңдықтың салтанатты кіруі",
      },
    },
    {
      time: "18:30",
      title: { ru: "Банкет", uz: "Toʻy bazmi", kk: "Той дастарханы" },
      text: {
        ru: "Ужин, поздравления и первый танец",
        uz: "Kechki ziyofat, tabriklar va birinchi raqs",
        kk: "Кешкі ас, құттықтаулар және алғашқы би",
      },
    },
    {
      time: "21:30",
      title: { ru: "Завершение вечера", uz: "Kecha yakuni", kk: "Кештің соңы" },
      text: { ru: "Последний танец и проводы", uz: "Soʻnggi raqs va kuzatuv", kk: "Соңғы би және шығарып салу" },
    },
  ],

  // Срок ответа. Для узбекского и казахского — в форме, к которой добавится «до»:
  // uz: «15-noyabr» → «15-noyabrgacha», kk: «15 қарашаға» → «15 қарашаға дейін».
  rsvpDeadline: { ru: "15 ноября", uz: "15-noyabr", kk: "15 қарашаға" },
  // URL веб-приложения Google Apps Script (см. README.md). Пусто — анкета в демо-режиме.
  rsvpEndpoint: "",

  contacts: [
    {
      role: { ru: "Жених и организатор", uz: "Kuyov va tashkilotchi", kk: "Күйеу жігіт және ұйымдастырушы" },
      name: { ru: "Хожиакбар", uz: "Xojiakbar", kk: "Хожиакбар" },
      phone: "+998 90 168-44-94",
    },
  ],
};
