<template>
  <div>
    <h1>Журнал подій</h1>
    <a :href="exportUrl">Експорт CSV</a>
    <DataTable :value="events" :loading="loading" size="small">
      <Column field="created_at" header="Час" sortable />
      <Column field="severity" header="Рівень">
        <template #body="{ data }">
          <Tag :severity="sevMap[data.severity]" :value="data.severity" />
        </template>
      </Column>
      <Column field="event_type" header="Тип" />
      <Column field="message" header="Повідомлення" />
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { eventsApi } from "../api";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";

const events = ref([]);
const loading = ref(true);
const exportUrl = eventsApi.exportCsv();
const sevMap = { INFO: "info", WARN: "warning", CRITICAL: "danger" };

onMounted(async () => {
  try { events.value = await eventsApi.list(); }
  finally { loading.value = false; }
});
</script>
