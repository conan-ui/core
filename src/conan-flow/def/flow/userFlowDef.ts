import {UserFlowStatusesDef} from "../status/userStatusDef";
import {ReactionCb} from "../reactionDef";
import {Mutators, VoidMutators} from "../../domain/mutators";
import {StatusLike} from "../../domain/status";
import {FlowActionsDef} from "../../domain/actions";
import {AsapLike} from "../../../conan-utils/asap";
import {IConsumer} from "../../..";
import {FlowEvent, FlowEventNature} from "../../domain/flowRuntimeEvents";
import {Rule} from "../../../conan-utils/rules/_rules";

export interface UserFlowDef<
    STATUSES,
    MUTATORS extends Mutators<STATUSES> = VoidMutators<STATUSES>,
    ACTIONS = void
> {
    name: string,
    statuses: UserFlowStatusesDef<STATUSES, MUTATORS>;
    initialStatus?: AsapLike<StatusLike<STATUSES>>;
    actions?: FlowActionsDef<STATUSES, MUTATORS, ACTIONS>;
    $onInit?: ReactionCb<STATUSES, any> [];
    $onStop?: ReactionCb<STATUSES, any> [];
    pipelineListener?: IConsumer<FlowEvent>;
    loggingRule?: Rule<FlowEvent>;
    nature?: FlowEventNature
}
