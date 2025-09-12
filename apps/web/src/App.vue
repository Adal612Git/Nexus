<script setup lang="ts"></script>

<template>
  <main style="padding:2rem;font-family:system-ui, sans-serif;">
    <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <h1>Nexus Web</h1>
      <nav style="display:flex;gap:12px">
        <router-link to="/login">Login</router-link>
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/boards">Boards</router-link>
        <router-link to="/settings/integrations">Integraciones</router-link>
      </nav>
    </header>
    <router-view />
  </main>
</template>

<style scoped>
main { max-width: 820px; margin: 0 auto; }
</style>
