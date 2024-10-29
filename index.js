const http = require('http');
const server = http.createServer();


let requestCounter = 0;
let echoBody = true;
let consoleLog = true;
let echoJSON = false;
let statusCode = 200;
let errorCode = 0;
let errorPct = 0;

const cacheBuffers = {}

const createRandomBuffer=(length)=> {
  var buffer = Buffer.alloc(length);

  for (var i = 0; i < length; i++) {
    buffer[i] = Math.floor(Math.random() * 256); // Each byte can be in range from 0 to 255
  }

  return buffer;
}

const createRandomString = (length)=> {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const cacheStrings = {};

const getString = (length)=> {
  const str = cacheStrings[length] || createRandomString(length);
  cacheStrings[length]=str
  return str
}

const getBuffer = (length)=> {
  const buffer = cacheBuffers[length] || createRandomBuffer(length);
  cacheBuffers[length]=buffer;
  return buffer;
}

const commands = {
  params: (...args) => console.log(args),
  echobody: (value) => echoBody = (value === "true"),
  echojson: (value) => echoJSON = (value === "true"),
  statuscode: (value) => statusCode = parseInt(value, 10),
  consolelog: (value) => consolelog = value === "true",
  settings: (value) => {
    const body = JSON.stringify({
      echoBody, consoleLog, requestCounter, statusCode
    },
      null, 2);
    console.log(body);
    return { body }
  },
  errorcode: (error, pct) => {
    errorPct = pct || 1;
    errorCode = error;
  },
  buffer: (length)=>({body:getBuffer(parseInt(length))}),
  randombuffer: (length)=>({body:createRandomBuffer(parseInt(length))}),
  string: (length)=>({body:getString(parseInt(length))}),
  randomstring: (length)=>({body:createRandomString(parseInt(length))})
}

const formatJSON = (request, body) => JSON.stringify({
  method: request.method,
  url: request.url,
  headers: request.headers,
  cookies: request.cookies,
  body
}, null, 2);

const log = (...args) => consoleLog && console.log(...args);


const execCmd = (url, body) => {
  try {
    const parts = url.slice(1).split('/');
    if (!parts[0].startsWith(':')) return;
    const res = commands[parts[0].slice(1)](...parts.slice(1));
    return (res && res.body) ? res.body : body;
  } catch (err) {
    console.log("err:", err);
  }
}

server.on('request', (request, response) => {
  requestCounter += 1;
  let body = [];
  request.on('data', (chunk) => {
    body.push(chunk);

  }).on('end', () => {
    body = Buffer.concat(body).toString();
    body = execCmd(request.url, body);
    log(`==== ${request.method} ${request.url}`);
    log('> Headers');
    log(request.headers);
    log('> Body');
    log(body, echoBody);

    if (errorCode && (requestCounter % errorPct == 0)) {
      response.statusCode = errorCode;
    } else {
      response.statusCode = statusCode;

    }

    if (echoJSON) {
      body = formatJSON(request, body);
    }
    if (echoBody && body) {
      response.write(body);
    }
    response.end();

  });

}).listen(3000);
