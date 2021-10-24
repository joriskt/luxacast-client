import { EventPacket } from './event';
import { StatePacket } from './state';

export * from './event';
export * from './state';

export type Packet = EventPacket | StatePacket;
