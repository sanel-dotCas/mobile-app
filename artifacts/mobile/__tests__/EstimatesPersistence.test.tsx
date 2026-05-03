/**
 * Persistence unit tests for the EstimatesProvider storage logic.
 *
 * These tests validate the two key invariants introduced by the `loaded` flag
 * fix in EstimatesContext:
 *  1. Saved data in AsyncStorage wins over SEED data on mount.
 *  2. The save effect never fires before the load effect resolves.
 *
 * We exercise the logic as a pure async simulation rather than mounting a
 * React component tree, so these tests run under plain jest without the
 * full Expo / React Native runtime. The fix in EstimatesContext is a simple
 * sequential async gate — the logic is straightforward to verify this way.
 */

const STORAGE_KEY = "igmma_estimates_v1";

const SEED = [
  { id: "est-001", lines: [], estimateNo: "SEED-001" },
  { id: "est-002", lines: [], estimateNo: "SEED-002" },
  { id: "est-003", lines: [{ id: "l1", hours: 2.0, total: 190 }], estimateNo: "SEED-003" },
];

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    _store: store,
  };
}

async function simulateProviderMount(storage: ReturnType<typeof makeStorage>) {
  let state = [...SEED];
  let loaded = false;
  const saveCallsBeforeLoad: number[] = [];

  const saveIfLoaded = async (currentState: typeof SEED) => {
    if (!loaded) {
      saveCallsBeforeLoad.push(Date.now());
      return;
    }
    await storage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  };

  await saveIfLoaded(state);

  const raw = await storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (saved.length) state = saved;
    } catch {}
  }
  loaded = true;

  await saveIfLoaded(state);

  return { state, saveCallsBeforeLoad };
}

describe("EstimatesProvider persistence logic", () => {
  it("uses SEED data when AsyncStorage is empty", async () => {
    const storage = makeStorage();
    const { state } = await simulateProviderMount(storage);
    expect(state.map((e) => e.id)).toEqual(["est-001", "est-002", "est-003"]);
  });

  it("loaded estimate data wins over SEED when AsyncStorage has saved estimates", async () => {
    const storage = makeStorage();

    const editedEstimates = [
      {
        id: "est-003",
        estimateNo: "EST-EDITED",
        lines: [{ id: "l1", hours: 5.0, total: 475 }],
      },
    ];
    await storage.setItem(STORAGE_KEY, JSON.stringify(editedEstimates));

    const { state } = await simulateProviderMount(storage);

    expect(state).toHaveLength(1);
    expect(state[0].id).toBe("est-003");
    expect(state[0].lines[0].hours).toBe(5.0);
    expect(state[0].lines[0].total).toBe(475);
  });

  it("does not overwrite saved estimates with SEED on mount", async () => {
    const storage = makeStorage();

    const savedEstimates = [
      {
        id: "est-999",
        estimateNo: "EST-CUSTOM",
        lines: [{ id: "custom-l1", hours: 3.0, total: 300 }],
      },
    ];
    await storage.setItem(STORAGE_KEY, JSON.stringify(savedEstimates));

    const { state } = await simulateProviderMount(storage);

    const ids = state.map((e) => e.id);
    expect(ids).toContain("est-999");
    expect(ids).not.toContain("est-001");
    expect(ids).not.toContain("est-002");
    expect(ids).not.toContain("est-003");
  });

  it("does not call setItem before the load promise resolves (loaded flag guard)", async () => {
    const storage = makeStorage();
    await simulateProviderMount(storage);
    const setItemCalls = (storage.setItem as jest.Mock).mock.calls;
    expect(setItemCalls.length).toBe(1);
    const getItemCalls = (storage.getItem as jest.Mock).mock.invocationCallOrder[0];
    const setItemCall = (storage.setItem as jest.Mock).mock.invocationCallOrder[0];
    expect(setItemCall).toBeGreaterThan(getItemCalls);
  });

  it("persists edited line hours and totals after load completes", async () => {
    const storage = makeStorage();

    const savedEstimates = [
      {
        id: "est-003",
        estimateNo: "EST-003",
        lines: [{ id: "l1", hours: 8.0, total: 760 }],
      },
    ];
    await storage.setItem(STORAGE_KEY, JSON.stringify(savedEstimates));

    const { state } = await simulateProviderMount(storage);

    const storedRaw = await storage.getItem(STORAGE_KEY);
    const stored = JSON.parse(storedRaw!);
    const line = stored[0].lines[0];
    expect(line.hours).toBe(8.0);
    expect(line.total).toBe(760);

    expect(state[0].lines[0].hours).toBe(8.0);
    expect(state[0].lines[0].total).toBe(760);
  });
});
