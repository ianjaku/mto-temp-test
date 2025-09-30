#!/bin/bash
set -e

GIT_SRC_REPO="git@bitbucket.org:bindersmedia/binders-service.git"
GIT_DST_REPO="git@bitbucket.org:bindersmedia/m3.git"

function check_env_vars {
    if ! [ -d "$GIT_ACTIVE_FOLDER" ]; then
        echo "GIT_ACTIVE_FOLDER $GIT_ACTIVE_FOLDER is not a valid folder"
        exit 1
    fi

    if ! [ -d "$GIT_TARGET_FOLDER" ]; then
        echo "GIT_TARGET_FOLDER $GIT_TARGET_FOLDER is not a valid folder"
        exit 1
    fi
}

function clone_repo {
    if ! [ -z "$( ls -A "$GIT_TARGET_FOLDER" )" ]; then
        echo "GIT_TARGET_FOLDER $GIT_TARGET_FOLDER is not empty"
        exit 1
    fi
    echo "Cloning repository from $GIT_SRC_REPO to $GIT_TARGET_FOLDER"
    time git clone $GIT_SRC_REPO $GIT_TARGET_FOLDER
    echo "Repository cloned successfully"
}

function build_files_list {
    yarn workspace @binders/devops-v1 tsx src/scripts/git/maintenance/pruneHistory.ts
}

function run_filter_repo {
    cd $GIT_TARGET_FOLDER
    echo > .git/logs/HEAD
    python3 ${GIT_ACTIVE_FOLDER}/binders-devops-service-v1/app/src/scripts/git/maintenance/git-filter-repo --paths-from-file /tmp/gitFilesToKeep.txt
    cd -
}

function push_back {
    echo "Pushing to new repository"
    git --git-dir="$GIT_TARGET_FOLDER/.git" push --all --prune --force
    echo "Pushed successfully"
}

function add_origin {
    echo "Adding new origin"
    git --git-dir="$GIT_TARGET_FOLDER/.git" remote add origin $GIT_DST_REPO
}

function clean_old_branches {
    echo "Cleaning old refs"
    yarn workspace @binders/devops-v1 tsx src/scripts/git/maintenance/cleanOldBranches.ts
    git --git-dir="$GIT_TARGET_FOLDER/.git" reflog expire --expire=now --all
    git --git-dir="$GIT_TARGET_FOLDER/.git" gc --prune=now
}

check_env_vars
clone_repo
build_files_list
run_filter_repo
clean_old_branches
#add_origin
#push_back
