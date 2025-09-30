import * as fs from "fs";
import { BaseStyleProps } from "./base";
import { BaseStyleRepository } from "./baseRepository";

export class CssTemplateBuilder<T extends BaseStyleProps> {
    constructor(private readonly baseStyleRepo: BaseStyleRepository<T>, private readonly cssTemplate: string) { }

    build(key: string): Promise<string> {
        return this.baseStyleRepo.get(key).then(baseStyle => {
            const cssTemplate = fs.readFileSync(this.cssTemplate, "utf8");
            return this.mapProps(baseStyle.getProps(), cssTemplate);
        })
    }

    /**
     * Replace the properties of the style in the template with the correct value
     * @param props 
     * @param template 
     */
    mapProps(props: BaseStyleProps, template: string): string{
        const VAR_PREFIX = "\\$\\$"; // in regex form
        const CUSTOM_STYLES_PLACEHOLDER = "\\#customStyles\\s*\\{([^}]*)\\}";

        Object.keys(props).forEach(prop => {
            let value;
            let regex;
            if(prop === "customTagsStyles") {
                // build correct css classes
                value = props[prop].reduce((acc, {tag, style}) => {
                    return `${acc}\n.chunk-content ${tag} { ${style} }`;
                }, "");
                regex = new RegExp(CUSTOM_STYLES_PLACEHOLDER, "g");

            } else {
                value = props[prop];
                regex = new RegExp(`${VAR_PREFIX}${prop}`, "g");
            }
            template = template.replace(regex, value);
        });
        
        
        return template;
    }
}