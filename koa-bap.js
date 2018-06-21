"use strict";

const Koa = require("koa");
const fs = require("fs");
const path = require("path");

// Config consts
const CFG_BASEPATH = "basepath";
const CFG_BASEPATH_DEFAULT = "/";

const CFG_PORT = "port";

const CFG_BOOTSTRAPS = "bootstraps"
const CFG_BOOTSTRAPS_DEFAULT = [];

class UserError extends Error {
  constructor(msg) {
    super(msg);
    this.expose = true;
    this.status = 400;

    // http.log.error(msg);
  }
}

class InternalError extends Error {
  constructor(msg) {
    super(msg);
    this.expose = false;
    this.status = 500;

    // http.log.error(msg);
  }
}

class KoaHttpServerBap extends besh.HttpServerBap {
  constructor(name) {
    super(name);
    
    this.log.info("Initialising ...");

    this.app = new Koa();

    this.log.info("Adding stat for http reqs");

    let base = this.getCfg(CFG_BASEPATH, CFG_BASEPATH_DEFAULT);
    // Make sure there is a leading slash and no trailing slash
    this.base = `/${base.replace(/(^\/+|\/+$)/, "")}`;
    this.log.info(`Using (${this.base}) as API base path`);

    this.log.info("Finished initialising");
  }

  loadBootstraps() {
    let bootstraps = this.getCfg(CFG_BOOTSTRAPS, CFG_BOOTSTRAPS_DEFAULT);

    if (typeof bootstraps === "string") {
      bootstraps = [ bootstraps ];
    }

    if (!Array.isArray(bootstraps) || bootstraps.length === 0) {
      this.log.info("No bootstrap scripts specified");
      return;
    }

    for (let script of bootstraps) {
      try {
        // This gets around the issue of sym links
        besh.require(script)(this);
      } catch(e) {
        throw this.Error(`Can not find bootstrap script ${script}`);
      }
    }
  }

  async start() {
    this.log.info("Starting ...");

    this.loadBootstraps();

    let port = this.getRequiredCfg(CFG_PORT);
    let ip = this.getInterfaceIp();

    this.log.info(`Starting to listening on (${ip}:${port})`);
    this.server = this.app.listen(port, ip);
    this.log.info("Now listening!");

    this.log.info("Started!");
  }

  async stop() {
    this.log.info("Stopping ...");

    this.log.info("Closing port on server now ...");
    this.server.close();
    this.log.info("Port closed");

    this.log.info("Stopped!");
  }

  fullPath(path) {
    if (typeof path !== "string") {
      return this.base;
    }

    path = path.replace(/^\/+/, "").replace(/\/+$/, "");

    if (path) {
      return `${this.base}/${path}`;
    } else {
      return this.base;
    }
  }

  get UserError() {
    return UserError;
  }

  get InternalError() {
    return InternalError;
  }

  getBasicAuth(ctx) {
      let basic = ctx.header("Authorization");
      if (basic === undefined) {
          return null;
      }

      let parts = basic.split(/ +/);
      if (parts.length !== 2 || parts[0].toLowerCase() !== "basic") {
          return null;
      }

      let credentials = Buffer.from(parts[1], "base64").toString("ascii");

      // NOTE: There may be no password so length may be 1 or 2 
      let pair = credentials.split(":");
      if (pair.length > 2) {
          return null;
      }

      let auth = {};
      auth.username = pair[0]

      if (pair.length === 2) {
          auth.password = pair[1];
      } else {
          auth.password = "";
      }

      return auth;
  }

  getCookies(ctx, next) {
      let cookieJar = {};
      //req[this.cookieJar] = cookieJar;

      let cookieList = ctx.header("Cookie");
      if (cookieList === undefined) {
          next();
          return;
      }

      for (let cookie of cookieList.split(/ *; */)) {
          let parts = cookie.split(/ *= */);
          if (parts.length === 2) {
              cookieJar[parts[0]] = parts[1].trim();
          }
      }

      next();
  }
}

// Use the same version as besh
KoaHttpServerBap.version = besh.version;

module.exports = KoaHttpServerBap;
