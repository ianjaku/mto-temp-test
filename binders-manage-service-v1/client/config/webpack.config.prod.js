const autoprefixer = require("autoprefixer");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");

const paths = require("./paths");
const getClientEnvironment = require("./env");

// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
const publicPath = paths.servedPath;
// Some apps do not use client-side routing with pushState.
// For these, "homepage" can be set to "." to enable relative asset paths.
const shouldUseRelativeAssetPaths = publicPath === "./";
// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
const publicUrl = publicPath.slice(0, -1);
// Get environment variables to inject into our app.
const env = getClientEnvironment(publicUrl);

// Assert this just to be safe.
// Development builds of React are slow and not intended for production.
// eslint-disable-next-line
if (env.stringified["process.env"].NODE_ENV !== '"production"') {
    throw new Error("Production builds must have NODE_ENV=production.");
}

// Note: defined here because it will be used more than once.
const cssFilename = "[name].css";

// ExtractTextPlugin expects the build output to be flat.
// (See https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/27)
// However, our output is structured with css, js and media folders.
// To have this structure working with relative paths, we have to use custom options.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const extractTextPluginOptions = shouldUseRelativeAssetPaths ?
    { publicPath: Array(cssFilename.split("/").length).join("../") } :
    {};

// This is the production configuration.
// It compiles slowly and is focused on producing a fast and minimal bundle.
// The development configuration is different and lives in a separate file.
module.exports = {
    target: ["web", "es2020"],
    // Don't attempt to continue if there are any errors.
    bail: true,
    // We generate sourcemaps in production. This is slow but gives good results.
    // You can exclude the *.map files from the build during deployment.
    devtool: false,
    // In production, we only want to load the polyfills and the app code.
    entry: {
        index: [require.resolve("./polyfills"), paths.appIndexJs],
        login: ["./src/vars.styl", "./src/login.styl"]
    },
    output: {
        // The build folder.
        path: paths.appBuild,
        // Generated JS file names (with nested folders).
        // There will be one main bundle, and one file per asynchronous chunk.
        // We don't currently advertise code splitting but Webpack supports it.
        filename: "static/js/[name].[chunkhash:8].js",
        chunkFilename: "static/js/[name].[chunkhash:8].chunk.js",
        // We inferred the "public path" (such as / or /my-project) from homepage.
        publicPath: publicPath + "assets/",
        // Point sourcemap entries to original disk location (format as URL on Windows)
        devtoolModuleFilenameTemplate: info => path.relative(paths.appSrc, info.absoluteResourcePath).replace(/\\/g, "/")
    },
    resolve: {
        // This allows you to set a fallback for where Webpack should look for modules.
        // We placed these paths second because we want `node_modules` to "win"
        // if there are any conflicts. This matches Node resolution mechanism.
        // https://github.com/facebookincubator/create-react-app/issues/253
        modules: ["node_modules", paths.appNodeModules].concat(
            // It is guaranteed to exist because we tweak it in `env.js`
            process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
        ),
        // These are the reasonable defaults supported by the Node ecosystem.
        // We also include JSX as a common component filename extension to support
        // some tools, although we do not recommend using it, see:
        // https://github.com/facebookincubator/create-react-app/issues/290
        // `web` extension prefixes have been added for better support
        // for React Native Web.
        extensions: [".js", ".json", ".jsx", ".ts", ".tsx", ".styl"],
        plugins: [
            // Prevents users from importing files from outside of src/ (or node_modules/).
            // This often causes confusion because we only process files within src/ with babel.
            // To fix this, we prevent you from importing files out of src/ -- if you'd like to,
            // please link the files into your node_modules/ and let module-resolution kick in.
            // Make sure your source files are compiled, as they will not be processed in any way.
            // new ModuleScopePlugin(paths.appSrc)
        ],
        alias: {
            // Support React Native Web
            // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
            "react-native": "react-native-web",
            assets: path.resolve("public")
        },
        fallback: {
            util: false
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
                        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.svg$/, /\.png$/],
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
                        test: /\.(js|jsx|ts|tsx)$/,
                        loader: "babel-loader",
                        options: {
                            presets: [
                                [ "@babel/preset-env" ]
                            ],
                            cacheDirectory: true,
                            exclude : [
                                /\bcore-js\b/,
                                /\bwebpack\/buildin\b/
                            ]
                        }
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
                                    minimize: true,
                                    sourceMap: false
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
                                    sourceMap: false
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
            // failOnWarning: true,
            files: paths.appSrc,
            failOnError: false,
            failOnWarning: false
        }),
        // Generates an `index.html` file with the <script> injected.
        new HtmlWebpackPlugin({
            inject: true,
            filename: "index.html",
            template: paths.appHtml,
            chunks: ["index"],
            minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true
            }
        }),
        new HtmlWebpackPlugin({
            inject: true,
            filename: "login.html",
            template: paths.loginHtml,
            chunks: ["login"],
            minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true
            }
        }),
        new HtmlWebpackPlugin({
            inject: true,
            filename: "blocked.html",
            template: paths.blockedHtml,
            chunks: ["blocked"],
            minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true
            }
        }),
        // Makes some environment variables available to the JS code, for example:
        // if (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
        // It is absolutely essential that NODE_ENV was set to production here.
        // Otherwise React will be compiled in the very slow development mode.
        new webpack.DefinePlugin(env.stringified),
        // Minify the code.
        // Note: this won't work without ExtractTextPlugin.extract(..) in `loaders`.
        new MiniCssExtractPlugin({

        }),
        new CopyWebpackPlugin({
            patterns: [
                { context: "public/assets", from: "logo.png" },
                { context: "public", from: "favicon*" },
            ]
        }),
        // Generate a manifest file which contains a mapping of all asset filenames
        // to their corresponding output file so that tools can pick it up without
        // having to parse `index.html`.
        new WebpackManifestPlugin({
            fileName: "asset-manifest.json"
        }),
    ]
};
