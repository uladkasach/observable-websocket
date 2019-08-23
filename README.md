# observable-websocket

a websocket client that makes it possible to interact with websockets using subscriptions

# features

- subscribe to messages from websocket, in observable fashion
- automatically attempt reconnect, up to limit, on connection broken without client intent
- automatically managed websocket connection on `subscribe`, `unsubscribe`, and `send`

# installation

```ts
npm install --save observable-websocket
```

# usage

```ts
// create a new websocket (without attempting to establish any connections)
const ECHO_SERVER_URI = 'wss://echo.websocket.org';
const websocket = new ObservableWebsocket({ uri: ECHO_SERVER_URI });

// define some consumer; in this case, we'll just log whatever the websocket server tells us
const consumer = ({ event }: { event: any }) => console.log(event);

// subscribe to the websocket (and automatically establish a connection in the process)
await websocket.subscribe({ consumer });

// send some data to the websocket server
await websocket.send({ data: 'hello' });

// we'll now see that the consumer has logged the message back to us, as the websocket server responds
> "hello"

// now lets unsubscribe to close the connection
await websocket.unsubscribe({ consumer });
```

# options

#### `protocols?: string[];`

passed directly to the underlying websocket client: `new Websocket(uri, protocols)`

default: undefined

#### `maxConnectionAttempts?: number;`

defines how many times we can attempt to connect, which limits the auto-reconnect functionality

default: 0 -> no limit

#### `debug?: boolean;`

defines whether or not to console.log debug statements (e.g., onopen, onmessage, onclose)

default: false
