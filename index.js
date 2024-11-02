const http = require("http");
const server = http.createServer();
const os = require("os");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3000");

const settings = {
  requestCounter: 0,
  echoBody: true,
  consoleLog: true,
  consoleCompact: false,
  echoContext: false,
  statusCode: 200,
  errorCode: 0,
  errorPct: 0,
  showTime: true,
  delay: 0,
  hostname: os.hostname(),
  version: os.version(),
};

// Store request logs
const requestHistory = [];

const storedResponses = {};

const cacheBuffers = {};

const fmtDate = (date) => {
  let year = date.getFullYear();
  let month = ("0" + (date.getMonth() + 1)).slice(-2);
  let day = ("0" + date.getDate()).slice(-2);
  let hours = ("0" + date.getHours()).slice(-2);
  let minutes = ("0" + date.getMinutes()).slice(-2);
  let seconds = ("0" + date.getSeconds()).slice(-2);
  let dateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  return dateTime;
};

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

const setGlobalSettings = (url, body) => {
  const [cmd, ..._args] = url.slice(1).split("/");
  if (!cmd.startsWith(":")) return;
  ({
    echobody: (value) => (echoBody = value === "true"),
    echocontext: (value) => {
      echoContext = value === "true";
    },
    globalstatuscode: (value) => (settings.statusCode = parseInt(value, 10)),
    consolelog: (value) => (settings.consoleLog = value === "true"),
    consolecompact: (value) => (settings.consoleCompact = value === "true"),
    showtime: (value) => (settings.showTime = value === "true"),
    delay: (value) => (settings.delay = value),
    globalerrorcode: (error, pct) => {
      settings.errorPct = pct || 1;
      settings.errorCode = error;
    },
    storeresponse: (path) => {
      storedResponses[path] = body;
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
      ...settings,
      time: fmtDate(ctx.time),
    };
  }
  if (ctx.log) {
    const n = parseInt(ctx.log);
    res = requestHistory.slice(-n);
  }
  if (ctx.storedResponses) {
    res = storedResponses;
  }
  if (storedResponses[ctx.request.url.slice(1)]) {
    res = storedResponses[ctx.request.url];
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

const log = (...args) => settings.consoleLog && console.log(...args);

const cmdFromUrl = (url) => {
  const parts = url.slice(1).split("/");
  if (!parts[0].startsWith(":")) return [];
  return [parts[0].slice(1), parts.slice(1)];
};

const getContextFromCommand = (v) => {
  return {
    ...(v.echocontext && { echoContext: v.echocontext[0] === "true" }),
    ...(v.settings && { settings: true }),
    ...(v.consolelog && { consoleLog: v.consolelog === "true" }),
    ...(v.statuscode && { statusCode: v.statuscode }),
    ...(v.errorcode && { errorCode: v.errorcode[0], errorPct: v.errorcode[1] }),
    ...(v.cachedstring && { cachedstring: v.cachedstring[0] }),
    ...(v.string && { string: v.string[0] }),
    ...(v.errorpct && { errorPct: v.errorpct }),
    ...(v.showtime && { showTime: v.showtime }),
    ...(isFinite(v.delay) && { delay: v.delay }),
  };
};

const getQueryCommands = (url) => {
  const [cmd, ..._args] = url.slice(1).split("/");
  return getContextFromCommand({ [cmd.slice(1)]: _args });
};

const getHeaderCommands = (headers) => {
  const values = Object.entries(headers).reduce((acc, [h, v]) => {
    h = h.toLocaleLowerCase();
    if (h.startsWith("x-cmd-")) {
      acc[h.replace("x-cmd-", "")] = v.split(" ");
    }
    return acc;
  }, {});
  return getContextFromCommand(values);
};

const getResponseContext = (request) => {
  return {
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      cookies: request.cookies,
    },
    ...settings,
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
  if (settings.consoleCompact) {
    log(`${fmtDate(ctx.time)} ${ctx.statusCode} ${ctx.request.method} ${ctx.request.url}`);
    return;
  }
  log(`${fmtDate(ctx.time)} ======
    ${ctx.statusCode} ${ctx.request.method} ${ctx.request.url}
    > Headers
    ${JSON.stringify(ctx.request.headers, null, 2)}
    > Body
    ${ctx.body}
  `);
};

server
  .on("request", (request, response) => {
    settings.requestCounter += 1;
    let body = [];
    request
      .on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        setGlobalSettings(request.url, body);
        const ctx = getResponseContext(request);
        if (ctx.errorCode && ctx.errorCode != "200" && settings.requestCounter % ctx.errorPct == 0) {
          ctx.statusCode = ctx.errorCode;
        }

        let content = getContent(ctx);

        if (ctx.echoContext || (typeof content == "object" && !Buffer.isBuffer(content))) {
          ctx.headers["Content-Type"] = "application/json";
        }

        logRequest(ctx, content);
        storeRequest(ctx);
        //        console.log(JSON.stringify(ctx, null, 2), content);

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

        if (ctx.delay > 0) {
          setTimeout(() => {
            response.end();
          }, ctx.delay);
        } else {
          response.end();
        }
      });
  })
  .listen({ host: HOST, port: PORT });
