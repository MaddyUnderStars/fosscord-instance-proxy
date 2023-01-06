import express from "express";
import rewire from "./middleware/rewire.js";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { InstanceManager } from "../util/instances.js";

export default class Api {
  app: express.Application;

  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(bodyParser.json());

    this.app.use("/api/", rewire);

    this.app.use(
      `/avatars/${InstanceManager.user.id}/${InstanceManager.user.avatar}.webp`,
      (res, req) => {
        req.sendFile(
          path.join(process.cwd(), "public", "assets", "avatar.webp")
        );
      }
    );

    this.app.use(
      `/banners/${InstanceManager.user.id}/${InstanceManager.user.banner}.webp`,
      (res, req) => {
        req.sendFile(
          path.join(process.cwd(), "public", "assets", "banner.gif")
        );
      }
    );

    // cdn
    this.app.use("/assets/", rewire);
    this.app.use("/avatars/", rewire);
    this.app.use("/attachments/", rewire);
    this.app.use("/banners/", rewire);
    this.app.use("/icons/", rewire);
    this.app.use("/emojis/", rewire);

    this.app.use("*", (res, req) => {
      req.sendFile(path.join(process.cwd(), "public", "index.html"));
    });
  }

  start = () => {};

  stop = () => {};
}
