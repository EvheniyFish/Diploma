import { defineStore } from "pinia";
import { unitsApi, forecastApi } from "../api";

export const useUnitsStore = defineStore("units", {
  state: () => ({ units: [], summary: null, loading: false, error: null }),
  actions: {
    async fetchUnits(params) {
      this.loading = true;
      try { this.units = await unitsApi.list(params); }
      catch (e) { this.error = e; }
      finally { this.loading = false; }
    },
    async fetchSummary() {
      this.summary = await forecastApi.summary();
    },
  },
});
