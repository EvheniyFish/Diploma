# CASS

**Cross-domain Anomaly & Signature System**

Веб-платформа предиктивної діагностики обладнання на базі прогнозної аналітики.
Equipment-agnostic архітектура, синтетичний генератор телеметрії, ML-сервіс для виявлення аномалій та оцінки залишкового ресурсу (RUL).

---

## 1. Призначення та академічне обґрунтування

### 1.1 Мета роботи

Розробити веб-застосунок, що реалізує парадигму **predictive maintenance** (CBM — Condition-Based Maintenance): замість реактивної моделі "обладнання зламалось → ремонтуємо" система забезпечує **проактивний контур** — за поточними і ретроспективними телеметричними даними прогнозує деградацію та сповіщає про необхідність втручання за N днів до відмови.

Ключова архітектурна теза, на якій будується захист роботи:

> Платформа є **обладнання-агностичною**. Вона не прив'язана до конкретного типу пристрою, не вшита у фізичну модель окремого вузла, не вимагає перенавчання моделі при додаванні нового класу обладнання. Замість цього система оперує **формальною моделлю каналу сигналу** і **паспортом одиниці обладнання** як декларативним описом.

### 1.2 Теоретична база

Робота спирається на загальновизнані стандарти та методології моніторингу стану:

- **ISO 17359** — Condition monitoring and diagnostics of machines. General guidelines. Визначає схему процесу CBM: вибір параметрів → встановлення порогів → збір даних → діагностика → прогноз.
- **ISO 13374** — Data processing, communication and presentation. Описує шість функціональних блоків системи CBM: Data Acquisition (DA), Data Manipulation (DM), State Detection (SD), Health Assessment (HA), Prognostic Assessment (PA), Advisory Generation (AG). CASS реалізує всі шість.
- **OSA-CBM** (Open System Architecture for Condition-Based Maintenance) — практичне втілення ISO 13374, MIMOSA.
- **Розподіл Вейбулла** як стандартна модель часу до відмови у reliability engineering.
- **RUL (Remaining Useful Life)** — цільова величина прогностики, ключовий KPI predictive maintenance.

Це не теоретичні прикраси — кожен компонент CASS прямо співвідноситься з функціональним блоком ISO 13374, що дає чітку структуру для пояснювальної записки і захисту.

### 1.3 Обов'язкові вимоги ТЗ та їх покриття

| № | Вимога | Реалізація в CASS |
|---|--------|-------------------|
| 1 | Веб-застосунок | SPA-фронтенд (Vue 3) + REST-бекенд (Node.js/Fastify), розгортається у браузері |
| 2 | Збір та обробка даних з обладнання | Уніфікований канал прийому телеметрії `POST /api/v1/ingest` + симулятор як зовнішній постачальник даних |
| 3 | Прогнозування ("через N днів буде проблема") | ML-мікросервіс на FastAPI: детектор аномалій + регресор RUL |
| 4 | CRUD для обладнання | Повний CRUD для одиниць обладнання та їх паспортів |
| 5 | Імітація даних | Окремий процес-симулятор з фізично-осмисленими моделями деградації |
| 6 | API для прогнозу | `GET /api/v1/equipment/:id/forecast`, `POST /api/v1/ml/predict` |
| 7 | Дашборд з графіком + статус (OK / Ризик / Скоро поломка) | Vue + ECharts, статус згідно з тришкальною класифікацією |
| 8 | Журнал обладнання | Подієвий журнал з фільтрацією, експорт |

---

## 2. Концептуальна модель: agnostic-платформа

### 2.1 Чому agnostic, а не "система моніторингу серверів"

Дешеве рішення — обрати один клас обладнання (наприклад, сервери) і вшити припущення про нього в код. На захисті це б'ється першим же питанням: "А якщо завтра вам дадуть моніторити насос?" — відповідь "переписати систему" провальна.

CASS реалізує підхід, який застосовують промислові платформи (Siemens MindSphere, GE Predix, Azure IoT Hub Device Twins): **обладнання — це набір каналів**, а не сутність з вшитою семантикою. Додавання нового типу пристрою = додавання нового паспорта в БД, без коду, без перенавчання моделі, без міграцій.

### 2.2 Класи каналів сигналу

Будь-який датчик у CASS відноситься до одного з шести класів. Це закриває переважну частину промислової телеметрії:

| Клас | Код | Природа | Приклади |
|------|-----|---------|----------|
| Температурний | `T` | Скалярна, повільно змінна, з тепловою інерцією | Температура підшипника, ядра CPU, обмотки, корпусу |
| Вібраційний | `V` | Скалярна (RMS) або спектральна, швидко змінна | Вібрація мотора, гул серверного шасі |
| Електричний | `E` | Скалярна, миттєва або усереднена | Струм, напруга, потужність, cos φ |
| Потоковий | `F` | Швидкісно-витратний | Оберти/хв, потік газу, частота тактів, IOPS |
| Ресурсний | `R` | Монотонно зростаюча | Наработка в годинах, кількість циклів, лічильник записів SSD |
| Якісний | `Q` | Лічильник деградації | BER, кількість помилок, повторні передачі, відбракування |

ML працює не зі значенням "78 °C", а з **нормованими безрозмірними ознаками каналу**: відхилення від номіналу, швидкість зміни, варіація, кореляція з іншими каналами тієї ж одиниці, спектральні характеристики (для V-класу).

### 2.3 Паспорт обладнання

Паспорт — декларативний JSON-документ, що описує одиницю обладнання. Він зберігається в БД і повністю визначає, як система буде з ним працювати.

```json
{
  "model_code": "SRV-R740-2U",
  "display_name": "Серверна стійка Dell R740 (2U)",
  "category": "compute",
  "weibull_eta_hours": 43800,
  "weibull_beta": 2.4,
  "channels": [
    {
      "code": "cpu_temp_pkg",
      "class": "T",
      "unit": "°C",
      "nominal": 55.0,
      "operating_range": [30.0, 75.0],
      "critical_range": [85.0, 105.0],
      "inertia_seconds": 30,
      "noise_sigma": 0.6
    },
    {
      "code": "fan_rpm_front",
      "class": "F",
      "unit": "rpm",
      "nominal": 4500,
      "operating_range": [2000, 7000],
      "critical_range": [0, 1500],
      "inertia_seconds": 5,
      "noise_sigma": 50
    }
  ],
  "failure_modes": [
    {
      "code": "thermal_runaway",
      "name": "Тепловий розгін",
      "affected_channels": ["cpu_temp_pkg", "fan_rpm_front"],
      "signature": "rising_T_with_compensating_F_until_F_saturates",
      "typical_horizon_hours": 72
    }
  ]
}
```

`weibull_eta` (масштаб) та `weibull_beta` (форма) — параметри розподілу часу до відмови для даного класу. Використовуються генератором для синтезу реалістичних траєкторій деградації та як baseline-prior для ML-моделі.

`failure_modes` — перелік сценаріїв деградації з характерними сигнатурами. Це і "довідник симптомів" для людини-оператора, і набір цільових класів для класифікатора.

### 2.4 Парк демонстраційного обладнання

Чотири моделі, обрані з конкретною метою:

**1. SRV-R740-2U — Серверна стійка**
Впізнаваний домен, проєктна точка опори. CPU/GPU temperatures, RAM ECC errors, fan RPMs, voltage rails, SSD wear leveling, мережеві помилки. Режими відмови: thermal runaway, fan bearing wear, SSD endurance exhaustion, PSU degradation.

**2. PMP-CF250 — Промисловий відцентровий насос**
Класичний кейс predictive maintenance, на якому будувалась галузь. Триосна вібрація (X/Y/Z RMS), температура підшипників (drive-end, non-drive-end), струм обмоток, тиск нагнітання, витрата. Режими: знос підшипника, дисбаланс ротора, кавітація, замикання обмотки.

**3. CRY-LN2-15K — Криогенна установка охолодження (рідкий азот)**
"Серйозне" обладнання для враження комісії, але з реальною фізикою. Тиск у дюарі, температура крапапробника, рівень рідини, струм компресора, цикли реконденсації. Режими: витік ізоляції вакууму, деградація компресора, забивання фільтра.

**4. QA-7000 — Квантовий анігілятор**
Демонстрація агностичності. Вигадані канали: `quantum_flux_pressure` (T-клас, бо тепло-подібна динаміка), `containment_field_strength` (E-клас), `tachyon_emission_rate` (Q-клас, лічильник), `vacuum_chamber_integrity` (F-клас, ресурсний). На захисті це прямий аргумент: "Системі неважливо, що це не існує — поки є канали з характеристиками, вона прогнозує."

Усі чотири моделі реєструються в БД через `seed`-скрипт. Кількість одиниць кожної моделі в демо-парку — 3–5 шт (різний вік, різна наработка, різні приховані стани здоров'я).

---

## 3. Архітектура системи

### 3.1 Огляд компонентів

```
+--------------------+
|   Vue 3 frontend   |
|  (SPA, ECharts)    |
+----------+---------+
           | HTTPS
           v
+--------------------+       +----------------------+
| Node.js / Fastify  |<----->|  SQLite (better-     |
|  REST API server   |       |  sqlite3, WAL mode)  |
+----+----------+----+       +----------------------+
     |          |
     | HTTP     | HTTP (ingest)
     v          ^
+----------+   +----------------------+
| FastAPI  |   | Симулятор телеметрії |
|  ML svc  |   | (Node.js, окремий    |
| (Python) |   |  процес, cron-tick)  |
+----------+   +----------------------+
```

Чотири окремих процеси, незалежно стартують і зупиняються. Між ними — тільки HTTP. Це дає:

- ізоляцію відмов (впав ML — система продовжує приймати дані),
- можливість масштабувати ML окремо,
- чіткі межі відповідальності в коді,
- природний поділ для git-комітів.

### 3.2 Стек

| Компонент | Технологія | Версія | Обґрунтування |
|-----------|-----------|--------|---------------|
| Бекенд API | Node.js + Fastify | Node 20 LTS, Fastify 4.x | Швидкий, з вбудованою валідацією через JSON Schema |
| ORM/DB-доступ | better-sqlite3 | 11.x | Синхронний, найшвидший SQLite-драйвер для Node, prepared statements |
| База даних | SQLite | 3.45+ | За вимогою. WAL-режим для конкурентного запису з симулятора |
| Валідація | Ajv + JSON Schema | 8.x | Інтегрується з Fastify нативно |
| Логування | Pino | 9.x | Стандарт для Fastify, JSON-формат |
| Симулятор | Node.js (окремий процес) | Node 20 LTS | Той самий рантайм, спільний код для типів і паспортів |
| ML-сервіс | FastAPI + uvicorn | Python 3.11, FastAPI 0.110+ | Швидкий старт, автодокументація |
| ML-фреймворк | scikit-learn + numpy | sklearn 1.4+, numpy 1.26+ | Достатньо для Isolation Forest, Random Forest, нема надмірності TensorFlow |
| Фронтенд | Vue 3 (Composition API) | 3.4+ | За вимогою |
| Збірка фронту | Vite | 5.x | Стандарт для Vue 3 |
| UI-компоненти | PrimeVue | 4.x | Готові таблиці, форми, дашборд-віджети, не потребує налаштування Tailwind |
| Графіки | Apache ECharts | 5.5+ | Кращий за Chart.js для часових рядів з великим обсягом точок |
| HTTP-клієнт | axios | 1.x | Стандарт |
| Тестування | Vitest + supertest | Vitest 1.x | Спільний для бекенду і фронту |

Свідомі рішення проти альтернатив:

- **Не React** — бо ТЗ і досвід замовника на Vue.
- **Не Express** — Fastify швидший і має нативну валідацію.
- **Не Sequelize/Prisma** — для SQLite з нашим обсягом це надмірно. Pure SQL через better-sqlite3 простіший і прозоріший.
- **Не TensorFlow.js** — Python ML-стек зріліший, бібліотеки кращі, графіки на захисті малювати простіше через scikit-learn.
- **Не TimescaleDB / InfluxDB** — за вимогою SQLite. Прийнятно, бо обсяги демо-стенду ~мільйони рядків, що SQLite витримує без проблем у WAL-режимі.

### 3.3 Потоки даних

**Потік 1: Прийом телеметрії**
```
Симулятор --[POST /api/v1/ingest]--> Fastify --[INSERT batch]--> SQLite
```
Симулятор кожні 10 секунд генерує пачку точок (по всіх каналах усіх одиниць) і відправляє одним POST. Бекенд валідує, складає в `telemetry` таблицю.

**Потік 2: Запит прогнозу (фоновий, періодичний)**
```
Scheduler в бекенді (раз/5 хв)
  --[вибірка останніх N точок з SQLite]-->
  --[POST /predict до ML-сервісу]-->
  --[відповідь: anomaly_score, predicted_failure_mode, rul_hours]-->
  --[UPDATE health_state + INSERT event у журнал]-->
```

**Потік 3: Інтерактивний запит з фронту**
```
Vue --[GET /api/v1/equipment/:id/forecast]--> Fastify --[читає health_state + останню телеметрію]--> Vue
```
Фронт не звертається до ML-сервісу напряму. Усі прогнози беруться з `health_state`, які оновлюються фоновим планувальником. Це дешево і консистентно.

**Потік 4: CRUD**
```
Vue --[REST]--> Fastify --[SQL]--> SQLite
```

---

## 4. Модель даних

### 4.1 Схема SQLite

```sql
-- Моделі обладнання (паспорти класів)
CREATE TABLE equipment_models (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_code      TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    category        TEXT NOT NULL,
    passport_json   TEXT NOT NULL,        -- повний паспорт з 2.3
    weibull_eta     REAL NOT NULL,
    weibull_beta    REAL NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Конкретні одиниці обладнання
CREATE TABLE equipment_units (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id        INTEGER NOT NULL REFERENCES equipment_models(id),
    serial_no       TEXT NOT NULL UNIQUE,
    location        TEXT,
    commissioned_at TEXT NOT NULL,         -- дата введення в експлуатацію
    hours_run       REAL NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_units_model ON equipment_units(model_id);
CREATE INDEX idx_units_active ON equipment_units(is_active);

-- Точки телеметрії (основна "товста" таблиця)
CREATE TABLE telemetry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id         INTEGER NOT NULL REFERENCES equipment_units(id),
    channel_code    TEXT NOT NULL,
    ts              TEXT NOT NULL,         -- ISO 8601 UTC
    value           REAL NOT NULL,
    quality         INTEGER NOT NULL DEFAULT 1  -- 0=bad, 1=good
) WITHOUT ROWID -- ні, з ROWID; WITHOUT ROWID програє з композитним PK тут
;
-- Виправлення: composite index, без WITHOUT ROWID
CREATE INDEX idx_telemetry_unit_ts ON telemetry(unit_id, channel_code, ts DESC);
CREATE INDEX idx_telemetry_ts ON telemetry(ts);

-- Прихований стан здоров'я (правда, відома симулятору, схована від системи)
-- Зберігається окремо — використовується тільки для оцінки якості моделі
CREATE TABLE ground_truth_state (
    unit_id         INTEGER PRIMARY KEY REFERENCES equipment_units(id),
    true_health     REAL NOT NULL,        -- [0, 1], 1 = нове, 0 = відмова
    active_mode     TEXT,                  -- код активного режиму деградації або NULL
    mode_started_at TEXT,
    rul_true_hours  REAL,                  -- реальний залишковий ресурс
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Стан здоров'я з точки зору ML-моделі (те, що бачить користувач)
CREATE TABLE health_state (
    unit_id             INTEGER PRIMARY KEY REFERENCES equipment_units(id),
    status              TEXT NOT NULL,    -- 'ok' | 'risk' | 'imminent'
    anomaly_score       REAL NOT NULL,    -- [0, 1]
    predicted_mode      TEXT,             -- код режиму або NULL
    predicted_mode_conf REAL,             -- впевненість класифікатора
    rul_hours           REAL,             -- прогноз RUL
    rul_lower_hours     REAL,             -- нижня межа довірчого інтервалу
    rul_upper_hours     REAL,             -- верхня межа
    last_updated        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Журнал подій (вимога ТЗ п.8)
CREATE TABLE event_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id         INTEGER REFERENCES equipment_units(id),
    ts              TEXT NOT NULL DEFAULT (datetime('now')),
    severity        TEXT NOT NULL,        -- 'info' | 'warning' | 'critical'
    event_type      TEXT NOT NULL,        -- 'status_change' | 'anomaly_detected' | 'maintenance' | 'manual'
    payload_json    TEXT NOT NULL DEFAULT '{}',
    message         TEXT NOT NULL
);

CREATE INDEX idx_events_unit_ts ON event_log(unit_id, ts DESC);
CREATE INDEX idx_events_severity ON event_log(severity, ts DESC);

-- Метадані моделі (для контролю версії моделі)
CREATE TABLE ml_model_versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    version_tag     TEXT NOT NULL UNIQUE,
    trained_at      TEXT NOT NULL,
    metrics_json    TEXT NOT NULL,        -- precision, recall, MAE для RUL
    is_active       INTEGER NOT NULL DEFAULT 0,
    notes           TEXT
);
```

### 4.2 Обсяг даних

Розрахунок для демо-стенду:
- 4 моделі × ~4 одиниці = ~16 одиниць.
- На одиницю ~15 каналів у середньому.
- Частота вибірки: 1 точка/канал/10 секунд = 8 640 точок/канал/добу.
- Загалом: 16 × 15 × 8 640 ≈ **2 млн точок/добу**.

SQLite у WAL-режимі це витримує без проблем. Розмір рядка в `telemetry` — ~80 байт, добовий приріст бази ~160 МБ. Для демонстрації достатньо тримати скользяче вікно у 14 днів — це ~2.2 ГБ.

Передбачено фонове завдання `compactor`, що раз на добу:
- видаляє точки старші 14 днів,
- агрегує точки старші 7 днів у хвилинні усереднення (опційно, якщо знадобиться).

### 4.3 Замітки щодо схеми

- `telemetry` — звичайна таблиця з ROWID. Спроба `WITHOUT ROWID` дає виграш тільки при PK з невеликою кардинальністю; у нас сурогатний PK + composite index — звичайна форма ефективніша.
- `quality` як `INTEGER` (0/1) — SQLite не має нативного BOOLEAN; integer найдешевший.
- `ts` як `TEXT` (ISO 8601) — стандартний підхід для SQLite. Сортування і `BETWEEN` працюють коректно через лексикографічний порядок ISO 8601 UTC.

---

## 5. Бекенд (Node.js / Fastify)

### 5.1 Структура проєкту

```
backend/
├── src/
│   ├── server.js               # точка входу, реєстрація плагінів
│   ├── config.js               # читання env
│   ├── db/
│   │   ├── index.js            # ініціалізація better-sqlite3, прагми
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql
│   │   │   └── 002_indices.sql
│   │   └── seed.js             # seed моделей і одиниць
│   ├── domain/
│   │   ├── passport.js         # парсинг і валідація паспортів
│   │   ├── health.js           # розрахунок статусу OK/Risk/Imminent
│   │   └── status_rules.js     # правила переходів статусів
│   ├── routes/
│   │   ├── models.js           # CRUD моделей
│   │   ├── units.js            # CRUD одиниць
│   │   ├── telemetry.js        # ingest, читання
│   │   ├── forecast.js         # API прогнозу
│   │   ├── events.js           # журнал
│   │   └── dashboard.js        # агрегати для дашборду
│   ├── ml/
│   │   ├── client.js           # HTTP-клієнт до FastAPI
│   │   └── scheduler.js        # періодичний виклик ML
│   ├── lib/
│   │   ├── logger.js
│   │   └── schemas/            # JSON Schema для валідації
│   └── plugins/
│       ├── error_handler.js
│       └── cors.js
├── test/
│   ├── routes/
│   └── fixtures/
├── package.json
└── .env.example
```

### 5.2 REST API: повний контракт

Усі ендпоінти повертають JSON. Префікс — `/api/v1`. Помилки — RFC 7807 (Problem Details).

#### 5.2.1 Models

```
GET    /api/v1/models                # список моделей
GET    /api/v1/models/:id            # деталі моделі з паспортом
POST   /api/v1/models                # створити модель (з паспортом)
PUT    /api/v1/models/:id            # оновити паспорт
DELETE /api/v1/models/:id            # видалити (тільки якщо немає одиниць)
```

`POST /models` тіло запиту:
```json
{
  "passport": { /* див. 2.3 */ }
}
```

Валідація паспорта робиться через JSON Schema (повна схема — додаток B).

#### 5.2.2 Units

```
GET    /api/v1/units                                # список з фільтрами ?model_id, ?status, ?q
GET    /api/v1/units/:id                            # деталі одиниці + поточний health_state
POST   /api/v1/units                                # створити
PUT    /api/v1/units/:id                            # оновити (location, notes, is_active)
DELETE /api/v1/units/:id                            # деактивувати (soft delete: is_active=0)
GET    /api/v1/units/:id/telemetry                  # ?channel=&from=&to=&limit=
GET    /api/v1/units/:id/forecast                   # поточний прогноз
GET    /api/v1/units/:id/events                     # події одиниці
```

`POST /units`:
```json
{
  "model_id": 1,
  "serial_no": "SRV-001",
  "location": "ДЦ-1, стійка А3",
  "commissioned_at": "2023-06-15"
}
```

Відповідь `GET /units/:id`:
```json
{
  "id": 1,
  "model": { "id": 1, "model_code": "SRV-R740-2U", "display_name": "..." },
  "serial_no": "SRV-001",
  "location": "ДЦ-1, стійка А3",
  "commissioned_at": "2023-06-15",
  "hours_run": 14523.5,
  "is_active": true,
  "health": {
    "status": "risk",
    "anomaly_score": 0.67,
    "predicted_mode": "fan_bearing_wear",
    "predicted_mode_conf": 0.82,
    "rul_hours": 168.4,
    "rul_lower_hours": 96.0,
    "rul_upper_hours": 240.0,
    "last_updated": "2026-05-18T12:34:56Z"
  }
}
```

#### 5.2.3 Telemetry ingest

```
POST /api/v1/ingest
```

Тіло — batch:
```json
{
  "points": [
    { "unit_id": 1, "channel_code": "cpu_temp_pkg", "ts": "2026-05-18T12:34:56Z", "value": 67.2 },
    { "unit_id": 1, "channel_code": "fan_rpm_front", "ts": "2026-05-18T12:34:56Z", "value": 5200 }
  ]
}
```

Обмеження: до 5 000 точок у запиті. Вставка одною транзакцією через `db.prepare(...).run()` у циклі — better-sqlite3 у `transaction()`-обгортці. На демо-обсязі це дає ~50–80 тис insertions/sec, надмірно з запасом.

Валідація: значення в межах physical range каналу — інакше точка маркується `quality=0`, але приймається (важливо: ML повинен бачити "погані" значення для деяких аномалій).

#### 5.2.4 Forecast / Dashboard

```
GET /api/v1/forecast/summary               # для дашборду: counts by status, top-risk units
GET /api/v1/forecast/units/:id             # детальний прогноз одиниці
POST /api/v1/forecast/refresh              # ручний запуск переоцінки (адмін)
```

#### 5.2.5 Events

```
GET    /api/v1/events                       # ?unit_id=&severity=&from=&to=&limit=&offset=
POST   /api/v1/events                       # ручний запис (для маркування ТО)
GET    /api/v1/events/export.csv            # експорт
```

### 5.3 Логіка статусів (state detection)

Статус одиниці визначається з anomaly_score (0–1) і RUL. Тришкальна класифікація з гістерезисом (щоб уникнути брязкоту):

```
status = OK         if anomaly_score < 0.3 AND rul_hours > 168 (>7 днів)
status = RISK       if 0.3 ≤ anomaly_score < 0.7 OR 72 < rul_hours ≤ 168
status = IMMINENT   if anomaly_score ≥ 0.7 OR rul_hours ≤ 72 (≤3 дні)
```

Гістерезис: для переходу зі стану в "гірший бік" пороги застосовуються прямо. Для зворотного переходу (поліпшення) поріг має бути нижчий на 0.1 за anomaly_score. Це фіксує статус після події і не дає йому стрибати при шумі.

Тривалість стану RISK без вирішення довше 48 годин → автоматично IMMINENT (припущення про прогресуючу деградацію).

### 5.4 Планувальник переоцінки

В межах процесу бекенду — `setInterval` (для простоти). У продукції тут стояв би BullMQ або щонайменше cron, але для демо досить.

```
кожні 5 хвилин:
  для кожної активної одиниці:
    1. вибрати останні 360 точок (60 хв при 10-сек крокові) по всіх каналах
    2. сформувати feature vector (див. 6.2)
    3. POST до ML-сервісу /predict
    4. отримати: anomaly_score, predicted_mode, predicted_mode_conf, rul_hours, ci
    5. UPDATE health_state
    6. якщо статус змінився — INSERT у event_log
```

Якщо ML-сервіс недоступний — переоцінка пропускається, у лог пишеться warning, статус не змінюється. Це коректна деградація.

### 5.5 Обробка помилок

Глобальний errorHandler у Fastify, що віддає RFC 7807:
```json
{
  "type": "/errors/validation-failed",
  "title": "Validation failed",
  "status": 400,
  "detail": "field 'serial_no' must be unique",
  "errors": [ ... ]
}
```

---

## 6. ML-сервіс (FastAPI / Python)

### 6.1 Призначення і область

ML-сервіс відповідає за **HA (Health Assessment) + PA (Prognostic Assessment)** з ISO 13374. Він не зберігає стан між запитами, не має доступу до БД, не приймає рішень про статус. Це чистий синхронний обчислювальний сервіс.

Вхід: feature vector + паспорт обладнання.
Вихід: anomaly_score, predicted_mode (+conf), rul_hours (+ довірчий інтервал).

### 6.2 Інженерія ознак

З 360 точок (60 хв) по кожному каналу будуються такі ознаки:

**Статистичні (для всіх класів каналів):**
- mean, std, min, max, median
- skewness, kurtosis
- останнє значення (для миттєвих відхилень)
- швидкість зміни (наклон лінійної регресії за вікно)

**Контекстні (відносно паспорта):**
- normalized_deviation = (mean − nominal) / (operating_range_high − operating_range_low)
- distance_to_critical = (critical_low − value) / (nominal − critical_low) — нижня межа
- time_above_operating = частка точок поза робочим діапазоном

**Спектральні (для V-каналів):**
- спектральна щільність у трьох смугах (FFT, потім інтеграл по смузі)
- частота максимуму спектра

**Кросс-канальні (для каналів однієї одиниці):**
- кореляція пар (T,V), (T,F), (E,F) — для виявлення розривів кореляції, характерних для деградації

Усього — близько 8–15 ознак на канал, ~120–200 ознак на одиницю. Це нормальний обсяг для tabular ML.

### 6.3 Архітектура моделі

Дві окремі моделі, обидві з scikit-learn:

**Модель A — детектор аномалій + класифікатор режиму**

Каскад:
1. `IsolationForest` на нормованих ознаках → anomaly_score ∈ [0, 1].
2. Якщо anomaly_score > 0.3 — `RandomForestClassifier` обирає найбільш імовірний failure_mode з переліку для даної моделі обладнання.

Класифікатор тренується **окремо для кожної моделі обладнання** (бо набір режимів різний). Метадані прив'язки model_id → шлях до .pkl зберігаються в `ml_model_versions`.

**Модель B — регресор RUL**

`GradientBoostingRegressor` з квантильною лоссою:
- основна модель — на median (q=0.5) → центральний прогноз rul_hours;
- модель нижньої межі — на q=0.1 → rul_lower_hours;
- модель верхньої межі — на q=0.9 → rul_upper_hours.

Це дає чесний довірчий інтервал без припущень про нормальність помилок, що важливо: RUL-розподіли в predictive maintenance скошені.

**Чому Random Forest / Gradient Boosting, а не нейромережі:**
- Tabular-дані з ~200 ознаками — на цьому tabular ML стабільно б'є нейромережі.
- Інтерпретованість: feature_importances_ показує, які канали найбільше впливають на прогноз — на захисті це питання обов'язкове.
- Швидке навчання (хвилини), компактні моделі (<10 МБ), нема GPU.
- Не вимагає TensorFlow/PyTorch — менше залежностей.

### 6.4 Дані для тренування

Тренувальний датасет генерує **той самий симулятор**, що працює в продакшені, але в режимі offline-генерації. Це означає:

1. Запустити симулятор з прискореним часом (1 година реального часу = 100 годин модельного) на ~6 місяців модельного часу.
2. Записати в parquet-файл усю телеметрію + ground truth (true_health, active_mode, rul_true_hours).
3. Розбити на навчальну/валідаційну (80/20 за одиницями, не за часом).
4. Тренувати моделі.

Це дає кілька мільйонів точок та сотні приклади відмов — достатньо для tabular ML.

Скрипт тренування — `ml/training/train.py`. Він зберігає моделі в `ml/models/<model_code>/{anomaly.pkl, classifier.pkl, rul_q05.pkl, rul_q5.pkl, rul_q95.pkl}` та метрики в `metrics.json`.

### 6.5 Очікувані метрики

На синтетичних даних з відомою правдою досягаються (приблизні цільові значення для звіту):
- Anomaly detection AUC ROC: ≥ 0.92
- Mode classification balanced accuracy: ≥ 0.78
- RUL MAE на горизонті 7 днів: ≤ 12 годин
- RUL MAPE на горизонті 7 днів: ≤ 15%

Це реалістичні цифри для tabular ML на достатньо багатих синтетичних даних. У звіті важливо чесно показати ROC-криву, confusion matrix, scatter plot RUL true vs predicted з 90%-CI.

### 6.6 REST API ML-сервісу

```
POST /predict
GET  /healthz
GET  /version
```

`POST /predict`:
```json
{
  "model_code": "SRV-R740-2U",
  "features": { "cpu_temp_pkg__mean": 67.3, "cpu_temp_pkg__std": 1.2, ... },
  "passport_hash": "sha256:..."
}
```

Відповідь:
```json
{
  "anomaly_score": 0.67,
  "predicted_mode": "fan_bearing_wear",
  "predicted_mode_conf": 0.82,
  "rul_hours": 168.4,
  "rul_lower_hours": 96.0,
  "rul_upper_hours": 240.0,
  "model_version": "v1.0.0",
  "explanation": {
    "top_features": [
      { "name": "fan_rpm_front__std", "contribution": 0.31 },
      { "name": "cpu_temp_pkg__slope", "contribution": 0.18 }
    ]
  }
}
```

`top_features` — top-5 по feature importance, що внесли найбільший вклад. Це джерело для текстового пояснення на дашборді ("Підозра на знос підшипника вентилятора: різке зростання варіації обертів і повільне зростання температури CPU").

### 6.7 Структура ML-сервісу

```
ml_service/
├── app/
│   ├── main.py                 # FastAPI, ендпоінти
│   ├── config.py
│   ├── schemas.py              # pydantic-моделі запит/відповідь
│   ├── inference.py            # завантаження .pkl, передбачення
│   ├── features.py             # будівник feature vector
│   └── registry.py             # реєстр моделей по model_code
├── training/
│   ├── generate_dataset.py     # запуск симулятора в offline-режимі
│   ├── train.py                # тренування моделей
│   ├── evaluate.py             # розрахунок метрик
│   └── visualize.py            # графіки для звіту
├── models/                     # збережені .pkl
├── tests/
├── requirements.txt
└── Dockerfile
```

---

## 7. Симулятор телеметрії

### 7.1 Призначення

Симулятор виконує функції **DA (Data Acquisition)** з ISO 13374, але замість реального обладнання — фізично-осмислена синтезова модель. Він відіграє дві ролі:

1. **Постачальник телеметрії у real-time** — окремий процес, що тікає кожні 10 секунд і пушить пачку точок у `/ingest`.
2. **Генератор навчального датасету** — той самий код, запущений з прискореним часом і прямим записом у parquet, без участі бекенду.

### 7.2 Модель деградації одиниці

Кожна одиниця обладнання у симуляторі має внутрішній стан:

```python
class UnitSimState:
    health: float            # [0, 1], 1 = ідеал, 0 = відмова
    active_mode: str | None  # код активного режиму деградації
    mode_progress: float     # [0, 1], 0 = тільки почалось, 1 = відмова
    age_hours: float         # вік одиниці
    nominal_load: float      # поточний рівень навантаження (0.5-1.2)
```

**Випадковий час до відмови:** при ініціалізації одиниці семплюється з Вейбулла:
```
TTF = weibull(eta, beta).sample()
```
де eta, beta з паспорта. Це формує "генетично закладений" вік відмови, який різний для кожної одиниці.

**Старт режиму деградації:** при age_hours наближається до TTF (наприклад, при age > 0.7 × TTF), з ймовірністю p_per_step стартує один з режимів зі списку failure_modes. Який саме — випадково з вагами (можна задавати у паспорті, за замовчуванням рівно).

**Прогрес деградації:** після старту mode_progress зростає з кроком, що залежить від `typical_horizon_hours` з паспорта. Тобто якщо typical_horizon = 72 год, то за 72 модельних години progress пройде 0 → 1.

**health:** монотонно зменшується відповідно до mode_progress + базова повільна деградація через age.

### 7.3 Модель сигналу для каналу

Значення каналу в момент t:

```
value(t) = nominal
         + load_modulation(t)            # добова/нагрузочна синусоїда
         + degradation_effect(t)          # ефект активного режиму
         + thermal_inertia_smoothing      # LP-фільтр з inertia_seconds
         + noise                          # gaussian(0, noise_sigma)
         + occasional_outlier             # рідкісні викиди (p=0.001)
```

**degradation_effect** — характеристика, що відрізняє один режим від іншого. Прописана у симуляторі для кожного режиму як **сигнатура**, наприклад:

`thermal_runaway` (сервер):
- `cpu_temp_pkg`: лінійне зростання середнього + експоненційне зростання варіації;
- `fan_rpm_front`: компенсаторне зростання (контролер ОС намагається охолодити), потім насичення на максимумі;
- після насичення вентилятора температура починає рости експоненційно.

`fan_bearing_wear` (сервер):
- `fan_rpm_front`: різке зростання std, поява низькочастотної модуляції;
- кореляція з шумом, який у V-каналі (якщо є);
- температура CPU повільно росте через нерівний потік повітря.

`bearing_wear` (насос):
- `vibration_x`, `vibration_y`: зростання RMS, поява характерної частоти у спектрі (BPFO/BPFI);
- `bearing_temp_de`: повільне зростання середнього;
- зміна кореляції з обертами.

`cavitation` (насос):
- `pressure_discharge`: збільшення std (флуктуації), періодичні провали;
- `vibration_*`: широкосмуговий шум;
- `current`: нестабільність.

`vacuum_breach` (кріоустановка):
- `dewar_pressure`: поступове зростання;
- `boil_off_rate`: зростання;
- `compressor_current`: зростання — компресор активніше реконденсує.

`field_decoherence` (анігілятор, видумане):
- `containment_field_strength`: зменшення з осциляціями;
- `tachyon_emission_rate`: зростання;
- це повністю синтетична сигнатура, що демонструє: моделі однаково тренуються на чомусь реальному і чомусь видуманому, бо вони бачать лише чисельні шаблони.

### 7.4 Структура симулятора

```
simulator/
├── src/
│   ├── index.js               # точка входу real-time режиму
│   ├── offline.js             # точка входу offline-генерації
│   ├── config.js
│   ├── unit_state.js          # клас стану одиниці
│   ├── channel_model.js       # генерація значення каналу
│   ├── degradation/
│   │   ├── thermal_runaway.js
│   │   ├── fan_bearing_wear.js
│   │   ├── ssd_endurance.js
│   │   ├── psu_degradation.js
│   │   ├── bearing_wear.js     # насос
│   │   ├── rotor_imbalance.js
│   │   ├── cavitation.js
│   │   ├── winding_short.js
│   │   ├── vacuum_breach.js    # кріо
│   │   ├── compressor_wear.js
│   │   ├── filter_clog.js
│   │   ├── field_decoherence.js  # анігілятор
│   │   ├── tachyon_overflow.js
│   │   └── containment_drift.js
│   ├── weibull.js
│   ├── filters.js              # LP, FFT
│   └── ingest_client.js        # HTTP до бекенду
└── package.json
```

### 7.5 Контрольні елементи

Симулятор підтримує REST-команди (для зручності демонстрації):

```
POST /sim/inject_fault     {unit_id, mode_code, horizon_hours}
POST /sim/reset_unit       {unit_id}
GET  /sim/state            # повний стан симулятора
POST /sim/pause
POST /sim/resume
POST /sim/speed            {factor: 1.0 | 10.0 | 100.0}
```

`inject_fault` — це **ключова кнопка для демо**. Натискаєш — і за 2-3 хвилини демонстрації на дашборді видно: статус OK → RISK, далі IMMINENT, з підсвічуванням каналу, що дав сигнал, і прогнозом часу до відмови. Без цього демо буде нудне ("давайте чекати 3 дні модельного часу").

---

## 8. Фронтенд (Vue 3)

### 8.1 Структура

```
frontend/
├── src/
│   ├── main.js                # ініціалізація Vue, PrimeVue, роутера
│   ├── App.vue
│   ├── router/
│   │   └── index.js
│   ├── stores/                # Pinia
│   │   ├── auth.js
│   │   ├── units.js
│   │   ├── models.js
│   │   └── notifications.js
│   ├── api/
│   │   ├── client.js          # axios instance
│   │   ├── units.js
│   │   ├── models.js
│   │   ├── telemetry.js
│   │   ├── forecast.js
│   │   └── events.js
│   ├── views/
│   │   ├── DashboardView.vue
│   │   ├── UnitsListView.vue
│   │   ├── UnitDetailView.vue
│   │   ├── ModelsListView.vue
│   │   ├── ModelEditorView.vue
│   │   ├── EventsView.vue
│   │   └── SettingsView.vue
│   ├── components/
│   │   ├── StatusBadge.vue
│   │   ├── TelemetryChart.vue
│   │   ├── HealthGauge.vue
│   │   ├── RulIndicator.vue
│   │   ├── ChannelCard.vue
│   │   ├── FailureModeExplain.vue
│   │   └── PassportEditor.vue
│   └── assets/
└── index.html
```

### 8.2 Ключові екрани

**Dashboard (головна)**

Зліва — лічильники: загальна кількість одиниць, з них OK / Risk / Imminent (великі цифри, кольорові). Знизу — список топ-5 одиниць за ризиком, сортовані за зростанням RUL. Праворуч — комбінований графік: за останні 24 години агреговано — скільки одиниць було в кожному статусі по часу (stacked area chart). Це і є "графік" з ТЗ п.7.

**UnitsList**

Таблиця всіх одиниць з фільтрами (модель, статус, локація, пошук за серійником). Колонки: Serial, Model, Location, Status (бейдж), RUL (з кольоровим індикатором), Predicted Mode, Last Update. Клік по рядку → UnitDetail.

**UnitDetail (найбагатший екран)**

Шапка: серійник, модель, локація, наработка, дата введення в експлуатацію, статус-бейдж великий.

Блок Health: gauge-індикатор anomaly_score (0–1 з кольоровою шкалою), RUL з довірчим інтервалом (текстом + горизонтальна шкала), predicted_mode з впевненістю.

Блок Explanation: текстове пояснення, top-3 канали-винуватці.

Блок Channels: сітка карток по кожному каналу. На картці — назва, поточне значення, мінінспаркliner за останню годину, кольорова рамка (зелена якщо в operating, жовта якщо за межами, червона якщо в critical).

Блок Telemetry chart: ECharts з вибором каналів (multiselect), часовим вікном (1h / 6h / 24h / 7d), overlay на критичні пороги горизонтальними лініями. Для V-каналів — кнопка "FFT" що показує спектр у модалці.

Блок Events: таблиця подій по одиниці.

Блок Actions: кнопки "Зафіксувати ТО" (записати подію maintenance, скинути ground_truth, скинути ML-стан), "Деактивувати".

**ModelEditor**

JSON-редактор паспорта зі схемою (можна на Monaco або просто textarea + кнопка "Валідувати"). Праворуч — попередній перегляд: список каналів з типами і діапазонами, список режимів відмови.

**Events**

Журнал. Фільтри: одиниця, тип події, severity, період. Експорт CSV. Сторінкова навігація.

### 8.3 UX-нюанси

- **Кольорова палітра статусів:** OK — зелений (#16a34a), Risk — янтарний (#f59e0b), Imminent — червоний (#dc2626). Не використовуються виключно кольори: статус-бейдж завжди має текстовий лейбл (доступність).
- **Real-time оновлення:** на UnitDetail дані телеметрії та health_state підтягуються polling-ом раз/15с. SSE або WebSocket — overkill для демо.
- **Локалізація:** інтерфейс українською, всередині коду — англійською (коди, типи).

---

## 9. Безпека (мінімально достатня)

Це навчальний проєкт, але кілька базових речей мають бути:

- Внутрішня аутентифікація: токен у заголовку для адмін-операцій (CRUD моделей, видалення одиниць, виклик `/sim/*`). Простий API key з .env, без OAuth.
- Прийом телеметрії на `/ingest` — за окремим симетричним токеном з .env (бо в реалі його мав би мати кожен пристрій).
- CORS: дозволити тільки фронтенд-origin.
- Rate limit на `/ingest` (наприклад, через `@fastify/rate-limit`): захист від випадкового flood.
- Параметризовані запити в SQL (better-sqlite3 prepared statements) — SQL-ін'єкції виключені за конструкцією.

Бекенд не приймає сирий SQL ззовні, не виконує eval, не приймає файли — поверхня атаки мінімальна.

---

## 10. Тестування

### 10.1 Бекенд

- Unit-тести валідації паспортів (vitest).
- Інтеграційні тести роутів через `fastify.inject()`: CRUD моделей і одиниць, ingest, forecast.
- Тест переходів статусів (state_rules) — табличні тести на всі ділянки порогів та гістерезис.

### 10.2 ML

- pytest на features.py — детерміновано перевірити, що ознаки рахуються правильно на синтетичних вікнах.
- Тест регресії метрик: при перенавчанні нові метрики не гірші за baseline більш ніж на 2%.

### 10.3 E2E

Один сценарій з Playwright (опційно — якщо буде час): відкрити дашборд → перейти у юніт → побачити графік. Решта — ручне тестування.

---

## 11. Структура репозиторію та план комітів

### 11.1 Корнева структура

```
cass/
├── backend/
├── ml_service/
├── simulator/
├── frontend/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── PASSPORTS.md
│   └── ML_TRAINING.md
├── scripts/
│   ├── start_all.sh
│   ├── reset_db.sh
│   └── seed_demo.sh
├── docker-compose.yml         # для запуску одною командою
├── README.md
└── .gitignore
```

### 11.2 План git-комітів

Чітка історія розробки — обов'язкова за ТЗ. Нижче — 24 коміти, кожен — окрема обмежена зміна. Імплементатор повинен пушити по одному коміту після завершення відповідного етапу.

```
01. chore: initial project structure (backend/ml/simulator/frontend stubs, .gitignore, README)
02. feat(backend): fastify skeleton, config, pino logging, healthcheck route
03. feat(backend): SQLite setup with better-sqlite3, WAL mode, migrations runner
04. feat(backend): initial schema (equipment_models, equipment_units, telemetry)
05. feat(backend): passport JSON schema and validator
06. feat(backend): CRUD routes for equipment_models
07. feat(backend): CRUD routes for equipment_units
08. feat(backend): telemetry ingest endpoint with batch inserts and validation
09. feat(backend): events table, event_log routes, status_rules with hysteresis
10. feat(backend): health_state table, ML client stub, scheduler skeleton
11. feat(simulator): unit state, Weibull TTF, base channel model with noise/inertia
12. feat(simulator): degradation modes for SRV-R740-2U (4 modes)
13. feat(simulator): degradation modes for PMP-CF250 (4 modes)
14. feat(simulator): degradation modes for CRY-LN2-15K (3 modes)
15. feat(simulator): degradation modes for QA-7000 (3 modes), control REST endpoints
16. feat(ml): FastAPI skeleton, schemas, feature extractor
17. feat(ml): offline dataset generator using simulator in fast-forward mode
18. feat(ml): training pipeline (IsolationForest + RandomForest + GBM quantile)
19. feat(ml): inference endpoint, model registry, explanation feature
20. feat(backend): integrate ML scheduler — periodic reassessment, status transitions
21. feat(frontend): Vue 3 + Vite skeleton, PrimeVue setup, routing, axios client
22. feat(frontend): Dashboard, UnitsList, UnitDetail views with ECharts
23. feat(frontend): ModelEditor, Events, polling for real-time updates
24. docs: ARCHITECTURE.md, API.md, PASSPORTS.md, ML_TRAINING.md, README with run instructions
```

24 коміти — це не "20 commits per day", а нормальний темп: один зрозумілий крок розробки.
Кожен коміт має повідомлення у форматі Conventional Commits, кожен — компілюється і не ламає попередній.

### 11.3 Запуск

`docker-compose up` піднімає 4 сервіси:
- `backend` (порт 3000),
- `ml_service` (порт 8000, внутрішній),
- `simulator` (без зовнішнього порту),
- `frontend` (порт 5173, dev-сервер Vite).

`scripts/seed_demo.sh` — створює моделі і одиниці, запускає симулятор, чекає 30 секунд, поки накопичиться телеметрія. Після цього демо готове.

---

## 12. Сценарій захисту

Це не частина системи, а пам'ятка для оператора (тебе) на захисті. Три демо-блоки по 2-3 хв кожен:

**Блок 1: Огляд і CRUD (2 хв)**
1. Відкрити Дашборд: бачимо парк, статуси, графік за добу.
2. Перейти в Models, показати паспорт QA-7000: "Зверніть увагу — це гіпотетичний пристрій, у природі не існує. Система не знає і знати не може його фізику. Для неї це просто набір каналів."
3. Зайти в UnitDetail однієї одиниці: показати дашборд здоров'я, графіки.

**Блок 2: Прогнозування в дії (4 хв) — головна сцена**
1. Відкрити UnitDetail сервера в статусі OK.
2. У другій вкладці (або через REST-клієнт) — `POST /sim/inject_fault {unit_id, mode: 'fan_bearing_wear', horizon: 1}` з прискореним часом.
3. На очах комісії за ~3 хвилини реального часу:
   - спочатку anomaly_score починає повзти вгору,
   - статус OK → RISK,
   - на дашборді з'являється текст "Підозра: знос підшипника вентилятора, RUL ≈ 0.8 год (CI: 0.5 – 1.2 год)",
   - top-features показують, що "винуватці" — std обертів і повільне зростання температури,
   - графік показує характеристичну криву.
4. Підкреслити: "Система не була запрограмована конкретно на ці значення. Вона навчена на синтезових прикладах загальних режимів деградації. Знос підшипника проявляється у вібрації — для вентилятора, для електродвигуна, для турбіни криогенної установки однаково."

**Блок 3: Агностичність (2 хв)**
1. Те саме — але з квантовим анігілятором. Запустити `field_decoherence`.
2. Показати, що алгоритм відпрацьовує однаково: anomaly_score, predicted_mode, RUL, top-features. Жодних спецкодів під QA-7000 у системі немає.
3. Підсумок: "Платформа агностична. Додавання нового типу обладнання — це додавання паспорта в БД і нічого більше."

Питання, до яких бути готовим:
- Чому Random Forest а не нейромережа? → Tabular, інтерпретованість, малий обсяг навчальних даних, вимоги до prod-простоти.
- Як уникнути false positives? → Гістерезис у status_rules + довірчий інтервал RUL + людська підтвердження маркуванням ТО.
- А якщо реальні дані не такі красиві, як синтезові? → Базова архітектура витримує. Для production треба domain adaptation і донавчання на реальних даних з конкретного парку.
- Чому SQLite, а не TimescaleDB? → Обсяги демо-стенду витримує. Для промислового впровадження — TimescaleDB або InfluxDB, міграція тривіальна, бо доменна модель не міняється.

---

## Додаток A. Перелік каналів і режимів відмови по моделях

### A.1 SRV-R740-2U (Серверна стійка)

Канали (15):
- `cpu_temp_pkg` (T, °C, nominal 55, op 30–75, crit 85–105)
- `cpu_temp_core_avg` (T, °C, nominal 58, op 35–80, crit 90–110)
- `cpu_load_pct` (F, %, nominal 35, op 0–95, crit 98–100)
- `ram_usage_pct` (F, %, nominal 50, op 0–90, crit 95–100)
- `ram_ecc_errors_rate` (Q, errors/min, nominal 0, op 0–2, crit 10–∞)
- `ssd_wear_pct` (R, %, nominal 0, op 0–80, crit 95–100, монотонна)
- `ssd_temp` (T, °C, nominal 40, op 25–60, crit 70–85)
- `fan_rpm_front` (F, rpm, nominal 4500, op 2000–7000, crit 0–1500)
- `fan_rpm_rear` (F, rpm, nominal 4000, op 2000–7000, crit 0–1500)
- `psu_voltage_12v` (E, V, nominal 12.0, op 11.4–12.6, crit <11.0 / >13.0)
- `psu_current` (E, A, nominal 25, op 10–50, crit >60)
- `network_rx_errors_rate` (Q, errors/s, nominal 0, op 0–5, crit >50)
- `disk_io_latency_p99` (Q, ms, nominal 5, op 0–20, crit >100)
- `uptime_hours` (R, h, монотонна)
- `gpu_temp` (T, °C, nominal 60, op 40–85, crit 95–105)

Режими (4):
- `thermal_runaway` (typ_horizon 72 год)
- `fan_bearing_wear` (typ_horizon 240 год)
- `ssd_endurance_exhaustion` (typ_horizon 720 год)
- `psu_degradation` (typ_horizon 168 год)

### A.2 PMP-CF250 (Відцентровий насос)

Канали (11):
- `vibration_x_rms` (V, mm/s, nominal 2.5, op 0–7, crit >11.2)
- `vibration_y_rms` (V, mm/s, nominal 2.5, op 0–7, crit >11.2)
- `vibration_z_rms` (V, mm/s, nominal 1.5, op 0–4.5, crit >7)
- `bearing_temp_de` (T, °C, nominal 50, op 25–85, crit >95)
- `bearing_temp_nde` (T, °C, nominal 48, op 25–85, crit >95)
- `winding_current` (E, A, nominal 18, op 10–25, crit >32)
- `winding_temp` (T, °C, nominal 70, op 40–110, crit >130)
- `pressure_discharge` (F, bar, nominal 6.0, op 4–8, crit <2 / >10)
- `flow_rate` (F, m³/h, nominal 250, op 150–320, crit <100 / >380)
- `rpm` (F, rpm, nominal 2960, op 2900–3020, crit ±100)
- `runtime_hours` (R, h, монотонна)

Режими (4):
- `bearing_wear` (typ_horizon 360 год)
- `rotor_imbalance` (typ_horizon 168 год)
- `cavitation` (typ_horizon 48 год — швидкий)
- `winding_short` (typ_horizon 24 год — дуже швидкий, critical)

### A.3 CRY-LN2-15K (Криогенна установка)

Канали (10):
- `dewar_pressure` (F, bar, nominal 1.1, op 0.9–1.5, crit >2.0)
- `cold_head_temp` (T, K, nominal 4.2, op 4.0–10, crit >20)
- `compressor_current` (E, A, nominal 14, op 10–20, crit >25)
- `compressor_oil_temp` (T, °C, nominal 55, op 30–80, crit >95)
- `ln2_level_pct` (F, %, nominal 70, op 30–95, crit <10)
- `boil_off_rate` (F, l/h, nominal 0.5, op 0.2–1.0, crit >3.0)
- `vacuum_pressure` (E, Pa, nominal 1e-4, op 1e-5 – 1e-3, crit >1e-2 — логарифмічна шкала)
- `condense_cycles_per_hour` (F, count, nominal 0.5, op 0–2, crit >5)
- `runtime_hours` (R, h, монотонна)
- `defrost_count` (R, count, монотонна)

Режими (3):
- `vacuum_breach` (typ_horizon 144 год)
- `compressor_wear` (typ_horizon 480 год)
- `filter_clog` (typ_horizon 96 год)

### A.4 QA-7000 (Квантовий анігілятор)

Канали (9, повністю вигадані):
- `quantum_flux_pressure` (T-клас за динамікою, "qfp", nominal 42.0, op 38–47, crit >52)
- `containment_field_strength` (E, kG, nominal 12.5, op 11.0–14.0, crit <9.0)
- `tachyon_emission_rate` (Q, count/s, nominal 0, op 0–3, crit >15)
- `vacuum_chamber_integrity` (F, %, nominal 99.5, op 98–100, crit <95)
- `entanglement_coherence` (Q, %, nominal 87, op 80–95, crit <70)
- `annihilation_cycle_count` (R, count, монотонна)
- `dimensional_resonance_freq` (V, Hz, nominal 2.4e6, op ±5%, crit ±15%)
- `core_temp_kelvin` (T, K, nominal 0.05, op 0.02–0.1, crit >0.5)
- `total_runtime_hours` (R, h, монотонна)

Режими (3):
- `field_decoherence` (typ_horizon 120 год)
- `tachyon_overflow` (typ_horizon 48 год)
- `containment_drift` (typ_horizon 240 год)

На захисті це найкорисніший пункт списку: видно, що канали повністю synthetic, але система працює з ними однаково.

---

## Додаток B. JSON Schema паспорта

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["model_code", "display_name", "category", "weibull_eta_hours", "weibull_beta", "channels", "failure_modes"],
  "properties": {
    "model_code": { "type": "string", "pattern": "^[A-Z][A-Z0-9-]{2,15}$" },
    "display_name": { "type": "string", "minLength": 3, "maxLength": 120 },
    "category": { "type": "string", "enum": ["compute", "rotary", "cryo", "experimental", "other"] },
    "weibull_eta_hours": { "type": "number", "exclusiveMinimum": 0 },
    "weibull_beta": { "type": "number", "exclusiveMinimum": 0 },
    "channels": {
      "type": "array",
      "minItems": 1,
      "maxItems": 50,
      "items": {
        "type": "object",
        "required": ["code", "class", "unit", "nominal", "operating_range", "critical_range", "inertia_seconds", "noise_sigma"],
        "properties": {
          "code": { "type": "string", "pattern": "^[a-z][a-z0-9_]{1,40}$" },
          "class": { "type": "string", "enum": ["T", "V", "E", "F", "R", "Q"] },
          "unit": { "type": "string", "maxLength": 16 },
          "nominal": { "type": "number" },
          "operating_range": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 2,
            "maxItems": 2
          },
          "critical_range": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 2,
            "maxItems": 2
          },
          "inertia_seconds": { "type": "number", "minimum": 0 },
          "noise_sigma": { "type": "number", "minimum": 0 }
        }
      }
    },
    "failure_modes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["code", "name", "affected_channels", "typical_horizon_hours"],
        "properties": {
          "code": { "type": "string", "pattern": "^[a-z][a-z0-9_]{1,40}$" },
          "name": { "type": "string" },
          "affected_channels": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1
          },
          "signature": { "type": "string" },
          "typical_horizon_hours": { "type": "number", "exclusiveMinimum": 0 },
          "weight": { "type": "number", "minimum": 0 }
        }
      }
    }
  }
}
```

---

## Додаток C. Конфіги (.env приклади)

`backend/.env.example`:
```
PORT=3000
DB_PATH=./data/cass.db
ML_SERVICE_URL=http://localhost:8000
ADMIN_API_KEY=change_me_admin
INGEST_API_KEY=change_me_ingest
CORS_ORIGIN=http://localhost:5173
REASSESSMENT_INTERVAL_MS=300000
TELEMETRY_RETENTION_DAYS=14
```

`ml_service/.env.example`:
```
PORT=8000
MODELS_DIR=./models
LOG_LEVEL=info
```

`simulator/.env.example`:
```
BACKEND_URL=http://localhost:3000
INGEST_API_KEY=change_me_ingest
TICK_INTERVAL_SECONDS=10
TIME_SPEED_FACTOR=1.0
SEED=42
```

---

## Підсумок

CASS — це не "ще одна CRUD-обгортка з графіками". Це **agnostic-платформа** з трьома незалежними сервісами, фізично-осмисленим симулятором, що породжує і real-time, і тренувальні дані, і двоступеневою ML-моделлю (детекція + прогноз RUL з довірчими інтервалами).

Захист стоїть на трьох опорах:
1. **ISO 13374 / 17359** як теоретична рамка.
2. **Agnostic-архітектура з паспортами** як інженерне рішення.
3. **Демонстрація на 4 типах обладнання, у тому числі гіпотетичному** як емпіричний доказ агностичності.

Жодних "заглушок", жодних "magic happens here". Кожен компонент має чітку відповідальність, чіткий контракт, реалізовний обсяг роботи.
