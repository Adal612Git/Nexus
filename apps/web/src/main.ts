import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.mount("#app");

// Expose Pinia stores map in dev for console debugging
if (import.meta.env.DEV) {
  // @ts-ignore
  (window as any).$pinia = (pinia as any)._s;
}
