// A timeout is an uncertain write, not a cancellation. Retrying checks the
// server receipt for the same UID before attempting another atomic create.
export async function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            "The connection is taking too long. Your response may still be processing; retry to check its status.",
          ),
        ),
      milliseconds,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
