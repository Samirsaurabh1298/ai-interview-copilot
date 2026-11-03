import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { closeDatabase } from "./db/connection.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Gracefully shutting down...`);
    try {
      await app.close();
      await closeDatabase();
      console.log("Database and API shutdown completed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    const address = await app.listen({
      port: config.PORT,
      host: "0.0.0.0",
    });
    console.log(`AI Interview Copilot API running at: ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

