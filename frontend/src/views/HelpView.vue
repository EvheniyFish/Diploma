<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Довідка</h1>
    </div>

    <div class="help-layout">

      <!-- Sidebar nav -->
      <nav class="help-nav">
        <a v-for="s in sections" :key="s.id" :href="'#' + s.id" class="help-nav-link" :class="{ active: activeSection === s.id }">
          {{ s.label }}
        </a>
      </nav>

      <!-- Content -->
      <div class="help-content" @scroll="onScroll" ref="contentEl">

        <!-- ── ЩО ТАКЕ CASS ───────────────────────── -->
        <section :id="sections[0].id" class="help-section">
          <h2 class="help-h2">Що таке CASS</h2>
          <p>
            <strong>CASS</strong> (Condition-based Anomaly & Signature System) — система прогностичного технічного обслуговування.
            Вона безперервно аналізує телеметрію обладнання та завчасно попереджає про погіршення стану —
            до того, як трапиться відмова.
          </p>
          <p>
            Система не прив'язана до конкретного типу обладнання.
            Будь-який пристрій описується JSON-паспортом із переліком сигнальних каналів,
            нормальними значеннями та відомими режимами відмов.
            Одна система — сервери, насоси, кріогенні установки, будь-що.
          </p>

          <div class="help-callout info">
            Поточна система одночасно моніторить <strong>реальне залізо</strong> (RAM/CPU/диск сервера)
            та <strong>змодельоване обладнання</strong> (симулятор генерує реалістичну телеметрію з деградацією).
            Обидва типи проходять однаковий ML-пайплайн.
          </div>
        </section>

        <!-- ── ЯК ПРАЦЮЄ ──────────────────────────── -->
        <section :id="sections[1].id" class="help-section">
          <h2 class="help-h2">Як працює система</h2>

          <div class="help-flow">
            <div class="flow-step">
              <div class="flow-num">1</div>
              <div class="flow-body">
                <div class="flow-title">Збір телеметрії</div>
                <div class="flow-desc">
                  Симулятор або реальні датчики надсилають дані кожні 10 секунд через
                  <code>POST /api/v1/ingest</code>. Кожна точка — це значення одного каналу
                  (температура, тиск, вібрація тощо) з міткою часу.
                  Дані зберігаються в таблиці <code>telemetry</code>.
                </div>
              </div>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <div class="flow-num">2</div>
              <div class="flow-body">
                <div class="flow-title">ML-аналіз (кожні 5 хвилин)</div>
                <div class="flow-desc">
                  Планувальник бере останні 6 годин телеметрії (360 точок на канал),
                  будує вектор з 20+ ознак (середнє, стандартне відхилення, нахил тренду,
                  відхилення від номіналу тощо) і передає до ML-сервісу.
                </div>
              </div>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <div class="flow-num">3</div>
              <div class="flow-body">
                <div class="flow-title">Три ML-моделі</div>
                <div class="flow-desc">
                  <strong>IsolationForest</strong> — виявляє аномалії (оцінка 0–100%).
                  Якщо аномалія > 30%, запускається
                  <strong>RandomForest</strong> — визначає конкретний режим відмови.
                  Паралельно <strong>GradientBoosting</strong> розраховує RUL з трьома квантилями (10%, 50%, 90%).
                </div>
              </div>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <div class="flow-num">4</div>
              <div class="flow-body">
                <div class="flow-title">Оновлення статусу та сповіщень</div>
                <div class="flow-desc">
                  Результат записується в <code>health_state</code>. Якщо статус змінився —
                  автоматично створюється запис у журналі подій.
                  Фронтенд оновлюється кожні 15 секунд (polling).
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── КЛЮЧОВІ МЕТРИКИ ────────────────────── -->
        <section :id="sections[2].id" class="help-section">
          <h2 class="help-h2">Ключові метрики</h2>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Оцінка аномальності</span>
              <span class="metric-range">0% — 100%</span>
            </div>
            <p>
              Показує, наскільки поточна поведінка обладнання відрізняється від його нормальної роботи.
              Розраховується моделлю IsolationForest — алгоритм, який ізолює «нетипові» спостереження
              у просторі ознак.
            </p>
            <div class="metric-thresholds">
              <div class="threshold ok">
                <span class="th-range">0–30%</span>
                <span class="th-label">Норма</span>
                <span class="th-desc">Поведінка в межах очікуваної</span>
              </div>
              <div class="threshold risk">
                <span class="th-range">30–70%</span>
                <span class="th-label">Спостереження</span>
                <span class="th-desc">Відхилення є, але не критичне</span>
              </div>
              <div class="threshold imminent">
                <span class="th-range">70–100%</span>
                <span class="th-label">Критично</span>
                <span class="th-desc">Поведінка різко нетипова</span>
              </div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">RUL — Залишковий ресурс</span>
              <span class="metric-range">у годинах</span>
            </div>
            <p>
              Remaining Useful Life — розрахункова кількість годин до ймовірної відмови.
              Модель GradientBoosting повертає три оцінки: консервативну (10-й перцентиль),
              медіанну (50-й) і оптимістичну (90-й). На дашборді і в таблицях показується медіанна.
            </p>
            <div class="metric-thresholds">
              <div class="threshold imminent">
                <span class="th-range">&lt; 72 год</span>
                <span class="th-label">Критично</span>
                <span class="th-desc">Менше 3 діб — негайне ТО</span>
              </div>
              <div class="threshold risk">
                <span class="th-range">72–168 год</span>
                <span class="th-label">Під наглядом</span>
                <span class="th-desc">3–7 діб — запланувати ТО</span>
              </div>
              <div class="threshold ok">
                <span class="th-range">&gt; 168 год</span>
                <span class="th-label">Норма</span>
                <span class="th-desc">Більше тижня — нічого не треба</span>
              </div>
            </div>
            <div class="help-callout warning" style="margin-top: 12px;">
              RUL — це прогноз, а не гарантія. Реальний ресурс залежить від умов експлуатації,
              які можуть змінитися. Завжди перевіряйте графіки телеметрії перед прийняттям рішень.
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-name">Статус обладнання</span>
            </div>
            <div class="status-explain-grid">
              <div class="status-explain ok">
                <div class="se-badge">OK</div>
                <div class="se-body">
                  <div class="se-title">Норма</div>
                  <div class="se-desc">Аномалія &lt; 30% І RUL &gt; 168 год. Обладнання працює в штатному режимі.</div>
                </div>
              </div>
              <div class="status-explain risk">
                <div class="se-badge">RISK</div>
                <div class="se-body">
                  <div class="se-title">Під наглядом</div>
                  <div class="se-desc">Аномалія 30–70% АБО RUL 72–168 год. Рекомендується заплановане ТО.</div>
                </div>
              </div>
              <div class="status-explain imminent">
                <div class="se-badge">IMMINENT</div>
                <div class="se-body">
                  <div class="se-title">Критично</div>
                  <div class="se-desc">Аномалія &gt; 70% АБО RUL &lt; 72 год. Потрібне негайне втручання.</div>
                </div>
              </div>
            </div>
            <p style="font-size: 12px; color: var(--color-text-muted); margin-top: 12px;">
              При підвищенні статусу діє гістерезис ±10%, щоб уникнути флуктуацій.
              Якщо RISK утримується більше 48 годин без втручання — автоматично переходить в IMMINENT.
            </p>
          </div>
        </section>

        <!-- ── СЦЕНАРІЇ ───────────────────────────── -->
        <section :id="sections[3].id" class="help-section">
          <h2 class="help-h2">Сценарії роботи</h2>

          <div class="scenario">
            <div class="scenario-header">
              <span class="scenario-num">01</span>
              <span class="scenario-title">Отримали RISK — що робити?</span>
            </div>
            <ol class="scenario-steps">
              <li>Перейдіть до розділу «Обладнання» → натисніть на одиницю зі статусом RISK.</li>
              <li>На сторінці деталей перегляньте графіки телеметрії: який канал поводиться аномально?</li>
              <li>Перевірте «Прогнозований режим відмови» — система вказує, яка саме несправність очікується.</li>
              <li>Якщо тренд стабільний і не погіршується — моніторте щодня. Якщо зростає — плануйте ТО.</li>
              <li>Після проведення ТО зафіксуйте подію у «Журналі подій» для збереження історії.</li>
            </ol>
          </div>

          <div class="scenario">
            <div class="scenario-header">
              <span class="scenario-num">02</span>
              <span class="scenario-title">Статус IMMINENT — термінові дії</span>
            </div>
            <ol class="scenario-steps">
              <li>Перейдіть до деталей одиниці — перегляньте точне значення RUL та впевненість прогнозу.</li>
              <li>Зверніть увагу на графік RUL у часі: якщо він різко впав — ймовірно активна деградація.</li>
              <li>Зупиніть або зменшіть навантаження на обладнання, якщо це можливо.</li>
              <li>Проведіть позапланове ТО або заміну компонента, на який вказує «Прогнозований режим».</li>
              <li>Після ремонту скиньте стан через симулятор (розділ «Налаштування») або зачекайте,
                  поки нові нормальні дані не перезапишуть аномалію.</li>
            </ol>
          </div>

          <div class="scenario">
            <div class="scenario-header">
              <span class="scenario-num">03</span>
              <span class="scenario-title">Додавання нового обладнання</span>
            </div>
            <ol class="scenario-steps">
              <li>Спочатку створіть <strong>Модель обладнання</strong> (розділ «Моделі» → «+ Нова модель»).</li>
              <li>Заповніть JSON-паспорт: опишіть канали сигналів з їхніми нормальними значеннями
                  (<code>nominal</code>), робочим діапазоном (<code>operating_range</code>)
                  та критичним діапазоном (<code>critical_range</code>).</li>
              <li>Додайте відомі режими відмов (<code>failure_modes</code>) з переліком каналів,
                  що на них впливають.</li>
              <li>Після збереження моделі перейдіть до «Обладнання» → «+ Додати вузол» —
                  оберіть щойно створену модель.</li>
              <li>Почніть надсилати телеметрію через <code>POST /api/v1/ingest</code>.
                  ML-оцінка з'явиться через 5–10 хвилин після накопичення перших даних.</li>
            </ol>
          </div>

          <div class="scenario">
            <div class="scenario-header">
              <span class="scenario-num">04</span>
              <span class="scenario-title">Моніторинг поточного сервера</span>
            </div>
            <ol class="scenario-steps">
              <li>Відкрийте «Аналіз системи» — блок «Поточний сервер» у верхній частині сторінки.</li>
              <li>RAM, CPU та диск відображаються в реальному часі (оновлення кожні 5 секунд).</li>
              <li>Порогові значення: попередження при 85%, критично при 95% завантаженості.</li>
              <li>Дані автоматично надходять у ML-пайплайн як звичайна телеметрія —
                  юніт «Local Server Hardware» з'являється в списку обладнання.</li>
              <li>Якщо ML-оцінка показує «накопичення даних» — зачекайте 10 хвилин після першого запуску.</li>
            </ol>
          </div>
        </section>

        <!-- ── РОЗДІЛИ СИСТЕМИ ────────────────────── -->
        <section :id="sections[4].id" class="help-section">
          <h2 class="help-h2">Розділи системи</h2>

          <div class="nav-guide-grid">
            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Панель моніторингу</div>
                <div class="nav-guide-desc">
                  Головний дашборд. Карти стану флоту, прогноз відмов на наступні 7 днів,
                  зведені графіки аномальності та останні події.
                  Оновлюється автоматично кожні 15 секунд.
                </div>
              </div>
            </div>

            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Обладнання</div>
                <div class="nav-guide-desc">
                  Список усіх одиниць обладнання з поточним статусом, RUL та прогнозом.
                  Натисніть на рядок або «Деталі» для перегляду повної телеметрії, графіків та
                  прогнозу по кожному каналу.
                </div>
              </div>
            </div>

            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Моделі</div>
                <div class="nav-guide-desc">
                  Керування типами обладнання. Кожна модель — це JSON-паспорт з описом каналів,
                  порогових значень та режимів відмов. Можна переглянути, відредагувати або
                  створити нову модель.
                </div>
              </div>
            </div>

            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Аналіз системи</div>
                <div class="nav-guide-desc">
                  Аналітична панель: реальний стан сервера, зведений стан флоту, рейтинг аномальності,
                  розподіл RUL та критичні події. Мета сторінки — швидко побачити найгірше.
                </div>
              </div>
            </div>

            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Журнал подій</div>
                <div class="nav-guide-desc">
                  Хронологія всіх подій: автоматичні (зміна статусу, виявлення аномалій) та ручні.
                  Фільтрація за датою, типом та одиницею. Експорт у CSV для звітів.
                </div>
              </div>
            </div>

            <div class="nav-guide-item">
              <div class="nav-guide-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/></svg>
              </div>
              <div class="nav-guide-body">
                <div class="nav-guide-title">Налаштування</div>
                <div class="nav-guide-desc">
                  Керування симулятором (ін'єкція несправностей, скидання, швидкість),
                  перевірка стану сервісів та конфігурація системи.
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── FAQ ───────────────────────────────── -->
        <section :id="sections[5].id" class="help-section">
          <h2 class="help-h2">Часті запитання</h2>

          <div class="faq-list">
            <div v-for="(item, i) in faq" :key="i" class="faq-item">
              <button class="faq-q" @click="item.open = !item.open">
                <span>{{ item.q }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  :style="{ transform: item.open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }"
                  style="width:16px;height:16px;flex-shrink:0;">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div v-if="item.open" class="faq-a">{{ item.a }}</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const contentEl = ref(null)
const activeSection = ref('what')

const sections = [
  { id: 'what', label: 'Що таке CASS' },
  { id: 'how', label: 'Як працює' },
  { id: 'metrics', label: 'Ключові метрики' },
  { id: 'scenarios', label: 'Сценарії' },
  { id: 'nav', label: 'Розділи системи' },
  { id: 'faq', label: 'FAQ' },
]

const faq = ref([
  {
    q: 'Чому ML-оцінка показує «накопичення даних»?',
    a: 'Для першого розрахунку потрібно мінімум 30 точок телеметрії на канал (при надходженні кожні 10 секунд — це 5 хвилин). Після першого запуску планувальник оновлює оцінку кожні 5 хвилин.',
    open: false,
  },
  {
    q: 'Що означає «аномалія 5%» у нормально працюючого обладнання?',
    a: '5% — базовий рівень шуму IsolationForest. Навіть ідеально нормальне обладнання отримує невеликий ненульовий бал через статистичну природу алгоритму. Значущим вважається відхилення від 30%.',
    open: false,
  },
  {
    q: 'Чому реальний RUL може відрізнятися від прогнозу?',
    a: 'Модель тренована на симульованих даних із відомою деградацією. При роботі з реальним обладнанням точність залежить від якості та обсягу историчних даних. Для виробничих сценаріїв необхідно дотренувати модель на реальній телеметрії.',
    open: false,
  },
  {
    q: 'Можна підключити власне обладнання?',
    a: 'Так. Створіть модель із JSON-паспортом (розділ «Моделі»), зареєструйте одиницю (розділ «Обладнання») і надсилайте телеметрію через POST /api/v1/ingest з полями unit_id, channel_code, ts, value. Більше деталей — у CASS_SPEC.md.',
    open: false,
  },
  {
    q: 'Чому QA-7000 постійно в стані RISK?',
    a: 'QA-7000 — вигаданий «квантовий прискорювач». Симулятор моделює накопичення runtime_hours як монотонно зростаючий канал, що ML сприймає як повільну деградацію. Це поведінка, закладена у специфікацію для демонстраційних цілей.',
    open: false,
  },
  {
    q: 'Як скинути стан симулятора після тесту відмови?',
    a: 'Перейдіть до «Налаштування» → блок «Симулятор» → кнопка «Скинути одиницю». Оберіть потрібний юніт. Симулятор повернеться до нормальної роботи, і через 5–10 хвилин ML перерахує стан.',
    open: false,
  },
])

function onScroll() {
  if (!contentEl.value) return
  const scrollTop = contentEl.value.scrollTop
  for (let i = sections.length - 1; i >= 0; i--) {
    const el = contentEl.value.querySelector('#' + sections[i].id)
    if (el && el.offsetTop <= scrollTop + 80) {
      activeSection.value = sections[i].id
      break
    }
  }
}
</script>

<style scoped>
.help-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
  height: calc(100vh - 120px);
}

/* Sidebar */
.help-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 4px;
  position: sticky;
  top: 0;
  align-self: start;
}
.help-nav-link {
  padding: 7px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.help-nav-link:hover,
.help-nav-link.active {
  color: var(--color-text);
  background: var(--color-surface-raised);
  border-left-color: var(--color-primary);
}

/* Content area */
.help-content {
  overflow-y: auto;
  padding-right: 8px;
}

/* Sections */
.help-section {
  margin-bottom: 48px;
  scroll-margin-top: 20px;
}
.help-h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}
.help-section p {
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}
.help-section p strong { color: var(--color-text); }
.help-section code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  color: var(--color-accent);
}

/* Callout */
.help-callout {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.7;
  margin-top: 12px;
}
.help-callout.info {
  background: rgba(14,165,233,0.08);
  border-left: 3px solid var(--color-primary);
  color: var(--color-text-muted);
}
.help-callout.warning {
  background: var(--color-risk-bg);
  border-left: 3px solid var(--color-risk);
  color: var(--color-text-muted);
}
.help-callout strong { color: var(--color-text); }

/* Flow */
.help-flow { display: flex; flex-direction: column; gap: 0; }
.flow-step {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.flow-arrow {
  text-align: center;
  color: var(--color-border-accent);
  font-size: 18px;
  padding: 2px 0;
}
.flow-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: var(--font-mono);
}
.flow-body { flex: 1; }
.flow-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; }
.flow-desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.7; }

/* Metric cards */
.metric-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 14px;
}
.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}
.metric-name { font-size: 14px; font-weight: 600; color: var(--color-text); }
.metric-range { font-size: 11px; color: var(--color-text-faint); font-family: var(--font-mono); }
.metric-thresholds { display: flex; gap: 8px; margin-top: 12px; }
.threshold {
  flex: 1;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.threshold.ok { background: var(--color-ok-bg); border: 1px solid var(--color-ok-border); }
.threshold.risk { background: var(--color-risk-bg); border: 1px solid var(--color-risk-border); }
.threshold.imminent { background: var(--color-imminent-bg); border: 1px solid var(--color-imminent-border); }
.th-range { font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
.threshold.ok .th-range { color: var(--color-ok); }
.threshold.risk .th-range { color: var(--color-risk); }
.threshold.imminent .th-range { color: var(--color-imminent); }
.th-label { font-size: 11px; font-weight: 600; color: var(--color-text); }
.th-desc { font-size: 11px; color: var(--color-text-muted); line-height: 1.4; }

/* Status explain */
.status-explain-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.status-explain {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
}
.status-explain.ok { background: var(--color-ok-bg); }
.status-explain.risk { background: var(--color-risk-bg); }
.status-explain.imminent { background: var(--color-imminent-bg); }
.se-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
}
.status-explain.ok .se-badge { background: var(--color-ok); color: #000; }
.status-explain.risk .se-badge { background: var(--color-risk); color: #000; }
.status-explain.imminent .se-badge { background: var(--color-imminent); color: #fff; }
.se-title { font-size: 12px; font-weight: 600; color: var(--color-text); margin-bottom: 2px; }
.se-desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }

/* Scenarios */
.scenario {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
}
.scenario-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
.scenario-num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 700;
  background: rgba(14,165,233,0.1);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
}
.scenario-title { font-size: 14px; font-weight: 600; color: var(--color-text); }
.scenario-steps {
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.scenario-steps li { font-size: 12px; color: var(--color-text-muted); line-height: 1.7; }
.scenario-steps li strong { color: var(--color-text); }

/* Nav guide */
.nav-guide-grid { display: flex; flex-direction: column; gap: 2px; }
.nav-guide-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 12px;
  border-radius: var(--radius-md);
  transition: background 0.15s;
}
.nav-guide-item:hover { background: var(--color-surface); }
.nav-guide-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  color: var(--color-primary);
  opacity: 0.7;
}
.nav-guide-icon svg { width: 100%; height: 100%; }
.nav-guide-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; }
.nav-guide-desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.6; }

/* FAQ */
.faq-list { display: flex; flex-direction: column; gap: 2px; }
.faq-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.faq-q {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  background: var(--color-surface);
  border: none;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.faq-q:hover { background: var(--color-surface-raised); }
.faq-a {
  padding: 12px 14px 14px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.8;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
}
</style>
