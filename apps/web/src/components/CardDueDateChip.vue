<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useCardsStore } from "../stores/cards";
import http from "../lib/http";

interface Props {
  cardId: string;
  projectId: string;
  currentDate?: string | null; // ISO in UTC
  status?: "Synced" | "Pending" | "Error" | null;
  allDay?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: "updated", payload: { startUtc: string | null; allDay?: boolean; status?: string | null }): void }>();

const store = useCardsStore();
const open = ref(false);
const localIso = ref<string>("");
const localStatus = ref<"Synced" | "Pending" | "Error" | null>(props.status ?? null);
const localAllDay = ref<boolean>(!!props.allDay);
const loading = ref(false);
const lastError = ref<string | null>(null);

const hasDate = computed(() => !!(props.currentDate || localIso.value));

function fmtDisplay(iso?: string | null, allDay?: boolean) {
  if (!iso) return "+ fecha";
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = allDay ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

async function fetchEvent() {
  try {
    const res = await http.get(`/cards/${props.cardId}/event`);
    const ev = res.data?.data;
    if (ev) {
      localIso.value = ev.startUtc;
      localAllDay.value = !!ev.allDay;
      localStatus.value = ev.status || "Synced";
      emit("updated", { startUtc: ev.startUtc, allDay: ev.allDay, status: ev.status });
    } else {
      localIso.value = "";
      localStatus.value = null;
      emit("updated", { startUtc: null, status: null });
    }
  } catch (e: any) {
    // 404 -> no event
    localIso.value = "";
    localStatus.value = null;
    emit("updated", { startUtc: null, status: null });
  }
}

onMounted(() => {
  if (props.currentDate) localIso.value = props.currentDate;
  else fetchEvent();
});

watch(() => props.currentDate, (nv) => {
  if (nv) localIso.value = nv;
});

watch(() => props.status, (nv) => {
  localStatus.value = (nv as any) ?? localStatus.value;
});

function openPicker() {
  open.value = true;
  lastError.value = null;
  if (!localIso.value) {
    const now = new Date();
    now.setSeconds(0, 0);
    localIso.value = new Date(now.getTime()).toISOString();
  }
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalInputValue(val: string) {
  // Treat as local and convert to UTC ISO (append Z after constructing Date)
  const d = new Date(val);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

async function save() {
  if (!localIso.value) return;
  loading.value = true;
  localStatus.value = "Pending";
  lastError.value = null;
  const start = fromLocalInputValue((document.getElementById(`dt-${props.cardId}`) as HTMLInputElement)?.value || toLocalInputValue(localIso.value));
  try {
    await store.setDueDate(props.cardId, props.projectId, { start, allDay: localAllDay.value });
    await fetchEvent();
    open.value = false;
  } catch (e: any) {
    localStatus.value = "Error";
    lastError.value = "No se pudo guardar";
  } finally {
    loading.value = false;
  }
}

async function clearDate() {
  loading.value = true;
  lastError.value = null;
  try {
    await store.clearDueDate(props.cardId, props.projectId);
    localIso.value = "";
    localStatus.value = null;
    emit("updated", { startUtc: null, status: null });
    open.value = false;
  } catch (e: any) {
    localStatus.value = "Error";
    lastError.value = "No se pudo borrar";
  } finally {
    loading.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!e.altKey) return;
  const input = document.getElementById(`dt-${props.cardId}`) as HTMLInputElement | null;
  const baseIso = input?.value ? fromLocalInputValue(input.value) : localIso.value;
  if (!baseIso) return;
  const d = new Date(baseIso);
  switch (e.key) {
    case "ArrowUp":
      d.setDate(d.getDate() + 1);
      break;
    case "ArrowDown":
      d.setDate(d.getDate() - 1);
      break;
    case "ArrowRight":
      d.setHours(d.getHours() + 1);
      break;
    case "ArrowLeft":
      d.setHours(d.getHours() - 1);
      break;
    default:
      return;
  }
  e.preventDefault();
  const newLocal = toLocalInputValue(new Date(d.getTime()).toISOString());
  if (input) input.value = newLocal;
}
</script>

<template>
  <div class="inline-flex items-center gap-2" :aria-label="hasDate ? 'Fecha asignada' : 'Sin fecha'">
    <button
      class="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
      :class="{
        'text-gray-600': !hasDate,
      }"
      @click="openPicker"
      :tabindex="0"
    >
      <span v-if="!hasDate">+ fecha</span>
      <span v-else>{{ fmtDisplay(props.currentDate || localIso, localAllDay) }}</span>
    </button>
    <span v-if="localStatus === 'Synced'" title="Sincronizado">✅</span>
    <span v-else-if="localStatus === 'Pending'" title="Pendiente">⏳</span>
    <span v-else-if="localStatus === 'Error'" title="Error">⚠️</span>

    <div v-if="open" class="mt-2 p-2 border rounded bg-white shadow" @keydown="onKeydown">
      <div class="flex items-center gap-2">
        <input
          :id="`dt-${props.cardId}`"
          type="datetime-local"
          class="border rounded px-2 py-1 text-sm"
          :value="toLocalInputValue((props.currentDate || localIso) || new Date().toISOString())"
        />
        <label class="text-xs flex items-center gap-1">
          <input type="checkbox" v-model="localAllDay" /> Todo el día
        </label>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50" :disabled="loading" @click="save">Guardar</button>
        <button class="px-2 py-1 text-xs rounded bg-gray-200" @click="() => (open = false)">Cancelar</button>
        <button class="px-2 py-1 text-xs rounded bg-red-600 text-white" :disabled="loading" @click="clearDate">Borrar</button>
        <button v-if="localStatus==='Error'" class="px-2 py-1 text-xs rounded bg-amber-600 text-white" @click="save">Reintentar</button>
      </div>
      <div v-if="lastError" class="text-xs text-red-600 mt-1">{{ lastError }}</div>
      <div class="text-[10px] text-gray-500 mt-1">Accesibilidad: Alt+↑/↓ día, Alt+←/→ hora, Enter para guardar</div>
    </div>
  </div>
</template>

<style scoped>
.inline-flex { display: inline-flex; }
</style>

