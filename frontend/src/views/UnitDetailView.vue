<template>
  <div v-if="unit">
    <div class="unit-header">
      <h1>{{ unit.name }}</h1>
      <Tag :severity="sev(unit.status)" :value="unit.status ?? 'Немає даних'" />
    </div>
    <p>{{ unit.model_name }} · {{ unit.serial_number }} · {{ unit.location }}</p>

    <div class="health-section" v-if="unit.anomaly_score != null">
      <div class="gauge">
        <span>Аномальність:</span>
        <strong>{{ (unit.anomaly_score * 100).toFixed(1) }}%</strong>
      </div>
      <div class="rul">
        <span>Залишковий ресурс:</span>
        <strong>{{ Math.round(unit.rul_hours) }} год</strong>
        <small>({{ Math.round(unit.rul_lower_hours) }}–{{ Math.round(unit.rul_upper_hours) }})</small>
      </div>
      <div v-if="unit.predicted_mode">
        <span>Прогнозований режим відмови:</span>
        <strong>{{ unit.predicted_mode }}</strong>
        <small>({{ (unit.predicted_mode_conf * 100).toFixed(0) }}%)</small>
      </div>
    </div>
  </div>
  <div v-else-if="loading">Завантаження...</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { unitsApi } from "../api";
import Tag from "primevue/tag";

const route = useRoute();
const unit = ref(null);
const loading = ref(true);
let interval;

const sev = (s) => ({ OK: "success", RISK: "warning", IMMINENT: "danger" }[s] ?? "info");

const load = async () => {
  try { unit.value = await unitsApi.get(route.params.id); }
  finally { loading.value = false; }
};

onMounted(() => { load(); interval = setInterval(load, 15000); });
onUnmounted(() => clearInterval(interval));
</script>
