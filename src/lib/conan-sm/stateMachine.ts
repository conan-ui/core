import {SMJoinerDef, SMListenerDef, SmListenersByType, StateMachineListenerDefs} from "./stateMachineListenerDefs";
import {SerializedSmEvent, SmEvent, SmListener} from "./domain";
import {StateMachineData} from "./stateMachineStarter";
import {EventThread} from "./eventThread";
import {EventType, StateMachineLogger} from "./stateMachineLogger";
import {Stage, StageDef} from "./stage";
import {ICallback, IConsumer, IKeyValuePairs, WithMetadataArray} from "../conan-utils/typesHelper";
import {ReactionsFactory} from "./reactionsFactory";
import {Strings} from "../conan-utils/strings";
import {StateMachineFactory} from "./stateMachineFactory";
import {Queue} from "./queue";

export interface StateMachineEndpoint<SM_LISTENER extends SmListener,
    JOIN_LISTENER extends SmListener,
    > {
    onceAsap(name: string, requestListeners: SMListenerDef<SM_LISTENER, StateMachine<SM_LISTENER, JOIN_LISTENER>>): this;

    conditionallyOnce(name: string, ifStageListeners: SMJoinerDef<JOIN_LISTENER, StateMachine<SM_LISTENER, JOIN_LISTENER>>): this;

    requestStage (stage: Stage<string, any, any>, eventType: EventType): this;
}

export interface StateMachine<SM_LISTENER extends SmListener,
    JOIN_LISTENER extends SmListener,
    > extends StateMachineEndpoint<SM_LISTENER, JOIN_LISTENER> {
    requestTransition(methodName: string, payload: any, stage: Stage<string, any, any>, eventType: EventType, forksInto: StateMachine<any, any>): this;

    stop(): this;

    getEvents(): SerializedSmEvent [];

    getStageDef(name: string): StageDef<any, any, any>;
}

interface ActionToProcess {
    actionName: string;
    into: Stage<string, any, any>;
    payload?: any;
    eventType: EventType;
    forksInto: StateMachine<any, any>;
}

interface StageToProcess {
    stage: Stage<string, any, any>;
    eventType: EventType;
}

export type ToProcess = StageToProcess | ActionToProcess;

export interface ParentStateMachineInfo<
    SM_LISTENER extends SmListener,
    JOIN_LISTENER extends SmListener,
> {
    stateMachine: StateMachine<SM_LISTENER, JOIN_LISTENER>,
    joinsInto: string[]
}

export class StateMachineImpl<
    SM_LISTENER extends SmListener,
    JOIN_LISTENER extends SmListener,
    ACTIONS,
> implements StateMachine<SM_LISTENER, JOIN_LISTENER> {
    eventThread: EventThread;
    private listeners: SmListenersByType<SM_LISTENER, JOIN_LISTENER>;
    private processing: boolean = false;
    private toProcessQueue: ToProcess[] = [];

    constructor(
        readonly data: StateMachineData<SM_LISTENER, JOIN_LISTENER, ACTIONS>,
        readonly stageDefsByKey: IKeyValuePairs<StageDef<string, any, any, any>>,
        private readonly parent?: ParentStateMachineInfo<any, any>,
    ) {
    }

    init(listeners: SmListenersByType<SM_LISTENER, JOIN_LISTENER>): void {
        this.eventThread = new EventThread();
        this.listeners = listeners;
    }


    requestStage(stage: Stage<string, any, any>, eventType: EventType): this {
        this.doRequest({
            stage,
            eventType: eventType
        } as StageToProcess);
        return this;
    }

    requestTransition(methodName: string, payload: any, stage: Stage<string, any, any>, eventType: EventType, forksInto: StateMachine<any, any>): this {
        StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent ? this.eventThread.currentEvent.stageName : '-', EventType.REQUEST_TRANSITION, `=>transition[${methodName}::${stage.name}]`);
        this.doRequest({
            actionName: methodName,
            into: stage,
            payload: payload,
            eventType: eventType,
            forksInto
        });
        return this;
    }

    private doRequest (toProcess: ToProcess): void{
        if (!this.processing) {
            this.processing = true;
            if ((toProcess as ActionToProcess).actionName) {
                this.processActionEvent(toProcess as ActionToProcess);
            } else {
                this.processStageEvent(toProcess as StageToProcess);
            }
            this.processPendingEvents();
            this.processing = false;
        } else {
            StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent.stageName, EventType.QUEUE_TO_PROCESS, `queueing: ${(toProcess as ActionToProcess).actionName ? 
                `action [${(toProcess as ActionToProcess).actionName}]`: 
                `stage [${(toProcess as StageToProcess).stage.name}]`
            }`);
            this.toProcessQueue.push(toProcess)
        }

    }

    private processPendingEvents(): void {
        if (this.toProcessQueue.length === 0) return;

        let pendingStages: ToProcess[] = [...this.toProcessQueue];
        this.toProcessQueue = [];
        pendingStages.forEach(it => {
            if ((it as ActionToProcess).actionName) {
                this.processActionEvent(it as ActionToProcess);
            } else {
                this.processStageEvent(it as StageToProcess);
            }
        });
        this.processPendingEvents();
    }

    private processActionEvent(actionToProcess: ActionToProcess): void {
        StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent ? this.eventThread.currentEvent.stageName : '-', EventType.REQUEST_ACTION, `=>processing action [${actionToProcess.actionName}]`);

        let eventName = Strings.camelCaseWithPrefix('on', actionToProcess.actionName);
        // @ts-ignore
        this.onceAsap(`${eventName}=>${actionToProcess.into.name}`, {
            [eventName]: {
                then: ()=> this.requestStage(
                    actionToProcess.into,
                    EventType.REQUEST_STAGE,
                )
            }
        });

        this.eventThread.addActionEvent(
            eventName,
            actionToProcess.payload,
        );
        this.publishEvent(this.eventThread.currentEvent);
    }

    private processStageEvent(stageToProcess: StageToProcess): void {
        let intoStageName = stageToProcess.stage.name;
        StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent ? this.eventThread.currentEvent.stageName : '-', EventType.REQUEST_STAGE, `=>requesting stage ${intoStageName}`);

        if (this.parent && this.parent.joinsInto.indexOf(stageToProcess.stage.name) !== -1) {
            StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent ? this.eventThread.currentEvent.stageName : '-', EventType.FORK_STOP, `=>joining back ${intoStageName}`);
            this.requestStage({name: 'stop'}, EventType.FORK_STOP);
            this.onceAsap(`(continueOnParent=>${stageToProcess.stage.name})`, {
                // @ts-ignore
                onStop: {
                    then: ()=> {
                        this.parent.stateMachine.requestStage(stageToProcess.stage, EventType.REQUEST_STAGE);
                    }
                }
            });
            return
        }


        let stageDef = this.stageDefsByKey [intoStageName];
        if (stageDef && stageDef.deferredInfo) {
            let forkMachine = this.fork(
                stageToProcess.stage,
                (actions)=>stageDef.deferredInfo.deferrer (actions, stageToProcess.stage.requirements),
                stageDef.deferredInfo.joinsInto
            );
            this.eventThread.addStageEvent(
                {
                    name: this.eventThread.currentEvent.stageName,
                    requirements: this.eventThread.currentEvent.payload
                },
                Strings.camelCaseWithPrefix('onForking', stageToProcess.stage.name),
                null,
                forkMachine
            )
        } else {
            this.eventThread.addStageEvent(
                stageToProcess.stage,
                Strings.camelCaseWithPrefix('on', stageToProcess.stage.name)
            );
            this.publishEvent(this.eventThread.currentEvent);
        }
    }

    conditionallyOnce(name: string, ifStageListeners: SMJoinerDef<JOIN_LISTENER, StateMachine<SM_LISTENER, JOIN_LISTENER>>): this {
        throw new Error('TBI');
    }

    onceAsap(name: string, requestListeners: SMListenerDef<SM_LISTENER, StateMachine<SM_LISTENER, JOIN_LISTENER>>): this {
        StateMachineLogger.log(this.data.request.name, this.eventThread && this.eventThread.currentEvent ? this.eventThread.currentEvent.stageName: '', EventType.ADDING_REACTION, `adding ASAP reaction: ${name}`);
        this.data.request.nextReactionsQueue.push({
            metadata: name,
            value: requestListeners
        });
        return this;
    }

    stop(): this {
        this.requestStage({name: 'stop'}, EventType.STOP);
        return this;
    }

    getEvents(): SerializedSmEvent [] {
        return this.eventThread.serialize();
    }

    publishEvent(event: SmEvent) {
        let actions: ACTIONS = this.createProxy(this, this.stageDefsByKey, event.stageName, event.payload);
        let reactionsFactory = new ReactionsFactory();
        let reactions: WithMetadataArray<ICallback, string>  = [];

        let whileRunningListeners = this.listeners.whileRunning;

        reactions.push(...reactionsFactory.create(event, actions, whileRunningListeners));
        reactions.push(...this.requestedReactionsProvider(event, actions));

        StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent.stageName, EventType.PUBLISH, `${event.eventName}::pending reactions: [${reactions.length}]`, event.eventName);
        reactions.forEach((it, i) => {
            StateMachineLogger.log(this.data.request.name, event.stageName, EventType.REACTION_START, `START [${it.metadata}]: reaction ${i + 1} of ${reactions.length}`);
            it.value();
            StateMachineLogger.log(this.data.request.name, event.stageName, EventType.REACTION_END, `END [${it.metadata}]`)
        });
    }


    private requestedReactionsProvider(event: SmEvent, actions: ACTIONS): WithMetadataArray<ICallback, string> {
        let listenersDef: WithMetadataArray<SMListenerDef<SM_LISTENER, any>, any> = this.data.request.nextReactionsQueue.read();
        let listeners: WithMetadataArray<SM_LISTENER, any> = StateMachineListenerDefs.transformListeners(listenersDef, this);
        return new ReactionsFactory().create(event, actions, listeners);
    }

    private createProxy(
        stateMachine: StateMachine<any, any>,
        actionsByStage: IKeyValuePairs<StageDef<string, any, any, any>>,
        stageName: string,
        stagePayload: any,
    ) {
        let stageDef: StageDef<string, any, any, any> = actionsByStage [stageName];
        if (!stageDef) return {};
        let actionsLogic: any = new stageDef.logic(stagePayload);
        let proxy: any = {} as any;
        let prototype = Object.getPrototypeOf(actionsLogic);
        Object.getOwnPropertyNames(prototype).forEach(key => {
            if (key === 'constructor') return;
            let toProxy = (prototype as any)[key];
            if (typeof toProxy !== 'function') return;

            (proxy as any)[key] = (payload: any) => {
                let nextStage: Stage<string, any, any> = (actionsLogic as any)[key](payload);
                let nextStageDef: StageDef<string, any, any, any> = actionsByStage [nextStage.name];
                if (nextStageDef == null) {
                    if (!this.parent) {
                        throw new Error(`trying to move to a non existent stage: ${nextStage.name}`);
                    }

                    nextStageDef = this.parent.stateMachine.getStageDef(nextStage.name);
                    if (!nextStageDef) {
                        throw new Error(`trying to move to a non existent stage from a forked stateMachine: ${nextStage.name}`);
                    }
                }


                StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent.stageName, EventType.PROXY, `(proxy::${key})=>requesting::${nextStage.name}`);
                stateMachine.requestTransition(
                    key,
                    payload,
                    nextStage,
                    EventType.ACTION,
                    null
                );
            }
        });
        return proxy;
    }


    getStageDef(name: string): StageDef<any, any, any> {
        return this.stageDefsByKey [name];
    }

    private fork(
        nextStage: Stage<string, any, any>,
        defer: IConsumer<ACTIONS>,
        joinsInto: string []
    ): StateMachineImpl<any, any, any> {
        StateMachineLogger.log(this.data.request.name, this.eventThread.currentEvent.stageName, EventType.FORK, `forking deferred stage: ${nextStage.name}`);
        return StateMachineFactory.fork({
            stateMachine: this,
            joinsInto
        },{
            request: {
                name: `${this.data.request.name}/${nextStage.name}`,
                stageDefs: [{
                    name: nextStage.name,
                    logic: this.stageDefsByKey[nextStage.name].logic
                }],
                nextStagesQueue: new Queue<Stage<string, any, any>>([{name: 'start'}, nextStage]),
                startingPath: this.data.request.startingPath,
                stateMachineListenerDefs:new StateMachineListenerDefs({
                    whileRunning: [
                        {
                            metadata: '(autoDefer)',
                            // @ts-ignore
                            value: {
                                [Strings.camelCaseWithPrefix('on', nextStage.name)]: {
                                    thenRequest: (actions: any)=> defer(actions)
                                },
                            }
                        }
                    ],
                }),
                syncStateMachineDefs: undefined,
                nextConditionalReactionsQueue: new Queue(),
                nextReactionsQueue: new Queue()
            }
        });
    }

}
