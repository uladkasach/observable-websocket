import waitUntil from 'async-wait-until';
import { EventStreamPubSub, EventStreamPubSubConsumer } from 'event-stream-pubsub';
import WebSocket from 'isomorphic-ws';

export enum ObservableWebsocketRequestedState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export class ObservableWebsocket {
  private debug: boolean;
  private uri: string;
  private protocols?: string[];
  private maxConnectionAttempts: number;
  private messageStream: EventStreamPubSub<any>; // where we publish data to and what the consumer can subscribe to
  private requestedState: ObservableWebsocketRequestedState = ObservableWebsocketRequestedState.CLOSED; // initial state is closed
  private subscriberCount: number = 0; // initial value is zero
  constructor({
    uri,
    protocols,
    maxConnectionAttempts = 0, // defaults to infinite
    debug = false, // defaults to false
  }: {
    uri: string;
    protocols?: string[];
    maxConnectionAttempts?: number;
    debug?: boolean;
  }) {
    this.uri = uri;
    this.protocols = protocols;
    this.maxConnectionAttempts = maxConnectionAttempts;
    this.debug = debug;
    this.messageStream = new EventStreamPubSub<any>();
  }

  /*
    public
  */
  public get isOpen() {
    return !!this.openSocket;
  }
  public async send({ data }: { data: any }) {
    if (!this.isOpen) await this.open(); // should open on send if not already open
    this.logDebug({ message: `connection-send::${data}::${this.uri}` });
    this.openSocket!.send(data); // send the data
    if (!this.subscriberCount) await this.close(); // if no subscribers, then we should close after send
  }
  public async subscribe({ consumer }: { consumer: EventStreamPubSubConsumer<any> }) {
    this.messageStream.subscribe({ consumer });
    this.subscriberCount += 1;
    if (!this.isOpen) await this.open(); // open it if not already open
  }
  public async unsubscribe({ consumer }: { consumer: EventStreamPubSubConsumer<any> }) {
    this.messageStream.unsubscribe({ consumer });
    this.subscriberCount -= 1;
    if (!this.subscriberCount) await this.close(); // if no subscribers, then we should close
  }

  /*
    private
  */
  private logDebug({ message }: { message: string }) {
    if (!this.debug) return; // do nothing if not in debug mode
    console.log(`ObservableWebsocket: ${message}`);
  }

  // to open: set requested state and attempt to open connection
  private async open() {
    this.requestedState = ObservableWebsocketRequestedState.OPEN;
    this.attemptOpenConnection({ connectionAttempt: 0 });
    await waitUntil(() => this.isOpen, 30000, 100); // wait up to 30s for this to become open
  }

  // to close: set requested state and trigger close on socket
  private async close() {
    this.requestedState = ObservableWebsocketRequestedState.CLOSED;
    if (this.openSocket) this.openSocket.close();
    await waitUntil(() => !this.isOpen, 30000, 100); // wait up to 30s for this to become closed
  }

  // to open a connection, do lots of things:
  private openSocket?: WebSocket;
  private attemptOpenConnection({ connectionAttempt = 0 }: { connectionAttempt?: number }) {
    // do nothing if we've not requested this connection to be open
    if (this.requestedState !== ObservableWebsocketRequestedState.OPEN) return;

    // do nothing if we've attempted to reconnect more than the max amount already
    if (this.maxConnectionAttempts && connectionAttempt >= this.maxConnectionAttempts) return; // NOTE: we treat maxConnectionAttempts = 0 as infinite

    // start the connection and define the socket
    const socket = new WebSocket(this.uri, this.protocols); // NOTE: this automatically starts the connection

    // log debug message, if in debug mode
    this.logDebug({ message: `connection-attempt-${connectionAttempt}::${this.uri}` });

    // track when socket is opened
    socket.onopen = () => {
      this.logDebug({ message: `connection-onopen::${this.uri}` });
      this.openSocket = socket; // on open, set the open socket
    };

    // on message, publish to the event stream
    socket.onmessage = (event) => {
      this.logDebug({ message: `connection-onmessage::${this.uri}::${event.data}` });
      this.messageStream.publish({ event: event.data });
    };

    // track when socket is closed, and attempt reconnect
    socket.onclose = () => {
      this.logDebug({ message: `connection-onclose::${this.uri}` });

      // remove the open socket, on close
      this.openSocket = undefined;

      // if not explicitly request the connection to be closed, attempt to reconnect
      if (this.requestedState !== ObservableWebsocketRequestedState.CLOSED) {
        this.attemptOpenConnection({ connectionAttempt: connectionAttempt + 1 }); // attempt to reconnect
      }
    };

    // on error, throw error... to who?
    socket.onerror = (event) => {
      this.logDebug({ message: `connection-onerror::${this.uri}` });
      console.log(event); // TODO: figure out how to handle errors in an "observable" fashion: https://github.com/uladkasach/observable-websocket/issues/1
    };
  }
}
