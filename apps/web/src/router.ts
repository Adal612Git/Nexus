import { createRouter, createWebHistory } from "vue-router";
import Login from "./pages/login.vue";
import Forgot from "./pages/forgot-password.vue";
import Reset from "./pages/reset-password.vue";
import Dashboard from "./pages/dashboard.vue";
import Boards from "./pages/boards.vue";
import { useAuthStore } from "./stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: { name: "login" } },
    { path: "/login", name: "login", component: Login },
    { path: "/forgot-password", name: "forgot", component: Forgot },
    { path: "/reset-password", name: "reset", component: Reset },
    { path: "/dashboard", name: "dashboard", component: Dashboard, meta: { requiresAuth: true } },
    { path: "/boards", name: "boards", component: Boards, meta: { requiresAuth: true } },
    {
      path: "/settings/integrations",
      name: "integrations",
      component: () => import("./pages/settings/integrations.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) {
    await auth.init();
  }
  const needsAuth = to.matched.some((r) => r.meta?.requiresAuth);
  if (needsAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && auth.isAuthenticated) {
    return { name: "dashboard" };
  }
  return true;
});

export default router;
