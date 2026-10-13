import { purgeDueAccounts } from "@/lib/account-deletion";
import { syncAssistantRelay } from "@/lib/agents/assistant-relay";
import {
  listIdleActiveCampaigns,
  listMembers,
  markCampaignNudged,
} from "@/lib/db/campaigns";
import { notifyUsers } from "@/lib/db/notifications";
import { retentionDue, runRetention } from "@/lib/ops/retention";
import { pruneExpiredSessions } from "@/lib/db/users";

// Background chores: the idle-table nudge, the daily
// storage tidy. One interval on globalThis (login-throttle pattern),
// started from src/instrumentation.ts, because a standalone Next server has
// no custom entry point of its own and dev HMR would strand a module-scoped
// timer.
//
// The decision logic is pure and takes the clock as an argument so the test
// harness can drive time (scripts/test-jobs.mjs); the tick functions only
// fetch candidates, ask the pure helpers, and write the results.

export const JOB_TICK_MS = 60_000;

const IDLE_AFTER_MS = 4 * 24 * 60 * 60 * 1000;

// One nudge per idle stretch: a nudge sent after the table's last activity
// already covers this stretch, and only new activity (updated_at moving past
// the nudge) arms the next one. ISO strings compare lexicographically, so no
// date parsing is needed for that half.
export function idleNudgeDue(
  campaign: { status: string; updatedAt: string; idleNudgedAt: string | null },
  now = Date.now(),
): boolean {
  if (campaign.status !== "active") {
    return false;
  }
  const updatedAt = Date.parse(campaign.updatedAt);
  if (!Number.isFinite(updatedAt) || now - updatedAt < IDLE_AFTER_MS) {
    return false;
  }
  return !campaign.idleNudgedAt || campaign.idleNudgedAt < campaign.updatedAt;
}

function idleCampaignJob(now: number) {
  const cutoff = new Date(now - IDLE_AFTER_MS).toISOString();
  for (const campaign of listIdleActiveCampaigns(cutoff)) {
    if (!idleNudgeDue(campaign, now)) {
      continue;
    }
    markCampaignNudged(campaign.id);
    notifyUsers(
      listMembers(campaign.id).map((member) => member.userId),
      {
        campaignId: campaign.id,
        kind: "campaign_idle",
        body: `The table misses you: ${campaign.title} has been quiet for a few days.`,
      },
    );
  }
}

// Expired sign-ins. The session lookup refuses them by date already; this
// only keeps the table from growing (src/lib/db/users.ts).
function expiredSessionsJob(now: number) {
  pruneExpiredSessions(new Date(now).toISOString());
}

// Accounts whose deletion grace period has run out (src/lib/account-deletion.ts).
function accountPurgeJob(now: number) {
  purgeDueAccounts(now);
}

// A device world's assistant links follow its shared address to the
// broker (src/lib/agents/assistant-relay.ts). Async, so it is started here
// and finishes on its own; it never runs two passes at once.
function assistantRelayJob(now: number) {
  void syncAssistantRelay(now).catch((error) => console.error("[jobs] assistant-relay failed", error));
}

// The daily tidy of what nothing reads back (src/lib/ops/retention.ts).
// Async and batched, so a long event log never holds the table up.
function retentionJob(now: number) {
  if (retentionDue(now)) {
    void runRetention(now).catch((error) => console.error("[jobs] retention failed", error));
  }
}

const jobs: Array<[name: string, run: (now: number) => void]> = [
  ["expired-sessions", expiredSessionsJob],
  ["idle-campaigns", idleCampaignJob],
  ["account-purge", accountPurgeJob],
  ["assistant-relay", assistantRelayJob],
  ["retention", retentionJob],
];

// One pass over every job. Exported so the test harness can drive ticks with
// its own clock instead of waiting a minute per assertion.
export function runJobsOnce(now = Date.now()) {
  for (const [name, run] of jobs) {
    try {
      run(now);
    } catch (error) {
      // One failing job must not take its siblings, or the loop, down.
      console.error(`[jobs] ${name} failed`, error);
    }
  }
}

declare global {
  var __odmJobRunner: ReturnType<typeof setInterval> | undefined;
}

export function startJobRunner() {
  if (globalThis.__odmJobRunner) {
    return;
  }
  const timer = setInterval(() => runJobsOnce(), JOB_TICK_MS);
  // The loop must never be the reason the process stays alive.
  timer.unref?.();
  globalThis.__odmJobRunner = timer;
}
