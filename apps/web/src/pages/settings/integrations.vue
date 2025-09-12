<script setup lang="ts">
import { onMounted } from "vue";
import { useCalendarIntegrations as useCalendarIntegrationsStore } from "../../stores/calendarIntegrations";

const store = useCalendarIntegrationsStore();

onMounted(() => {
  store.fetch();
});

async function connect(provider: "GOOGLE" | "OUTLOOK") {
  await store.connect({
    provider,
    accountEmail: "demo@gmail.com",
    defaultCalendarId: "primary",
    timezone: "America/Mexico_City",
  });
}
</script>

<template>
  <main class="p-6" aria-label="Settings - Integraciones">
    <h1 class="text-2xl font-semibold mb-4">Integraciones de Calendario</h1>

    <section class="mb-4" aria-label="Conectar proveedor">
      <div class="flex gap-2">
        <button @click="connect('GOOGLE')" aria-label="Conectar Google" class="px-3 py-2 bg-blue-600 text-white rounded">
          Conectar Google
        </button>
        <button @click="connect('OUTLOOK')" aria-label="Conectar Outlook" class="px-3 py-2 bg-indigo-600 text-white rounded">
          Conectar Outlook
        </button>
      </div>
    </section>

    <section aria-label="Estado de integración" class="border rounded p-4">
      <div v-if="store.loading">Cargando...</div>
      <div v-else-if="!store.integration">
        <p>No conectado</p>
      </div>
      <div v-else>
        <p>
          Estado:
          <strong v-if="store.integration.status === 'Synced'">Conectado</strong>
          <strong v-else-if="store.integration.status === 'Expired'">Token expirado</strong>
          <strong v-else-if="store.integration.status === 'Pending'">Pendiente de sincronizar</strong>
          <strong v-else>Error</strong>
        </p>
        <p class="text-sm text-gray-600 mt-1">
          {{ store.integration.provider }} · {{ store.integration.accountEmail }} · {{ store.integration.defaultCalendarId }}
        </p>
        <div class="flex gap-2 mt-3">
          <button v-if="store.integration.status === 'Expired'" @click="store.refresh()" aria-label="Renovar token" class="px-3 py-2 bg-amber-600 text-white rounded">
            Renovar
          </button>
          <button @click="store.disconnect()" aria-label="Desconectar" class="px-3 py-2 bg-gray-700 text-white rounded">
            Desconectar
          </button>
          <!-- Botón dev para simular expiración -->
          <button @click="store.simulateExpire()" aria-label="Simular expiración" class="px-3 py-2 bg-gray-300 rounded">
            Simular expiración
          </button>
        </div>
      </div>
    </section>
  </main>
</template>
