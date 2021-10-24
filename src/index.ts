// import { LEDs, Luxa, Wave } from './luxa';

import { FlagLEDs, LuxaFlag } from 'luxa-driver';
import { Packet, isEventPacket, isStatePacket } from './packet';
import { RawData, WebSocket } from 'ws';

import { RcWebSocket } from './client';
import config from './config';
import { onState } from './rules';
import winston from 'winston';

const luxa: LuxaFlag | undefined = LuxaFlag.findOne();
if (!luxa) {
    winston.error('Cannot find Luxafor flag. Was it inserted correctly?');
    process.exit(1);
}

luxa.configure({
    brightness: 0.1,
    target: FlagLEDs.FRONT,
});
luxa.off();

const socket: RcWebSocket = new RcWebSocket(`${config.LUXACAST_HOST}/${config.LUXACAST_GROUP}`, {
    minReconnectInterval: 1000,
    maxReconnectInterval: 60000,
    reconnectIntervalMultiplier: 2,
});
socket.activate();

socket.on('open', (ws: WebSocket) => {
    winston.info('Connected');
    luxa.off();

    ws.on('message', async (buffer: RawData, isBinary: boolean) => {
        const raw: string = buffer.toString('utf-8');
        const packet: Packet = JSON.parse(raw) as Packet;

        if (isStatePacket(packet)) {
            winston.info(`State updated: ${JSON.stringify(packet.state, undefined, 4)}`);
            luxa.color(onState(packet.state));
        } else if (isEventPacket(packet)) {
            winston.warn(`Got event packet: ${JSON.stringify(packet, undefined, 4)}`);
        } else {
            winston.error(`Not a valid packet: ${JSON.stringify(packet, undefined, 4)}`);
        }
    });
});

socket.on('close', (code: number, reason: Buffer) => {
    winston.info('Disconnected');
    luxa.color('#f80');
});

socket.on('error', (err: Error) => {
    winston.error(`Error: ${err}`);
});

/*
    Make sure the light turns off when the software is turned off!
*/

process.on('SIGINT', () => {
    luxa.off();
});
process.on('beforeExit', () => {
    luxa.off();
});
