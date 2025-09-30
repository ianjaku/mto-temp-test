import {
    IGetSubscriptionResponse,
    IResolvePurchaseIdTokenResponse
} from "./apiresponses/IResolvePurchaseIdTokenResponse";
import { HTTPVerb } from "@binders/client/lib/clients/routes";
import { IMSOPeration } from "./apiresponses/IMSOperation";
import { IMSTransactableOffersApi } from "./IMSTransactableOffersApi";
import { MSOperationNotFound } from "./errors/MSOperationNotFound";
import { MSTransactableFailedAccessToken } from "./errors/MSTransactableFailedAccessToken";
import { MSTransactableInvalidToken } from "./errors/MSTransactableInvalidToken";
import { MSTransactableOffersConfig } from "./MSTransactableOffersConfig";
import fetch from "node-fetch";
import { parseBodyInFetchResponse } from "../apiclient/helpers";

interface IRequestMarketplaceParams {
    urlPath: string;
    headers?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
    method: "get" | "post";
}

export class MSTransactableOffersApi implements IMSTransactableOffersApi {

    private currentAccessToken: string;
    private currentAccessTokenExpiresAt: Date;
    
    constructor(
        private config: MSTransactableOffersConfig
    ) {}

    public async getSubscription(
        subscriptionId: string
    ): Promise<IGetSubscriptionResponse> {
        try {
            const response = await this.requestFromMarketplaceApi({
                urlPath: `/api/saas/subscriptions/${subscriptionId}`,
                method: "get"
            });
            return await parseBodyInFetchResponse<IGetSubscriptionResponse>(response);
        } catch (e) {
            throw new Error(
                `Failed to fetch subscription with id ${subscriptionId}. Message: ${e.message}`
            );
        }
    }

    public async activateSubscription(
        subscriptionId: string,
        planId: string,
        quantity: number
    ): Promise<void> {
        try {
            await this.requestFromMarketplaceApi({
                urlPath: `/api/saas/subscriptions/${subscriptionId}/activate`,
                method: "post",
                body: { planId, quantity }
            });
        } catch (e) {
            throw new Error(`Failed to activate Microsoft subscription with id ${subscriptionId}`);
        }
    }

    public async getOperationById(
        operationId: string,
        subscriptionId: string
    ): Promise<IMSOPeration> {
        try {
            const response = await this.requestFromMarketplaceApi({
                urlPath: `/api/saas/subscriptions/${subscriptionId}/operations/${operationId}`,
                method: "get"
            });
            return await parseBodyInFetchResponse<IMSOPeration>(response);
        } catch (e) {
            if (e.statusCode === 404) {
                throw new MSOperationNotFound(operationId, subscriptionId);
            }
            throw new Error(`Get operation by id "${operationId}" failed for unknown reasons, status: ${e.statusCode}`);
        }
    }

    public async resolvePurchaseIdToken(
        purchaseIdToken: string
    ): Promise<IResolvePurchaseIdTokenResponse> {
        try {
            const response = await this.requestFromMarketplaceApi({
                urlPath: "/api/saas/subscriptions/resolve",
                method: "post",
                headers: {
                    "x-ms-marketplace-token": purchaseIdToken
                }
            });
            return await parseBodyInFetchResponse<IResolvePurchaseIdTokenResponse>(response);
        } catch (e) {
            if (e.statusCode === 400) {
                const error = JSON.parse(e.error);
                if (error?.target === "token") {
                    throw new MSTransactableInvalidToken();
                }
            }
            throw new Error(
                `Resolve purchase id token "${purchaseIdToken}" failed with status code: ${e.statusCode}. Error: ${e.error}`
            );
        }
    }

    private async requestFromMarketplaceApi(
        {
            urlPath,
            method = "post",
            body = undefined,
            headers = {}
        }: IRequestMarketplaceParams
    ) {
        const baseUrl = this.joinUrl(this.config.marketPlaceApiBaseUrl, urlPath);
        const params = new URLSearchParams({ "api-version": this.config.marketPlaceApiVersion }).toString();
        const uri = baseUrl + (baseUrl.includes("?") ? "&" : "?") + params;
        return await fetch(
            uri,
            {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + await this.getAccessToken(),
                    ...headers
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
    }

    private async getAccessToken(): Promise<string> {
        if (this.isCurrentAccessTokenValid()) {
            return this.currentAccessToken;
        }

        const uri = this.joinUrl(this.config.authApiBaseUrl, this.config.tenantId, "/oauth2/token");
        const response = await fetch(
            uri,
            {
                method: HTTPVerb.POST,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    "grant_type": "client_credentials",
                    "client_id": this.config.appId,
                    "client_secret": this.config.appSecret,
                    "resource": this.config.marketPlaceResourceId
                })
            });

        if (!response.ok) {
            throw new MSTransactableFailedAccessToken();
        }
        const body = await parseBodyInFetchResponse<{ access_token: string, expires_on: number }>(response);
        this.setAccessToken(
            body.access_token,
            body.expires_on
        );
        return this.currentAccessToken;
    }

    private isCurrentAccessTokenValid(): boolean {
        if (this.currentAccessTokenExpiresAt == null || this.currentAccessToken == null) return false;
        return this.currentAccessTokenExpiresAt.getTime() > (new Date()).getTime();
    }

    private setAccessToken(token: string, expiresAtSeconds: number) {
        this.currentAccessToken = token;
        // We subtract 2 minutes to ensure a smooth transition from 1 token to the next
        this.currentAccessTokenExpiresAt = new Date(expiresAtSeconds * 1000 - 180);
    }

    private joinUrl(baseUrl: string, ...relativeUrls: string[]) {
        return relativeUrls.reduce((url, relativeUrl) => {
            if (!relativeUrl) return url;
            return url.replace(/\/+$/, "") + "/" + relativeUrl.replace(/^\/+/, "")
        }, baseUrl);
    }
}