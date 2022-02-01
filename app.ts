const bodyParser = require("body-parser");
const cors = require("cors");
const http = require('http');
const express = require('express');
const socketIo = require("socket.io");
import axios from 'axios';
import swaggerUI from 'swagger-ui-express';
const YAML = require('yamljs');
import { Dictionary } from 'dictionaryjs';
import { query, Request, Response } from 'express';
import RequestBodyDto from './submodules/ex3-ms-dtos/requestBody.dto';

require('dotenv').config();
const microserviceBaseUrl: string = process.env.MICROSERVICE_BASE_URL || `http://localhost:4001`;
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 4002;

// load apiswagger configuration
const swaggerJsDocs = YAML.load('./api.yaml');


import { Broker } from './submodules/rabbitmq-broker/broker';
import { tokenAuthenticationMiddleware } from './middlewares/tokenAuthentcation.middleware';
import ResponseModel from './submodules/ex3-ms-dtos/responseModel';

// create app instance
const app = express();


// used build in middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// setup swagger configuration
app.use('/api-gateway', swaggerUI.serve, swaggerUI.setup(swaggerJsDocs));


// use custom middleware globally
app.use(tokenAuthenticationMiddleware)

// running app http server
const server = http.createServer(app);

// book keeping of connected devices and running queues
let activeConnectionDict = new Dictionary();
let socketAndDeviceDict = new Dictionary();

var sockets = [];

var broker = Broker.getInstance();

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "HEAD", "OPTIONS"],
        allowedHeaders: ["my-custom-header"],
        credentials: false,
    },
});

io.on("connection", (socket) => {
    console.log(`client with id : ${socket.id} connected to apigateway`);
    // add to sockets
    sockets.push(socket);
    // adding to active connection dictonary
    activeConnectionDict.set(socket.id, socket);
    console.log("number of client connected : ", activeConnectionDict.length);
    // sending message to client: acknowledgement of connection
    socket.emit("socketIdFromServer", { socketId: socket.id });
    socket.on("disconnect", () => {
        console.log("Client disconnected");
        // remove soket id from active-connection dictonary
        activeConnectionDict.remove(socket.id);
        // remove soket id from socket-device dictonary
        if (socketAndDeviceDict.has(socket.id) === true) {
            socketAndDeviceDict.remove(socket.id);
        }
        console.log("number of client connected : ", activeConnectionDict.length);
        socket.disconnect(true);
    });
});

// starting the routes

app.get('/connectdevice/:id/:socketid', (req: Request, res: Response) => {
    const deviceid = parseInt(req.params.id);
    const socketid = req.params.socketid;
    if (!socketAndDeviceDict.contains(deviceid)) {
        socketAndDeviceDict.set(socketid, deviceid);
        console.log("connected");
        res.status(200).json({ message: 'connected' });
    }
    else {
        for (let [key, value] of socketAndDeviceDict.entries()) {
            if (deviceid === value && socketid === key) {
                console.log("Already Connected");
                res.status(200).json({ message: 'you already connected' });
            }
        }
        console.log("Cant Connect");
        res.status(400).json({ message: 'not able to connect...' });
    }
});




// getting a specific service object with id

app.get("/:serviceName/:service/:id", async (req: Request, res: Response) => {
    const service = req.params.service;
    const id = req.params.id;
    const url = microserviceBaseUrl + "/" + service + "/" + id;
    try {
        const result = await axios.get(url);
        res.status(200).json(result.data);
    } catch (error) {
        console.log(error.message);
        const response = new ResponseModel(400, 'FAILED', 'GET', `Unalble to fetch the ${service} with Id: ${id}`, {})
        res.status(400).json(response);
    }
}
);

// getting a service all objects
app.get("/:serviceName/:service", async (req: Request, res: Response) => {
    const service = req.params.service;
    const query = req.query.query;
    const url = microserviceBaseUrl + "/" + service + (query ? "/" + "?query=" + query : "");
    console.log(url, query);
    try {
        const result = await axios.get(url);
        res.status(200).json(result.data);
    } catch (error) {
        console.log(error.message);
        const response = new ResponseModel(500, 'FAILED', 'GET', `Unalble to fetch all the ${service}S`, {});
        res.status(400).json(response);
    }
})

// create a specific service object with data
app.post("/:serviceName/:service", async (req: Request, res: Response) => {
    const requestBody: RequestBodyDto = req.body;
    const exchangeName = req.params.service + "_ADD";
    const response = broker.publishMessageToTopic(
        exchangeName,
        requestBody,
    );
    res.status(response.statusCode).json(response);
});

// update a specific service object with id and data
app.put("/:serviceName/:service/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const requestBody: RequestBodyDto = req.body;
    requestBody.data['id'] = id;
    const exchangeName = req.params.service + "_UPDATE";
    const response = broker.publishMessageToTopic(
        exchangeName,
        requestBody
    );
    res.status(response.statusCode).json(response);

});

// delete a specific service object with id
app.delete("/:serviceName/:service/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const requestBody: RequestBodyDto = req.body;
    requestBody.data['id'] = id;
    const exchangeName = req.params.service + "_DELETE";
    const response = broker.publishMessageToTopic(
        exchangeName,
        requestBody
    );
    res.status(response.statusCode).json(response);
});


// Listening to port and created exchanges
server.listen(port, () => {
    broker.listenToServices("API_GATEWAY_SERVICE", (result) => {
        const { message } = result;
        console.log('message recieved from MS to gateway lisnter', message);
        //getting the browser socket to hom the response needs to be send
        let vSocket: any = activeConnectionDict.get(message.socketId);
        if (vSocket) {
            console.log("response to client to call call back function", message);
            vSocket.emit("successResponseFromServer", message);
        } else {
            console.log(`client with socket id : ${message.socketId} diconnected... unable to emit message`);
        }
    });
    broker.listenToServices("ERROR_RECEIVER", (result) => {
        let { message } = result;
        console.log(message, 'message from MS');
        let vSocket: any = activeConnectionDict.get(message.socketId);
        if (vSocket) {
            vSocket.emit("errorResponseFromServer", message);
        } else {
            console.log(`client with socket id : ${message.socketId} diconnected... unable to emit message`);
        }
    });
    console.log(`gateway is listening on http://localhost:${port}`);
    console.log(`gateway swagger documentation is listening on http://localhost:${port}/api-gateway`);
});
