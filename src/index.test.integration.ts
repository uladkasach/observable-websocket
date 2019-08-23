import waitUntil from 'async-wait-until';
import { ObservableWebsocket } from './index';

const ECHO_SERVER_URI = 'wss://echo.websocket.org';

const consumerMock = jest.fn();

describe('ObservableWebsocket', () => {
  beforeEach(() => jest.clearAllMocks());
  it('should be able to send a message to a websocket server', async () => {
    const websocket = new ObservableWebsocket({ uri: ECHO_SERVER_URI, debug: true });
    await websocket.send({ data: 'hello' });
  });
  it('should be able to subscribe to a server, send a message, and unsubscribe', async () => {
    const websocket = new ObservableWebsocket({ uri: ECHO_SERVER_URI, debug: true });
    await websocket.subscribe({ consumer: consumerMock });
    await websocket.send({ data: 'hello' });
    await websocket.unsubscribe({ consumer: consumerMock });
  });
  it('should be able to subscribe to an echo server, send a message, receive the echo response, and unsubscribe', async () => {
    const websocket = new ObservableWebsocket({ uri: ECHO_SERVER_URI, debug: true });
    await websocket.subscribe({ consumer: consumerMock });
    await websocket.send({ data: 'hello' });
    await waitUntil(() => consumerMock.mock.calls.length); // wait until the consumer is called
    expect(consumerMock).toHaveBeenCalledTimes(1); // exactly one response, because only one message sent
    expect(consumerMock).toHaveBeenCalledWith({ event: 'hello' }); // exactly the same data that we sent the websocket, since we're talking to an echo server
    await websocket.unsubscribe({ consumer: consumerMock });
  });
});
