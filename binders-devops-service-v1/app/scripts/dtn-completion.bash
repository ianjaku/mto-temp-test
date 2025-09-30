#/usr/bin/env bash

function listIt () {
    COMPREPLY=()
    COMPREPLY=($(node printit.mjs ${COMP_WORDS[COMP_CWORD]}))
}


function completeIt() {
    local file
    local matches
    local FIND_DIR
    local FIND_DIR_SUFFIX
    COMPREPLY=()

    DEVOPS_ROOT="binders-devops-service-v1/app"
    if [ "$2x" = "x" ] ; then
        FIND_DIR=$DEVOPS_ROOT
    else
        FIND_DIR_SUFFIX="/$(dirname $2)"
        if [ "$FIND_DIR_SUFFIX" = "/." ] ; then
            if [ -d $DEVOPS_ROOT/$2 ] ; then
                FIND_DIR_SUFFIX="/$2"
            else
                FIND_DIR_SUFFIX=""
            fi
        fi
        FIND_DIR=$DEVOPS_ROOT$FIND_DIR_SUFFIX
    fi
    matches=$(find $FIND_DIR -maxdepth 1 -wholename "$DEVOPS_ROOT/$2*")
    matchCount=$(find $FIND_DIR -maxdepth 1 -wholename "$DEVOPS_ROOT/$2*" | wc -l)

    if [ $matchCount -eq 1 ] && [ -d ${matches[0]} ]
    then
        FIND_DIR=${matches[0]}
        matches=$(find $FIND_DIR -maxdepth 1 -wholename "$DEVOPS_ROOT/$2*")
        matchCount=$(find $FIND_DIR -maxdepth 1 -wholename "$DEVOPS_ROOT/$2*" | wc -l)
    fi

    for file in $matches ; do
        local trimmed
        trimmed=$(echo $file | cut -d'/' -f 3-30)
        if [ "$trimmed" != "" ] ; then
            COMPREPLY+=("$trimmed")
        fi

    done

    # for rep in $result ; do
    #     COMPREPLY+=("$rep")
    # done

    # for file in "$2"*; do
    #     # If the glob doesn't match, we'll get the glob itself, so make sure
    #     # we have an existing file
    #     [[ -e $file ]] || continue

    #     # If it's a directory, add a trailing /
    #     [[ -d $file ]] && file+=/
    #
    # done
}

complete -F completeIt dtn

# complete -F listIt ls dtn
# complete -F listIt dtn
# complete -G "binders-devops-service-v1/app/$2*" dtn
