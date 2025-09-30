import { Answers, DistinctQuestion } from "inquirer";
import { endpointPrompt } from "./mtutil/endpoint/prompt";
import { i18nPrompt } from "./mtutil/i18n/prompt";
import inquirer from "inquirer";
import promptSuggest from "inquirer-prompt-suggest";
import tablePrompt from "inquirer-table-prompt";

const questions: DistinctQuestion[] = [
    {
        type: "list",
        name: "task",
        message: "Select a task",
        choices: ["Create endpoint", "Insert i18n string"],
    },
];

export async function mtutilTool(): Promise<void> {
    inquirer.registerPrompt("table", tablePrompt);
    inquirer.registerPrompt("suggest", promptSuggest);
    inquirer.prompt(questions).then(async (answers: Answers) => {
        if (answers.task === "Create endpoint") {
            await endpointPrompt();
        }
        if (answers.task === "Insert i18n string") {
            await i18nPrompt();
        }
    });
}

mtutilTool().catch(console.error)
