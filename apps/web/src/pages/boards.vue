<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useProjectsStore } from "../stores/projects";
import { useCardsStore } from "../stores/cards";
import { VueDraggableNext as Draggable } from "vue-draggable-next";
import http from "../lib/http";

const projects = useProjectsStore();
const cards = useCardsStore();
const currentProjectId = ref<string>("");


// Stable, mutable arrays per column for Draggable
const todoList = ref<any[]>([]);
const doingList = ref<any[]>([]);
const doneList = ref<any[]>([]);
const archivedList = ref<any[]>([]);

function syncColumnsFromStore(projectId: string) {
  const list = cards.listByProject(projectId);
  const byStatus: Record<string, any[]> = { TODO: [], DOING: [], DONE: [], ARCHIVED: [] };
  for (const c of list) byStatus[c.status]?.push(c);
  for (const k of Object.keys(byStatus)) byStatus[k] = byStatus[k].sort((a, b) => a.position - b.position);
  todoList.value = byStatus.TODO;
  doingList.value = byStatus.DOING;
  doneList.value = byStatus.DONE;
  archivedList.value = byStatus.ARCHIVED;
}

onMounted(async () => {
  await projects.fetch();
  if (projects.list.length) {
    currentProjectId.value = projects.list[0].id;
    await cards.fetch(currentProjectId.value);
    syncColumnsFromStore(currentProjectId.value);
    const pid = currentProjectId.value;
    const list = cards.listByProject(pid);
    console.debug("[boards] pid:", pid);
    console.debug("[boards] count:", list.length);
    console.debug(
      "[boards] titles/status:",
      list.map((c: any) => ({ title: c.title, status: c.status, position: c.position }))
    );
    // Debug column refs after sync
    console.debug("[boards] TODO:", (todoList.value || []).map((c: any) => c.title));
    console.debug("[boards] DOING:", (doingList.value || []).map((c: any) => c.title));
    console.debug("[boards] DONE:", (doneList.value || []).map((c: any) => c.title));
    console.debug("[boards] ARCHIVED:", (archivedList.value || []).map((c: any) => c.title));
  }
});

async function selectProject(id: string) {
  currentProjectId.value = id;
  await cards.fetch(id);
  syncColumnsFromStore(id);
}

// Optimistic reorder handler
let snapshot: Record<string, any[]> | null = null;
const reordering = ref(false);
let reorderTimer: any = null;

async function commitReorder() {
  if (!currentProjectId.value) return;
  const pid = currentProjectId.value;
  // build moves for all columns from current grouped order
  // Build full list of target positions for every card (avoids unique collisions server-side)
  const moves: Array<{ id: string; status: string; position: number }> = [];
  (todoList.value as any[]).forEach((c: any, idx: number) => moves.push({ id: c.id, status: "TODO", position: idx + 1 }));
  (doingList.value as any[]).forEach((c: any, idx: number) => moves.push({ id: c.id, status: "DOING", position: idx + 1 }));
  (doneList.value as any[]).forEach((c: any, idx: number) => moves.push({ id: c.id, status: "DONE", position: idx + 1 }));
  (archivedList.value as any[]).forEach((c: any, idx: number) => moves.push({ id: c.id, status: "ARCHIVED", position: idx + 1 }));
  // optimistic snapshot
  snapshot = {
    TODO: JSON.parse(JSON.stringify(todoList.value)),
    DOING: JSON.parse(JSON.stringify(doingList.value)),
    DONE: JSON.parse(JSON.stringify(doneList.value)),
    ARCHIVED: JSON.parse(JSON.stringify(archivedList.value)),
  };
  try {
    // send reorder using axios client (includes Authorization)
    console.debug("[boards] reorder moves", moves);
    const res = await http.patch("/cards/reorder", { moves });
    const data = res.data;
    // update store with server order and resync columns
    cards.byProject[pid] = data?.data || [];
    syncColumnsFromStore(pid);
  } catch (e: any) {
    console.error("[boards] reorder failed", e?.response?.status, e?.response?.data || e?.message);
    if (e?.response?.status === 409) {
      await cards.fetch(pid);
      alert("Hubo un conflicto de orden. Recargamos el tablero. Intenta de nuevo.");
      snapshot = null;
      return;
    }
    // Fallback for unique constraint collision: perform two-phase client-side updates
    const code = e?.response?.data?.error || e?.response?.data?.code;
    if (e?.response?.status === 400 && code === 'P2002') {
      try {
        console.warn('[boards] falling back to client-side two-phase reorder');
        const statuses = ['TODO','DOING','DONE','ARCHIVED'];
        // Phase 1: move all current cards in each status to unique high positions to free 1..n
        const current = cards.listByProject(pid);
        for (const s of statuses) {
          const inStatus = current.filter((c: any) => c.status === s).sort((a: any, b: any) => a.position - b.position);
          for (let i = 0; i < inStatus.length; i++) {
            const c = inStatus[i];
            await http.put(`/cards/${c.id}`, { position: 1000 + i + 1 });
          }
        }
        // Phase 2: assign final status and positions from UI lists
        const assign = async (arr: any[], s: string) => {
          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            await http.put(`/cards/${c.id}`, { status: s, position: i + 1 });
          }
        };
        await assign(todoList.value as any[], 'TODO');
        await assign(doingList.value as any[], 'DOING');
        await assign(doneList.value as any[], 'DONE');
        await assign(archivedList.value as any[], 'ARCHIVED');
        await cards.fetch(pid);
        syncColumnsFromStore(pid);
        return;
      } catch (inner: any) {
        console.error('[boards] client-side reorder failed', inner?.response?.status, inner?.response?.data || inner?.message);
      }
    }
    // rollback
    if (snapshot) {
      todoList.value = snapshot.TODO;
      doingList.value = snapshot.DOING;
      doneList.value = snapshot.DONE;
      archivedList.value = snapshot.ARCHIVED;
    }
    alert("No se pudo guardar el orden. Deshaciendo cambios.");
  } finally {
    snapshot = null;
  }
}

function onDraggableChange(evt?: any) {
  // Ignore pure 'removed' phase; wait for 'added' or 'moved'
  if (!evt || (!evt.added && !evt.moved)) return;
  if (reorderTimer) clearTimeout(reorderTimer);
  reorderTimer = setTimeout(async () => {
    if (reordering.value) return;
    reordering.value = true;
    try {
      await commitReorder();
    } finally {
      reordering.value = false;
      reorderTimer = null;
    }
  }, 50);
}

function promptDue(card: any) {
  const start = window.prompt("Fecha inicio (ISO, e.g. 2025-09-13T10:00:00Z)", new Date().toISOString().slice(0, 16));
  if (!start) return;
  const allDay = false;
  const pid = currentProjectId.value;
  if (!pid) return;
  cards.setDueDate(card.id, pid, { start: start.includes("Z") ? start : start + "Z", allDay }).catch(() => alert("No se pudo asignar la fecha"));
}

function clearDue(card: any) {
  const pid = currentProjectId.value;
  if (!pid) return;
  cards.clearDueDate(card.id, pid).catch(() => alert("No se pudo quitar la fecha"));
}
</script>

<template>
  <main style="padding:2rem;">
    <h1>Boards</h1>
    <div style="margin-bottom:1rem;display:flex;gap:8px;align-items:center;">
      <label>Proyecto:</label>
      <select v-model="currentProjectId" @change="selectProject(currentProjectId)" style="padding:6px;">
        <option v-for="p in projects.list" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>
    <div v-if="!currentProjectId">Crea un proyecto para empezar.</div>
    <div v-else style="display:grid;grid-template-columns: repeat(4, 1fr); gap: 12px;">
      <section style="border:1px solid #ddd;border-radius:8px;min-height:200px;">
        <header style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">To Do ({{ todoList?.length || 0 }})</header>
        <Draggable v-model="todoList" item-key="id" group="cards" tag="div" @change="onDraggableChange">
          <div v-for="element in todoList" :key="element.id" :data-id="element.id" style="margin:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px;">
            <div style="font-weight:600;">{{ element.title }}</div>
            <div style="font-size:12px;color:#666;">pos {{ element.position }}</div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button @click="() => promptDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Fecha</button>
              <button @click="() => clearDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Quitar</button>
            </div>
          </div>
          <template #footer>
            <div v-if="!todoList?.length" style="color:#999;font-size:12px;padding:8px;">Sin cards</div>
          </template>
        </Draggable>
      </section>
      <section style="border:1px solid #ddd;border-radius:8px;min-height:200px;">
        <header style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">Doing ({{ doingList?.length || 0 }})</header>
        <Draggable v-model="doingList" item-key="id" group="cards" tag="div" @change="onDraggableChange">
          <div v-for="element in doingList" :key="element.id" :data-id="element.id" style="margin:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px;">
            <div style="font-weight:600;">{{ element.title }}</div>
            <div style="font-size:12px;color:#666;">pos {{ element.position }}</div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button @click="() => promptDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Fecha</button>
              <button @click="() => clearDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Quitar</button>
            </div>
          </div>
          <template #footer>
            <div v-if="!doingList?.length" style="color:#999;font-size:12px;padding:8px;">Sin cards</div>
          </template>
        </Draggable>
      </section>
      <section style="border:1px solid #ddd;border-radius:8px;min-height:200px;">
        <header style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">Done ({{ doneList?.length || 0 }})</header>
        <Draggable v-model="doneList" item-key="id" group="cards" tag="div" @change="onDraggableChange">
          <div v-for="element in doneList" :key="element.id" :data-id="element.id" style="margin:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px;">
            <div style="font-weight:600;">{{ element.title }}</div>
            <div style="font-size:12px;color:#666;">pos {{ element.position }}</div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button @click="() => promptDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Fecha</button>
              <button @click="() => clearDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Quitar</button>
            </div>
          </div>
          <template #footer>
            <div v-if="!doneList?.length" style="color:#999;font-size:12px;padding:8px;">Sin cards</div>
          </template>
        </Draggable>
      </section>
      <section style="border:1px solid #ddd;border-radius:8px;min-height:200px;">
        <header style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">Archived ({{ archivedList?.length || 0 }})</header>
        <Draggable v-model="archivedList" item-key="id" group="cards" tag="div" @change="onDraggableChange">
          <div v-for="element in archivedList" :key="element.id" :data-id="element.id" style="margin:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px;">
            <div style="font-weight:600;">{{ element.title }}</div>
            <div style="font-size:12px;color:#666;">pos {{ element.position }}</div>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button @click="() => promptDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Fecha</button>
              <button @click="() => clearDue(element)" style="font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;">Quitar</button>
            </div>
          </div>
          <template #footer>
            <div v-if="!archivedList?.length" style="color:#999;font-size:12px;padding:8px;">Sin cards</div>
          </template>
        </Draggable>
      </section>
    </div>
  </main>
  </template>
