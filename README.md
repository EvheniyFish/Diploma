# CASS — Condition-based Anomaly & Signature System

Платформа прогностичного технічного обслуговування обладнання на основі аналізу телеметрії та машинного навчання.

## Про проект

CASS реалізує концепцію **Condition-Based Maintenance (CBM)** відповідно до стандартів ISO 13374 та ISO 17359. Система не прив'язана до конкретного типу обладнання — будь-який пристрій описується декларативним JSON-паспортом із каналами сигналів, пороговими значеннями та режимами відмов.

### Ключові можливості

- **Моніторинг в реальному часі** — прийом телеметрії з будь-якого обладнання
- **Виявлення аномалій** — IsolationForest на ~200 ознаках сигналу
- **Класифікація режиму відмови** — RandomForest (14 режимів для 4 типів обладнання)
- **Прогноз залишкового ресурсу (RUL)** — GradientBoosting з довірчим інтервалом 90%
- **Обладнання-агностична архітектура** — сервер, насос, кріогенна установка, будь-що

## Стек технологій

| Компонент | Технологія |
|-----------|-----------|
| REST API | Node.js 20, Fastify 4, SQLite (WAL) |
| ML Service | Python 3.11, FastAPI, scikit-learn |
| Simulator | Node.js 20 (14 режимів деградації) |
| Frontend | Vue 3, Vite 5, PrimeVue 4, Apache ECharts |

## Архітектура

```
Frontend (Vue 3) :5173
        │
        ▼
Fastify API :3000 ──── SQLite
        │
        ▼
FastAPI ML :8000

Node.js Simulator → POST /api/v1/ingest (кожні 10 с)
```

## Швидкий старт

```bash
# Клонувати репозиторій
git clone https://github.com/EvheniyFish/CASS.git
cd CASS

# Запустити всі сервіси
docker-compose up

# Або вручну (4 термінали):
cd backend  && npm install && npm run dev   # :3000
cd ml_service && pip install -r requirements.txt && uvicorn app.main:app --reload  # :8000
cd simulator  && npm install && npm start
cd frontend   && npm install && npm run dev  # :5173
```

Після запуску: засіяти демо-дані:
```bash
./scripts/seed_demo.sh
```

Відкрити браузер: [http://localhost:5173](http://localhost:5173)

## Статус проекту

Реалізація ведеться за 24-commit roadmap. Детальна технічна специфікація — у `CASS_SPEC.md`.

## Ліцензія

MIT
