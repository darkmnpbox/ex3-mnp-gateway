# API GATEWAY

## Setup Rabbitmq Configuration
    - This configuration is independent of this project, so we can create different project for this configuration then pull to submodules.
    - Create a different topic for exchanges, should be unique for each topic.
    - Crate a general purpose class `Broker` for:
        - Initiate all exchanges required by `exchanges.ts`.
        - Publish to a queue.
        - Listen to queue.

## Setup Middleware for token authentication
    - Created a middleware in middlewares folder.

## Create app.ts : entry point
    - Use nessasary middlewares : cors, bodyparser.
    - Declare varibles: sockets, broker, activeConnectionDict, socketAndDeviceDict.
    - Setup socket connect with client.
    - Create Routes :-
        - create a connection between device and gateway : `get('/connectdevice/:id/:socketid')`.
        - create a **GET** request for service to get all objects : `get('/:service')`.
        - craete a **GET** request for service to get object by id : `get('/:service/:id')`.
        - create a **POST** request for service to create a object : `post('/:service')`.
        - craete a **PUT** request for service to update object by id : `put('/:service/:id')`.
        - craete a **DELETE** request for service to delete object by id : `delete('/:service/:id')`.
