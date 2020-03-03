import {Strings} from "../conan-utils/strings";
import {StateMachineStatus} from "./stateMachine";

export enum EventType {
    REQUEST = 'REQUEST',
    REACTION = 'REACTION',
    ADD_LISTENER = '+LISTENER',
    ADD_INTERCEPTOR = '+INTERCEPT',
    SHUTDOWN = 'SHUTDOWN',
    FORK = 'FORK',
    FORK_STOP = 'FORK_STOP',
    STAGE = 'STAGE',
    ACTION = 'ACTION',
    INIT = 'INIT'
}

export const eventTypesToLog: EventType[] = [
    EventType.INIT,
    EventType.STAGE,
    // EventType.REQUEST,
    // EventType.REACTION,
    // EventType.REQUEST,
    EventType.FORK,
    EventType.ACTION,
    EventType.SHUTDOWN
];

export const detailLinesToLog: string[] = [
    // 'init listeners',
    'listeners',
    // 'system listeners',
    'stages',
    // 'system stages '
];

export class StateMachineLogger {
    static log(smName: string, status: StateMachineStatus, stageName: string, actionName: string, eventType: EventType, transactionId: string, details?: string, additionalLines?: [string, string][]): void {
        if (eventTypesToLog.indexOf(eventType) < 0) return;

        let transactionSplit: string [] = transactionId.split('/');
        let transactionRoot: string = '/' + transactionSplit [0] + transactionSplit [1];
        let transactionRemainder: string = transactionSplit.length < 3 ? '/' : transactionId.substring(transactionRoot.length, transactionId.length);

        if (additionalLines){
            console.log('--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------')
        }

        console.log(
            Strings.padEnd(`${smName}`, 30),
            Strings.padEnd(status, 15),
            Strings.padEnd(transactionRoot, 15),
            Strings.padEnd(`${stageName}`, 25),
            Strings.padEnd(`${actionName}`, 25),
            Strings.padEnd(`${eventType}`, 14),
            Strings.padEnd(transactionRemainder, 90),
            details
        );

        if (!additionalLines) return;
        if (!additionalLines) return;

        additionalLines.forEach(it => {
            if (it[1] == null || it[1] === '{}' || it[1] == '') return;
            let detailLineName = it[0];
            if (detailLinesToLog.indexOf(detailLineName) > -1) {
                console.log("=>", Strings.padEnd(detailLineName, 18), it [1]);
            }
        });
        console.log('--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------')
    }
}
