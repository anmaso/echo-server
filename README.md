# echo server

Simple HTTP echo server with some additional functionality

The default behaviour is to get back the body of the request, but this can be changed with some server options

Host and port for the server are taken from `HOST` and `PORT` environment variables.

# Commands

The server implements some commands to modify the default behaviour.

To send a command, use a request with the following format

`/?configParam1=value1&configParam2=value2`


The best way to explore the options is using the UI

http://localhost:3000?ui=true


|Command      |Description                                           | Value           |
|-------------|------------------------------------------------------|-----------------|
|path         | All configParams will refer to this path             | an url path     |
|showConfig   | Displays the current server settings                 | any value       |
|body         | Depends on the method, sets the response to <br/>-GET: body param, <br/>POST: the body of the request                                       |                 |
|echoContext  | Adds to the response the config of the request       | false   |
|consoleLog   | Logs everything through the server console           | true    |
|statusCode   | Sets the status code for all subsequent requests     | 200     |
|errorCode    | Error code to send when #request/errorPct=0          | 500     |
|errorPct     | Configure to send errorCode at every errorPct request| 1       |
|string       | Returns a BODY of a random string of length value    |         |
|cachedstring | Random cached string, same value for the same size   |         |
|proxy        | URL to retrieve the response from                    |         |
|delay        | Delays the response by x miliseconds                 |         |


# test commands

Here there are some examples for the echo server

```

curl http://localhost:3000/

curl http://localhost:3000/hello-world
curl "http://localhost:3000/hello-world?statusCode=500"


curl "http://localhost:3000/?showConfig=true"

# simulate errors every 3 requests
curl "http://localhost:3000/?path=possible-error&errorCode=500&errorPct=3"
curl "http://localhost:3000/possible-error"
curl "http://localhost:3000/possible-error"
curl "http://localhost:3000/possible-error"  <-- error 500


curl "http://localhost:3000/?path=slow-response&delay=1000"
# this one will take 1 sec to answer
curl "http://localhost:3000/?slow-response"


curl "http://localhost:3000/?path=google&proxy=https://www.google.com"
# retrieve google home page
curl "http://localhost:3000/google"

```
