// One-shot migration: collapse legacy split credit pools into the v6
// unified `credits` field.
//
//   newCredits  = (existing credits) + imageCredits + videoCredits
//   newPaygCredits = 0  (we don't know retroactively which were PAYG,
//                        so everything moves to the subscription pool.
//                        This is deliberately conservative — PAYG grants
//                        going forward go to paygCredits via the webhook.)
//
// Dry-run by default. Pass `--commit` to actually write.
//
//   npx tsx scripts/backfill-unified-credits.ts            # dry-run
//   npx tsx scripts/backfill-unified-credits.ts --commit   # execute
//
// Writes a report at scripts/backfill-report-<timestamp>.json.

import { adminDb } from "../lib/firebase-admin";
import fs from "node:fs/promises";
import path from "node:path";

const COMMIT = process.argv.includes("--commit");

interface Row {
  id: string;
  email?: string;
  before: { credits?: number; imageCredits?: number; videoCredits?: number; paygCredits?: number };
  newCredits: number;
  delta: number;
  action: "skip" | "update";
  note?: string;
}

async function main() {
  console.log(`${COMMIT ? "⚡ COMMIT" : "🧪 DRY-RUN"} mode`);
  console.log("Reading all users…");

  const snap = await adminDb.collection("users").get();
  console.log(`Found ${snap.size} user docs.`);

  const rows: Row[] = [];
  let willUpdate = 0;
  let willSkip = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const credits      = typeof data.credits === "number" ? data.credits : 0;
    const imageCredits = typeof data.imageCredits === "number" ? data.imageCredits : 0;
    const videoCredits = typeof data.videoCredits === "number" ? data.videoCredits : 0;
    const paygCredits  = typeof data.paygCredits === "number" ? data.paygCredits : 0;
    const legacy = imageCredits + videoCredits;
    const newCredits = credits + legacy;

    const alreadyMigrated = legacy === 0 && typeof data.paygCredits === "number";
    const row: Row = {
      id: doc.id,
      email: data.email,
      before: { credits, imageCredits, videoCredits, paygCredits },
      newCredits,
      delta: legacy,
      action: alreadyMigrated || legacy === 0 ? "skip" : "update",
    };
    if (alreadyMigrated) row.note = "already migrated";
    rows.push(row);
    if (row.action === "update") willUpdate++; else willSkip++;
  }

  const sum = rows.reduce((s, r) => s + r.delta, 0);
  console.log(`\nPlan: update=${willUpdate}  skip=${willSkip}  total credits migrated=${sum}`);
  const sample = rows.filter((r) => r.action === "update").slice(0, 10);
  if (sample.length) {
    console.log("\nSample of updates (first 10):");
    for (const r of sample) {
      console.log(`  ${r.id} ${r.email ?? ""}  +${r.delta}  →  ${r.newCredits}`);
    }
  }

  if (COMMIT) {
    console.log("\nWriting…");
    let done = 0;
    for (const r of rows) {
      if (r.action !== "update") continue;
      await adminDb.collection("users").doc(r.id).update({
        credits: r.newCredits,
        paygCredits: r.before.paygCredits ?? 0,
        imageCredits: 0,
        videoCredits: 0,
      });
      done++;
      if (done % 50 === 0) console.log(`  …${done} updated`);
    }
    console.log(`✓ Updated ${done} users.`);
  } else {
    console.log("\n(dry-run — pass --commit to apply)");
  }

  const outPath = path.join(__dirname, `backfill-report-${Date.now()}.json`);
  await fs.writeFile(outPath, JSON.stringify({ committed: COMMIT, willUpdate, willSkip, totalMigrated: sum, rows }, null, 2));
  console.log(`\nReport: ${outPath}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
