import {ListenerType, SmListener, SmListenerDef, SmListenerDefLike} from "./stateMachineListeners";
import {SerializedSmEvent, SmTransition} from "./stateMachineEvents";
import {StageDef} from "./stage";

export interface SmEventsPublisher<
    SM_ON_LISTENER extends SmListener,
    SM_INTERCEPTOR extends SmListener,
> {
    addListener(listener: SmListenerDefLike<SM_ON_LISTENER>, type?: ListenerType): this;

    addInterceptor (interceptor: SmListenerDefLike<SM_INTERCEPTOR>): this;
}


export interface StateMachineController<
    SM_ON_LISTENER extends SmListener,
    SM_INTERCEPTOR extends SmListener,
> extends SmEventsPublisher<SM_ON_LISTENER, SM_INTERCEPTOR> {

    getEvents(): SerializedSmEvent [];

    getStageDef(name: string): StageDef<any, any, any>;

    getStateData(): any;

}


