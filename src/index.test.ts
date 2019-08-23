import Websocket from 'isomorphic-ws';
import { ObservableWebsocket, ObservableWebsocketRequestedState } from './index';

/*
  note: unit test coverage is not complete as we implicitly test many things with the integration test.
    - as we find cases where more nuanced testing is required, we can add them to unit test coverage.
    - otherwise, it will likely be overkill

  TODO: make library easier to test and understand:
    - consider breaking up the `attemptOpenConnection` method and the class into other methods / composable functions to make it easier to understand and to make less "tricky"
    - potentially, even just breaking the full class into two classes:
      - one that manages opening and closing the connection and exposes the `open` and `close` methods
      - another than manages the user intents: send, subscribe, unsubscribe
*/

interface SharedIsoWebsocketInstance {
  removeWebsocketOnEventHandlers: () => void;
  onclose?: () => void;
}
jest.mock('isomorphic-ws', () => {
  // to be able to access properties of the "socket" for testing, we need to create a shared object that is passed around by reference. for tests not to affect each other, it will need to be able to "clean" itself to reset its state after we add props
  const isoInstance = {
    // tslint:disable-next-line object-literal-shorthand space-before-function-paren
    removeWebsocketOnEventHandlers: function() {
      delete (this as any).onopen;
      delete (this as any).onclose;
      delete (this as any).onmessage;
      delete (this as any).onerror;
    },
  }; // define one object that is returned by reference for every socket
  return jest.fn().mockImplementation(() => {
    return isoInstance;
  });
});
const isoWebsocketConstructorMock = (Websocket as any) as jest.Mock;
const sharedIsoWebsocketInstance = (new Websocket('__PATH__') as any) as SharedIsoWebsocketInstance;

describe('ObservableWebsocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sharedIsoWebsocketInstance.removeWebsocketOnEventHandlers(); // clean the state before each test
  });
  describe('internals', () => {
    describe('attemptOpenConnection', () => {
      it('should do nothing if the requested state is not OPEN (i.e., dont reconnect if not desired to be open)', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__' });
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).not.toHaveBeenCalled(); // we shouldn't have attempted to start the connection, so this should not have been called
      });
      it('should instantiate the real websocket if the requested state _was_ OPEN', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 0 });
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're requested state is open
      });
      it('should do nothing if this connection attempt is over the maxConnectionAttempts limit', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 2 });
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({ connectionAttempt: 3 });
        expect(isoWebsocketConstructorMock).not.toHaveBeenCalled(); // we shouldn't have attempted to start the connection, so this should not have been called
      });
      it('should consider a maxConnectionAttempt of 0 to imply infinite connection attempts are allowed', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 0 });
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({ connectionAttempt: 9999999 });
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're allowed infinite connection attempts
      });
      it('should define an onclose event on the opened websocket', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 0 });

        // show that before opening, there is no openSocket on the websocket
        expect(sharedIsoWebsocketInstance).not.toHaveProperty('onclose');

        // open the websocket
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're requested state is open

        // show that now the websocket does have this property
        expect(sharedIsoWebsocketInstance).toHaveProperty('onclose');
      });
      it('should attempt to reconnect "onclose"', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 0 });

        // open the websocket
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're requested state is open

        // run the onclose property - show that it results in connection being created again
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(2); // two instead of one now
      });
      it('should not attempt to reconnect "onclose" if the requested state has been changed to CLOSED', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 0 });

        // open the websocket
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're requested state is open

        // set requestedState to closed and run the onclose property - show that it results in connection NOT being created again
        (websocket as any).requestedState = ObservableWebsocketRequestedState.CLOSED;
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // still one
      });
      it('should not attempt to reconnect "onclose" the maxConnectionAttempts number of times and no more', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__', maxConnectionAttempts: 3 });

        // open the websocket
        (websocket as any).requestedState = ObservableWebsocketRequestedState.OPEN;
        (websocket as any).attemptOpenConnection({});
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(1); // show that we called it, because we're requested state is open

        // keep running on close and show that it stops attempting to connect after limit is reached
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(2);
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(3);
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(3);
        sharedIsoWebsocketInstance.onclose!();
        expect(isoWebsocketConstructorMock).toHaveBeenCalledTimes(3);
      });
    });
  });
  describe('public api', () => {
    describe('instantiation', () => {
      it('should have zero as the default value for maxConnectionAttempts', () => {
        const websocket = new ObservableWebsocket({ uri: '__SOME_URI__' });
        expect((websocket as any).maxConnectionAttempts).toEqual(0);
      });
    });
    describe('message sending', () => {
      it.skip('should open a connection if one was not already open before sending a message, and then close the connection', () => {});
      it.skip('should return a promise for sending a message, which resolves after the connection was opened and the message was successfully sent', () => {});
    });
    describe('observation', () => {
      it.skip('should open a connection if it is the first subscriber', () => {});
      it.skip('should close a connection if no more subscribers remaining', () => {});
      it.skip('should be possible to consume events', () => {});
    });
  });
});
