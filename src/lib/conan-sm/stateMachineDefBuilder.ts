import {IBiConsumer, IConstructor, IConsumer} from "../conan-utils/typesHelper";
import {ListenerType, SmListener, SmListenerDefLike, SmListenerDefLikeParser} from "./stateMachineListeners";
import {SmEventsPublisher} from "./_domain";
import {State, StateDef, StateLogic} from "./state";
import {StateMachineDef, SyncListener} from "./stateMachineDef";


export interface StateMachineBuilderEndpoint<SM_ON_LISTENER extends SmListener,
    > extends SmEventsPublisher <SM_ON_LISTENER, SM_ON_LISTENER> {
    withState<ACTIONS,
        DATA = void>
    (
        stateName: string,
        logic: StateLogic<ACTIONS, DATA>,
    ): this;

    withDeferredState<NAME extends string,
        ACTIONS,
        REQUIREMENTS = void>(
        name: NAME,
        logic: IConstructor<ACTIONS, REQUIREMENTS>,
        deferrer: IBiConsumer<ACTIONS, REQUIREMENTS>,
        joinsInto: string[]
    ): this;

    sync<INTO_SM_ON_LISTENER extends SmListener,
        JOIN_SM_ON_LISTENER extends SmListener>(
        name: string,
        treeStateMachineDef: StateMachineBuilderEndpoint<SM_ON_LISTENER>,
        joiner: SyncListener<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>,
        initCb?: IConsumer<StateMachineDef<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>>
    ): this;
}

export class StateMachineDefBuilder<
    SM_ON_LISTENER extends SmListener,
> implements StateMachineBuilderEndpoint<SM_ON_LISTENER> {
    private readonly smListenerDefLikeParser: SmListenerDefLikeParser = new SmListenerDefLikeParser();

    public stateMachineTreeDef: StateMachineDef<SM_ON_LISTENER, SM_ON_LISTENER> = {
        rootDef: {
            listeners: [],
            interceptors: [],
            name: undefined,
            stageDefsByKey: {},
        },
        syncDefs: [],
    };
    addListener(listener: SmListenerDefLike<SM_ON_LISTENER>, type: ListenerType = ListenerType.ALWAYS): this {
        this.stateMachineTreeDef.rootDef.listeners.push(
            this.smListenerDefLikeParser.parse(listener, type)
        );
        return this;
    }

    addInterceptor(interceptor: SmListenerDefLike<SM_ON_LISTENER>, type: ListenerType = ListenerType.ALWAYS): this {
        throw new Error('TBI');
    }

    withInitialState<DATA = void>(
        stateName: string,
        data?: DATA,
    ): this {
        this.withState<any>('start', () => ({
            doInitialise: (initialData: DATA): State<any, DATA> => ({
                name: stateName,
                ...initialData ? {data: initialData} : undefined
            })
        }))
            .addListener([`::start=>doInitialise`, {
                onStart: (actions: any) => actions.doInitialise(data)
            } as any,], ListenerType.ONCE);
        return this;
    }

    withDeferredStart<
        ACTIONS,
        DATA>
    (
        joinsInto: string,
        actionsProvider: IConstructor<ACTIONS, DATA>,
        deferrer: IConsumer<ACTIONS>
    ): this {
        // [`onStart=>initializing`, {
        //     onStart: (_: any, params: any) => params.sm.requestTransition({
        //         transition: {
        //             stateName: 'initializing'
        //         },
        //         transitionName: 'doInitializing'
        //     } as any)
        // }]
        return this.withDeferredState<'start',
            ACTIONS,
            DATA>(
            'start',
            actionsProvider,
            deferrer,
            [joinsInto]
        );
    }


    withState<
        ACTIONS,
        DATA = void
    >(
        stateName: string,
        logic: StateLogic<ACTIONS, DATA>,
    ): this {
        this.stateMachineTreeDef.rootDef.stageDefsByKey [stateName] = {
            logic: logic,
            name: stateName
        } as StateDef<any, any, any>;
        return this;
    }


    withDeferredState<NAME extends string,
        ACTIONS,
        REQUIREMENTS = void>
    (
        name: NAME,
        logic: StateLogic<ACTIONS, REQUIREMENTS>,
        deferrer: IBiConsumer<ACTIONS, REQUIREMENTS>,
        joinsInto: string[]
    ): this {
        this.stateMachineTreeDef.rootDef.stageDefsByKey[name] = {
            name: name,
            logic: logic,
            deferredInfo: {
                deferrer: deferrer,
                joinsInto: joinsInto
            }
        } as StateDef<NAME, ACTIONS, any, REQUIREMENTS>;
        return this;
    }

    sync<INTO_SM_ON_LISTENER extends SmListener,
        JOIN_SM_ON_LISTENER extends SmListener>(
        name: string,
        treeStateMachineDef: StateMachineBuilderEndpoint<SM_ON_LISTENER>,
        joiner: SyncListener<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>,
        initCb?: IConsumer<StateMachineDef<INTO_SM_ON_LISTENER, JOIN_SM_ON_LISTENER>>
    ): this {
        throw new Error('TBI');
    }

    withName(name: string) {
        this.stateMachineTreeDef.rootDef.name = name;
    }

    build(): StateMachineDef<SM_ON_LISTENER, SM_ON_LISTENER> {
        return this.stateMachineTreeDef;
    }
}