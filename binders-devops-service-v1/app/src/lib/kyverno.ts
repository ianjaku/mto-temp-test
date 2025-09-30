/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    addHelmRepo,
    checkIfHelmRepositoryExists,
    runHelmInstall,
    updateHelmRepoCache
} from "../actions/helm/install";
import { checkIfNamespaceExist } from "../actions/k8s/namespaces";
import { log } from "./logging";


const CHART_NAME = "kyverno/kyverno"
const DEFAULT_NAMESPACE = "kyverno"
const RELEASE_NAME = "kyverno"
const REPOSITORY_NAME = "kyverno"
const REPOSITORY_URL = "https://kyverno.github.io/kyverno/"

interface Matcher {
    kinds: string[]
    names?: string[]
    namespaces?: string[]
    selector?: unknown
}

export type Operator = "Equals" | "NotEquals" | "AnyIn" | "AllIn" | "GreaterThan" | "LessThan"

export interface Conditions {
    key: string
    operator: Operator
    value: string
}

interface Validation {
    message: string
    anyOrAllStatement: AnyOrAllStatement,
    deny?: {
        conditions: Conditions[]
    }
}

type AnyOrAllStatement = "any" | "all"
interface Rule {
    name: string
    matchers: Matcher[]
    anyOrAllStatement: AnyOrAllStatement,
    validation: Validation
}

type ValidationFailureAction = "Enforce" | "Audit"

export interface Policy {
    name: string;
    rules: Rule[]
    validationFailureAction: ValidationFailureAction
}

function createMatcher(matcher: Matcher) {
    const { kinds, names, namespaces, selector } = matcher
    return {
        resources: {
            kinds,
            ...(names && { names }),
            ...(namespaces && { namespaces }),
            ...(selector && { selector })
        }
    }
}

function createValidation(validation: Validation) {
    const { anyOrAllStatement, deny, message } = validation
    return {
        message,
        ...(deny && {
            deny: {
                conditions: {
                    [anyOrAllStatement === "all" ? "all" : "any"]: [...deny.conditions]
                }
            }
        })

    }
}

function createRules(rules: Rule[]) {
    return rules.map((rule: Rule) => {
        const { name } = rule
        const matchers = rule.matchers.map(createMatcher)
        const validate = createValidation(rule.validation)
        return {
            name,
            match: {
                [rule.anyOrAllStatement === "all" ? "all" : "any"]: [...matchers]
            },
            validate
        }
    })
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createPolicy(policy: Policy): unknown {
    const { name, validationFailureAction } = policy
    const rules = createRules(policy.rules)
    return {
        apiVersion: "kyverno.io/v1",
        kind: "ClusterPolicy",
        metadata: {
            name
        },
        spec: {
            rules,
            validationFailureAction
        }
    }
}

async function installKyverno(namespace: string = DEFAULT_NAMESPACE): Promise<void> {
    const kyvernoRepoExists = await checkIfHelmRepositoryExists(REPOSITORY_NAME)
    if (!kyvernoRepoExists) {
        log(`Adding ${RELEASE_NAME} repository...`)
        try {
            await addHelmRepo(REPOSITORY_NAME, REPOSITORY_URL)
        } catch (error) {
            log(`Error during adding ${RELEASE_NAME} repo ${error}`, error)
            throw error
        }
        log(`Repository ${RELEASE_NAME} successfully added.`)
    }
    await updateHelmRepoCache()
    const allowCreatingNamespace = true
    await runHelmInstall(CHART_NAME, RELEASE_NAME, ".", undefined, namespace, { installCRDs: true }, undefined, allowCreatingNamespace)
}

export async function maybeInstallKyverno(): Promise<void> {
    try {
        log("Checking if kyverno exists")
        await checkIfNamespaceExist(DEFAULT_NAMESPACE)
    } catch (err) {
        if (err.output.indexOf(`namespaces ${DEFAULT_NAMESPACE} not found`)) {
            log("Installing kyverno")
            await installKyverno()
        }
    }

}