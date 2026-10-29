import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);

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

