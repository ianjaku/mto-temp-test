import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResolvedIcon } from "../../../../src/views/reader/CommentsSidebar/Comment/ResolvedIcon";

describe("ResolvedIcon Component", () => {
    it("should be rendered by default", async () => {
        const { container } = render(<ResolvedIcon />);
        const element = container.querySelector(".comment-resolved-icon");
        expect(element).toBeInTheDocument();
    });

    it("display tooltip on mouse over", async () => {
        const { container } = render(<ResolvedIcon />);
        const element = container.querySelector(".comment-resolved-icon");
        fireEvent.mouseOver(element);
        const tooltipText = await screen.findByText("Resolved by editor");
        expect(tooltipText).toBeVisible();
    });

    it("hide tooltip on mouse leave", async () => {
        const { container } = render(<ResolvedIcon />);
        const element = container.querySelector(".comment-resolved-icon");
        fireEvent.mouseOver(element);
        fireEvent.mouseLeave(element);
        const tooltipText = await screen.findByText("Resolved by editor");
        expect(tooltipText).not.toBeVisible();
    });

    it("display tooltip on mouse click", async () => {
        const { container } = render(<ResolvedIcon />);
        const element = container.querySelector(".comment-resolved-icon");
        fireEvent.click(element);
        const tooltipText = await screen.findByText("Resolved by editor");
        expect(tooltipText).toBeInTheDocument();
    });
});
