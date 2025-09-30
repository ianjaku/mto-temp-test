#!/bin/bash

create_login_item() {
    local username=$1
    local vault=$2
    local title=$3
    local url=$4
    op item create --category=login --title="$title" --vault="$vault" \
        --url $url \
        --generate-password=20,letters,digits \
        username="$username"
}

extract_active_users() {
    local group_name=$1
    declare -gA USER_DETAILS

    while IFS= read -r line; do
        # Extract user ID and name
        local user_id=$(echo "$line" | awk '{print $1}')
        local user_name=$(echo "$line" | awk '{print $2}')

        # Store in the associative array
        USER_DETAILS["$user_id"]="$user_name"
    done < <(op group user list "$group_name" | grep "ACTIVE")
}

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 [staging|production]"
    exit 1
fi

ENVIRONMENT=$1

# Validate the environment
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'."
    exit 1
fi
GROUP_NAME="developers"
extract_active_users "$GROUP_NAME"

for USER_ID in "${!USER_DETAILS[@]}"; do
    USER_NAME=${USER_DETAILS[$USER_ID]}
    echo "Processing user $USER_NAME in $ENVIRONMENT environment"
    VAULT_NAME="monitoring-$ENVIRONMENT-accounts-$USER_NAME"

    # Check if vault already exists
    if op vault get "$VAULT_NAME" > /dev/null 2>&1; then
        echo "Vault $VAULT_NAME already exists. Skipping creation and item addition."
        create_login_item "$USER_NAME" "$VAULT_NAME" "kibana-binders" "https://kibana-develop.staging.binders.media"
    else
        echo "Creating new vault: $VAULT_NAME"
        op vault create "$VAULT_NAME"
        op vault user grant --vault "$VAULT_NAME" --user "$USER_ID" --permissions allow_viewing,allow_editing

        # Create login items based on environment
        if [ "$ENVIRONMENT" == "production" ]; then
            echo "Production"
            create_login_item "$USER_NAME" "$VAULT_NAME" "grafana" "https://grafana.binders.media"
            create_login_item "$USER_NAME" "$VAULT_NAME" "kibana" "https://kibana.binders.media"
            create_login_item "$USER_NAME" "$VAULT_NAME" "kibana-binders" "https://kibana-binders.binders.media"

        else
            create_login_item "$USER_NAME" "$VAULT_NAME" "kibana" "https://kibana.staging.binders.media"
            create_login_item "$USER_NAME" "$VAULT_NAME" "kibana-binders" "https://kibana-develop.staging.binders.media"
        fi
    fi
done



