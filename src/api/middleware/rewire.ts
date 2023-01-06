import express from "express";
import fetch from "node-fetch";
import {
  findIds,
  InstanceManager,
  rewriteUpstreamMessage,
} from "../../util/instances.js";

const rewire = async (req: express.Request, res: express.Response) => {
  if (req.method == "OPTIONS") return res.status(204);

  let ids = findIds({ ...req.body, ...req.query, ...[req.url.split("/")] });
  let controller = InstanceManager.findControllerById(ids);
  if (!controller) {
    controller = InstanceManager.instances[InstanceManager.default];
  } else {
    ids.forEach((x) => controller!.controlledIds.add(x));
  }

  req.originalUrl = req.originalUrl.replace(
    InstanceManager.user.id,
    controller.userId!
  );

  const resp = await fetch(`${controller.baseUrl}${req.originalUrl}`, {
    method: req.method,
    body:
      req.method != "GET" && req.method != "HEAD"
        ? JSON.stringify(req.body)
        : undefined,
    headers: {
      "content-type": "application/json",
      authorization: controller.token,
      "X-Fingerprint": req.headers["X-Fingerprint"] as string,
      "X-Super-Properties": req.headers["X-Super-Properties"] as string,
    },
  });

  res.status(resp.status);
  for (var [header, value] of resp.headers.entries()) {
    value = value.replace(".discord.com", ("." + req.get("host")) as string);
    value = value.replace("discord.com", req.get("host") as string);
    res.setHeader(header, value);
  }
  res.setHeader("content-security-policy", "");
  res.setHeader("content-encoding", "");

  let buff = Buffer.from(await resp.arrayBuffer());

  if (req.originalUrl.includes("/api/")) {
    try {
      var payload = JSON.parse(buff.toString());
      ids = findIds(payload);
      ids.forEach((x) => controller!.controlledIds.add(x));

      payload = rewriteUpstreamMessage(payload, controller);
      buff = Buffer.from(JSON.stringify(payload));
    } catch (e) {}
  }

  return res.send(buff);
};

export default rewire;
