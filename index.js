const express = require("express");
const os = require("os");
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const PATH = require('path');

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3000");

const getDefaultConfig = () => ({
  requestCounter: 0,
  consoleLog: true,
  consoleCompact: false,
  echoContext: false,
  hostname: os.hostname(),
  version: os.version(),
  byUrl: {
  },
  allUrls: {
    delay: 0,
    errorCode: 0,
    errorPct: 1,
    statusCode: 200,
    counter: {},
  }
});

let globalConfig = getDefaultConfig();

// Storage
const requestHistory = [];
const cacheBuffers = {};
const cacheStrings = {};

const addStat = (path, method) => {
  globalConfig.byUrl[path] ||= {};
  globalConfig.byUrl[path].counter ||= {};
  globalConfig.byUrl[path].counter[method] ||= 0;
  globalConfig.byUrl[path].counter[method]++;
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

const request = async (url, options) => await new Promise((resolve, reject) => {
  try {

    const req = (url.startsWith('https')? https:http).request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (e) => {
      reject(e);
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  } catch (e) {
    return '<error>';
  }
});


const formatResponseContext = (ctx, body) => ({
  method: ctx.request.method,
  url: ctx.request.url,
  headers: ctx.request.headers,
  cookies: ctx.request.cookies,
  body,
  statusCode: ctx.statusCode,
});

const log = (...args) => globalConfig.consoleLog && console.log(...args);

const logRequest = (ctx) => {
  log(`${ctx.time} ${ctx.responseConfig.statusCode} ${ctx.request.method} ${ctx.request.url}`);
  if (globalConfig.consoleCompact) {
    return;
  }
  Object.entries(ctx.request.headers).forEach(([k, v]) => log(`  ${k}: ${v}`));
  ctx.request.body && log(ctx.request.body);
};


async function handleResponse(req, res, content) {
  const ctx = req.ctx;
  const cfg = ctx.responseConfig;

  if (cfg.errorCode && cfg.errorCode != cfg.statusCode && globalConfig.requestCounter % ctx.responseConfig.errorPct == 0) {
    ctx.responseConfig.statusCode = ctx.responseConfig.errorCode;
  }

  if (ctx.responseConfig.echoContext || (typeof content == "object" && !Buffer.isBuffer(content))) {
    ctx.response.headers["Content-Type"] = "application/json; charset=utf-8";
  }

  logRequest(ctx);
  requestHistory.push(ctx);

  res.statusCode = parseInt(ctx.responseConfig.statusCode);

  Object.entries(ctx.response.headers).forEach(([h, v]) => res.setHeader(h, v));
  removeExpressHeaders(res);

  let url = req.url;
  let configuredResponse = globalConfig.byUrl[url]?.body;
  content = content || configuredResponse || (req.method != "GET" && req.body) || { ...ctx, responseConfig: undefined };
  if (ctx.responseConfig.echoBody) {
    content = ctx.request.body;
  }
  if (ctx.responseConfig.proxy) {
    content = await request(ctx.responseConfig.proxy, {
      method: ctx.request.method,
      body: req.body
    })
  }

  if (ctx.responseConfig.echoContext) {
    content = formatResponseContext(ctx, content);
  }
  if (content) {
    if (typeof content === 'object') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write(JSON.stringify(content));
    } else if (Buffer.isBuffer(content)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.write(content);
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(content);
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

function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request.on('data', (chunk) => {
      bodyParts.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(bodyParts).toString();
      resolve(body)
    });
  });
}

const server = http.createServer(async (req, res) => {
  const body = await getBody(req);
  return processRequest(req, res, body);
});

const sendUI = (req, res) => {
  fs.readFile(PATH.join(__dirname, 'ui.html'), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });

}

const getLogs = (n, filter) => {
  return requestHistory.slice(-n).filter((r) => !filter || r.request.url.includes(filter));
}

const processRequest = async (req, res, requestBody) => {
  globalConfig.requestCounter += 1;
  const parsedUrl = url.parse(req.url, true);
  const requestPath = parsedUrl.pathname.replace(/^\//g, '');
  const query = parsedUrl.query;

  req.ctx = {
    request: {
      method: req.method,
      url: req.url,
      body: requestBody,
      headers: req.headers,
      cookies: req.cookies,
      ...(query.length && { query: query }),
    },
    responseConfig: { ...globalConfig.allUrls, ...globalConfig.byUrl[requestPath] },
    response: { headers: {} },
    time: fmtDate(new Date()),
  };
  let content = req.ctx;
  addStat(requestPath, req.method);

  let { delay, statusCode, errorCode, errorPct, reset, string, stringCache, stats,
    consoleLog, log, logCompact, logFilter, body, echoBody, showConfig, path, ui, proxy } = query;

  if (ui) {
    return sendUI(req, res);
  }

  const pathParam = path;
  if (reset) {
    if (pathParam) {
      globalConfig.byUrl[pathParam] = {}
    } else {
      globalConfig = getDefaultConfig();
    }
  }
  //decide if we are talking about a specific path or the global config
  let config = globalConfig.allUrls;
  if (pathParam) {
    config = globalConfig.byUrl[pathParam] || {}
    globalConfig.byUrl[pathParam] = config;
  }
  if (pathParam && body) {
    if (req.method == "POST") {
      config.body = requestBody;
    } else {
      config.body = body;
    }
  }
  if (consoleLog) {
    globalConfig.consoleLog = consoleLog == "true";
  }
  if (echoBody) {
    config.echoBody = echoBody == "true"
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
  if (globalConfig.byUrl[requestPath]?.body) {
    content = globalConfig.byUrl[requestPath].body;
  }
  if (string) {
    content = createRandomString(parseInt(string))
  }
  if (stringCache) {
    content = getString(parseInt(stringCache))
  }
  if (proxy) {
    config.proxy = proxy;
  }

  if (stats) {
    if (stats == '*') {
      content = Object.entries(globalConfig.byUrl).reduce((acc, [k, v]) => ({ ...acc, ...(v.counter && { [k]: v.counter }) }), {})
    } else {
      content = globalConfig.byUrl[stats]?.counter || {}
    }
  }

  if (log) {
    content = getLogs(log, logFilter);
  }
  if (logCompact) {
    content = getLogs(logCompact, logFilter).map((r) => `${r.time} ${r.responseConfig.statusCode} ${r.request.method} ${r.request.url}`);
  }
  if (showConfig) {
    content = globalConfig
  }

  setTimeout(() => {
    handleResponse(req, res, content);
  }, req.ctx.responseConfig.delay);
}

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
