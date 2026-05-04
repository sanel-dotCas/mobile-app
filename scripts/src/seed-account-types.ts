import { db, dmsAccountTypesTable } from "@workspace/db";

const SEED_ACCOUNT_TYPES = [
  { name: "Customer Pay", code: "CP", displayOrder: 1, isActive: true },
  { name: "Warranty",     code: "WR", displayOrder: 2, isActive: true },
  { name: "Internal",     code: "IN", displayOrder: 3, isActive: true },
  { name: "Sublet",       code: "SL", displayOrder: 4, isActive: true },
];

async function main() {
  const existing = await db
    .select({ code: dmsAccountTypesTable.code })
    .from(dmsAccountTypesTable);
  const existingCodes = new Set(existing.map((r) => r.code));
  const toInsert = SEED_ACCOUNT_TYPES.filter((t) => !existingCodes.has(t.code));
  if (toInsert.length === 0) {
    console.log("All default account types already present — nothing to insert.");
    process.exit(0);
  }
  await db.insert(dmsAccountTypesTable).values(toInsert);
  console.log(`Seeded ${toInsert.length} account type(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
