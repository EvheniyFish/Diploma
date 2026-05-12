<template>
  <div class="dashboard">
    <h1>Панель моніторингу</h1>

    <div class="status-cards" v-if="summary">
      <div class="card ok">
        <span class="count">{{ summary.counts.OK ?? 0 }}</span>
        <span class="label">Норма</span>
      </div>
      <div class="card risk">
        <span class="count">{{ summary.counts.RISK ?? 0 }}</span>
        <span class="label">Ризик</span>
      </div>
      <div class="card imminent">
        <span class="count">{{ summary.counts.IMMINENT ?? 0 }}</span>
        <span class="label">Критично</span>
      </div>
    </div>

    <h2>Топ-5 ризикованих вузлів</h2>
    <DataTable :value="topRisk" :loading="loading" size="small">
      <Column field="serial_number" header="Серійний номер" />
      <Column field="model_name" header="Модель" />
      <Column field="location" header="Розташування" />
      <Column field="status" header="Статус">
        <template #body="{ data }">
          <Tag :severity="statusSeverity(data.status)" :value="data.status" />
        </template>
      </Column>
      <Column field="rul_hours" header="Залишок, год" />
      <Column header="">
        <template #body="{ data }">
          <RouterLink :to="`/units/${data.id}`">Деталі</RouterLink>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { onMounted, computed } from "vue";
import { useUnitsStore } from "../stores/units";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";

const store = useUnitsStore();
const summary = computed(() => store.summary);
const loading = computed(() => store.loading);
const topRisk = computed(() => store.summary?.top_risk ?? []);

const statusSeverity = (s) => ({ OK: "success", RISK: "warning", IMMINENT: "danger" }[s] ?? "info");

onMounted(async () => {
  await store.fetchSummary();
});
</script>
