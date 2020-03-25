import {SmListener, SmListenerDefList} from "./stateMachineListeners";
import {IKeyValuePairs} from "../../conan-utils/typesHelper";
import {StateDef} from "./state";

export interface StateMachineCoreDef<
    SM_ON_LISTENER extends SmListener,
>  {
    name: string,
    interceptors: SmListenerDefList<SM_ON_LISTENER>
    listeners: SmListenerDefList<SM_ON_LISTENER>
    stageDefsByKey: IKeyValuePairs<StateDef<any, any, any, any>>,
}