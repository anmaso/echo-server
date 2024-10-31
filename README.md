# echo server

Simple HTTP echo server with some additional functionality

The default behaviour is to get back the body of the request, but this can be changed with some server options

Host and port for the server are taken from `HOST` and `PORT` environment variables.

# Commands

The server implements some commands to modify the default behaviour.

To send a command, use a GET request with the following format

`/:[command]/[arg1]/[arg2]`



|Command|Description| Default|
|--|--|--|
|settings   | Displays the current server settings| |
|echobody   | Returns the BODY | true |
|echojson   | Returns as JSON the echo response| false|
|consolelog | Logs everything through the server console| true|
|statuscode | Sets the status code for all subsequent requests| 200|
|errorcode  | Sends the error code at every request number [arg1] | 200 / 1|
|randomstring | Returns a BODY of a random string of length [arg1] ||
|string       | Random cached string, same value for the same size||

## header commands

Commands can also be sent using headers with `x-cmd-` prefix

```
curl http://localhost:3000/hello-world -H "x-cmd-echojson: true"`
curl http://localhost:3000/hello-world -H "x-cmd-statuscode: 401" -v`
```




# test commands

Here there are some test commands for the echo server

```

curl http://localhost:3000/
curl http://localhost:3000/ -v

curl http://localhost:3000/hello-world
curl http://localhost:3000/hello-world -H "x-cmd-echojson: true"
curl http://localhost:3000/hello-world -H "x-cmd-statuscode: 401" -v


curl http://localhost:3000/:settings
curl http://localhost:3000/:settings -v
curl http://localhost:3000/:echojson/true
curl http://localhost:3000/:echojson/false

curl -X POST http://localhost:3000/:echojson/true -d 'hello'
curl -v -X POST http://localhost:3000/:statuscode/500 -d 'hello'
curl -v -X POST http://localhost:3000/:statuscode/200 -d 'hello'
curl -v -X POST http://localhost:3000/:errorcode/500/4 -d 'hello'
curl -v -X POST http://localhost:3000/:errorcode/200/4 -d 'hello'
curl -v http://localhost:3000/

curl -v http://localhost:3000/:randombuffer/100
curl -v http://localhost:3000/:randomstring/100
curl -v http://localhost:3000/:string/100

curl -v http://localhost:3000/:string/100

```
