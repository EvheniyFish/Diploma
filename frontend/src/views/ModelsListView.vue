<template>
  <div>
    <h1>Моделі обладнання</h1>
    <DataTable :value="models" :loading="loading" size="small">
      <Column field="model_code" header="Код" sortable />
      <Column field="name" header="Назва" sortable />
      <Column field="category" header="Категорія" />
      <Column field="manufacturer" header="Виробник" />
      <Column header="">
        <template #body="{ data }">
          <Button label="Редагувати" size="small" @click="$router.push(`/models/${data.id}`)" />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { modelsApi } from "../api";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";

const models = ref([]);
const loading = ref(true);
onMounted(async () => {
  try { models.value = await modelsApi.list(); }
  finally { loading.value = false; }
});
</script>
