import { Packet } from '.';

export type EventPacket = {
    event: string;
    payload: any;
};

export function eventPacket(event: string, payload: any): EventPacket {
    return { event, payload };
}

export function isEventPacket(packet: Packet): packet is EventPacket {
    return packet.hasOwnProperty('event');
}
