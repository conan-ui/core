import {AppCredentials} from "../../main/domain/domain";
import {Authenticator} from "../../main/sm/authentication/authentication.sm";

export abstract class Authenticators {
    static alwaysAuthenticatesSuccessfullyWith (appCredentials: AppCredentials): Authenticator {
        return (authenticatingActions) =>  {
            setTimeout(()=>authenticatingActions.doSuccess(appCredentials), 500);
        };
    }
}
