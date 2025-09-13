<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useDashboardStore } from "../stores/dashboard";
import { useProjectsStore } from "../stores/projects";

const store = useDashboardStore();
const projects = useProjectsStore();
const router = useRouter();

const slides = [
  { src: "/img1.svg", alt: "Bienvenido a Nexus" },
  { src: "/img2.svg", alt: "Tip: Usa atajos Alt+↑/↓" },
  { src: "/img3.svg", alt: "Explora la vista calendario" },
];
const currentSlide = ref(0);
const currentMsg = ref(0);
let intervalId: any = null;
const paused = ref(false);

onMounted(async () => {
  await projects.fetch();
  await store.fetchMetrics();
  intervalId = setInterval(() => {
    if (paused.value) return;
    currentSlide.value = (currentSlide.value + 1) % slides.length;
    currentMsg.value = (currentMsg.value + 1) % slides.length;
  }, 5 * 60 * 1000);
});

onBeforeUnmount(() => intervalId && clearInterval(intervalId));

function go(path: string) {
  router.push(path);
}
</script>

<template>
  <main class="p-6" aria-busy="false">
    <h1 class="text-2xl font-semibold mb-4">Dashboard</h1>

    <!-- KPIs -->
    <section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" aria-label="KPIs" :aria-busy="store.loading">
      <div v-for="(val, key) in (store.metrics?.kpis || {income:0,expenses:0,balance:0,savings:0})" :key="String(key)" class="border rounded p-3 bg-white">
        <div class="text-xs text-gray-500 capitalize">{{ key }}</div>
        <div class="text-xl font-semibold">{{ val }}</div>
      </div>
      <div v-if="store.loading" class="col-span-4 text-sm text-gray-500">Cargando KPIs…</div>
    </section>

    <!-- Accesos rápidos -->
    <section class="flex gap-3 mb-6" aria-label="Accesos rápidos">
      <button role="link" aria-label="Ir a Tableros" class="border px-3 py-2 rounded" @click="go('/boards')">Tableros</button>
      <button role="link" aria-label="Ir a Calendario" class="border px-3 py-2 rounded" @click="go('/calendar')">Calendario</button>
      <button role="link" aria-label="Ir a Gráficas" class="border px-3 py-2 rounded" @click="go('/analytics')">Gráficas</button>
    </section>

    <!-- Próximos eventos / CTA integración -->
    <section class="mb-6" aria-label="Próximos eventos">
      <h2 class="font-semibold mb-2">Próximos 7 días</h2>
      <div v-if="!store.metrics?.upcoming || store.metrics.upcoming.length===0" class="text-sm text-gray-600">
        <p>No hay eventos próximos o no hay integración conectada.</p>
        <button class="mt-2 border px-3 py-2 rounded" aria-label="Conectar Google u Outlook" @click="go('/settings/integrations')">Conectar Google/Outlook</button>
      </div>
      <ul v-else class="space-y-2">
        <li v-for="ev in store.metrics.upcoming" :key="ev.title+ev.startUtc" class="border rounded p-2 flex justify-between items-center">
          <div>
            <div class="font-medium">{{ ev.title }}</div>
            <div class="text-xs text-gray-500">{{ new Date(ev.startUtc).toLocaleString() }} · {{ projects.list.find(p=>p.id===ev.projectId)?.name || ev.projectId }}</div>
          </div>
          <div class="text-xs">{{ ev.syncStatus }}</div>
        </li>
      </ul>
    </section>

    <!-- Slideshow -->
    <section class="border rounded p-3 bg-white" aria-live="polite" aria-atomic="true">
      <div class="flex items-center gap-3">
        <img :src="slides[currentSlide].src" :alt="slides[currentSlide].alt" class="w-64 h-auto" />
        <div class="text-sm text-gray-700">{{ slides[currentSlide].alt }}</div>
      </div>
      <button class="mt-2 border px-2 py-1 rounded text-xs" aria-label="Pausar slideshow" @click="paused = !paused">{{ paused ? 'Reanudar' : 'Pausar' }}</button>
    </section>
  </main>
</template>
