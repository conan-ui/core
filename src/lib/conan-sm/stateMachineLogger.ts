import {Strings} from "../conan-utils/strings";

export enum EventType {
    ADD_LISTENER = '+LISTENER',
    ADD_INTERCEPTOR = '+INTERCEPT',
    STOP = 'STOP',
    FORK = 'FORK',
    FORK_STOP = 'FORK_STOP',
    STAGE = 'STAGE',
    TRANSACTION = 'TRANSACTION',
    ADD_TO_QUEUE = '+QUEUE',
    PROCESS_FROM_QUEUE = '=>QUEUE',
    JUST_PROCESSED = '<=QUEUE',
    TRANSITION = 'TRANSITION',
    REACTION_START = '=>REACT',
    REACTION_END = '<=REACT',
    REACTING = 'REACTING',
    PROXY = 'PROXY',
    ACTION = 'ACTION',
    INIT = 'INIT'
}

export class StateMachineLogger {
    static log(threadName: string, stageName: string, eventType: EventType, details?: string, additionalLines?: [string, string][]): void {
        let eventTypeCol: string = `${eventType}`;
        let threadNameCol: string = `${threadName}`;
        let stageNameCol: string = `${stageName}`;

        if (additionalLines){
            console.log('----------------------------------------------------------------------------------------------------------------------------------------------------')
        }

        console.log(
            Strings.padEnd(threadNameCol, 30),
            Strings.padEnd(stageNameCol, 25),
            Strings.padEnd(eventTypeCol, 12),
            details
        );

        if (!additionalLines) return;
        if (!additionalLines) return;

        additionalLines.forEach(it => {
            if (it[1] == null || it[1] === '{}' || it[1] == '') return;
            console.log("=>", Strings.padEnd(it [0], 18), it [1]);
        });
        console.log('----------------------------------------------------------------------------------------------------------------------------------------------------')
    }
}
