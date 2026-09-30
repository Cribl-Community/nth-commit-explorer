#!/usr/bin/env bash
#
# Fetch a Cribl.Cloud OAuth token via client credentials, then query
# GET /products/{product}/workers for the given Cribl product.
#
# Usage:
#   CRIBL_WORKSPACE=myworkspace CRIBL_ORG_ID=myorg \
#     ./cribl-list-workers.sh <client-id> <client-secret> [product]
#
# Required env vars:
#   CRIBL_WORKSPACE  - Cribl.Cloud workspace name
#   CRIBL_ORG_ID     - Cribl.Cloud organization ID
#
# [product] defaults to "stream". Valid values: stream, edge, outpost.
#
# Requires: curl, jq

set -euo pipefail

CLIENT_ID="${1:?Usage: $0 <client-id> <client-secret> [product]}"
CLIENT_SECRET="${2:?Usage: $0 <client-id> <client-secret> [product]}"
PRODUCT="${3:-stream}"

: "${CRIBL_WORKSPACE:?CRIBL_WORKSPACE env var is required}"
: "${CRIBL_ORG_ID:?CRIBL_ORG_ID env var is required}"

BASE_URL="https://${CRIBL_WORKSPACE}-${CRIBL_ORG_ID}.cribl.cloud/api/v1"

TOKEN_RESPONSE=$(curl --silent --fail --request POST \
  --url "https://login.cribl.cloud/oauth/token" \
  --header "Content-Type: application/json" \
  --data "{
    \"grant_type\": \"client_credentials\",
    \"client_id\": \"${CLIENT_ID}\",
    \"client_secret\": \"${CLIENT_SECRET}\",
    \"audience\": \"https://api.cribl.cloud\"
  }")

ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.access_token')

if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
  echo "Failed to obtain access token. Response was:" >&2
  echo "${TOKEN_RESPONSE}" >&2
  exit 1
fi

curl  --request GET \
  --url "${BASE_URL}/products/${PRODUCT}/workers" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  | jq .
