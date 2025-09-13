<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useProjectsStore } from "../stores/projects";
import { useCardsStore } from "../stores/cards";
import { useCalendarStore } from "../stores/calendar";
import { useRouter } from "vue-router";

const projects = useProjectsStore();
const cards = useCardsStore();
const calendar = useCalendarStore();
const router = useRouter();

const view = ref<"month" | "week" | "day">("month");
const from = ref<string>(new Date(new Date().setDate(1)).toISOString());
const to = ref<string>(new Date(new Date().setMonth(new Date().getMonth() + 1, 0)).toISOString());
const boardId = ref<string>("");
const status = ref<string>("");
const label = ref<string>("");

async function load() {
  const params: any = { from: from.value, to: to.value };
  if (boardId.value) params.boardId = boardId.value;
  if (status.value) params.status = status.value;
  if (label.value) params.label = label.value;
  await calendar.fetchEvents(params);
}

onMounted(async () => {
  await projects.fetch();
  await load();
  calendar.bindOnlineListener(async (cardId, projectId, input) => {
    await cards.setDueDate(cardId, projectId, input);
  });
});

watch([boardId, status, label], load);

function onReschedule(ev: any) {
  const start = window.prompt("Nueva fecha (ISO)", ev.start);
  if (!start) return;
  const input = { start } as any;
  if (!navigator.onLine) {
    calendar.enqueuePending({ cardId: ev.cardId, projectId: ev.boardId, start });
    return;
  }
  cards
    .setDueDate(ev.cardId, ev.boardId, input)
    .then(load)
    .catch(() => alert("No se pudo reprogramar"));
}

function goToCard(ev: any) {
  router.push({ name: "boards", query: { cardId: ev.cardId } });
}
</script>

<template>
  <main style="padding: 1rem;">
    <h1 class="text-2xl font-semibold mb-4">Calendario</h1>
    <div class="flex gap-2 items-center mb-3">
      <select v-model="boardId" class="border rounded px-2 py-1">
        <option value="">Todos los boards</option>
        <option v-for="p in projects.list" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <select v-model="status" class="border rounded px-2 py-1">
        <option value="">Todos los estados</option>
        <option value="TODO">TODO</option>
        <option value="DOING">DOING</option>
        <option value="DONE">DONE</option>
        <option value="ARCHIVED">ARCHIVED</option>
      </select>
      <input v-model="label" placeholder="Etiqueta" class="border rounded px-2 py-1" />
      <button class="border px-2 py-1 rounded" @click="load">Refrescar</button>
    </div>
    <!-- Fallback simple list view (no FullCalendar to avoid extra deps) -->
    <div v-if="calendar.loading">Cargando…</div>
    <div v-else>
      <table class="w-full text-sm border">
        <thead>
          <tr class="bg-gray-100">
            <th class="text-left p-2">Card</th>
            <th class="text-left p-2">Board</th>
            <th class="text-left p-2">Estado</th>
            <th class="text-left p-2">Inicio</th>
            <th class="text-left p-2">Fin</th>
            <th class="text-left p-2">Sync</th>
            <th class="text-left p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in calendar.events" :key="ev.eventId">
            <td class="p-2 underline cursor-pointer" @click="goToCard(ev)">{{ ev.title }}</td>
            <td class="p-2">{{ projects.list.find(p=>p.id===ev.boardId)?.name || ev.boardId }}</td>
            <td class="p-2">{{ ev.status }}</td>
            <td class="p-2">{{ ev.start }}</td>
            <td class="p-2">{{ ev.end }}</td>
            <td class="p-2">{{ ev.syncStatus }}</td>
            <td class="p-2"><button class="border px-2 py-1 rounded" @click="onReschedule(ev)">Reprogramar</button></td>
          </tr>
          <tr v-if="!calendar.events.length">
            <td colspan="7" class="p-4 text-center text-gray-500">Sin eventos</td>
          </tr>
        </tbody>
      </table>
      <div class="text-xs text-gray-500 mt-2" v-if="!calendar.online">Modo sin conexión: cambios se guardarán al reconectar.</div>
    </div>
  </main>
</template>

