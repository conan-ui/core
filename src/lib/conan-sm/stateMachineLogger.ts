import {Strings} from "../conan-utils/strings";

export enum EventType {
    ADDING_REACTION = '+ASAP',
    STOP = 'STOP',
    FORK = 'FORK',
    FORK_STOP = 'FORK_STOP',
    REQUEST_ACTION = 'REQ_ACTION',
    REQUEST_STAGE = 'REQ_STAGE',
    QUEUE_TO_PROCESS = 'Q_EVENT',
    REQUEST_TRANSITION = 'REQ_TRANSIT',
    REACTION_START = '=>REACT',
    REACTION_END = '<=REACT',
    PUBLISH = 'PUBLISH',
    PROXY = 'PROXY',
    ACTION = 'ACTION',
    INIT = 'INIT'
}

export class StateMachineLogger {
    static log(threadName: string, stageName: string, eventType: EventType, details?: string, handlerName?: string, additionalLines?: [string, string][]): void {
        let eventTypeCol: string = `${eventType}`;
        let threadNameCol: string = `${threadName}`;
        let stageNameCol: string = `${stageName}`;
        let handlerNameCol: string = `${handlerName ? handlerName : '-'}`;

        if (additionalLines){
            console.log('----------------------------------------------------------------------------------------------------------------------------------------------------')
        }

        console.log(
            Strings.padEnd(threadNameCol, 30),
            Strings.padEnd(handlerNameCol, 27),
            Strings.padEnd(stageNameCol, 25),
            Strings.padEnd(eventTypeCol, 12),
            details
        );

        if (!additionalLines) return;

        additionalLines.forEach(it => {
            if (it[1] == null || it[1] === '{}' || it[1] == '') return;
            console.log("=>", Strings.padEnd(it [0], 18), it [1]);
        });
        console.log('----------------------------------------------------------------------------------------------------------------------------------------------------')
    }
}
