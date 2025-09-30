export default (includeGhentianDialect = false): { [languageCode: string]: Record<string, unknown> } => ({
    ...(includeGhentianDialect ?
        {
            "nl": {
                "nl-GH": {
                    "nativeName": "Gents",
                    "name": "Ghentian"
                }
            }
        } :
        {}
    ),
    "de": {
        "de-DE": {
            "nativeName": "Deutsch (Deutschland)",
            "name": "German (Germany)"
        },
        "de-AT": {
            "nativeName": "Deutsch (Österreich)",
            "name": "German (Austria)"
        },
        "de-CH": {
            "nativeName": "Deutsch (Schweiz)",
            "name": "German (Switzerland)"
        }
    },
    "en": {
        "en-GB": {
            "nativeName": "English (UK)",
            "name": "English (UK)"
        },
        "en-US": {
            "nativeName": "English (US)",
            "name": "English (US)"
        }
    },
    "es": {
        "es-ES": {
            "nativeName": "Español (España)",
            "name": "Spanish (Spain)"
        },
        "es-AR": {
            "nativeName": "Español (Argentina)",
            "name": "Spanish (Argentina)"
        },
        "es-BO": {
            "nativeName": "Español (Bolivia)",
            "name": "Spanish (Bolivia)"
        },
        "es-CL": {
            "nativeName": "Español (Chile)",
            "name": "Spanish (Chile)"
        },
        "es-CO": {
            "nativeName": "Español (Colombia)",
            "name": "Spanish (Colombia)"
        },
        "es-CR": {
            "nativeName": "Español (Costa Rica)",
            "name": "Spanish (Costa Rica)"
        },
        "es-DO": {
            "nativeName": "Español (República Dominicana)",
            "name": "Spanish (Dominican Republic)"
        },
        "es-EC": {
            "nativeName": "Español (Ecuador)",
            "name": "Spanish (Ecuador)"
        },
        "es-SV": {
            "nativeName": "Español (El Salvador)",
            "name": "Spanish (El Salvador)"
        },
        "es-GT": {
            "nativeName": "Español (Guatemala)",
            "name": "Spanish (Guatemala)"
        },
        "es-HN": {
            "nativeName": "Español (Honduras)",
            "name": "Spanish (Honduras)"
        },
        "es-MX": {
            "nativeName": "Español (México)",
            "name": "Spanish (Mexico)"
        },
        "es-NI": {
            "nativeName": "Español (Nicaragua)",
            "name": "Spanish (Nicaragua)"
        },
        "es-PA": {
            "nativeName": "Español (Panamá)",
            "name": "Spanish (Panama)"
        },
        "es-PY": {
            "nativeName": "Español (Paraguay)",
            "name": "Spanish (Paraguay)"
        },
        "es-PE": {
            "nativeName": "Español (Perú)",
            "name": "Spanish (Peru)"
        },
        "es-PR": {
            "nativeName": "Español (Puerto Rico)",
            "name": "Spanish (Puerto Rico)"
        },
        "es-UY": {
            "nativeName": "Español (Uruguay)",
            "name": "Spanish (Uruguay)"
        },
        "es-VE": {
            "nativeName": "Español (Venezuela)",
            "name": "Spanish (Venezuela)"
        }
    },
    "fr": {
        "fr-CA": {
            "nativeName": "Français (Canada)",
            "name": "French (Canada)"
        },
        "fr-FR": {
            "nativeName": "Français (France)",
            "name": "French (France)"
        }
    },
    "pt": {
        "pt-BR": {
            "nativeName": "Português (Brasil)",
            "name": "Portuguese (Brazil)"
        },
        "pt-PT": {
            "nativeName": "Português (Portugal)",
            "name": "Portuguese (Portugal)"
        }
    },
    "zh": {
        "zh-CN": {
            "nativeName": "中文 (简体)",
            "name": "Chinese (Simplified)"
        },
        "zh-TW": {
            "nativeName": "正體中文 (繁體)",
            "name": "Chinese (Traditional)"
        }
    }
});
