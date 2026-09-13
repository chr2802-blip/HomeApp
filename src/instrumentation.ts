import type { Instrumentation } from "next";

/**
 * Anything thrown while handling a request lands here. It is written as one JSON line
 * so the hosting platform's log search can filter on the fields rather than on free
 * text, and so a stack trace stays attached to the request that produced it.
 *
 * Errors are deliberately not stored in the database: they arrive in bursts, they are
 * unbounded in size, and a table of them would need its own pruning and paging to be
 * useful. The admin page reports how often requests failed; the detail lives here.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const { message, stack, name } = normalise(error);

  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      name,
      message,
      path: request.path,
      method: request.method,
      router: context.routerKind,
      route: context.routePath,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
      stack,
      at: new Date().toISOString(),
    }),
  );
};

function normalise(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error), stack: undefined };
}
