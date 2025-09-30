# Linting on pre-commit

Before every commit, husky will run the "lint" script on all changed workspaces and their dependencies.
If this script does not exist, it will be ignored.

When migrating to yarn 3+, the "yarn changed foreach -p run lint" command
should be replaced by "yarn workspaces foreach -p --since run lint".

The --since tag does exactly the same as the plugin https://github.com/Dcard/yarn-plugins/tree/master/packages/changed
But is not supported in yarn version 2.4.x


