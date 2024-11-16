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
  await makeRequest("/.config?reset=true");
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

      assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    });

  // Test hello-world endpoint
  test("GET /hello-world", async () => {
    const response = await makeRequest("/hello-world");

    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
  });

  // Test settings endpoint
  test("GET /.config", async () => {
    const response = await makeRequest("/.config");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    assert.ok(response.body.indexOf("echoContext") >= 0, "Response body should contain " + "echoContext");
  });

  // Test echo JSON endpoints
  test("GET /.echocontext/true", async () => {
    const response = await makeRequest("/.echocontext/true");

    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    assert.doesNotThrow(() => JSON.parse(response.body), "Response should be valid JSON");
  });

  // Test POST endpoints
  test("POST /.echocontext/true with body", async () => {
    const options = {
      ...baseOptions,
      method: "POST",
    };
    const response = await makeRequest("/.echocontext/true", options, "hello");

    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    assert.doesNotThrow(() => JSON.parse(response.body), "Response should be valid JSON");
  });

  test("response all with statusCode 500", async () => {
    //await makeRequest( "/.config?reset=true");
    await reset();
    let response = await makeRequest("/.config?statusCode=500", baseOptions);
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    response = await makeRequest("/hello");

    assert.strictEqual(response.statusCode, 500, "Status code should be 500");
  });

  test("single URL with statusCode=500", async () => {
    //await makeRequest( "/.config?reset=true");
    await reset();
    let response = await makeRequest("/.config?path=/hello&statusCode=500");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    response = await makeRequest("/hello");

    assert.strictEqual(response.statusCode, 500, "Status code should be 500");
  });

  // Test error code endpoints
  test("error every Nth request", async () => {
    await reset();
    let responses = [];
    let response = await makeRequest("/.config?errorCode=500&errorPct=4");
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
    const response = await makeRequest("/.config?stringCache=10");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    assert.strictEqual(response.body.length, 10, "Response should be 10 characters long");
    const response2 = await makeRequest("/.config?stringCache=10");
    assert.strictEqual(response.body, response2.body, "Cached string should be the same for the same size");
  });

  // Test string generation endpoint
  test("random string", async () => {
    const response = await makeRequest("/.config?string=10");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    assert.strictEqual(response.body.length, 10, "Response should be 10 characters long");
    const response2 = await makeRequest("/.config?string=10");
    assert.ok(response.body!=response2.body, "String response should be different");
  });

  test("stats of path", async () => {
    let response = await makeRequest("/a");

    response = await makeRequest("/.config?stats=true&path=/a");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    let json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 1, "counter is 1");

    response = await makeRequest("/a");
    response = await makeRequest("/.config?stats=true&path=/a");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 2, "counter is 2");

    response = await makeRequest("/.config?stats=true");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    json = JSON.parse(response.body);
    assert.strictEqual(json["/a"]["GET"], 2, "counter is 2");
  });
  test("delay 100", async () => {
    const d1 = new Date().getTime();
    let response = await makeRequest("/.config?delay=100");
    const d2 = new Date().getTime();
    assert.ok(d2 - d1 < 100, "A normal response takes less than 100ms");

    response = await makeRequest("/");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    const d3 = new Date().getTime();
    assert.ok(d3 - d1 > 100, "There should be a 100ms delay for the response");
  });
  test("reset path", async () => {
    let response = await makeRequest("/a");

    response = await makeRequest("/.config?stats=true&path=/a");
    assert.strictEqual(response.statusCode, 200, "Status code should be 200");
    let json = JSON.parse(response.body);
    assert.strictEqual(json["GET"], 1, "counter is 1");
    response = await makeRequest("/.config?reset=true&path=/a");

  })
});
