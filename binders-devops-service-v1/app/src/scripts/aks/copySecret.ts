import { copySecret } from "../../actions/k8s/secrets";
import { main } from "../../lib/program";

main( async () => {
    // await copySecret("tls-staging-secret", "default", "pipeline-experiment");
    await copySecret("dev-users-basic-auth", "production", "monitoring");
});