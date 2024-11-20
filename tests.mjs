import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import http from "node:http";

const xtest = () => null;

const baseOptions = {
  hostname: "localhost",
  port: 3000,
  method: "GET",
};

// Helper function to make HTTP requests
const makeRequest = (path, options, body = null) => {
  options = { ...baseOptions, ...options };
  options.path = path;

  if (body) {
    options.headers = {
      ...options.headers,
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': typeof(body)=='object'? 'application/json':'application/x-www-form-urlencoded'
    };
  }

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          assertStatus: (code)=>assert.strictEqual(res.statusCode, code, "Status code should be "+code)
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const reset = async () => {
  await makeRequest("/?reset=true");
}

describe("HTTP Server Test Suite", () => {
  // Base request options

  beforeEach(() => {
    reset();
  }),

    // Test root endpoint
    test("GET /", async () => {
      await new Promise((acc) => setTimeout(acc, 1000));
      const response = await makeRequest("/");

    response.assertStatus(200);
    });

  // Test hello-world endpoint
  test("GET /hello-world", async () => {
    const response = await makeRequest("/hello-world");
    response.assertStatus(200);
  });

  test("response all with statusCode 500", async () => {
    //await makeRequest( "/?reset=true");
    await reset();
    let response = await makeRequest("/?statusCode=500", baseOptions);
    response.assertStatus(200);
    response = await makeRequest("/hello");

    assert.strictEqual(response.statusCode, 500, "Status code should be 500");
  });

  test("single URL with statusCode=500", async () => {
    //await makeRequest( "/?reset=true");
    await reset();
    let response = await makeRequest("/?path=hello&statusCode=500");
    response.assertStatus(200);
    response = await makeRequest("/hello");
    response.assertStatus(500);

  });

  // Test error code endpoints
  test("error every Nth request", async () => {
    await reset();
    let responses = [];
    let response = await makeRequest("/?errorCode=500&errorPct=4");
    responses.push(response.statusCode);
    response = await makeRequest("/");
    responses.push(response.statusCode);
    response = await makeRequest("/");
    responses.push(response.statusCode);
    response = await makeRequest("/");
    responses.push(response.statusCode);
    assert.strictEqual(responses.filter((x) => x == 200).length, 3, "Status code should be 200 for 3 requests");
    assert.strictEqual(responses.filter((x) => x == 500).length, 1, "Status code should be 500 for 1 request");
  });


  test("cached string", async () => {
    const response = await makeRequest("/?stringCache=10");
    response.assertStatus(200);
    assert.strictEqual(response.body.length, 10, "Response should be 10 characters long");
    const response2 = await makeRequest("/?stringCache=10");
    assert.strictEqual(response.body, response2.body, "Cached string should be the same for the same size");
  });

  // Test string generation endpoint
  test("random string", async () => {
    const response = await makeRequest("/?string=10");
    response.assertStatus(200);
    assert.strictEqual(response.body.length, 10, "Response should be 10 characters long");
    const response2 = await makeRequest("/?string=10");
    assert.ok(response.body!=response2.body, "String response should be different");
  });

  test("stats of path", async () => {
    let response = await makeRequest("/a");

    response = await makeRequest("/?stats=a");
    response.assertStatus(200);
    let json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 1, "counter is 1");

    response = await makeRequest("/a");
    response = await makeRequest("/?stats=a");
    response.assertStatus(200);
    json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 2, "counter is 2");

    response = await makeRequest("/?stats=*");
    response.assertStatus(200);
    json = JSON.parse(response.body);
    assert.strictEqual(json["a"]["GET"], 2, "counter is 2");
  });
  test("delay 100", async () => {
    const d1 = new Date().getTime();
    let response = await makeRequest("/?delay=100");
    const d2 = new Date().getTime();
    assert.ok(d2 - d1 < 100, "A normal response takes less than 100ms");

    response = await makeRequest("/");
    response.assertStatus(200);
    const d3 = new Date().getTime();
    assert.ok(d3 - d1 > 100, "There should be a 100ms delay for the response");
  });
  test("reset path", async () => {
    let response = await makeRequest("/a");

    response = await makeRequest("/?stats=a");
    response.assertStatus(200);
    let json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 1, "counter is 1");
    response = await makeRequest("/?reset=a");

  })
  test("show log", async () => {
    let response = await makeRequest("/some-path");
    response = await makeRequest("/?log=10");
    response.assertStatus(200);
    let json = JSON.parse(response.body);
    assert.ok(json.length > 0, "log should have at least one entry");
    assert.strictEqual(json.slice(-1)[0].request.url, "/some-path", "penultimate log entry should be for /a");
    response = await makeRequest("/do-not-show-this-in-path");
    response = await makeRequest("/do-not-show-this-in-path");
    response = await makeRequest("/do-not-show-this-in-path");
    response = await makeRequest("/do-not-show-this-in-path");
    response = await makeRequest("/?log=10&logFilter=some");
    assert.equal(response.body.indexOf("do-not-show"), -1, "do-not-show should not show in logs");

  });

  test("echo body", async () => {
    let response = await makeRequest("/?echoBody=true");
    response.assertStatus(200);
    response = await makeRequest("/random-path", { method: "POST" }, "hello");
    response.assertStatus(200);
    assert.strictEqual(response.body, "hello", "Response body should be the same as the request body");
  })
  //add a test case to test auration of echoBody for a single url overrides the global configuration
  test("echo body for a single URL", async () => {
    let response = await makeRequest("/?path=random-path&echoBody=true");
    response.assertStatus(200);
    response = await makeRequest("/random-path", { method: "POST" }, "hello");
    response.assertStatus(200);
    assert.strictEqual(response.body, "hello", "Response body should be empty");
    response = await makeRequest("/another-random-path", { method: "POST" }, "hello");
    response.assertStatus(200);
    assert.notEqual(response.body, "hello", "Response body should be not hello");
  })

  //test setting content for a single URL
  test("set content for a single URL", async () => {
    let response = await makeRequest("/?path=random-path&body=hello");
    response.assertStatus(200);
    response = await makeRequest("/random-path");
    response.assertStatus(200);
    assert.strictEqual(response.body, "hello", "Response body should be hello");
    //test another path doesnt come with hello
    response = await makeRequest("/another-random-path");
    response.assertStatus(200);
    assert.notStrictEqual(response.body, "hello", "Response body should not be hello");
  })

  //test for proxy option
  test("proxy", async () => {
    let response = await makeRequest("/?path=proxy-google&proxy=https://www.google.com");
    response.assertStatus(200);
    response = await makeRequest("/proxy-google");
    response.assertStatus(200);
    assert.ok(response.body.indexOf("google") > -1, "Response body should contain google");
  })



});



function statusIs200(response) {
  assert.strictEqual(response.statusCode, 200, "Status code should be 200");
}

