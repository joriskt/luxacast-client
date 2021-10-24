import { LuxaFlag } from 'luxa-driver';

const OFF: string = '#000';
const RED: string = '#f00';
const GREEN: string = '#0f0';
const ORANGE: string = '#f40';
const CYAN: string = '#0ff';

export function onState(E: Record<string, boolean>): string {
    if (!E.working || !(E.office_location || E.home_location)) {
        return OFF;
    }

    // If we are occupied.
    if (E.meeting || E.calling || E.busy) {
        return RED;
    }

    // If we are away.
    if (E.away) {
        return ORANGE;
    }

    // When we are in the office..
    if (E.office_location) {
        // We want to switch between GREEN and ORANGE depending on if we are in front of the
        // computer or not. However, this requires some work. For now, default to GREEN.
        return GREEN;
    }

    // When we are at home..
    if (E.home_location) {
        return CYAN;
    }

    return OFF;
}

export function onEvent(event: string, luxa: LuxaFlag): void {
    luxa.blink('#f80', { times: 5 });
}
