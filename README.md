# HTTP Server Implementation with Node.js & TypeScript 

This project is an HTTP server implementation built using Node.js and TypeScript. No supporting libraries are used, only a Node utilities and a TCP connection.

This project was a [CodeCrafters](https://codecrafters.io/) challenge.

## Features

- **Routing**
- **Dynamic URLs**
- **GET & POST Requests**:
- **Gzip Compression**

## Installation

1. Clone the repository:

```bash
git clone https://github.com/metalpipemomo/ts-http-impl
cd ts-http-impl
```

2. Install dependencies

```bash
npm install
```

## Usage

Start the server by running:

```bash
npm run dev
```

Keep in mind that `bun` must be installed to run this project.

## API Endpoints Implemented for Showcase

### GET /

Returns a 200 OK status.

### GET /echo/:str

Echoes the string provided in the `:str` parameter.

### GET /user-agent

Returns the `user-agent` header from the request.

### GET /files/:filename

Serves the file with the specified `:filename` from the directory provided when starting the server.

### POST /files/:filename

Saves the request body as a file with the specified `:filename` in the directory provided when starting the server.

## Example Requests

### GET /

```bash
curl -X GET http://localhost:4221/
```

### GET /echo/hello

```bash
curl -X GET http://localhost:4221/echo/hello
```

### GET /user-agent

```bash
curl -X GET http://localhost:4221/user-agent
```

### GET /files/example.txt

```bash
curl -X GET http://localhost:4221/files/example.txt
```

### POST /files/example.txt

```bash
curl -X POST http://localhost:4221/files/example.txt -d "File content goes here"
```
