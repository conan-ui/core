import {ParentStateMachineInfo, StateMachine, StateMachineStatus, ToProcessType} from "./stateMachine";
import {IConsumer, IKeyValuePairs} from "../conan-utils/typesHelper";
import {Stage, StageDef} from "./stage";
import {Objects} from "../conan-utils/objects";
import {EventType, StateMachineLogger} from "./stateMachineLogger";
import {SmEventCallbackParams, SmListener, SmListenerDefLikeParser, SmListenerDefList} from "./stateMachineListeners";
import {StateMachineTreeBuilderData} from "./_domain";
import {Strings} from "../conan-utils/strings";

export class StateMachineFactory {
    static create<
        SM_ON_LISTENER extends SmListener,
        SM_IF_LISTENER extends SmListener,
        ACTIONS
    >(request: StateMachineTreeBuilderData<SM_ON_LISTENER, SM_IF_LISTENER>): StateMachine<SM_ON_LISTENER, SM_IF_LISTENER, ACTIONS> {
        return this.doCreate(request);
    }


    static fork<
        SM_LISTENER extends SmListener,
        JOIN_LISTENER extends SmListener,
    >(
        forkName: string,
        parent: ParentStateMachineInfo<any, any>,
        forkIntoStage: Stage,
        forkIntoStageDef: StageDef<any, any, any>,
        defer: IConsumer<any>
    ) {
        let deferEventName = Strings.camelCaseWithPrefix('on', forkIntoStage.stage);
        let deferPathName = Strings.camelCaseWithPrefix('do', forkIntoStage.stage);

        return this.doCreate({
            initialListener: {
                metadata: `::start=>${deferPathName}`,
                value: {
                    onStart: (_: any, params: SmEventCallbackParams) => params.sm.requestTransition({
                        path: deferPathName,
                        into: forkIntoStage,
                    })
                }
            },
            name: forkName,
            stageDefs: [{
                name: forkIntoStage.stage,
                logic: forkIntoStageDef.logic
            }],
            listeners: [{
                metadata: `::${deferEventName}->[DEFERRED]`,
                value: {
                    [deferEventName]: (actions: any) => defer(actions)
                }
            }],
            interceptors: [],
            syncDefs: undefined,
        }, parent);
    }

    private static doCreate<
        SM_LISTENER extends SmListener,
        JOIN_LISTENER extends SmListener,
        ACTIONS
    >(
        treeBuilderData: StateMachineTreeBuilderData<SM_LISTENER, JOIN_LISTENER>,
        parent?: ParentStateMachineInfo<any, any>
    ): StateMachine<SM_LISTENER, JOIN_LISTENER, ACTIONS> {
        let stageDefsByKey: IKeyValuePairs<StageDef<string, any, any, any>> = Objects.keyfy(treeBuilderData.stageDefs, (it) => it.name);
        let systemStages: IKeyValuePairs<StageDef<string, any, any, any>> = Objects.keyfy(treeBuilderData.stageDefs, (it) => it.name);
        let systemListeners: SmListenerDefList<SM_LISTENER> = [];
        let externalListeners: SmListenerDefList<SM_LISTENER> = treeBuilderData.listeners;

        systemStages = {
            init: {
                name: 'init',
                logic: undefined
            },
            start: {
                name: 'start',
                logic: undefined
            },
            stop: {
                name: 'stop',
                logic: undefined
            }
        };

        systemListeners.push(
            new SmListenerDefLikeParser().parse([
                '::init=>doStart', {
                    onInit: ()=>{
                        stateMachine.requestTransition({
                            path: `doStart`,
                            into: {
                                stage: 'start'
                            }
                        })
                    }
                } as any as SM_LISTENER
            ])
        );

        systemListeners.push(
            new SmListenerDefLikeParser().parse(['::stop->shutdown', {
                onStop: () => {
                    stateMachine.shutdown();
                }
            } as any as SM_LISTENER])
        );

        let stageStringDefs: string [] = [];
        Object.keys(stageDefsByKey).forEach(key => {
            let stageDef = stageDefsByKey[key];
            let description = `${stageDef.name}`;
            if (stageDef.deferredInfo) {
                description += `[DEFERRED]`;
            }
            stageStringDefs.push(description)
        });

        StateMachineLogger.log(treeBuilderData.name, StateMachineStatus.IDLE, '', '', EventType.INIT, undefined, '', [
            [`init listeners`, `(${treeBuilderData.initialListener.metadata})`],
            [`listeners`, `${externalListeners.map(it=>it.metadata).map(it => {
                return it.split(',').map(it=>`(${it})`).join(',');
            })}`],
            [`system listeners`, `${systemListeners.map(it=>it.metadata).map(it => {
                return it.split(',').map(it=>`(${it})`).join(',');
            })}`],
            [`interceptors`, `${treeBuilderData.interceptors.map(it => it.metadata)}`],
            [`stages`, `${stageStringDefs.join(', ')}`],
            [`system stages`, 'init, start, stop'],
        ]);

        let stateMachine: StateMachine<SM_LISTENER, JOIN_LISTENER, ACTIONS> = new StateMachine({
            ...treeBuilderData,
            listeners: [...treeBuilderData.listeners, ...systemListeners, treeBuilderData.initialListener],
            stageDefsByKey: {...stageDefsByKey, ...systemStages},
            parent,
        });



        stateMachine.requestStage ({
            description: '::init',
            eventType: EventType.INIT,
            stage: {
                stage: 'init'
            },
            type: ToProcessType.STAGE
        });


        return stateMachine;

    }

}
