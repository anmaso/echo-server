import { test, describe } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

const xtest = ()=>null

// Helper function to make HTTP requests
const makeRequest = (options, body = null) => {
  options.method = options.method || 'GET';
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
  test('GET /hello-world with x-cmd-echocontext header', async () => {
    const options = {
      ...baseOptions,
      path: '/hello-world',
      headers: { 'x-cmd-echocontext': 'true' }
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
    assert.ok(response.body.indexOf('echoContext')>=0, 'Response body should contain '+'echoContext');
    assert.ok(response.body.indexOf('echoBody')>=0, 'Response body should contain '+'echoBody');
  });

  // Test echo JSON endpoints
  test('GET /:echocontext/true', async () => {
    const options = { ...baseOptions, path: '/:echocontext/true' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.doesNotThrow(() => JSON.parse(response.body), 'Response should be valid JSON');
  });

  test('GET /:echocontext/false', async () => {
    const options = { ...baseOptions, path: '/:echocontext/false' };
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body, '', 'Response body should not be empty');
  });

  // Test POST endpoints
  test('POST /:echocontext/true with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:echocontext/true',
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

  test('post /:statuscode/200 with body', async () => {
    const options = {
      ...baseOptions,
      path: '/:statuscode/200',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    };
    const response = await makeRequest(options, 'hello');

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
  });
  test('post /:globalstatuscode/500', async () => {
    let response = await makeRequest({...baseOptions, path:'/'});
    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');

    response = await makeRequest({...baseOptions, path:'/:globalstatuscode/500'});
    assert.strictEqual(response.statusCode, 500, 'Status code should be 500');
    response = await makeRequest({...baseOptions, path:'/'});
    assert.strictEqual(response.statusCode, 500, 'Status code should be 500');
    response = await makeRequest({...baseOptions, path:'/:statuscode/200'});
    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    response = await makeRequest({...baseOptions, path:'/:globalstatuscode/200'});
    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    response = await makeRequest({...baseOptions, path:'/'});
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
    let responses = [];
    let response = await makeRequest(options, 'hello');
    responses.push(response.statusCode);
    response = await makeRequest(options, 'hello');
    responses.push(response.statusCode);
    response = await makeRequest(options, 'hello');
    responses.push(response.statusCode);
    response = await makeRequest(options, 'hello');
    responses.push(response.statusCode);
    assert.strictEqual(responses.filter(x=>x==200).length, 3, 'Status code should be 200 for 3 requests');
    assert.strictEqual(responses.filter(x=>x==500).length, 1, 'Status code should be 500 for 1 request');
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
  xtest('GET /:randombuffer/10', async () => {
    const options = { ...baseOptions, path: '/:randombuffer/10', headers: {'x-cmd-echocontext':'false'}};
    const response = await makeRequest(options);

    console.log("???????????????", response.body)
    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 10, 'Response should be 10 characters long');
  });

  test('GET /:cachedstring/10', async () => {
    const options = { ...baseOptions, path: '/:cachedstring/10', headers: {'x-cmd-echocontext':'false'}};
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 10, 'Response should be 10 characters long');
    const response2 = await makeRequest(options);
    assert.strictEqual(response.body, response2.body, 'Cached string should be the same for the same size');
  });

  // Test string generation endpoint
  test('GET /:string/10', async () => {
    const options = { ...baseOptions, path: '/:string/10', headers: {'x-cmd-echocontext':'false'}};
    const response = await makeRequest(options);

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.strictEqual(response.body.length, 10, 'Response should be 10 characters long');
  });
  test('GET /:delay/100', async () => {
    const options = { ...baseOptions, path: '/:delay/100'};
    const d1 = new Date().getTime();
    const response = await makeRequest(options);
    const d2 = new Date().getTime();

    assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
    assert.ok((d2-d1)>100, 'There should be a 100ms delay for the response');
  });
});
