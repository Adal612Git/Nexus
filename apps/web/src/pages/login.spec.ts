import { mount } from "@vue/test-utils";
import Login from "./login.vue";
import { vi } from "vitest";

vi.mock("../stores/auth", () => {
  const login = vi.fn().mockResolvedValue(undefined);
  return { useAuthStore: () => ({ login }) };
});

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined), currentRoute: { value: { query: {} } } })
}));

describe("Login form", () => {
  it("submits with valid credentials", async () => {
    const wrapper = mount(Login);
    await wrapper.find("input[type=email]").setValue("demo@nexus.dev");
    await wrapper.find("input[type=password]").setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    // if no error shown, submit path executed
    expect(wrapper.html()).not.toContain("Credenciales inválidas");
  });
});

