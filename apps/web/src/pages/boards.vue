<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useProjectsStore } from "../stores/projects";
import { useCardsStore } from "../stores/cards";

const projects = useProjectsStore();
const cards = useCardsStore();
const currentProjectId = ref<string>("");

const columns = [
  { key: "TODO", title: "To Do" },
  { key: "DOING", title: "Doing" },
  { key: "DONE", title: "Done" },
  { key: "ARCHIVED", title: "Archived" },
] as const;

const grouped = computed(() => {
  const list = currentProjectId.value ? cards.listByProject(currentProjectId.value) : [];
  const map: Record<string, any[]> = { TODO: [], DOING: [], DONE: [], ARCHIVED: [] };
  for (const c of list) map[c.status]?.push(c);
  for (const k of Object.keys(map)) map[k] = map[k].sort((a, b) => a.position - b.position);
  return map;
});

onMounted(async () => {
  await projects.fetch();
  if (projects.list.length) {
    currentProjectId.value = projects.list[0].id;
    await cards.fetch(currentProjectId.value);
  }
});

async function selectProject(id: string) {
  currentProjectId.value = id;
  await cards.fetch(id);
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
      <section v-for="col in columns" :key="col.key" style="border:1px solid #ddd;border-radius:8px;min-height:200px;">
        <header style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">{{ col.title }}</header>
        <ul style="list-style:none;margin:0;padding:8px;display:flex;flex-direction:column;gap:8px;">
          <li v-for="c in grouped[col.key]" :key="c.id" style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px;">
            <div style="font-weight:600;">{{ c.title }}</div>
            <div style="font-size:12px;color:#666;">pos {{ c.position }}</div>
          </li>
          <li v-if="!grouped[col.key]?.length" style="color:#999;font-size:12px;">Sin cards</li>
        </ul>
      </section>
    </div>
  </main>
  </template>
