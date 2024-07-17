import net from "net";
import fs from "fs";

type Method = "GET" | "POST";

const ReasonPhrases = {
    "200": "OK",
    "201": "Created",
    "404": "Not Found"
} as const;

type StatusCode = keyof typeof ReasonPhrases;

type HttpReq = {
    method: Method;
    endpoint: string;
    params?: { [key: string]: string };
    headers?: { [key: string]: string };
    body?: { [key: string]: string } | string;
};

type ResType = object | string | Buffer;

class HttpRes {
    private statusCode: StatusCode = "404";
    private headers: Map<string, string> = new Map();

    constructor(private socket: net.Socket) {}

    status(statusCode: StatusCode) {
        this.statusCode = statusCode;

        return this;
    }

    header(k: string, v: string) {
        this.headers.set(k, v);
    }

    send(data?: ResType) {
        let response = `HTTP/1.1 ${this.statusCode} ${ReasonPhrases[this.statusCode]}\r\n`;
        
        let body: string | Buffer = '';
    
        if (typeof data === "object" && !Buffer.isBuffer(data)) {
            let jsonData = JSON.stringify(data);
            this.header('Content-Type', 'application/json');
            this.header('Content-Length', Buffer.byteLength(jsonData).toString());
            body = jsonData;
        } else if (typeof data === "string") {
            this.header('Content-Type', 'text/plain');
            this.header('Content-Length', Buffer.byteLength(data).toString());
            body = data;
        } else if (Buffer.isBuffer(data)) {
            this.header('Content-Type', 'application/octet-stream');
            this.header('Content-Length', data.length.toString());
            body = data;
        }
    
        let headers = Array.from(this.headers).map(([a, b]) => `${a}: ${b}\r\n`).join("");
        response = `${response}${headers}\r\n`;
    
        this.socket.write(response);
        if (body) {
            this.socket.write(body);
        }
    }
    

}

type HttpEndpoint = (req: HttpReq, res: HttpRes) => void

class RequestBuilder {
    private method: Method;
    private endpoint: string;
    private params: { [key: string]: string } = {};
    private headers: { [key: string]: string } = {};
    private body: { [key: string]: string } | string = {};
    
    constructor(req: string, registeredRoutes: Map<string, HttpEndpoint>) {
        const reqBody = req.split(" ");
        this.method = reqBody[0] as Method;
        this.endpoint = reqBody[1];
        const specialCharSplit = req.split("\r\n");
        this.headers = specialCharSplit
            .slice(1, specialCharSplit.length)
            .reduce((a, v) => {
                return { ...a, [v.split(':')[0].replace('-', '_').toLowerCase()]: v.split(' ')[1] }
            }, {});
        this.body = specialCharSplit.slice(-1)[0];

        for (let [route] of registeredRoutes) {
            // Replace params with a regex group that matches one or more words/hyphens
            const routeRegex = new RegExp(`^${route.replace(/:[^\s/]+/g, '([\\w-]+)')}$`);
            // Match target url against route regex
            const match = this.endpoint.match(routeRegex);
            if (match) {
                // Extracts parameters into an array if they are found
                const paramNames = route.match(/:[^\s/]+/g) || [];
                // Strips parameters of : and shoves them into the params object
                paramNames.forEach((paramName, idx) => {
                    this.params[paramName.substring(1)] = match[idx + 1];
                });
                // Sets endpoint to be the actual endpoint
                this.endpoint = route;
                break;
            }
        }
    }

    build(): HttpReq {
        return {
            method: this.method,
            endpoint: this.endpoint,
            params: this.params,
            headers: this.headers,
            body: this.body
        }
    }
}

class HttpServer {
    private endpoints: Map<Method, Map<string, HttpEndpoint>>;
    private server: net.Server;

    constructor() {
        this.endpoints = new Map();
        this.endpoints.set("GET", new Map());
        this.endpoints.set("POST", new Map());

        this.server = net.createServer((socket) => {
            socket.on('data', (data) => {
                const methodEndpoints = this.endpoints.get(data.toString().split(" ")[0] as Method);
                let reqBuilder = new RequestBuilder(data.toString(), methodEndpoints!);
                let req = reqBuilder.build();
                let callback = methodEndpoints?.get(req.endpoint);
                if (callback) {
                    let res = new HttpRes(socket);
                    callback(req, res);
                } else {
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                } 
            });
        
            socket.on("close", () => {
                socket.end();
            });
        });
    }

    get(url: string, callback: HttpEndpoint) {
        this.endpoints.get("GET")?.set(url, callback);
    }

    post(url: string, callback: HttpEndpoint) {
        this.endpoints.get("POST")?.set(url, callback);
    }

    listen(port: number, callback: () => void) {
        this.server.listen(port, "localhost", callback)
    }
}

const app = new HttpServer();

app.get("/", (req: HttpReq, res: HttpRes) => {
    res.status("200").send();
});

app.get("/echo/:str", (req: HttpReq, res: HttpRes) => {
    res.status("200").send(req.params?.str);
});

app.get("/user-agent", (req: HttpReq, res: HttpRes) => {
    if (req.headers?.user_agent) {
        res.status("200").send(req.headers.user_agent);
    } else {
        res.status("404").send("No user-agent header found.");
    }
});

app.get("/files/:filename", (req: HttpReq, res: HttpRes) => {
    const path = process.argv.slice(-1);
    if (req.params?.filename) {
        const fileLocation = `${path}${req.params.filename}`;
        try {
            let file = fs.readFileSync(fileLocation);
            if (file) {
                return res.status("200").send(file);
            }
        } catch {
            return res.status("404").send("File not found");
        }
    }

    return res.status("404").send("File not found");
});

app.post("/files/:filename", (req: HttpReq, res: HttpRes) => {
    const path = process.argv.slice(-1);
    if (req.params?.filename && req.body) {
        const fileLocation = `${path}${req.params.filename}`;
        try {
            fs.writeFileSync(fileLocation, req.body as string);
            return res.status("201").send();
        } catch {
            return res.status("404").send("Something went terrible wrong");
        }
    }
});

app.listen(4221, () => {
    console.log(`Server listening on port ${4221}`);
});