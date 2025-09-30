const autoprefixer = require("autoprefixer");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CaseSensitivePathsPlugin = require("case-sensitive-paths-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const getClientEnvironment = require("./env");
const paths = require("./paths");
const BrowserSyncPlugin = require("browser-sync-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");

// Webpack uses `publicPath` to determine where the app is being served from.
// In development, we always serve from the root. This makes config easier.
const publicPath = "/";
// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = "";
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
module.exports = {
    target: ["web", "es2020"],
    // You may want 'eval' instead if you prefer to see the compiled output in DevTools.
    // See the discussion in https://github.com/facebookincubator/create-react-app/issues/343.
    devtool: "cheap-module-source-map",
    // These are the "entry points" to our application.
    // This means they will be the "root" imports that are included in JS bundle.
    // The first two entry points enable "hot" CSS and auto-refreshes for JS.
    entry: {
        index: [
            // Include an alternative client for WebpackDevServer. A client's job is to
            // connect to WebpackDevServer by a socket and get notified about changes.
            // When you save a file, the client will either apply hot updates (in case
            // of CSS changes), or refresh the page (in case of JS changes). When you
            // make a syntax error, this client will display a syntax error overlay.
            // Note: instead of the default WebpackDevServer client, we use a custom one
            // to bring better experience for Create React App users. You can replace
            // the line below with these two lines if you prefer the stock client:
            // require.resolve('webpack-dev-server/client') + '?/',
            // require.resolve('webpack/hot/dev-server'),
            // require.resolve('react-dev-utils/webpackHotDevClient'),
            // We ship a few polyfills by default:
            require.resolve("./polyfills"),
            // Errors should be considered fatal in development
            require.resolve("react-error-overlay"),
            // Finally, this is your app's code:
            paths.appIndexJs
        ],
        login: [
            require.resolve("./polyfills"),
            // Errors should be considered fatal in development
            require.resolve("react-error-overlay"),
            // Finally, this is your app's code:
            paths.appLoginJs
        ]
    },
    output: {
        path: paths.appBuild,
        // Add /* filename */ comments to generated require()s in the output.
        pathinfo: true,
        // This does not produce a real file. It's just the virtual path that is
        // served by WebpackDevServer in development. This is the JS bundle
        // containing code from all our entry points, and the Webpack runtime.
        filename: "static/js/[name]-bundle.js",
        // There are also additional JS chunk files if you use code splitting.
        chunkFilename: "static/js/[name].chunk.js",
        // This is the URL that app is served from. We use "/" in development.
        publicPath: publicPath + "assets/",
        // Point sourcemap entries to original disk location (format as URL on Windows)
        devtoolModuleFilenameTemplate: info => path.resolve(info.absoluteResourcePath).replace(/\\/g, "/")
    },
    optimization: {
        moduleIds: "named"
    },
    resolve: {
        // This allows you to set a fallback for where Webpack should look for modules.
        // We read `NODE_PATH` environment variable in `paths.js` and pass paths here.
        // We placed these paths second because we want `node_modules` to "win"
        // if there are any conflicts. This matches Node resolution mechanism.
        // https://github.com/facebookincubator/create-react-app/issues/253
        modules: ["node_modules", paths.appNodeModules].concat(
            // It is guaranteed to exist because we tweak it in `env.js`
            process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
        ),
        // which extension auto search? you'll be able to do `require('./utils')` instead of `require('./utils.js')`
        // https://github.com/facebookincubator/create-react-app/issues/290
        extensions: [".js", ".json", ".jsx", ".ts", ".tsx", ".styl"],
        alias: {
            // Support React Native Web
            // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
            "react-native": "react-native-web",
            assets: path.resolve("public")
        },
        fallback: {
            url: require.resolve("url/"),
            util: false,
        }
    },
    module: {
        strictExportPresence: true,
        rules: [
            {
                // "oneOf" will traverse all following loaders until one will
                // match the requirements. When no loader matches it will fall
                // back to the "file" loader at the end of the loader list.
                oneOf: [
                    {
                        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
                        type: "asset/inline"
                    },
                    // HTML-Loader
                    // We use this in our case because our html files will also be parsed by express
                    // The html file might contain express template codes that might otherwise crash webpack
                    {
                        test: /\.html$/,
                        use: [
                            {
                                loader: require.resolve("html-loader"),
                                options: {
                                    minimize: true
                                }
                            }
                        ]
                    },
                    {
                        test: /\.(jsx?|tsx?)$/,
                        include: paths.appSrc,
                        exclude: /node_modules/,
                        use: [
                            {
                                loader: require.resolve("babel-loader"),
                            }
                        ]
                    },
                    // "postcss" loader applies autoprefixer to our CSS.
                    // "css" loader resolves paths in CSS and adds assets as dependencies.
                    // "style" loader turns CSS into JS modules that inject <style> tags.
                    // In production, we use a plugin to extract that CSS to a file, but
                    // in development "style" loader enables hot editing of CSS.
                    {
                        test: /\.css$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: require.resolve("css-loader"),
                                options: {
                                    importLoaders: 1
                                }
                            },
                            {
                                loader: require.resolve("postcss-loader"),
                                options: {
                                    // Necessary for external CSS imports to work
                                    // https://github.com/facebookincubator/create-react-app/issues/2677
                                    ident: "postcss",
                                    plugins: () => [
                                        require("postcss-flexbugs-fixes"),
                                        autoprefixer({
                                            browsers: [
                                                ">1%",
                                                "last 4 versions",
                                                "Firefox ESR",
                                                "not ie < 9" // React doesn't support IE8 anyway
                                            ],
                                            flexbox: "no-2009"
                                        })
                                    ]
                                }
                            }
                        ]
                    },
                    // "stylus" loader applies stylus parsing
                    // "css" loader resolves paths in CSS and adds assets as dependencies.
                    // "style" loader turns CSS into JS modules that inject <style> tags.
                    // In production, we use a plugin to extract that CSS to a file, but
                    // in development "style" loader enables hot editing of CSS.
                    {
                        test: /\.styl$/i,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: require.resolve("css-loader"),
                                options: {
                                    importLoaders: 1,
                                    sourceMap: true
                                }
                            },
                            {
                                loader: require.resolve("postcss-loader"),
                                options: {
                                    // Necessary for external CSS imports to work
                                    // https://github.com/facebookincubator/create-react-app/issues/2677
                                    ident: "postcss",
                                    plugins: () => [
                                        require("postcss-flexbugs-fixes"),
                                        autoprefixer({
                                            browsers: [
                                                ">1%",
                                                "last 4 versions",
                                                "Firefox ESR",
                                                "not ie < 9" // React doesn't support IE8 anyway
                                            ],
                                            flexbox: "no-2009"
                                        })
                                    ],
                                    sourceMap: true
                                }
                            },
                            {
                                loader: require.resolve("stylus-loader")
                            }
                        ]
                    },
                    // "file" loader makes sure those assets get served by WebpackDevServer.
                    // When you `import` an asset, you get its (virtual) filename.
                    // In production, they would get copied to the `build` folder.
                    // This loader doesn't use a "test" so it will catch all modules
                    // that fall through the other loaders.
                    {
                        // Exclude `js` files to keep "css" loader working as it injects
                        // it's runtime that would otherwise processed through "file" loader.
                        // Also exclude `html` and `json` extensions so they get processed
                        // by webpacks internal loaders.
                        exclude: [/\.m?js$/, /\.html$/, /\.json$/],
                        loader: require.resolve("file-loader"),
                        options: {
                            name: "static/media/[name].[hash:8].[ext]"
                        }
                    }
                ]
            }

            // ** STOP ** Are you adding a new loader?
            // Remember to add the new extension(s) to the "url" loader exclusion list.
        ]
    },
    plugins: [
        new ESLintPlugin({
            extensions: ["js", "jsx", "ts", "tsx"],
            files: paths.appSrc,
            failOnError: true,
            failOnWarning: false
        }),
        new MiniCssExtractPlugin({
        }),
        // Generates an `index.html` file with the <script> injected.
        new HtmlWebpackPlugin({
            inject: true,
            chunks: ["index"],
            template: paths.appHtml,
            filename: "index.html"
        }),
        new HtmlWebpackPlugin({
            inject: true,
            chunks: ["login"],
            template: paths.loginHtml,
            filename: "login.html"
        }),
        new HtmlWebpackPlugin({
            inject: true,
            chunks: ["blocked"],
            template: paths.blockedHtml,
            filename: "blocked.html"
        }),
        // This is necessary to emit hot updates (currently CSS only):
        new webpack.HotModuleReplacementPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                { context: "public", from: "logo.png" },
                { context: "public", from: "favicon*" },
            ]
        }),
        new CaseSensitivePathsPlugin(),
        new webpack.DefinePlugin(env.stringified),
        new BrowserSyncPlugin({
            host: "localhost",
            port: 3014,
            ui: {
                port: 3114
            },
            // proxy the Webpack Dev Server endpoint
            // (which should be serving on http://localhost:3100/)
            // through BrowserSync
            proxy: "http://localhost:8014",
            serverStatic: ["/assets", "/public"],
            logConnections: true,
            injectChanges: true,
            open: false
        })
    ],
    // Turn off performance hints during development because we don't do any
    // splitting or minification in interest of speed. These warnings become
    // cumbersome.
    performance: {
        hints: false
    },
    stats: {
        assets: false,
        cached: false,
        cachedAssets: false,
        children: false,
        chunks: false,
        chunkModules: false,
        chunkOrigins: false,
        colors: false,
        depth: false,
        entrypoints: false,
        errors: true,
        errorDetails: true,
        hash: false,
        modules: false,
        performance: false,
        providedExports: false,
        publicPath: false,
        reasons: false,
        source: false,
        timings: true,
        usedExports: false,
        version: false,
        warnings: true
    }
};
