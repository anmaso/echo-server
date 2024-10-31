import { test, describe } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

const xtest = ()=>null

// Helper function to make HTTP requests
const makeRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

describe('HTTP Server Test Suite', () => {
  // Base request options
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    method: 'GET'
  };

  // Test root endpoint
  test('GET /', async () => {
    const options = { ...baseOptions, path: '/' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body, '',  'Response body should be empty');
  });

  // Test verbose root request
  test('GET / with verbose flag', async () => {
    const options = { ...baseOptions, path: '/', headers: { 'x-verbose': 'true' } };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.ok(response.headers, 'Headers should be present');
  });

  // Test hello-world endpoint
  test('GET /hello-world', async () => {
    const options = { ...baseOptions, path: '/hello-world' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
  });

  // Test hello-world with echo JSON header
  test('GET /hello-world with x-cmd-echojson header', async () => {
    const options = {
      ...baseOptions,
      path: '/hello-world',
      headers: { 'x-cmd-echojson': 'true' }
    };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.doesNotThrow(() => JSON.parse(response.body), 'Response should be valid JSON');
  });

  // Test hello-world with custom status code
  test('GET /hello-world with x-cmd-statuscode header', async () => {
    const options = {
      ...baseOptions,
      path: '/hello-world',
      headers: { 'x-cmd-statuscode': '401' }
    };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 401, 'Status code should be 401');
  });

  // Test settings endpoint
  test('GET /:settings', async () => {
    const options = { ...baseOptions, path: '/:settings' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.ok(response.body.indexOf('echoJSON')>=0, 'Response body should contain '+'echoJSON');
    assert.ok(response.body.indexOf('echoBody')>=0, 'Response body should contain '+'echoBody');
  });

  // Test echo JSON endpoints
  test('GET /:echojson/true', async () => {
    const options = { ...baseOptions, path: '/:echojson/true' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.doesNotThrow(() => JSON.parse(response.body), 'Response should be valid JSON');
  });

  test('GET /:echojson/false', async () => {
    const options = { ...baseOptions, path: '/:echojson/false' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body, '', 'Response body should not be empty');
  });

  // Test POST endpoints
  test('POST /:echojson/true with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:echojson/true',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.doesNotThrow(() => JSON.parse(response.body), 'Response should be valid JSON');
  });

  test('POST /:statuscode/500 with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:statuscode/500',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 500, 'Status code should be 500');
  });

  test('POST /:statuscode/200 with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:statuscode/200',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
  });

  // Test error code endpoints
  test('POST /:errorcode/500/4 with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:errorcode/500/4',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 500, 'Status code should be 500');
  });

  test('POST /:errorcode/200/4 with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:errorcode/200/4',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
  });

  // Test random data generation endpoints
  xtest('GET /:randombuffer/100', async () => {
    const options = { ...baseOptions, path: '/:randombuffer/100', headers: {'x-cmd-echojson':'false'}};
    const response = await makeRequest(options);

    console.log("???????????????", response.body)
    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 100, 'Response should be 100 characters long');
  });

  test('GET /:randomstring/100', async () => {
    const options = { ...baseOptions, path: '/:randomstring/100', headers: {'x-cmd-echojson':'false'}};
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 100, 'Response should be 100 characters long');
  });

  // Test string generation endpoint
  test('GET /:string/100', async () => {
    const options = { ...baseOptions, path: '/:string/100', headers: {'x-cmd-echojson':'false'}};
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 100, 'Response should be 100 characters long');
  });
});