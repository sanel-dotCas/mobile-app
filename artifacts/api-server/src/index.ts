import app from "./app";
import { logger } from "./lib/logger";
import { startSubmissionCleanup } from "./lib/submissionCleanup";
import { seedDatabase } from "./lib/seedDatabase";
import { seedServicePackages } from "./routes/service-packages";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedDatabase()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      startSubmissionCleanup();
      seedServicePackages().catch((e) => logger.error({ err: e }, "Service package seeding failed"));
    });
  })
  .catch((err) => {
    logger.error({ err }, "Database seeding failed — aborting startup");
    process.exit(1);
  });
