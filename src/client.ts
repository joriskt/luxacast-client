import { ClientOptions, RawData, WebSocket } from 'ws';

import { ClientRequestArgs } from 'http';
import EventEmitter from 'events';
import { URL } from 'url';
import winston from 'winston';

export type RcOptions = {
    minReconnectInterval?: number;
    maxReconnectInterval?: number;
    reconnectIntervalMultiplier?: number;
};

export class RcWebSocket {
    private readonly emitter: EventEmitter;

    private readonly address: string | URL;
    private readonly options?: ClientOptions | ClientRequestArgs;

    /*
        Timeouts
    */
    private minTimeout: number;
    private maxTimeout: number;
    private curTimeout: number;
    private timeoutMultiplier: number;
    private timeoutId?: NodeJS.Timeout;
    private pingIntervalId?: NodeJS.Timer;

    /*
        State
    */

    /**
     * Whether we currently INTEND to reconnect, should we disconnect.
     */
    private shouldReconnect: boolean;

    /**
     * Whether there CURRENTLY exists a stable connection.
     */
    private connected: boolean;

    /**
     * Whether we are currently actively attempting to re-establish a connection.
     */
    private activelyReconnecting: boolean;

    /**
     * Our current WebSocket instance, if any.
     */
    private socket?: WebSocket;

    constructor(address: string | URL, options?: RcOptions & (ClientOptions | ClientRequestArgs)) {
        this.emitter = new EventEmitter();

        // WebSocket settings
        this.address = address;
        this.options = options;

        // Reconnect settings
        this.minTimeout = options?.minReconnectInterval || 1000;
        this.maxTimeout = options?.maxReconnectInterval || 60000;
        this.timeoutMultiplier = options?.reconnectIntervalMultiplier || 2;

        // Current connection state
        this.shouldReconnect = false;
        this.connected = false;

        // Current reconnection state
        this.activelyReconnecting = false;
        this.curTimeout = this.minTimeout;
    }

    activate(): void {
        // Do nothing if we're already activated.
        if (this.shouldReconnect) {
            return;
        }

        this.shouldReconnect = true;
        this.open();
    }

    deactivate(): void {
        // Do nothing if we're not active.
        if (!this.shouldReconnect) {
            return;
        }

        this.stopReconnecting();
        this.close();
    }

    open(): void {
        // Do nothing if we're already connected or currently connecting.
        if (this.socket) {
            return;
        }

        // Initiate the WebSocket.
        const socket: WebSocket = new WebSocket(this.address, this.options);
        this.socket = socket;

        // Catch all events WE need to know about.
        socket.on('open', this.onOpen.bind(this));
        socket.on('error', this.onError.bind(this));
        socket.on('close', this.onClose.bind(this));
    }

    close(): void {
        // Do nothing if we're neither connected nor connecting.
        if (!this.socket) {
            return;
        }

        this.connected = false;
        this.socket?.close();
        this.socket = undefined;
    }

    on(event: 'open', fn: (ws: WebSocket) => void): void;
    on(event: 'close', fn: (code: number, reason: Buffer) => void): void;
    on(event: 'error', fn: (err: Error) => void): void;
    on(event: string, fn: (...args: any[]) => void) {
        this.emitter.on(event, fn);
    }

    /**
     * Start the reconnect cycle. This does not mean an immediate reconnection attempt;
     * it simply means that a new attempt will be scheduled if it isn't already.
     */
    private startReconnecting(): void {
        if (this.activelyReconnecting) return;

        this.activelyReconnecting = true;
        this.curTimeout = this.minTimeout;
        this.scheduleReconnect();
    }

    /**
     * Schedule the next reconnect attempt.
     */
    private scheduleReconnect(): void {
        if (!this.activelyReconnecting) {
            return;
        }

        // Start the timeout.
        this.timeoutId = setTimeout(() => {
            this.timeoutId = undefined;
            this.open();
            this.scheduleReconnect();
        }, this.curTimeout);

        // Multiply the curTimeout, while making sure it always stays within bounds of
        // [minTimeout, maxTimeout].
        this.curTimeout = Math.max(
            this.minTimeout,
            Math.min(this.maxTimeout, this.curTimeout * this.timeoutMultiplier)
        );
    }

    /**
     * Stop an active reconnect cycle, if any.
     *
     * **Warning:** This does *NOT* stop an active reconnection attempt. It only stops a new
     * attempt from being scheduled.
     */
    private stopReconnecting(): void {
        this.activelyReconnecting = false;
        winston.debug(`stopReconnecting()`);

        // Unschedule the next attempt if it was already scheduled.
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }

    /**
     * The current {@link WebSocket} connection, if any.
     */
    get connection(): WebSocket | undefined {
        return this.socket;
    }

    /**
     * @returns Whether there currently exists an open socket.
     */
    get isConnected() {
        return this.connected;
    }

    /**
     * Whether there is currently a connection attempt ongoing.
     * @returns true if there is a connection attempt ongoing, false if there is no socket at all
     *          or if the socket has already connected.
     */
    get isConnecting() {
        return !this.connected && this.socket !== undefined;
    }

    /**
     * Whether there currently is a reconnect attempt scheduled.
     */
    get isReconnectScheduled() {
        return this.timeoutId !== undefined;
    }

    private onOpen(): void {
        winston.debug('onOpen()');
        this.connected = true;
        // We are no longer in an active reconnect cycle.
        this.activelyReconnecting = false;

        this.emitter.emit('open', this.socket);

        this.pingIntervalId = setInterval(() => {
            this.socket?.ping();
        }, 30000);
    }

    private onError(err: Error): void {
        winston.debug('onError()');

        // Only emit the events when we are NOT actively reconnecting.
        if (!this.activelyReconnecting) {
            this.emitter.emit('error', err);
        }
    }

    private onClose(code: number, reason: Buffer): void {
        winston.debug('onClose()');
        this.socket = undefined;

        // Stop sending PINGs.
        if (this.pingIntervalId) {
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = undefined;
        }

        // Only fire a close event when the connection was closed.
        if (this.connected) {
            this.emitter.emit('close', code, reason);
        }

        this.connected = false;
        if (this.shouldReconnect) {
            this.startReconnecting();
        }
    }
}
