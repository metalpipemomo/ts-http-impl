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
};

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

    send() {
        let headers = Array.from(this.headers).map(([a, b]) => `${a}: ${b}\r\n`).join("");
        this.socket.write(`HTTP/1.1 ${this.statusCode} ${ReasonPhrases[this.statusCode]}\r\n${headers}\r\n`);
    }

}

type HttpEndpoint = (req: HttpReq, res: HttpRes) => void

class RequestBuilder {
    private method: Method;
    private endpoint: string;
    
    constructor(req: string) {
        const headers = req.split(" ");
        this.method = headers[0] as Method;
        this.endpoint = headers[1];
    }

    build(): HttpReq {
        return {
            method: this.method,
            endpoint: this.endpoint
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
                let reqBuilder = new RequestBuilder(data.toString());
                let req = reqBuilder.build();
                let callback = this.endpoints.get(req.method)?.get(req.endpoint);
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

app.listen(4221, () => {
    console.log(`Server listening on port ${4221}`);
});