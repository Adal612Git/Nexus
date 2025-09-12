<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import axios from "axios";

const route = useRoute();
const token = (route.query.token as string) || "";
const password = ref("");
const confirm = ref("");
const message = ref("");
const error = ref("");

async function onSubmit() {
  error.value = "";
  if (password.value.length < 8 || password.value !== confirm.value) {
    error.value = "Contraseña inválida";
    return;
  }
  try {
    await axios.post("/auth/password-reset/confirm", { token, password: password.value });
    message.value = "Tu contraseña fue actualizada";
  } catch {
    error.value = "Enlace inválido o expirado";
  }
}
</script>

<template>
  <main style="padding:2rem;max-width:420px;margin:0 auto;">
    <h1>Restablecer contraseña</h1>
    <div v-if="message">
      <p>{{ message }}</p>
      <p><a href="/login">Ir a login</a></p>
    </div>
    <form v-else @submit.prevent="onSubmit">
      <label>Nueva contraseña</label>
      <input v-model="password" type="password" minlength="8" required style="width:100%;padding:8px" />
      <label style="margin-top:8px;display:block">Confirmar</label>
      <input v-model="confirm" type="password" minlength="8" required style="width:100%;padding:8px" />
      <div v-if="error" style="color:#c00;margin-top:8px">{{ error }}</div>
      <button type="submit" style="margin-top:12px">Actualizar</button>
    </form>
  </main>
  </template>
