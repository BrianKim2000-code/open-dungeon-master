// Next's startup hook: the one code path a standalone server is guaranteed
// to run exactly once, which makes it the home for the background job loop.
// Guarded to the node runtime because register() is also evaluated for the
// edge bundle, where there is no database and no interval to own. Every
// node-only import stays inside that guard, so the edge bundle never traces it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobRunner } = await import("@/lib/jobs");
    startJobRunner();

    if (process.env.NEXT_PHASE !== "phase-production-build") {
      // Event loop delay for the admin's metrics (src/lib/metrics.ts).
      const { startProcessMetrics } = await import("@/lib/metrics");
      startProcessMetrics();

      // Player decision webhooks, when the operator allowed receiver origins
      // (src/lib/agents/webhooks.ts). A failure must not stop the server.
      try {
        const { startPlayerWebhookRunner } = await import("@/lib/agents/webhooks");
        startPlayerWebhookRunner();
      } catch (error) {
        console.error("[player-webhooks] could not start", error);
      }

      // A server nobody has signed up to yet prints the one-time code that
      // claims its admin account (src/lib/setup-code.ts). The operator
      // reads it in the log; a stranger who found the port first cannot.
      try {
        const { announceSetupCode } = await import("@/lib/setup-code");
        announceSetupCode();
      } catch (error) {
        console.error("[setup] could not check for a first account", error);
      }

      // Rules PDFs read by the old first-page-only reader get their whole
      // book, once (src/lib/dm/lore-attachments.ts).
      void import("@/lib/dm/lore-attachments")
        .then(({ rereadRulesAttachments }) => rereadRulesAttachments())
        .catch((error) => console.error("[lore] rules PDF re-read failed", error));
    }
  }
}
