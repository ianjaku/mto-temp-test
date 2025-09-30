const orange = "\x1b[38;5;17;48;5;214m";
const white = "\x1b[38;5;17;48;5;231m";
const black = "\x1b[38;5;0;48;5;231m";
const boldBlack = "\x1b[1;38;5;0;48;5;231m";
const clear = "\x1b[0m";

const title = "Manualto CLI Utility".padStart(23);
const version = "v0.0.1".padStart(23);

export default `  ${orange}                                      ${clear}
${orange}     ${white}                               ${orange}      ${clear}
${orange}   ${white}                                   ${orange}    ${clear}
${orange}   ${white}                                   ${orange}    ${clear}
${orange}   ${white}                                   ${orange}    ${clear}
${orange}   ${white}      ${clear}            ${white} ${clear}        ${white}        ${orange}    ${clear}
${orange}   ${white}      ${clear}     ${white}    ${clear}     ${white}    ${clear}    ${white}       ${orange}    ${clear}
${orange}   ${white}      ${clear}    ${white}     ${clear}    ${white}      ${clear}    ${white}      ${orange}    ${clear}
${orange}   ${white}      ${clear}    ${white}     ${clear}    ${white}      ${clear}    ${white}      ${orange}    ${clear}
${orange}   ${white}      ${clear}    ${white}     ${clear}    ${white}      ${clear}    ${white}      ${orange}    ${clear}
${orange}   ${white}      ${clear}    ${white}     ${clear}    ${white}      ${clear}    ${white}      ${orange}    ${clear}
${orange}   ${white}                                   ${orange}    ${clear}
${orange}   ${white}      ${boldBlack}${title}${white}      ${orange}    ${clear}
${orange}   ${white}      ${black}${version}${white}      ${orange}    ${clear}
${orange}     ${white}                               ${orange}      ${clear}
${orange}                            ${white}    ${orange}          ${clear}
  ${orange}                                      ${clear}
`;
