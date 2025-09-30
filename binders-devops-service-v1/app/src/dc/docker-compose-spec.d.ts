/**
 * This file was automatically generated on 2025-04-07T08:56:43.646Z
 * from https://raw.githubusercontent.com/compose-spec/compose-spec/refs/heads/main/schema/compose-spec.json
 * DO NOT MODIFY IT BY HAND.
 * To re-generate the types, run
 * yarn workspace @binders/devops-v1 dc:types
 */

export type Include =
    | string
    | {
          path?: StringOrList;
          env_file?: StringOrList;
          project_directory?: string;
      };
export type StringOrList = string | ListOfStrings;
export type ListOfStrings = string[];
export type Development = {
    watch?: {
        ignore?: StringOrList;
        include?: StringOrList;
        path: string;
        action: "rebuild" | "sync" | "restart" | "sync+restart" | "sync+exec";
        target?: string;
        exec?: ServiceHook;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    }[];
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} & Development1;
export type Command = null | string | string[];
export type ListOrDict =
    | {
          /**
           * This interface was referenced by `undefined`'s JSON-Schema definition
           * via the `patternProperty` ".+".
           */
          [k: string]: string | number | boolean | null;
      }
    | string[];
export type Development1 = {
    watch?: {
        ignore?: StringOrList;
        include?: StringOrList;
        path: string;
        action: "rebuild" | "sync" | "restart" | "sync+restart" | "sync+exec";
        target?: string;
        exec?: ServiceHook;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    }[];
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} | null;
export type Deployment = {
    mode?: string;
    endpoint_mode?: string;
    replicas?: number | string;
    labels?: ListOrDict;
    rollback_config?: {
        parallelism?: number | string;
        delay?: string;
        failure_action?: string;
        monitor?: string;
        max_failure_ratio?: number | string;
        order?: "start-first" | "stop-first";
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    update_config?: {
        parallelism?: number | string;
        delay?: string;
        failure_action?: string;
        monitor?: string;
        max_failure_ratio?: number | string;
        order?: "start-first" | "stop-first";
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    resources?: {
        limits?: {
            cpus?: number | string;
            memory?: string;
            pids?: number | string;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        };
        reservations?: {
            cpus?: number | string;
            memory?: string;
            generic_resources?: GenericResources;
            devices?: Devices;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        };
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    restart_policy?: {
        condition?: string;
        delay?: string;
        max_attempts?: number | string;
        window?: string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    placement?: {
        constraints?: string[];
        preferences?: {
            spread?: string;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        }[];
        max_replicas_per_node?: number | string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} & Deployment1;
export type GenericResources = {
    discrete_resource_spec?: {
        kind?: string;
        value?: number | string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}[];
export type Devices = {
    capabilities: ListOfStrings;
    count?: string | number;
    device_ids?: ListOfStrings;
    driver?: string;
    options?: ListOrDict;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}[];
export type Deployment1 = {
    mode?: string;
    endpoint_mode?: string;
    replicas?: number | string;
    labels?: ListOrDict;
    rollback_config?: {
        parallelism?: number | string;
        delay?: string;
        failure_action?: string;
        monitor?: string;
        max_failure_ratio?: number | string;
        order?: "start-first" | "stop-first";
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    update_config?: {
        parallelism?: number | string;
        delay?: string;
        failure_action?: string;
        monitor?: string;
        max_failure_ratio?: number | string;
        order?: "start-first" | "stop-first";
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    resources?: {
        limits?: {
            cpus?: number | string;
            memory?: string;
            pids?: number | string;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        };
        reservations?: {
            cpus?: number | string;
            memory?: string;
            generic_resources?: GenericResources;
            devices?: Devices;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        };
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    restart_policy?: {
        condition?: string;
        delay?: string;
        max_attempts?: number | string;
        window?: string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    placement?: {
        constraints?: string[];
        preferences?: {
            spread?: string;
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        }[];
        max_replicas_per_node?: number | string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} | null;
export type ExtraHosts =
    | {
          /**
           * This interface was referenced by `undefined`'s JSON-Schema definition
           * via the `patternProperty` ".+".
           */
          [k: string]: string | string[];
      }
    | string[];
export type ServiceConfigOrSecret = (
    | string
    | {
          source?: string;
          target?: string;
          uid?: string;
          gid?: string;
          mode?: number | string;
          /**
           * This interface was referenced by `undefined`'s JSON-Schema definition
           * via the `patternProperty` "^x-".
           */
          [k: string]: unknown;
      }
)[];
export type EnvFile =
    | string
    | (
          | string
          | {
                path: string;
                format?: string;
                required?: boolean | string;
            }
      )[];
export type LabelFile = string | string[];
export type Gpus =
    | "all"
    | {
          capabilities?: ListOfStrings;
          count?: string | number;
          device_ids?: ListOfStrings;
          driver?: string;
          options?: ListOrDict;
          [k: string]: unknown;
      }[];
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
 */
export type Network = {
    name?: string;
    driver?: string;
    driver_opts?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.+$".
         */
        [k: string]: string | number;
    };
    ipam?: {
        driver?: string;
        config?: {
            subnet?: string;
            ip_range?: string;
            gateway?: string;
            aux_addresses?: {
                /**
                 * This interface was referenced by `undefined`'s JSON-Schema definition
                 * via the `patternProperty` "^.+$".
                 */
                [k: string]: string;
            };
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        }[];
        options?: {
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^.+$".
             */
            [k: string]: string;
        };
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    external?:
        | boolean
        | string
        | {
              /**
               * @deprecated
               */
              name?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
    internal?: boolean | string;
    enable_ipv4?: boolean | string;
    enable_ipv6?: boolean | string;
    attachable?: boolean | string;
    labels?: ListOrDict;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} & Network1;
export type Network1 = {
    name?: string;
    driver?: string;
    driver_opts?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.+$".
         */
        [k: string]: string | number;
    };
    ipam?: {
        driver?: string;
        config?: {
            subnet?: string;
            ip_range?: string;
            gateway?: string;
            aux_addresses?: {
                /**
                 * This interface was referenced by `undefined`'s JSON-Schema definition
                 * via the `patternProperty` "^.+$".
                 */
                [k: string]: string;
            };
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^x-".
             */
            [k: string]: unknown;
        }[];
        options?: {
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^.+$".
             */
            [k: string]: string;
        };
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    external?:
        | boolean
        | string
        | {
              /**
               * @deprecated
               */
              name?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
    internal?: boolean | string;
    enable_ipv4?: boolean | string;
    enable_ipv6?: boolean | string;
    attachable?: boolean | string;
    labels?: ListOrDict;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} | null;
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
 */
export type Volume = {
    name?: string;
    driver?: string;
    driver_opts?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.+$".
         */
        [k: string]: string | number;
    };
    external?:
        | boolean
        | string
        | {
              /**
               * @deprecated
               */
              name?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
    labels?: ListOrDict;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} & Volume1;
export type Volume1 = {
    name?: string;
    driver?: string;
    driver_opts?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.+$".
         */
        [k: string]: string | number;
    };
    external?:
        | boolean
        | string
        | {
              /**
               * @deprecated
               */
              name?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
    labels?: ListOrDict;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
} | null;

/**
 * The Compose file is a YAML file defining a multi-containers based application.
 */
export interface ComposeSpecification {
    /**
     * declared for backward compatibility, ignored.
     */
    version?: string;
    /**
     * define the Compose project name, until user defines one explicitly.
     */
    name?: string;
    /**
     * compose sub-projects to be included.
     */
    include?: Include[];
    services?: {
        [k: string]: Service;
    };
    networks?: {
        [k: string]: Network;
    };
    volumes?: {
        [k: string]: Volume;
    };
    secrets?: {
        [k: string]: Secret;
    };
    configs?: {
        [k: string]: Config;
    };
    /**
     * This interface was referenced by `ComposeSpecification`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
 */
export interface Service {
    develop?: Development;
    deploy?: Deployment;
    annotations?: ListOrDict;
    attach?: boolean | string;
    build?:
        | string
        | {
              context?: string;
              dockerfile?: string;
              dockerfile_inline?: string;
              entitlements?: string[];
              args?: ListOrDict;
              ssh?: ListOrDict;
              labels?: ListOrDict;
              cache_from?: string[];
              cache_to?: string[];
              no_cache?: boolean | string;
              additional_contexts?: ListOrDict;
              network?: string;
              pull?: boolean | string;
              target?: string;
              shm_size?: number | string;
              extra_hosts?: ExtraHosts;
              isolation?: string;
              privileged?: boolean | string;
              secrets?: ServiceConfigOrSecret;
              tags?: string[];
              ulimits?: Ulimits;
              platforms?: string[];
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
    blkio_config?: {
        device_read_bps?: BlkioLimit[];
        device_read_iops?: BlkioLimit[];
        device_write_bps?: BlkioLimit[];
        device_write_iops?: BlkioLimit[];
        weight?: number | string;
        weight_device?: BlkioWeight[];
    };
    cap_add?: string[];
    cap_drop?: string[];
    cgroup?: "host" | "private";
    cgroup_parent?: string;
    command?: Command;
    configs?: ServiceConfigOrSecret;
    container_name?: string;
    cpu_count?: string | number;
    cpu_percent?: string | number;
    cpu_shares?: number | string;
    cpu_quota?: number | string;
    cpu_period?: number | string;
    cpu_rt_period?: number | string;
    cpu_rt_runtime?: number | string;
    cpus?: number | string;
    cpuset?: string;
    credential_spec?: {
        config?: string;
        file?: string;
        registry?: string;
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    depends_on?:
        | ListOfStrings
        | {
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
               */
              [k: string]: {
                  restart?: boolean | string;
                  required?: boolean;
                  condition: "service_started" | "service_healthy" | "service_completed_successfully";
                  /**
                   * This interface was referenced by `undefined`'s JSON-Schema definition
                   * via the `patternProperty` "^x-".
                   */
                  [k: string]: unknown;
              };
          };
    device_cgroup_rules?: ListOfStrings;
    devices?: (
        | string
        | {
              source: string;
              target?: string;
              permissions?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          }
    )[];
    dns?: StringOrList;
    dns_opt?: string[];
    dns_search?: StringOrList;
    domainname?: string;
    entrypoint?: Command;
    env_file?: EnvFile;
    label_file?: LabelFile;
    environment?: ListOrDict;
    expose?: (string | number)[];
    extends?:
        | string
        | {
              service: string;
              file?: string;
          };
    external_links?: string[];
    extra_hosts?: ExtraHosts;
    gpus?: Gpus;
    group_add?: (string | number)[];
    healthcheck?: Healthcheck;
    hostname?: string;
    image?: string;
    init?: boolean | string;
    ipc?: string;
    isolation?: string;
    labels?: ListOrDict;
    links?: string[];
    logging?: {
        driver?: string;
        options?: {
            /**
             * This interface was referenced by `undefined`'s JSON-Schema definition
             * via the `patternProperty` "^.+$".
             */
            [k: string]: string | number | null;
        };
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^x-".
         */
        [k: string]: unknown;
    };
    mac_address?: string;
    mem_limit?: number | string;
    mem_reservation?: string | number;
    mem_swappiness?: number | string;
    memswap_limit?: number | string;
    network_mode?: string;
    networks?:
        | ListOfStrings
        | {
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
               */
              [k: string]: {
                  aliases?: ListOfStrings;
                  ipv4_address?: string;
                  ipv6_address?: string;
                  link_local_ips?: ListOfStrings;
                  mac_address?: string;
                  driver_opts?: {
                      /**
                       * This interface was referenced by `undefined`'s JSON-Schema definition
                       * via the `patternProperty` "^.+$".
                       */
                      [k: string]: string | number;
                  };
                  priority?: number;
                  gw_priority?: number;
                  /**
                   * This interface was referenced by `undefined`'s JSON-Schema definition
                   * via the `patternProperty` "^x-".
                   */
                  [k: string]: unknown;
              } | null;
          };
    oom_kill_disable?: boolean | string;
    oom_score_adj?: string | number;
    pid?: string | null;
    pids_limit?: number | string;
    platform?: string;
    ports?: (
        | number
        | string
        | {
              name?: string;
              mode?: string;
              host_ip?: string;
              target?: number | string;
              published?: string | number;
              protocol?: string;
              app_protocol?: string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          }
    )[];
    post_start?: ServiceHook[];
    pre_stop?: ServiceHook[];
    privileged?: boolean | string;
    profiles?: ListOfStrings;
    pull_policy?: string;
    pull_refresh_after?: string;
    read_only?: boolean | string;
    restart?: string;
    runtime?: string;
    scale?: number | string;
    security_opt?: string[];
    shm_size?: number | string;
    secrets?: ServiceConfigOrSecret;
    sysctls?: ListOrDict;
    stdin_open?: boolean | string;
    stop_grace_period?: string;
    stop_signal?: string;
    storage_opt?: {
        [k: string]: unknown;
    };
    tmpfs?: StringOrList;
    tty?: boolean | string;
    ulimits?: Ulimits;
    user?: string;
    uts?: string;
    userns_mode?: string;
    volumes?: (
        | string
        | {
              type: string;
              source?: string;
              target?: string;
              read_only?: boolean | string;
              consistency?: string;
              bind?: {
                  propagation?: string;
                  create_host_path?: boolean | string;
                  recursive?: "enabled" | "disabled" | "writable" | "readonly";
                  selinux?: "z" | "Z";
                  /**
                   * This interface was referenced by `undefined`'s JSON-Schema definition
                   * via the `patternProperty` "^x-".
                   */
                  [k: string]: unknown;
              };
              volume?: {
                  nocopy?: boolean | string;
                  subpath?: string;
                  /**
                   * This interface was referenced by `undefined`'s JSON-Schema definition
                   * via the `patternProperty` "^x-".
                   */
                  [k: string]: unknown;
              };
              tmpfs?: {
                  size?: number | string;
                  mode?: number | string;
                  /**
                   * This interface was referenced by `undefined`'s JSON-Schema definition
                   * via the `patternProperty` "^x-".
                   */
                  [k: string]: unknown;
              };
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          }
    )[];
    volumes_from?: string[];
    working_dir?: string;
    /**
     * This interface was referenced by `Service`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
export interface ServiceHook {
    command: Command;
    user?: string;
    privileged?: boolean | string;
    working_dir?: string;
    environment?: ListOrDict;
    /**
     * This interface was referenced by `ServiceHook`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
export interface Ulimits {
    /**
     * This interface was referenced by `Ulimits`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z]+$".
     */
    [k: string]:
        | (number | string)
        | {
              hard: number | string;
              soft: number | string;
              /**
               * This interface was referenced by `undefined`'s JSON-Schema definition
               * via the `patternProperty` "^x-".
               */
              [k: string]: unknown;
          };
}
export interface BlkioLimit {
    path?: string;
    rate?: number | string;
}
export interface BlkioWeight {
    path?: string;
    weight?: number | string;
}
export interface Healthcheck {
    disable?: boolean | string;
    interval?: string;
    retries?: number | string;
    test?: string | string[];
    timeout?: string;
    start_period?: string;
    start_interval?: string;
    /**
     * This interface was referenced by `Healthcheck`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
 */
export interface Secret {
    name?: string;
    environment?: string;
    file?: string;
    external?:
        | boolean
        | string
        | {
              name?: string;
              [k: string]: unknown;
          };
    labels?: ListOrDict;
    driver?: string;
    driver_opts?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^.+$".
         */
        [k: string]: string | number;
    };
    template_driver?: string;
    /**
     * This interface was referenced by `Secret`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9._-]+$".
 */
export interface Config {
    name?: string;
    content?: string;
    environment?: string;
    file?: string;
    external?:
        | boolean
        | string
        | {
              /**
               * @deprecated
               */
              name?: string;
              [k: string]: unknown;
          };
    labels?: ListOrDict;
    template_driver?: string;
    /**
     * This interface was referenced by `Config`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
}
