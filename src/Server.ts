import http from "http";
import Api from "./api/index.js";
import Gateway from "./gateway/index.js";
import { InstanceManager } from "./util/instances.js";

export default class Server {
  api!: Api;
  gateway!: Gateway;
  server!: http.Server;

  listen = async (port: number) => {
    InstanceManager.load();

    this.api = new Api();
    this.gateway = new Gateway();

    this.server = http.createServer(this.api.app);
    this.api.start();
    await this.gateway.start(this.server);

    this.server.listen(port, () => {
      console.log("listening on port", port);
    });
  };
}
