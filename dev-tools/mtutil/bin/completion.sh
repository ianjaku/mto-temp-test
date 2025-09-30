#!/usr/bin/env bash

if [[ $SHELL == */bash ]]; then
    _mto_bash_completion() {
        mapfile -t COMPREPLY < <(
            mto tab --quiet --bash "${COMP_WORDS[@]}"
        )
    }
    complete -F _mto_bash_completion mto
elif [[ $SHELL == */zsh ]]; then
    _mto_zsh_completion() {
        local state
        local commands_output
        local -a commands
        commands_output=$(mto tab --quiet --zsh)
        commands=( ${(f)commands_output} )

        _arguments -C \
            '1: :->cmds' \
            '*::arg:->args'

        case $state in
            cmds)
                _describe -t commands 'mto command' commands
                return
                ;;
            args)
                completions_output=$(mto tab --quiet --zsh "${words[@]}")
                # Split string into array by newlines
                completions=( ${(f)completions_output} )

                if (( ${#completions[@]} > 0 )); then
                    _values 'context' "${completions[@]}"
                fi
                ;;
        esac
    }
    compdef _mto_zsh_completion mto
fi
