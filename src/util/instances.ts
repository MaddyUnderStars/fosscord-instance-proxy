import fs from "fs";
import path from "path";

interface InstanceSettings {
  name: string;
  api: string;
  baseUrl: string;
  token: string;
}

interface Settings {
  instances: InstanceSettings[];
  defaultInstance: number;
  user: any;
}

export const readSettings = () => {
  const file = fs.readFileSync(path.join(process.cwd(), "settings.json"));
  const text = file.toString();
  return JSON.parse(text) as Settings;
};

export const findIds = (obj: any, depth = 5): string[] => {
  if (depth == 0) return [];

  var ret: string[] = [];
  for (var [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object")
      ret = ret.concat(findIds(value, depth - 1));

    if (value && !(value as any).toString) {
      // prevent objects with null prototype from throwing when we convert to string later
      continue;
    }
    // bad way of checking if it looks like a proper snowflake
    if (
      !value ||
      value == "null" ||
      value == "undefined" ||
      typeof value == "symbol"
    )
      continue;
    if (!Number(value)) continue;

    if ((value as any).toString().length < 17) continue;

    // const index = key.toLowerCase().indexOf("id");
    // if (index == -1) continue;
    // if (index != key.length - 2) continue;

    ret.push(value as string);
  }
  return ret;
};

export const rewriteUpstreamMessage = (
  data: any,
  instance: Instance,
  depth = 5
) => {
  if (depth == 0) return data;
  depth--;

  for (var [key, value] of Object.entries(data)) {
    if (!value) continue;

    if (typeof value == "object") {
      data[key] = rewriteUpstreamMessage(value, instance, depth);
    }

    if (key === "member" && data[key].id == instance.userId)
      data[key] = {
        deaf: false,
        guild_id: data[key].guild_id,
        id: instance.userId,
        index: 1,
        joined_at: new Date().toString(),
        joined_by: null,
        last_message_id: data[key].last_message_id,
        mute: false,
        nick: null,
        pending: false,
        premium_since: null,
        roles: data[key].roles,
      };

    if (data[key] == instance.userId) data[key] = InstanceManager.user.id;
  }
  return data;
};

export class Instance {
  api: string;
  token: string;
  name: string;
  baseUrl: string;
  userId?: string;

  controlledIds: Set<string> = new Set();

  constructor(data: InstanceSettings) {
    this.name = data.name;
    this.api = data.api;
    this.token = data.token;
    this.baseUrl = data.baseUrl;
  }
}

export class InstanceManager {
  static instances: Instance[] = [];
  static default: number;

  static user: any;

  static load = () => {
    var settings = readSettings();
    for (var instance of settings.instances) {
      this.instances.push(new Instance(instance));
    }
    this.default = settings.defaultInstance;
    this.user = settings.user;
  };

  static findControllerById = (ids: string | string[]) => {
    if (typeof ids == "string") ids = [ids];

    for (var id of ids) {
      var instance = this.instances.find((x) => x.controlledIds.has(id));
      if (instance) return instance;
    }

    return undefined;
  };
}
