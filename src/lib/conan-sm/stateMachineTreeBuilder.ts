import {IBiConsumer, IConstructor, IConsumer, IOptSetKeyValuePairs, WithMetadata} from "../conan-utils/typesHelper";
import {SmListener} from "./domain";
import {StateMachine, StateMachineEndpoint} from "./stateMachine";
import {StateMachineData, StateMachineTree} from "./stateMachineTree";
import {Queue} from "./queue";
import {Stage} from "./stage";


export type SyncListener<
    INTO_SM_ON_LISTENER extends SmListener,
    JOIN_SM_ON_LISTENER extends SmListener
> = IOptSetKeyValuePairs<keyof INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>

export interface SyncStateMachineDef<
    SM_IF_LISTENER extends SmListener,
    INTO_SM_ON_LISTENER extends SmListener,
    JOIN_SM_ON_LISTENER extends SmListener,
> {
    stateMachineBuilder: StateMachineTreeBuilder<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER, any>,
    syncName: string,
    syncStartingPath?: string;
    joiner: SyncListener<INTO_SM_ON_LISTENER, SM_IF_LISTENER>,
    initCb?: IConsumer<StateMachineTreeBuilder<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER, any>>
}

export class StateMachineTreeBuilder<
    SM_ON_LISTENER extends SmListener,
    SM_IF_LISTENER extends SmListener,
    SM_ACTIONS
> implements StateMachineEndpoint <SM_ON_LISTENER, SM_IF_LISTENER> {
    public data: StateMachineData<SM_ON_LISTENER, SM_IF_LISTENER> = {
        request: {
            nextReactionsQueue: new Queue<WithMetadata<SM_ON_LISTENER, string>>(),
            nextConditionalReactionsQueue: new Queue<WithMetadata<SM_IF_LISTENER, string>>(),
            nextStagesQueue: new Queue<Stage>(),
            stateMachineListeners: [],
            name: undefined,
            syncStateMachineDefs: [],
            stageDefs: [],
        }
    };
    private started: boolean = false;

    always(name: string, listener: SM_ON_LISTENER): this {
        if (this.started) throw new Error("can't modify the behaviour of a state machine once that it has started");
        this.data.request.stateMachineListeners.push({
            metadata: name,
            value: listener
        });
        return this;
    }

    onceAsap(name: string, requestListeners: SM_ON_LISTENER): this {
        this.data.request.nextReactionsQueue.push({
            metadata: name,
            value: requestListeners
        });
        return this;
    }

    withStage<
        NAME extends string,
        ACTIONS,
        REQUIREMENTS = void
    >(
        name: NAME,
        logic: IConstructor<ACTIONS, REQUIREMENTS>,
    ): this {
        this.data.request.stageDefs.push({
            name,
            logic,
        });
        return this;
    }

    withDeferredStage<
        NAME extends string,
        ACTIONS,
        REQUIREMENTS = void
    >(
        name: NAME,
        logic: IConstructor<ACTIONS, REQUIREMENTS>,
        deferrer: IBiConsumer<ACTIONS, REQUIREMENTS>,
        joinsInto: string[]
    ): this {
        this.data.request.stageDefs.push({
            name,
            logic,
            deferredInfo: {
                deferrer,
                joinsInto
            }
        });
        return this;
    }



    requestStage(stage: Stage): this {
        this.data.request.nextStagesQueue.push(stage);
        return this;
    }

    conditionallyOnce(name: string, ifStageListeners: SM_IF_LISTENER): this {
        this.data.request.nextConditionalReactionsQueue.push({
            metadata: name,
            value: ifStageListeners
        });
        return this;
    }

    sync<
        INTO_SM_ON_LISTENER extends SmListener,
        JOIN_SM_ON_LISTENER extends SmListener
    >(
        name: string,
        stateMachine: StateMachineTreeBuilder<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER, any>,
        joiner: SyncListener<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>,
        initCb?: IConsumer<StateMachineTreeBuilder<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER, any>>
    ): this {
        if (this.started) throw new Error("can't modify the behaviour of a state machine once that it has started");
        this.data.request.syncStateMachineDefs.push({
            stateMachineBuilder: stateMachine,
            syncName: name,
            joiner: joiner as unknown as SyncListener<any, SM_IF_LISTENER>,
            initCb
        });
        return this;
    }

    start(name: string): StateMachine<SM_ON_LISTENER, SM_IF_LISTENER> {
        if (this.started) throw new Error("can't start twice the same state machine");

        this.data.request.name = name;
        return new StateMachineTree().start(this);
    }
}