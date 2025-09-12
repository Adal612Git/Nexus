<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const email = ref("");
const password = ref("");
const show = ref(false);
const remember = ref(true);
const error = ref("");

const router = useRouter();
const auth = useAuthStore();

async function onSubmit() {
  error.value = "";
  const validEmail = /.+@.+\..+/.test(email.value);
  if (!validEmail || password.value.length < 8) {
    error.value = "Credenciales inválidas";
    return;
  }
  try {
    await auth.login(email.value, password.value, remember.value);
    const redirect = (router.currentRoute.value.query.redirect as string) || "/dashboard";
    await router.push(redirect);
  } catch {
    error.value = "Credenciales inválidas";
  }
}
</script>

<template>
  <main style="padding:2rem;max-width:420px;margin:0 auto;">
    <h1>Iniciar sesión</h1>
    <form @submit.prevent="onSubmit">
      <label>Email</label>
      <input v-model.trim="email" type="email" required style="width:100%;padding:8px" />
      <label style="margin-top:8px;display:block">Contraseña</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input :type="show ? 'text' : 'password'" v-model="password" minlength="8" required style="flex:1;padding:8px" />
        <button type="button" @click="show=!show">{{ show ? 'Ocultar' : 'Mostrar' }}</button>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <input type="checkbox" v-model="remember" /> Recordarme
      </label>
      <div v-if="error" style="color:#c00;margin-top:8px">{{ error }}</div>
      <button type="submit" style="margin-top:12px">Entrar</button>
    </form>
    <p style="margin-top:12px">
      <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
    </p>
  </main>
  </template>

<style scoped>
label { font-weight: 600; }
</style>
