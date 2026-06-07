import { appConfig } from "./config.js";
import { createServer } from "./server.js";

const app = createServer();

app.listen(appConfig.port, () => {
  console.info("api_server_started", {
    port: appConfig.port
  });
});
