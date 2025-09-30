export const USER_IDENTIFIER_PREFIX = "uid-";
/**
 * We don't enforce a dash <code>-</code> in the group id prefix because of a bug
 * in the past that allowed creating group ids without it.
 */
export const USER_GROUP_IDENTIFIER_PREFIX = "gid";
export const OLD_DEVICE_TARGET_USER_DOMAIN = "device.user";
export const DEVICE_TARGET_USER_DOMAIN = "device.manual.to";

export const EMAIL_DOMAINS_TO_HIDE_IN_TABLE = [
    OLD_DEVICE_TARGET_USER_DOMAIN,
    DEVICE_TARGET_USER_DOMAIN
];
