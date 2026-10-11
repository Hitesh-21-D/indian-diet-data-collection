import { expect, it, vi } from "vitest";
import { withTimeout } from "../../src/timeout";
it("allows a confirmed result and surfaces uncertain network completion", async () => {
  expect(await withTimeout(Promise.resolve("receipt"), 100)).toBe("receipt");
  vi.useFakeTimers();
  const operation = withTimeout(new Promise(() => {}), 25000);
  const assertion = expect(operation).rejects.toThrow(
    "may still be processing",
  );
  await vi.advanceTimersByTimeAsync(25000);
  await assertion;
  vi.useRealTimers();
});
