import * as React from "react";
import * as hooks from "../../../../src/elements/userwidget/hooks";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserWidget } from "../../../../src/elements/userwidget";
import { render } from "@testing-library/react";

jest.mock("@binders/client/lib/util/impersonation", () => {});  // Override import side effects

describe("UserWidget component", () => {
    describe("when public user", () => {
        it("should display a button with sign in text has enough space", async () => {
            jest.spyOn(hooks, "useShouldDisplayName")
                .mockImplementation(() => true);

            const { container } = render(<UserWidget isPublic />);

            const element = container.querySelector(".loginButton");
            expect(element).toBeInTheDocument();
            expect(element).toHaveTextContent("Sign in");
        });

        it("should display a button without sign in text and it's not enough space", async () => {
            jest.spyOn(hooks, "useShouldDisplayName")
                .mockImplementation(() => false);

            const { container } = render(<UserWidget isPublic />);

            const element = container.querySelector(".loginButton");
            expect(element).toBeInTheDocument();
            expect(element).not.toHaveTextContent("Sign in");
        });
    })

    describe("when logged in", () => {
        it("should display the user name when it has enough space", async () => {
            jest.spyOn(hooks, "useShouldDisplayName")
                .mockImplementation(() => true);

            const { container } = render(<UserWidget user={{ displayName: "Some user" } as User} />);

            const element = container.querySelector(".userWidget-container");
            expect(element).toBeInTheDocument();
            expect(element).toHaveTextContent("Some user");
        });

        it("should not display the user name when it's not enough space", async () => {
            jest.spyOn(hooks, "useShouldDisplayName")
                .mockImplementation(() => false);

            const { container } = render(<UserWidget user={{ displayName: "Some user" } as User} />);

            const element = container.querySelector(".userWidget-container");
            expect(element).toBeInTheDocument();
            expect(element).not.toHaveTextContent("Some user");
        });
    });
});