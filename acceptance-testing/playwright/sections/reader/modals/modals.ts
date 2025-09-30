import { DeviceUserSwitcher } from "./deviceuserswitcher/deviceuserswitcher";
import { TestSection } from "../../testsection";

export class ReaderModals extends TestSection {

    get deviceUserSwitcher(): DeviceUserSwitcher {
        return new DeviceUserSwitcher(this.context);
    }
    
}
