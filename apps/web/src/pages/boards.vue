<script setup lang="ts">
import axios from "axios";
import { onMounted, ref } from "vue";
import { useAuthStore } from "../stores/auth";

const boards = ref<Array<Record<string, unknown>>>([]);
const error = ref("");
const auth = useAuthStore();

onMounted(async () => {
  try {
    const res = await axios.get("/api/boards", { headers: auth.authHeader() });
    boards.value = res.data.boards || [];
  } catch {
    error.value = "No autorizado";
  }
});
</script>

<template>
  <main style="padding:2rem;">
    <h1>Boards</h1>
    <div v-if="error" style="color:#c00">{{ error }}</div>
    <ul>
      <li v-for="b in boards" :key="b.id">{{ b.name || 'Board' }}</li>
    </ul>
  </main>
</template>
