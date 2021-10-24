import { Packet } from '.';

export type StatePacket = {
    state: Record<string, any>;
};

export function statePacket(state: Record<string, any>) {
    return { state };
}

export function isStatePacket(packet: Packet): packet is StatePacket {
    return packet.hasOwnProperty('state');
}
