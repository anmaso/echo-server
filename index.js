const express = require("express");
const os = require("os");
const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3000");

// Global settings object
const getDefaultConfig = () => ({
  requestCounter: 0,
  consoleLog: true,
  consoleCompact: false,
  echoContext: false,
  hostname: os.hostname(),
  version: os.version(),
  urlConfigs: {
  },
  allUrls: {
    delay: 0,
    errorCode: 0,
    errorPct: 0,
    statusCode: 200,
    counter: {},
  }
});

let settings = getDefaultConfig();

// Storage
const requestHistory = [];
const storedResponses = {};
const cacheBuffers = {};
const cacheStrings = {};

const addStat = (path, method) => {
  settings.urlConfigs[path] ||= {};
  settings.urlConfigs[path].counter ||= {};
  settings.urlConfigs[path].counter[method] ||= 0;
  settings.urlConfigs[path].counter[method]++;
};

// Utility functions
const fmtDate = (date) => {
  let year = date.getFullYear();
  let month = ("0" + (date.getMonth() + 1)).slice(-2);
  let day = ("0" + date.getDate()).slice(-2);
  let hours = ("0" + date.getHours()).slice(-2);
  let minutes = ("0" + date.getMinutes()).slice(-2);
  let seconds = ("0" + date.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const createRandomBuffer = (length) => {
  const buffer = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
};

const createRandomString = (length) => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const getString = (length) => {
  const str = cacheStrings[length] || createRandomString(length);
  cacheStrings[length] = str;
  return str;
};

const getBuffer = (length) => {
  const buffer = cacheBuffers[length] || createRandomBuffer(length);
  cacheBuffers[length] = buffer;
  return buffer;
};

const formatResponseContext = (ctx, body) => ({
  method: ctx.request.method,
  url: ctx.request.url,
  headers: ctx.request.headers,
  cookies: ctx.request.cookies,
  body,
  statusCode: ctx.statusCode,
});

const log = (...args) => settings.consoleLog && console.log(...args);

const logRequest = (ctx) => {
  if (settings.consoleCompact) {
    log(`${fmtDate(ctx.time)} ${ctx.settings.statusCode} ${ctx.request.method} ${ctx.request.url}`);
    return;
  }
  log(`${fmtDate(ctx.time)} ======
    ${ctx.settings.statusCode} ${ctx.request.method} ${ctx.request.url}
    > Headers
    ${JSON.stringify(ctx.request.headers, null, 2)}
    > Body
    ${ctx.body}
  `);
};

// Middleware
app.use(express.text({ type: "*/*" }));
app.disable("etag");
app.set("json spaces", 4);

app.use(async (req, res, next) => {
  settings.requestCounter += 1;

  let path = req.path;
  req.ctx = {
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers,
      cookies: req.cookies,
      ...(req.params.length && { params: req.params }),
      ...(req.query.length && { query: req.query }),
    },
    settings: { ...settings.allUrls, ...settings.urlConfigs[path] },
    response: { headers: {} },
    time: new Date(),
  };
  addStat(path, req.method);
  next();
});

app.all(/\.config.*/, (req, res) => {
  let { path, delay, statusCode, errorCode, errorPct, reset, string, stringCache, stats, log, body, echoBody } = req.query;
  let config = settings.allUrls;
  let content
  if (reset) {
    if (path) {
      settings.urlConfigs[path] = {}
    } else {
      settings = getDefaultConfig();

    }
  }
  if (path) {
    config = settings.urlConfigs[path] || {}
    settings.urlConfigs[path] = config;
  }
  if (path && body) {
    if (req.method == "POST") {
      config.body = req.body
    } else {
      config.body = body;
    }
  }
  if (path && echoBody) {
      config.echoBody = echoBody=="true"
  }
  if (delay) {
    config.delay = parseInt(delay, 10);
  }
  if (statusCode) {
    config.statusCode = parseInt(statusCode, 10);
  }
  if (errorCode) {
    config.errorCode = parseInt(errorCode, 10);
  }
  if (errorPct) {
    config.errorPct = parseInt(errorPct, 10);
  }
  if (string) {
    content = createRandomString(parseInt(string))
  }
  if (stringCache) {
    content = getString(parseInt(stringCache))
  }
  if (stats) {

    if (!path || path == '*') {
      content = Object.entries(settings.urlConfigs).reduce((acc, [k, v]) => ({ ...acc, ...(v.counter && { [k]: v.counter }) }), {})
    } else {
      content = settings.urlConfigs[path]?.counter || {}
    }
  }
  if (log) {
    content = requestHistory.slice(-parseInt(log));
  }
  if (Object.keys(req.query).length == 0) {
    content = settings
  }
  handleResponse(req, res, content);
});

async function handleResponseLogic(req, res, content = null) {
  const ctx = req.ctx;

  const SETTINGS = { ...settings.allUrls, ...settings.urlConfigs[req.path] };
  let code = SETTINGS.statusCode;

  // Handle error simulation
  if (SETTINGS.errorCode && ctx.settings.errorCode != "200" && settings.requestCounter % ctx.settings.errorPct == 0) {
    ctx.settings.statusCode = ctx.settings.errorCode;
  }

  // Set content type if needed
  if (ctx.settings.echoContext || (typeof content == "object" && !Buffer.isBuffer(content))) {
    ctx.response.headers["Content-Type"] = "application/json; charset=utf-8";
  }

  // Log and store request
  logRequest(ctx);
  requestHistory.push(ctx);

  // Set status code and headers
  res.status(parseInt(ctx.settings.statusCode));

  Object.entries(ctx.response.headers).forEach(([h, v]) => res.setHeader(h, v));
  removeExpressHeaders(res);

  // Handle response content
  let url = req.url;
  let configuredResponse = settings.urlConfigs[url]?.body;
  content = content || configuredResponse || (req.method != "GET" && req.body) || { ...ctx, settings: undefined };
  if (ctx.settings.echoBody) {
    content = ctx.request.body;
  }
  if (ctx.settings.echoContext) {
    content = formatResponseContext(ctx, content);
  }
  if (content) {
    if (typeof content == "object") {
      res.json(content);
    } else {
      res.send(content);
    }
  }
  res.end();
}

function removeExpressHeaders(res) {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Date");
  res.removeHeader("Connection");
  res.removeHeader("Keep-Alive");
}

// Generic response handler
async function handleResponse(req, res, content = null) {
  setTimeout(() => {
    handleResponseLogic(req, res, content);
  }, req.ctx.settings.delay);
}

app.all(/(.*)/, async (req, res) => {
  let url = req.url;
  console.log("catch all *", url);
  let configuredResponse = settings.urlConfigs[url]?.body;
  await handleResponse(req, res, configuredResponse || req.ctx);
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
