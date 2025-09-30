#!/usr/bin/env bash

set -euo pipefail

BIN_DIR="$HOME/.local/bin"
MTO_EXE_INSTALL_PATH="$BIN_DIR/mto"
MTO_COMPLETION_INSTALL_PATH="$BIN_DIR/mto-completion.sh"
MTO_JS_INSTALL_PATH="$BIN_DIR/mto.js"
YARN_SCRIPT=(workspace @binders/mtutil cli)
MTUTIL_PATH=$PWD
if [ ! -f "$MTUTIL_PATH/bin/mto.sh" ] && [ -f "$MTUTIL_PATH/dev-tools/mtutil/bin/mto.sh" ]; then
	MTUTIL_PATH="$MTUTIL_PATH/dev-tools/mtutil"
fi
MTO_SH_BUILD_PATH="$MTUTIL_PATH/bin/mto.sh"
MTO_COMPLETION_BUILD_PATH="$MTUTIL_PATH/bin/completion.sh"
MTO_JS_BUILD_PATH="$MTUTIL_PATH/dist/cli.js"
MTO_SOURCE_CMD="source ~/.local/bin/mto-completion.sh"

_mto_main() {
	case "${1:-}" in
	--uninstall | uninstall)
		_mto_uninstall
		return 0
		;;
	--install | install)
		_mto_check_directory
		_mto_install
		return 0
		;;
	--update | update)
		_mto_check_directory
		_mto_uninstall
		_mto_install
		return 0
		;;
	esac

	if [ "$EUID" -eq 0 ]; then
		_die "Running as root. Aborting."
	fi

	if [ ! -d ./binders-service-common-v1 ] && ! grep -q "@binders/mtutil" package.json; then
		_die "This script can be run only in binders-service repository"
	fi

	if [ ! -e "$MTO_EXE_INSTALL_PATH" ] && [ ! -f "$MTO_JS_BUILD_PATH" ]; then
		_log "Building mto"
		yarn mto:build >&2
	fi

	if [ -e "$MTO_JS_INSTALL_PATH" ]; then
		[ ! -L "$MTO_JS_INSTALL_PATH" ] && _warn "$MTO_JS_INSTALL_PATH is not a symbolic link. This means it was not installed with yarn mto install. Try running\n\n  \$  mto update" >&2
		node "$MTO_JS_INSTALL_PATH" "${@}"
	else
		if [ -e "$MTO_EXE_INSTALL_PATH" ]; then
			_die "mto is installed, but mto.js was not found.\n Try running\n  \$  mto update"
		else
			_log "Falling back to yarn ${YARN_SCRIPT[*]}" >&2
			yarn "${YARN_SCRIPT[@]}" "${@}"
		fi
	fi

	if [ "$#" -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
		cat <<EOF

CLI Commands:
  install      Install the tool to ~/.local/bin
  update       Rebuild & reinstall the tool
  uninstall    Uninstall itself
EOF
	fi

	echo
	if [ -e "$MTO_EXE_INSTALL_PATH" ]; then
		[ ! -x "$MTO_EXE_INSTALL_PATH" ] && _die "mto is not executable. Try running\n\n  \$  yarn mto update"
		[ ! -L "$MTO_EXE_INSTALL_PATH" ] && _warn "$MTO_EXE_INSTALL_PATH is not a symbolic link. This means it was not installed with yarn mto install. Try running\n\n  \$  mto update" >&2
	else
		_warn "mto is not installed locally.\n    To install, run\n    $(_bold "\$ yarn mto install\n")" >&2
	fi
}

_mto_check_directory() {
	[ ! -f "$MTO_SH_BUILD_PATH" ] && _die "Running in incorrect directory $PWD"
	return 0
}

_mto_install() {
	if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
		_err "The path $HOME/.local/bin is not in the PATH."
		_red "     Current value of \$PATH"
		_red "$PATH"
		_red "     Add it to the \$PATH, restart your shell and try again"
		_die "Aborting"
	fi

	_log "Building mto"
	yarn mto:build >&2
	echo

	_log "Installing to $BIN_DIR"

	_create_symlink "$MTO_SH_BUILD_PATH" "$MTO_EXE_INSTALL_PATH"
	_create_symlink "$MTO_JS_BUILD_PATH" "$MTO_JS_INSTALL_PATH"
	_create_symlink "$MTO_COMPLETION_BUILD_PATH" "$MTO_COMPLETION_INSTALL_PATH"

	if [ ! -x "$MTO_EXE_INSTALL_PATH" ]; then
		_warn "$MTO_EXE_INSTALL_PATH is not executable, adding +x flag"
		chmod +x "$MTO_EXE_INSTALL_PATH"
	fi

	echo
	_mto_install_tab_completion
	echo
	_green "$(_log "Installation Complete")"
	_success "mto was installed to $BIN_DIR"
	echo
	echo "    For more information, run any of these commands"
	echo
	_green "    mto"
	_green "    yarn workspace @binders/mtutil cli"
	_green "    yarn mto"
	echo
}

_mto_uninstall() {
	echo
	_rm_symlink "$MTO_EXE_INSTALL_PATH"
	_rm_symlink "$MTO_JS_INSTALL_PATH"
	_rm_symlink "$MTO_COMPLETION_INSTALL_PATH"

	echo
	_log "Uninstall Tab Completion"
	has_completion=0
	if grep -q "$MTO_SOURCE_CMD" "$HOME/.bashrc"; then
		_warn "Tab Completion snippet was found in $HOME/.bashrc"
		has_completion=1
	fi
	if grep -q "$MTO_SOURCE_CMD" "$HOME/.zshrc"; then
		_warn "Tab Completion snippet was found in $HOME/.zshrc"
		has_completion=1
	fi

	if [[ $has_completion -eq 1 ]]; then
		_warn "You can remove it now. Search for"
		_warn "$(_bold "$MTO_SOURCE_CMD")"
	fi

	echo
	_success "mto has been uninstalled"
	_green "    To access the mto utility, run"
	_green "    yarn mto"
	echo
}

_mto_install_tab_completion() {
	echo
	_log "Install Tab Completion"

	local shellrc=""
	if [[ $SHELL == */bash ]]; then
		shellrc=".bashrc"
	elif [[ $SHELL == */zsh ]]; then
		shellrc=".zshrc"
	else
		_err "Unsupported shell $SHELL for tab completion"
	fi

	[ -z "$shellrc" ] && err "TabCompletionInstall: No supported shell found" && return
	shellrc_path=$(realpath "$HOME/$shellrc")
	[ ! -f "$shellrc_path" ] && err "TabCompletionInstall: rc file for shell $SHELL was not found at $shellrc" && return
	if grep -q "$MTO_SOURCE_CMD" "$shellrc_path"; then
		_info "Tab Completion already installed"
		return
	fi

	_info "To install the tab completion for mto,"
	_info "add the following line to your $(_bold "$shellrc")"
	_info "at $shellrc_path"
	_info "$(_bold "$MTO_SOURCE_CMD")"
	echo
	_info "Alternatively, run the following command"
	_info "$(_bold "echo \"$MTO_SOURCE_CMD\" >> $shellrc_path")"
	echo
}

_rm_symlink() {
	path="${1:-}"
	[ -z "$path" ] || [ "$path" = "/" ] && _die "Refusing to remove path '$path'"
	if [ -L "$path" ]; then
		rm "$path"
		_success "Removed $path"
	else
		_warn "$path is not a symbolic link"
	fi
}

_create_symlink() {
	source="$1"
	target="$2"
	if [ -e "$target" ]; then
		_warn "$target already exists, removing"
		rm "$target"
	fi
	echo "Linking $source -> $target"
	ln -s "$source" "$target"
}

CLR_BLUE='\033[34m'
CLR_RED='\033[31m'
CLR_GREEN='\033[32m'
CLR_YELLOW='\033[33m'
CLR_GRAY='\033[90m'
CLR_RESET='\e[0m'
CLR_BOLD='\e[1m'

_red() {
	echo -e "${CLR_RED}$*${CLR_RESET}"
}

_err() {
	_red "  \\ud7  $*" >&2
}

_warn() {
	echo -e "${CLR_YELLOW} ⚠  $*${CLR_RESET}" >&2
}

_die() {
	_err "$*"
	exit 1
}

_bold() {
	echo -e "${CLR_BOLD}$*${CLR_RESET}"
}

_log() {
	echo -e "${CLR_BOLD}==> $*${CLR_RESET}"
}

_dimmed() {
	echo -e "${CLR_GRAY}$*${CLR_RESET}"
}

_info() {
	echo -e "${CLR_BLUE} i  $*${CLR_RESET}"
}

_success() {
	_green " ✔  $*"
}

_green() {
	echo -e "${CLR_GREEN}$*${CLR_RESET}"
}

_mto_main "${@}"
