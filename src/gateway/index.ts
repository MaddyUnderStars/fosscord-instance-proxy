import http from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";
import {
  findIds,
  Instance,
  InstanceManager,
  rewriteUpstreamMessage,
} from "../util/instances.js";
import GatewayClient from "./client/index.js";
import crypto from "crypto";
import zlib from "fast-zlib";
import erlpack from "erlpack";

export default class Gateway {
  socketServer!: WebSocketServer;

  clients: GatewayClient[] = [];

  session_id?: string;
  inflate?: zlib.Inflate;
  deflate?: zlib.Deflate;

  merged_ready?: any;

  constructor() {}

  start = async (server: http.Server) => {
    for (var instance of InstanceManager.instances) {
      var client = new GatewayClient(instance);
      await client.login();

      this.clients.push(client);
    }

    this.socketServer = new WebSocketServer({
      server: server,
    });

    this.socketServer.on("connection", this.handleConnection);
  };

  handleConnection = async (socket: WebSocket) => {
    console.log("new downstream connection");

    this.inflate = new zlib.Inflate();
    this.deflate = new zlib.Deflate();

    socket.send(this.encode({ op: 10, d: { heartbeat_interval: 30000 } }));

    this.session_id = crypto.randomUUID();

    for (let client of this.clients) {
      client.on("message", (data) => {
        data = rewriteUpstreamMessage(data, client.instance);

        if (data.t === "READY") {
          // don't send additional READYs as it will replace the one stored by client
          return (() => {
            // instead send guild_create etc events
          })();
        }

        socket.send(this.encode(data));
      });
    }

    socket.on("message", (data) => this.handleMessage(socket, data));

    socket.on("close", (code, reason) => {
      console.log(`[downstream] closed ${code} : ${reason}`);
      this.stop();
    });
  };

  handleMessage = (socket: WebSocket, data: RawData) => {
    const payload = this.decode(data);
    console.log(`[downstream] recv op ${payload.op} ${payload.t ?? ""}`);

    switch (payload.op) {
      case 1: //heartbeat
        return socket.send(this.encode({ op: 11 }));
      case 2: // identity
        return this.sendMergedReady(socket);
      case 6: // resume
        return socket.close(4006, "Invalid session");
      case 14:
        return this.forwardLazyRequest(payload);
    }
  };

  stop = () => {
    for (var client of this.clients) {
      client.removeAllListeners();
    }
  };

  forwardLazyRequest = (payload: any) => {
    const instance = InstanceManager.findControllerById(findIds(payload));
    if (!instance)
      return console.warn("Could not find instance for lazy request");

    const client = this.clients.find((x) => x.instance.token == instance.token);

    client?.send(payload);
  };

  sendMergedReady = (socket: WebSocket) => {
    const ready = {
      v: 8,
      analytics_token: "",
      connected_accounts: [],
      consents: {
        personalization: {
          consented: false,
        },
      },
      experiments: [],
      friend_suggestion_count: 0,
      geo_ordered_rtc_regions: [],
      guild_experiments: [],
      guild_join_requests: [],
      guilds: [],
      merged_members: [],
      presences: [],
      private_channels: [],
      read_state: { entries: [], partial: false, version: 1 },
      relationships: [],
      session_id: this.session_id,
      sessions: [],
      tutorial: null,
      user: InstanceManager.user,
      user_guild_settings: { entries: [], partial: false, version: 1 },
      user_settings: {},
      users: [],
    } as any; // TODO

    for (var client of this.clients) {
      var clientReady = client.ready;
      if (!clientReady) continue;

      ready.guilds.push(...clientReady.guilds);
      ready.users.push(...clientReady.users);
      ready.private_channels.push(...clientReady.private_channels);
      ready.read_state.entries.push(...clientReady.read_state.entries);
      ready.merged_members.push(...clientReady.merged_members);
      ready.user_guild_settings.entries.push(
        ...clientReady.user_guild_settings.entries
      );
    }

    socket.send(this.encode({ op: 0, t: "READY", s: 0, d: ready }));
  };

  encode = (data: any) => {
    data = JSON.stringify(data);

    data = this.deflate!.process(data);

    // data = erlpack.pack(data);

    return data;
  };

  // TODO move to new file
  decode = (data: RawData) => {
    const LEFT_BRACE_ASCII = 123;
    if (
      typeof data == "string" ||
      (data instanceof Buffer && data[0] == LEFT_BRACE_ASCII)
    ) {
      return JSON.parse(data.toString());
    }

    if (data instanceof Buffer) {
      return erlpack.unpack(data);
    }

    throw new Error("decode error");
  };
}
