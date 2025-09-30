import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { ReactNode, useState } from "react";
import { Button } from "./button"
import FontAwesome from "react-fontawesome";
import { Search } from "./search";

export function Combobox({
    id,
    options,
    placeholder,
    selectedValue,
    onChange,
    filter,
    onChangeFilter,
}: {
    id?: string;
    options: { icon?: string; value: string; label: ReactNode }[];
    placeholder?: string;
    selectedValue?: string;
    onChange: (val: string) => void;
    filter?: string;
    onChangeFilter?: (filter: string) => void;
}) {
    const [open, setOpen] = useState(false)

    const selectItem = (value: string) => {
        onChange(value);
        setOpen(false);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="bg-white border-border w-[200px] justify-between"
                >
                    {selectedValue ?
                        options.find(option => option.value === selectedValue)?.label ?? <span /> :
                        <span className="text-muted-foreground">{placeholder}</span>}
                    <FontAwesome name="chevron-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 flex flex-col">
                <Search id={id} value={filter} setValue={onChangeFilter} />
                {options.map(option => (
                    <Button
                        key={option.value}
                        className="justify-start"
                        variant="ghost"
                        onClick={() => selectItem(option.value)}
                    >
                        {option.icon ? <FontAwesome name={option.icon} /> : null}
                        {option.label}
                    </Button>
                ))}
            </PopoverContent>
        </Popover>
    )
}
