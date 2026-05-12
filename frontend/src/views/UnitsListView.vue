<template>
  <div>
    <div class="toolbar">
      <h1>Обладнання</h1>
      <InputText v-model="search" placeholder="Пошук..." @input="onSearch" />
      <Dropdown v-model="filterStatus" :options="statusOptions" placeholder="Статус" @change="onSearch" />
    </div>

    <DataTable :value="store.units" :loading="store.loading" size="small">
      <Column field="serial_number" header="Серійний номер" sortable />
      <Column field="model_name" header="Модель" sortable />
      <Column field="location" header="Розташування" />
      <Column field="status" header="Статус">
        <template #body="{ data }">
          <Tag :severity="sev(data.status)" :value="data.status ?? '—'" />
        </template>
      </Column>
      <Column field="rul_hours" header="Залишок, год" sortable>
        <template #body="{ data }">{{ data.rul_hours != null ? Math.round(data.rul_hours) : '—' }}</template>
      </Column>
      <Column field="predicted_mode" header="Режим відмови">
        <template #body="{ data }">{{ data.predicted_mode ?? '—' }}</template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <RouterLink :to="`/units/${data.id}`">Деталі</RouterLink>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useUnitsStore } from "../stores/units";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import InputText from "primevue/inputtext";
import Dropdown from "primevue/dropdown";

const store = useUnitsStore();
const search = ref("");
const filterStatus = ref(null);
const statusOptions = ["OK", "RISK", "IMMINENT"];

const sev = (s) => ({ OK: "success", RISK: "warning", IMMINENT: "danger" }[s] ?? "info");

const onSearch = () => store.fetchUnits({ q: search.value || undefined, status: filterStatus.value || undefined });

onMounted(() => store.fetchUnits());
</script>
