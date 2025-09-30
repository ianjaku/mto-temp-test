export const MANAGED_PREMIUM_RETAIN = "managed-premium-zrs-retain"
export const MANAGED_PREMIUM_DELETE = "managed-premium-zrs-delete"

export const getStorageClass = (isProduction: boolean): string => isProduction ? MANAGED_PREMIUM_RETAIN : MANAGED_PREMIUM_DELETE
