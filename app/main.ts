import net from "net";

type Method = "GET" | "POST";

const ReasonPhrases = {
    "200": "OK",
    "404": "Not Found"
} as const;

type StatusCode = keyof typeof ReasonPhrases;

type HttpReq = {
    method: Method;
    endpoint: string;
    params?: { [key: string]: string };
};

type ResType = object | string;

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
        if (typeof data === "object") {
            let jsonData = JSON.stringify(data);
            this.header('Content-Type', 'application/json');
            this.header('Content-Length', jsonData.length.toString());
        } else if (typeof data === "string") {
            this.header('Content-Type', 'text/plain');
            this.header('Content-Length', data.length.toString());
        }
        let headers = Array.from(this.headers).map(([a, b]) => `${a}: ${b}\r\n`).join("");
        let body: string = typeof data === "object" ? JSON.stringify(data) : data as string;
        response = `${response}${headers}\r\n${typeof data !== 'undefined' ? body : ''}`;
        this.socket.write(response);
    }

}

type HttpEndpoint = (req: HttpReq, res: HttpRes) => void

class RequestBuilder {
    private method: Method;
    private endpoint: string;
    private params: { [key: string]: string } = {};
    
    constructor(req: string, registeredRoutes: Map<string, HttpEndpoint>) {
        const headers = req.split(" ");
        this.method = headers[0] as Method;
        this.endpoint = headers[1];

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
            params: this.params
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

app.listen(4221, () => {
    console.log(`Server listening on port ${4221}`);
});