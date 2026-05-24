import { mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";

interface Row {
  id: string;
  name: string;
  value: number;
}

const helper = createColumnHelper<Row>();
const baseColumns = [
  helper.accessor("id", { header: "ID", size: 80 }),
  helper.accessor("name", { header: "Name", size: 160 }),
  helper.accessor("value", { header: "Value", size: 100 }),
];

const sampleRows: Row[] = [
  { id: "r1", name: "Alpha", value: 10 },
  { id: "r2", name: "Bravo", value: 30 },
  { id: "r3", name: "Charlie", value: 20 },
];

function mountTable(propsOverrides: Record<string, unknown> = {}): VueWrapper {
  const Host = defineComponent({
    components: { DataTable },
    props: {
      passProps: {
        type: Object as () => Record<string, unknown>,
        default: () => ({}),
      },
    },
    setup(props) {
      return () =>
        h(DataTable as never, {
          data: sampleRows,
          columns: baseColumns,
          rowKey: "id",
          enableVirtualization: false,
          ...props.passProps,
        });
    },
  });
  return mount(Host, { props: { passProps: propsOverrides } });
}

describe("DataTable", () => {
  it("renders the empty state when data is empty", async () => {
    const wrapper = mountTable({ data: [], emptyMessage: "Nothing to show" });
    await nextTick();
    expect(wrapper.text()).toContain("Nothing to show");
  });

  it("renders the loading state when loading is true", async () => {
    const wrapper = mountTable({ data: [], loading: true, loadingMessage: "Loading rows" });
    await nextTick();
    expect(wrapper.text()).toContain("Loading rows");
  });

  it("renders all rows when virtualization is disabled", async () => {
    const wrapper = mountTable();
    await nextTick();
    const bodyRows = wrapper.findAll(".cv-dt-body-row");
    expect(bodyRows).toHaveLength(sampleRows.length);
  });

  it("toggles sort on header click and updates aria-sort", async () => {
    const wrapper = mountTable();
    await nextTick();
    const nameHeader = wrapper
      .findAll(".cv-dt-header-cell")
      .find((node) => node.text().includes("Name"))!;
    expect(nameHeader.attributes("aria-sort")).toBe("none");

    await nameHeader.trigger("click");
    await nextTick();
    expect(nameHeader.attributes("aria-sort")).toBe("ascending");

    await nameHeader.trigger("click");
    await nextTick();
    expect(nameHeader.attributes("aria-sort")).toBe("descending");
  });

  it("toggles sort on Enter keypress on a focused header", async () => {
    const wrapper = mountTable();
    await nextTick();
    const nameHeader = wrapper
      .findAll(".cv-dt-header-cell")
      .find((node) => node.text().includes("Name"))!;
    await nameHeader.trigger("keydown", { key: "Enter" });
    await nextTick();
    expect(nameHeader.attributes("aria-sort")).toBe("ascending");
  });

  it("applies the data-density attribute to the container", async () => {
    const wrapper = mountTable({ density: "compact" });
    await nextTick();
    expect(wrapper.find(".commandvue-datatable").attributes("data-density")).toBe("compact");

    await wrapper.setProps({ passProps: { density: "spacious" } });
    await nextTick();
    expect(wrapper.find(".commandvue-datatable").attributes("data-density")).toBe("spacious");
  });

  it("emits row-click with the underlying row data on body row click", async () => {
    const wrapper = mountTable();
    await nextTick();
    await wrapper.findAll(".cv-dt-body-row")[1]!.trigger("click");
    const dt = wrapper.findComponent(DataTable) as unknown as VueWrapper;
    const events = dt.emitted("row-click");
    expect(events).toBeDefined();
    expect(events![0]![0]).toEqual(sampleRows[1]);
  });

  it("applies the sticky-header class when stickyHeader is true", async () => {
    const wrapper = mountTable({ stickyHeader: true });
    await nextTick();
    expect(wrapper.find(".cv-dt-thead").classes()).toContain("cv-dt-sticky-header");
  });

  it("filters rows when the global filter prop changes", async () => {
    const wrapper = mountTable({ globalFilter: "Bravo" });
    await nextTick();
    const bodyRows = wrapper.findAll(".cv-dt-body-row");
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]!.text()).toContain("Bravo");
  });

  it("supports multi-row selection with Ctrl+click", async () => {
    const wrapper = mountTable({ selectionMode: "multiple" });
    await nextTick();
    const rows = wrapper.findAll(".cv-dt-body-row");
    await rows[0]!.trigger("click");
    await rows[1]!.trigger("click", { ctrlKey: true });
    await nextTick();
    const dt = wrapper.findComponent(DataTable) as unknown as VueWrapper;
    const events = dt.emitted("selection-change");
    expect(events).toBeDefined();
    const lastEvent = events![events!.length - 1]!;
    const selected = lastEvent[0] as Row[];
    expect(selected.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("respects column visibility state via emitted event after toggling on the table API", async () => {
    const wrapper = mountTable();
    await nextTick();
    const dt = wrapper.findComponent(DataTable) as unknown as VueWrapper;
    const exposed = dt.vm as unknown as {
      table: { getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } };
    };
    exposed.table.getColumn("value").toggleVisibility(false);
    await nextTick();
    const visibilityEvents = dt.emitted("column-visibility-change");
    expect(visibilityEvents).toBeDefined();
    const last = visibilityEvents![visibilityEvents!.length - 1]![0] as Record<string, boolean>;
    expect(last.value).toBe(false);
  });
});
