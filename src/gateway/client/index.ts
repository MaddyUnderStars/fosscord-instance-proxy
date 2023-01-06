import { WebSocket, RawData } from "ws";
import fetch from "node-fetch";
import { findIds, Instance } from "../../util/instances.js";
import EventEmitter from "events";

export default class GatewayClient extends EventEmitter {
  instance: Instance;
  socket?: WebSocket;
  private heartbeater?: NodeJS.Timer;
  private sequence: number = -1;

  ready?: any;

  constructor(instance: Instance) {
    super();
    this.instance = instance;
  }

  login = async () => {
    const gatewayAddress = await this.getGatewayAddress();
    if (!gatewayAddress) {
      console.warn(`could not get gateway URL for ${this.instance.name}`);
      return;
    }
    console.log(
      `[upstream ${this.instance.name}] gateway url is ${gatewayAddress}`
    );
    this.socket = new WebSocket(gatewayAddress);

    this.socket.on("message", this.handleMessage);

    this.socket.on("open", () => {
      this.identify();
    });

    this.socket.on("close", (code, reason) => {
      console.log(
        `[upstream ${this.instance.name}] closed ${code} : ${reason}`
      );
    });
  };

  handleMessage = async (data: RawData) => {
    const payload = this.decode(data);
    console.log(
      `[upstream ${this.instance.name}] recv op ${payload.op} ${
        payload.t ?? ""
      }`
    );

    const ids = findIds(payload);
    ids.forEach((x) => this.instance.controlledIds.add(x));

    if (payload.op != 11) this.emit("message", payload);

    switch (payload.op) {
      case 10: // hello
        this.startHeartbeater(payload.d.heartbeat_interval);
        return;
      case 0: // dispatch
        return this.handleDispatch(payload);
    }
  };

  handleDispatch = async (payload: any) => {
    this.sequence++;

    switch (payload.t) {
      case "READY":
        console.log(`[upstream ${this.instance.name}] ready`);
        this.ready = payload.d;
        this.instance.userId = this.ready.user.id;
        return;
    }
  };

  identify = async () => {
    const payload = {
      op: 2,
      d: {
        token: this.instance.token,
        capabilities: 1021,
        properties: {
          os: "Windows",
          browser: "Firefox",
          device: "",
          system_locale: "en-US",
          browser_user_agent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:106.0) Gecko/20100101 Firefox/106.0",
          browser_version: "106.0",
          os_version: "10",
          referrer: "",
          referring_domain: "",
          referrer_current: "",
          referring_domain_current: "",
          release_channel: "stable",
          client_build_number: 155587,
          client_event_source: null,
        },
        presence: {
          status: "online",
          since: 0,
          activities: [],
          afk: false,
        },
        compress: false,
        client_state: {
          guild_hashes: {},
          highest_last_message_id: "0",
          read_state_version: 0,
          user_guild_settings_version: -1,
          user_settings_version: -1,
          private_channels_version: "0",
        },
      },
    };

    this.send(payload);
  };

  startHeartbeater = (interval: number) => {
    if (this.heartbeater) return;

    this.heartbeater = setInterval(() => {
      this.send({
        op: 1,
        d: this.sequence < 0 ? null : this.sequence,
      });
    }, interval);
  };

  getGatewayAddress = async () => {
    const resp = await fetch(`${this.instance.api}/gateway`);

    const json = (await resp.json()) as any;
    if (!json.url) return null;

    return json.url as string;
  };

  decode = (data: RawData) => {
    const LEFT_BRACE_ASCII = 123;
    if (
      typeof data == "string" ||
      (data instanceof Buffer && data[0] == LEFT_BRACE_ASCII)
    ) {
      return JSON.parse(data.toString());
    }

    throw new Error("decode error");
  };

  send = (payload: any) => {
    // TODO erlpack and compression
    return this.socket?.send(JSON.stringify(payload));
  };
}
