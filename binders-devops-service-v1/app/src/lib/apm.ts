

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getApmHelmValues = (elasticEndpoint) => {
    return {
        kind: "Deployment",
        replicaCount: 1,
        service: {
            enabled: true
        },
        config: {
            output: {
                file: {
                    enabled: false,
                },
                elasticsearch: {
                    hosts: elasticEndpoint
                }
            }
        }
    }
}

