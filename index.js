const http = require('http');
const server = http.createServer();

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000');


let requestCounter = 0;
let echoBody = true;
let consoleLog = true;
let echoJSON = false;
let statusCode = 200;
let errorCode = 0;
let errorPct = 0;
let showTime = true;

const cacheBuffers = {}

const createRandomBuffer = (length) => {
  console.log("createRandomString", length)
  var buffer = Buffer.alloc(length);

  for (var i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256); // Each byte can be in range from 0 to 255
  }
  return buffer;
}

const createRandomString = (length) => {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const cacheStrings = {};

const getString = (length) => {
  const str = cacheStrings[length] || createRandomString(length);
  cacheStrings[length] = str
  return str
}

const getBuffer = (length) => {
  const buffer = cacheBuffers[length] || createRandomBuffer(length);
  cacheBuffers[length] = buffer;
  return buffer;
}

const setSettings = (url) => {
  const [cmd, ..._args] = url.slice(1).split('/');
  if (!cmd.startsWith(':')) return;
  console.log("cmd", cmd, _args);
  ({
    echobody: (value) => echoBody = (value === "true"),
    echojson: (value) => {console.log("value", value); echoJSON = (value === "true")},
    statuscode: (value) => statusCode = parseInt(value, 10),
    consolelog: (value) => consolelog = value === "true",
    showtime: (value) => showTime = value === "true",
    errorcode: (error, pct) => {
      console.log("----", error, pct, _args)
      errorPct = pct || 1;
      errorCode = error;
    },
  })[cmd.slice(1)]?.call(null, ..._args);
  console.log("11", echoJSON)
};

const transformBody = (request, body, opts, code) => {
  if (opts.buffer) {
    body = getBuffer(parseInt(opts.buffer));
  }
  if (opts.randombuffer) {
    body = createRandomBuffer(parseInt(opts.randombuffer));
  }
  if (opts.string) {
    body = getString(parseInt(opts.string));
  }
  if (opts.randomstring) {
    body = createRandomString(parseInt(opts.randomstring))
  };
  if (opts.settings) {
    body = {
      echoJSON, echoBody, consoleLog, requestCounter, statusCode, errorCode, errorPct
    };
  }
  if (opts.echoJSON) {
    body = formatJSON(request, body, code)
  };
  return body;
}

const formatJSON = (request, body, code) => ({
  method: request.method,
  url: request.url,
  headers: request.headers,
  cookies: request.cookies,
  body,
  code
});

const log = (...args) => consoleLog && console.log(...args);

const cmdFromUrl = (url) => {
  const parts = url.slice(1).split('/');
  if (!parts[0].startsWith(':')) return [];
  return [parts[0].slice(1), parts.slice(1)];
}

const getHeaderOpts = (headers) => {
  const values = Object.entries(headers).reduce((acc, [h, v]) => {
    h = h.toLocaleLowerCase();
    console.log(h)
    if (h.startsWith('x-cmd-')) {
      acc[h.replace('x-cmd-', '')] = v;
    }
    return acc;
  }, {})
  return {
    ... (values.echojson && { echojson: values.echojson === "true" }),
    ... (values.consolelog && { echojson: values.consolelog === "true" }),
    ... (values.echojson && { echoJSON: values.echojson === "true" }),
    ... (values.statuscode && { statusCode: values.statuscode }),
    ... (values.errorcode && { errorCode: values.errorcode }),
    ... (values.errorpct && { errorPct: values.errorpct }),
    ... (values.showtime && { showTime: values.showtime }),
  }
}

const getOpts = (url, overrides) => {
  const [cmd, _args] = url.slice(1).split('/');
  return {
    echoBody,
    consoleLog,
    echoJSON,
    statusCode,
    errorCode,
    errorPct,
    showTime,
    ...(cmd == ":echojson" && { echoJSON: _args==='true' }),
    ...(cmd == ":settings" && { settings: true }),
    ...(cmd == ":string" && { string: _args }),
    ...(cmd == ":randomstring" && { randomstring: _args }),
    ...(cmd == ":buffer" && { buffer: _args }),
    ...(cmd == ":randombuffer" && { randombuffer: _args }),
    ...overrides
  }
};



server.on('request', (request, response) => {
  requestCounter += 1;
  let body = [];
  setSettings(request.url);
  const opts = getOpts(request.url, getHeaderOpts(request.headers));
  console.log(opts)
  console.log("2", echoJSON)
  request.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();

    const time = new Date().toISOString();
    if (opts.showTime) {
      log(time);
    }
    log(`==== ${request.method} ${request.url}`);
    log('> Headers');
    log(request.headers);

    let code = opts.statusCode;
    if (opts.errorCode && opts.errorCode != "200" && (requestCounter % opts.errorPct == 0)) {
      code = opts.errorCode;
    }
    response.statusCode = code;
    body = transformBody(request, body, opts, code);
    log('> Body');
    log(body, echoBody);

    if (opts.echoBody && body) {
      if (typeof (body) == "object" && !Buffer.isBuffer(body)) {
        response.setHeader('Content-Type', 'application/json');
        body = JSON.stringify(body, null, 2);
      }
      response.write(body);
    }
    response.end();

  });

}).listen({ host: HOST, port: PORT });
