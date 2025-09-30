import * as React from "react";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { useDebouncedValue } from "@binders/client/lib/react/hooks/useDebouncedValue";
import { useGetMockedEmails } from "../../api/hooks"
import { useState } from "react";

export const MockedEmails = () => {
    const [email, setEmail] = useState("");
    const debouncedEmail = useDebouncedValue(email, 500);
    const emails = useGetMockedEmails(debouncedEmail);
    const loadingView = emails.isLoading ? <p>Loading ...</p> : null;
    const idleView = emails.isLoading && emails.fetchStatus === "idle" ? <p>Type valid email to search</p> : null;
    const emptyView = emails.data?.length === 0 ? <p>No results</p> : null;
    const errorView = emails.isError ? <p>{JSON.stringify(emails.error)}</p> : null;
    return (
        <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-row gap-4 items-center">
                <label htmlFor="email">Email:</label>
                <Input
                    id="email"
                    className="bg-white"
                    value={email}
                    placeholder="Enter email address"
                    onChange={e => setEmail(e.currentTarget.value)}
                />
            </div>
            {idleView ?? loadingView ?? errorView ?? emptyView ?? emails.data?.map(e => (
                <Card className="p-4 flex flex-col gap-4">
                    <div>
                        <p>Subject: <strong>{e.subject}</strong></p>
                        <p>To: <strong>{e.to}</strong></p>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: e.html }} />
                </Card>
            ))}
        </div>
    )
}
