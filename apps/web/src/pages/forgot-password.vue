<script setup lang="ts">
import { ref } from "vue";
import axios from "axios";

const email = ref("");
const submitted = ref(false);

async function onSubmit() {
  await axios.post("/auth/password-reset/request", { email: email.value }).catch(() => {});
  submitted.value = true;
}
</script>

<template>
  <main style="padding:2rem;max-width:420px;margin:0 auto;">
    <h1>Recuperar contraseña</h1>
    <form @submit.prevent="onSubmit" v-if="!submitted">
      <label>Email</label>
      <input v-model.trim="email" type="email" required style="width:100%;padding:8px" />
      <button type="submit" style="margin-top:12px">Enviar</button>
    </form>
    <p v-else>Si existe, te enviamos instrucciones</p>
  </main>
</template>

