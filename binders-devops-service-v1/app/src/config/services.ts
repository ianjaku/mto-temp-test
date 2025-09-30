export interface IServiceSpec {
    name: string;
    version: "v1" | "v2" | "v3";
    port: number;
    extraPorts?: number[];
    replicas?: number;
    isFrontend?: boolean;
    isWorker?: boolean;
    domains?: string[];
    extraIngressPaths?: string[];
    sharedDeployment?: string;
    folder?: string;
    extraPackagesToInstall?: string[];
    extraDirsToCopy?: string[];
    extraDebPackagesToInstall?: IDebPackageSpec[];
    compilers?: DevTypeScriptCompiler[];
    minReplicas?: number
    maxReplicas?: number
    webAppBundler?: WebAppBundler[];
    redisQueueName?: string
}

export interface IDebPackageSpec {
    debFile: string;
    url: string;
}

export enum DevTypeScriptCompiler {
    Tsc = "tsc",
    Esbuild = "esbuild",
}

export enum WebAppBundler {
    Webpack = "webpack",
    Vite = "vite",
}

export const BINDERS_SERVICE_SPECS: IServiceSpec[] = [
    {
        name: "account",
        version: "v1",
        port: 8001,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        minReplicas: 2,
        maxReplicas: 6
    },
    {
        name: "authorization",
        version: "v1",
        port: 8002,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "comment",
        version: "v1",
        port: 8011,
        sharedDeployment: "binders"
    },
    {
        name: "content",
        version: "v1",
        port: 8011,
        sharedDeployment: "binders"
    },
    {
        name: "credential",
        version: "v1",
        port: 8004,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        minReplicas: 2,
        maxReplicas: 6
    },
    {
        name: "editor",
        version: "v2",
        port: 8006,
        isFrontend: true,
        extraPorts: [8096],
        webAppBundler: [WebAppBundler.Webpack, WebAppBundler.Vite],
        domains: [
            "editor.manual.to",
            "*.editor.manual.to"
        ],
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "export",
        version: "v1",
        port: 8011,
        sharedDeployment: "binders"
    },
    {
        name: "image",
        version: "v1",
        port: 8007,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        extraIngressPaths: [
            "/images/v1"
        ],
        extraPackagesToInstall: [
            "gifsicle", "ffmpeg", "libde265-0", "libde265-dev", "unifont"
        ],
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "manage",
        version: "v1",
        port: 8008,
        isFrontend: true,
        extraPorts: [8098],
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        webAppBundler: [WebAppBundler.Vite],
        domains: [
            "manage.binders.media"
        ],
        replicas: 1
    },
    {
        name: "notification",
        version: "v1",
        port: 8010,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "binders",
        version: "v3",
        port: 8011,
        folder: "binders-repository-service-v3",
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        extraPackagesToInstall: [
            "xfonts-75dpi",
            "xfonts-base",
            "ttf-wqy-microhei",
            "ttf-wqy-zenhei"
        ],
        extraDebPackagesToInstall: [
            {
                debFile: "libpng12-0_1.2.50-2+deb8u3_amd64.deb",
                url: "http://ftp.de.debian.org/debian/pool/main/libp/libpng/libpng12-0_1.2.50-2+deb8u3_amd64.deb"
            },
            {
                debFile: "libssl1.0.0_1.0.1t-1+deb8u12_amd64.deb",
                url: "http://security.debian.org/debian-security/pool/updates/main/o/openssl/libssl1.0.0_1.0.1t-1+deb8u12_amd64.deb"
            },
            {
                debFile: "wkhtmltox_0.12.5-1.jessie_amd64.deb",
                url: "https://github.com/wkhtmltopdf/wkhtmltopdf/releases/download/0.12.5/wkhtmltox_0.12.5-1.jessie_amd64.deb"
            }
        ],
        minReplicas: 3,
        maxReplicas: 6
    },
    {
        name: "routing",
        version: "v1",
        port: 8011,
        sharedDeployment: "binders"
    },
    {
        name: "static-pages",
        version: "v1",
        port: 8080,
        extraPorts: [8081, 8082]
    },
    {
        name: "tracking",
        version: "v1",
        port: 8012,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        minReplicas: 3,
        maxReplicas: 6

    },
    {
        name: "user",
        version: "v1",
        port: 8013,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        extraDirsToCopy: ["static"],
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "manualto",
        version: "v1",
        port: 8014,
        isFrontend: true,
        domains: [
            "*.manual.to"
        ],
        folder: "manualto-service-v1",
        minReplicas: 2,
        maxReplicas: 6

    },
    {
        name: "dashboard",
        version: "v1",
        port: 8015,
        extraPorts: [8095],
        domains: [
            "dashboard.binders.media"
        ],
        webAppBundler: [WebAppBundler.Vite],
        isFrontend: true,
        replicas: 1
    },
    {
        name: "devops",
        version: "v1",
        port: 8016,
        replicas: 1
    },
    {
        name: "public-api",
        version: "v1",
        port: 8017,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        extraIngressPaths: [
            "/public/v1"
        ]
    },
    {
        name: "partners",
        version: "v1",
        port: 8019,
        isFrontend: true,
        replicas: 1,
        domains: [
            "partners.binders.media",
            "*.partners.binders.media"
        ]
    },
    {
        name: "screenshot",
        version: "v1",
        port: 8020,
        isWorker: true,
        compilers: [DevTypeScriptCompiler.Esbuild, DevTypeScriptCompiler.Tsc],
        extraPackagesToInstall: [
            "ffmpeg"
        ],
        replicas: 0,
        redisQueueName: "screenshot-queue"
    }
];

export const BINDERS_SERVICE_SPECS_BY_NAME = BINDERS_SERVICE_SPECS.reduce((acc, service) => {
    acc[service.name] = service;
    return acc;
}, {} as Record<string, IServiceSpec>);


export const getServiceDir = (spec: IServiceSpec) => spec.folder || `binders-${spec.name}-service-${spec.version}`;

export const BINDERS_SERVICE_DIRS = BINDERS_SERVICE_SPECS
    .filter(spec => !spec.sharedDeployment)
    .map(getServiceDir);

const BINDERS_FRONT_END_SERVICES_DIRS = BINDERS_SERVICE_SPECS
    .filter(spec => spec.isFrontend && !spec.sharedDeployment)
    .map(getServiceDir);


export const isFrontendServiceDirectory = (dir: string): boolean => BINDERS_FRONT_END_SERVICES_DIRS.includes(dir);

export function isFrontendContainer(containerImageName: string): boolean {
    const [name, version] = containerImageName.split("-");
    for (const service of BINDERS_SERVICE_SPECS) {
        if (service.name === name && service.version === version) {
            return service.isFrontend ?? false;
        }
    }
    return false;
}
