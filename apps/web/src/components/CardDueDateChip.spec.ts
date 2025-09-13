import { mount } from "@vue/test-utils";
import { vi } from "vitest";
import CardDueDateChip from "./CardDueDateChip.vue";

vi.mock("../stores/cards", () => {
  return {
    useCardsStore: () => ({
      setDueDate: vi.fn().mockResolvedValue(undefined),
      clearDueDate: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

describe("CardDueDateChip", () => {
  it("renders + fecha when no date and opens picker", async () => {
    const wrapper = mount(CardDueDateChip, { props: { cardId: "c1", projectId: "p1" } });
    expect(wrapper.text()).toContain("+ fecha");
    await wrapper.find("button").trigger("click");
    // shows popup with inputs
    expect(wrapper.find("input[type='datetime-local']").exists()).toBe(true);
  });
});

