import * as React from "react";
import FontAwesome from "react-fontawesome";
import { Input } from "./input";

export const Search = ({ id, value, setValue }: { id: string; value: string; setValue: (val: string) => void }) => (
    <div className="relative">
        <label
            htmlFor={id}
            className="absolute top-1/2 -translate-y-1/2 left-2 text-gray-500"
        ><FontAwesome name="search" /></label>
        <Input
            id={id}
            className="bg-white ps-8"
            value={value}
            onChange={e => setValue(e.currentTarget.value)}
            placeholder="Search"
        />
    </div>
)

