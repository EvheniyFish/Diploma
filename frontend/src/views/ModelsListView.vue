<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Моделі обладнання</h1>
      <div class="page-actions">
        <RouterLink to="/models/new">
          <button class="time-range-btn active" style="padding: 6px 14px;">+ Новий паспорт</button>
        </RouterLink>
      </div>
    </div>

    <PageIntro storage-key="models">
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </template>
      <p><strong>Моделі обладнання</strong> — це паспорти типів техніки. Кожна модель описує, які саме сенсори (канали) є на пристрої, які значення вважаються нормою, а які — критичними, і які режими відмов можливі.</p>
      <p>
        <strong>Weibull η (ета)</strong> — характеристичний час до відмови в годинах (масштабний параметр).
        <strong>Weibull β (бета)</strong> — форма кривої зносу: менше 1 — ранні відмови, близько 1 — випадкові, більше 2 — знос від старіння.
      </p>
      <p>Клікніть на рядок, щоб переглянути або редагувати паспорт. Кнопка <strong>+ Новий паспорт</strong> дозволяє зареєструвати новий тип обладнання і призначити йому ML-параметри.</p>
    </PageIntro>

    <DataTable
      :value="modelsStore.models"
      :loading="modelsStore.loading"
      size="small"
      :empty-message="'Дані відсутні'"
      @row-click="onRowClick"
      style="cursor: pointer;"
    >
      <Column field="model_code" header="Код моделі" sortable style="width: 140px;">
        <template #body="{ data }">
          <span style="font-weight: 600; font-family: monospace;">{{ data.model_code }}</span>
        </template>
      </Column>
      <Column field="display_name" header="Назва" sortable />
      <Column field="category" header="Категорія" style="width: 140px;" />
      <Column field="weibull_eta" header="Weibull η" style="width: 100px;">
        <template #body="{ data }">
          {{ data.weibull_eta != null ? data.weibull_eta.toFixed(1) : '—' }}
        </template>
      </Column>
      <Column field="weibull_beta" header="Weibull β" style="width: 100px;">
        <template #body="{ data }">
          {{ data.weibull_beta != null ? data.weibull_beta.toFixed(2) : '—' }}
        </template>
      </Column>
      <Column header="Канали" style="width: 90px;">
        <template #body="{ data }">
          {{ data.passport?.channels?.length ?? '—' }}
        </template>
      </Column>
      <Column field="created_at" header="Створено" style="width: 140px;">
        <template #body="{ data }">
          {{ data.created_at ? formatDate(data.created_at) : '—' }}
        </template>
      </Column>
      <Column header="" style="width: 100px;">
        <template #body="{ data }">
          <RouterLink :to="`/models/${data.id}`" style="font-size: 12px;" @click.stop>Редагувати</RouterLink>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import PageIntro from '../components/PageIntro.vue'
import { useModelsStore } from '../stores/models.js'

const router = useRouter()
const modelsStore = useModelsStore()

function formatDate(ts) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(ts))
}

function onRowClick(event) {
  router.push(`/models/${event.data.id}`)
}

onMounted(() => modelsStore.fetchModels())
</script>
