const http = require("http");
const server = http.createServer();
const os = require("os");

const hostname = os.hostname();
const version = os.version();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3000");

let requestCounter = 0;
let echoBody = true;
let consoleLog = true;
let echoContext = false;
let statusCode = 200;
let errorCode = 0;
let errorPct = 0;
let showTime = true;
let delay = 0;

// Store request logs
const requestHistory = [];

const cacheBuffers = {};

const createRandomBuffer = (length) => {
  var buffer = Buffer.alloc(length);

  for (var i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256); // Each byte can be in range from 0 to 255
  }
  return buffer;
};

const createRandomString = (length) => {
  let result = "";
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const cacheStrings = {};

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

const setGlobalSettings = (url) => {
  const [cmd, ..._args] = url.slice(1).split("/");
  if (!cmd.startsWith(":")) return;
  ({
    echobody: (value) => (echoBody = value === "true"),
    echocontext: (value) => {
      echoContext = value === "true";
    },
    globalstatuscode: (value) => (statusCode = parseInt(value, 10)),
    consolelog: (value) => (consoleLog = value === "true"),
    showtime: (value) => (showTime = value === "true"),
    delay: (value) => (delay = value),
    errorcode: (error, pct) => {
      errorPct = pct || 1;
      errorCode = error;
    },
  })[cmd.slice(1)]?.call(null, ..._args);
};

const getContent = (ctx) => {
  let res;
  if (ctx.buffer) {
    res = getBuffer(parseInt(ctx.buffer));
  }
  if (ctx.randombuffer) {
    res = createRandomBuffer(parseInt(ctx.randombuffer));
  }
  if (ctx.cachedstring) {
    res = getString(parseInt(ctx.cachedstring));
  }
  if (ctx.string) {
    res = createRandomString(parseInt(ctx.string));
  }
  if (ctx.settings) {
    res = {
      echoContext,
      echoBody,
      consoleLog,
      requestCounter,
      statusCode,
      errorCode,
      errorPct,
      hostname,
      version,
      time: ctx.time.toISOString(),
    };
  }
  if (ctx.log) {
    const n = parseInt(ctx.log);
    res = requestHistory.slice(-n);
  }
  return res;
};

const formatResponseContext = (ctx, body) => ({
  method: ctx.request.method,
  url: ctx.request.url,
  headers: ctx.request.headers,
  cookies: ctx.request.cookies,
  body,
  statusCode: ctx.statusCode,
});

const log = (...args) => consoleLog && console.log(...args);

const cmdFromUrl = (url) => {
  const parts = url.slice(1).split("/");
  if (!parts[0].startsWith(":")) return [];
  return [parts[0].slice(1), parts.slice(1)];
};

const getHeaderCommands = (headers) => {
  const values = Object.entries(headers).reduce((acc, [h, v]) => {
    h = h.toLocaleLowerCase();
    if (h.startsWith("x-cmd-")) {
      acc[h.replace("x-cmd-", "")] = v;
    }
    return acc;
  }, {});
  return {
    ...(values.echocontext && { echoContext: values.echocontext === "true" }),
    ...(values.consolelog && { consoleLog: values.consolelog === "true" }),
    ...(values.statuscode && { statusCode: values.statuscode }),
    ...(values.errorcode && { errorCode: values.errorcode }),
    ...(values.errorpct && { errorPct: values.errorpct }),
    ...(values.showtime && { showTime: values.showtime }),
    ...(isFinite(values.delay) && { delay: values.delay }),
  };
};

const getGlobalSettings = () => ({
  echoBody,
  consoleLog,
  echoContext,
  statusCode,
  errorCode,
  errorPct,
  delay,
  showTime,
});

const getQueryCommands = (url) => {
  const [cmd, _args] = url.slice(1).split("/");
  return {
    ...(cmd == ":statuscode" && { statusCode: _args }),
    ...(cmd == ":echocontext" && { echoContext: _args === "true" }),
    ...(cmd == ":settings" && { settings: true }),
    ...(cmd == ":string" && { string: _args }),
    ...(cmd == ":cachedstring" && { cachedstring: _args }),
    ...(cmd == ":buffer" && { buffer: _args }),
    ...(cmd == ":randombuffer" && { randombuffer: _args }),
    ...(cmd == ":log" && { log: _args }),
  };
};

const getResponseContext = (request) => {
  return {
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      cookies: request.cookies,
    },
    ...getGlobalSettings(),
    ...getQueryCommands(request.url),
    ...getHeaderCommands(request.headers),
    headers: {},
    time: new Date(),
  };
};

const storeRequest = (ctx) => {
  requestHistory.push(ctx);
};

const logRequest = (ctx) => {
  log(` ${ctx.time} ======
    ${ctx.statusCode} ${ctx.request.method} ${ctx.request.url}
    > Headers
    ${JSON.stringify(ctx.request.headers, null, 2)}
    > Body
    ${ctx.body}
  `);
};

server
  .on("request", (request, response) => {
    requestCounter += 1;
    let body = [];
    setGlobalSettings(request.url);
    const ctx = getResponseContext(request);
    request
      .on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        if (ctx.errorCode && ctx.errorCode != "200" && requestCounter % ctx.errorPct == 0) {
          ctx.statusCode = ctx.errorCode;
        }

        let content = getContent(ctx);

        if (ctx.echoContext || (typeof content == "object" && !Buffer.isBuffer(content))) {
          ctx.headers["Content-Type"] = "application/json";
        }

        logRequest(ctx, content);
        storeRequest(ctx);
        console.log(JSON.stringify(ctx, null, 2), content);

        response.statusCode = ctx.statusCode;
        Object.entries(ctx.headers).forEach(([h, v]) => response.setHeader(h, v));

        if (ctx.echoBody) {
          if (ctx.echoContext) {
            content = formatResponseContext(ctx, content);
          }
          if (content) {
            if (typeof content == "object") {
              response.write(JSON.stringify(content, null, 2));
            } else {
              response.write(content);
            }
          }
        }

        if (delay > 0) {
          setTimeout(() => {
            response.end();
          }, delay);
        } else {
          response.end();
        }
      });
  })
  .listen({ host: HOST, port: PORT });
